// Turns whatever error shape IntaSend's API sends back into a plain,
// human-readable string — never an object, so the browser can never end
// up rendering the literal text "[object Object]".
//
// IntaSend (like most Django REST Framework APIs) doesn't use one
// consistent error shape. Depending on what went wrong, the JSON body
// can look like any of:
//   { "detail": "Some message" }
//   { "message": "Some message" }
//   { "errors": ["Some message", "Another message"] }
//   { "errors": [{ "message": "Some message" }, ...] }   <- array of OBJECTS
//   { "email": ["Enter a valid email address."] }         <- field-errors dict,
//                                                             no detail/message/errors wrapper at all
//
// The bug that caused "[object Object]" to show up to real users was the
// "array of objects" case: the old code did
//   intasendResult.errors.join(", ")
// and Array.prototype.join calls toString() on every element — which for
// a plain object is literally the string "[object Object]". That string
// then passed every `typeof x === "string"` guard downstream (it really
// is a string!) and sailed straight through to the user.
//
// This walks the whole structure recursively instead of assuming any one
// field is a plain string, so nested objects get their actual text pulled
// out instead of being stringified.
function fromValue(value: unknown): string {
  if (typeof value === "string") return value;

  if (Array.isArray(value)) {
    return value
      .map(fromValue)
      .filter(Boolean)
      .join(", ");
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.message === "string" && obj.message) return obj.message;
    if (typeof obj.detail === "string" && obj.detail) return obj.detail;

    const parts = Object.entries(obj)
      .map(([key, val]) => {
        const msg = fromValue(val);
        return msg ? key + ": " + msg : "";
      })
      .filter(Boolean);
    if (parts.length) return parts.join("; ");
  }

  return "";
}

export function extractIntasendError(result: any): string {
  if (!result || typeof result !== "object") return "";

  if (typeof result.detail === "string" && result.detail) return result.detail;
  if (typeof result.message === "string" && result.message) return result.message;

  if (result.errors !== undefined) {
    const msg = fromValue(result.errors);
    if (msg) return msg;
  }
  if (result.detail !== undefined) {
    const msg = fromValue(result.detail);
    if (msg) return msg;
  }
  if (result.message !== undefined) {
    const msg = fromValue(result.message);
    if (msg) return msg;
  }

  // Fallback: the whole body itself may just be a field-errors dict with
  // no detail/message/errors wrapper, e.g. {"email": ["Enter a valid
  // email address."]}.
  const topLevelKeys = Object.keys(result).filter((k) => !["detail", "message", "errors"].includes(k));
  if (topLevelKeys.length) {
    const parts = topLevelKeys
      .map((k) => {
        const msg = fromValue(result[k]);
        return msg ? k + ": " + msg : "";
      })
      .filter(Boolean);
    if (parts.length) return parts.join("; ");
  }

  return "";
}
