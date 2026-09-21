// Small helpers for the "Download CSV" buttons. The file is built in the
// browser from the rows already on the screen, so nothing extra is asked of
// the server. A leading byte-order mark makes Excel read the accents and
// symbols correctly.

// A text cell that starts with = + - or @ would be run as a formula when the
// file is opened in Excel, so it gets a leading apostrophe. Plain numbers and
// phone numbers such as +254 712 345 678 are left alone.
function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text) && !/^[+-]?[\d.,\s]+$/.test(text)) text = "'" + text;
  if (/[",\n\r]/.test(text)) text = '"' + text.replace(/"/g, '""') + '"';
  return text;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function downloadCsv(fileName: string, header: string[], rows: unknown[][]) {
  const blob = new Blob([String.fromCharCode(0xfeff) + toCsv(header, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// "2026-09-21" - used in file names.
export function todayForFileName(): string {
  const now = new Date();
  return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
}
