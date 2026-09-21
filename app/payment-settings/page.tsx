"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { cleanAccountPrefix, cleanPaybill, paybillAccount } from "@/lib/paybill";
import { cleanDueDay, ordinal } from "@/lib/reminder-rules";

export default function PaymentSettingsPage() {
const router = useRouter();
const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);
const [message, setMessage] = useState("");
const [accessToken, setAccessToken] = useState("");

const [mpesaEnabled, setMpesaEnabled] = useState(false);
const [shortcodeType, setShortcodeType] = useState("paybill");
const [shortcode, setShortcode] = useState("");
const [consumerKey, setConsumerKey] = useState("");
const [consumerKeySet, setConsumerKeySet] = useState(false);
const [consumerSecret, setConsumerSecret] = useState("");
const [consumerSecretSet, setConsumerSecretSet] = useState(false);
const [passkey, setPasskey] = useState("");
const [passkeySet, setPasskeySet] = useState(false);

const [manualMpesaEnabled, setManualMpesaEnabled] = useState(false);
const [manualMpesaType, setManualMpesaType] = useState("till");
const [manualMpesaNumber, setManualMpesaNumber] = useState("");
const [manualMpesaName, setManualMpesaName] = useState("");

const [bankEnabled, setBankEnabled] = useState(false);
const [bankName, setBankName] = useState("");
const [bankAccountName, setBankAccountName] = useState("");
const [bankAccountNumber, setBankAccountNumber] = useState("");
const [bankBranch, setBankBranch] = useState("");

const [paybillNumber, setPaybillNumber] = useState("");
const [paybillAccountPrefix, setPaybillAccountPrefix] = useState("");
const [dueDay, setDueDay] = useState("5");
const [penalties, setPenalties] = useState(true);

useEffect(() => {
async function init() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) { router.push("/landlord/login"); return; }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token || "";
  setAccessToken(token);

  const res = await fetch("/api/payment-settings", { headers: { Authorization: "Bearer " + token } });
  const settings = await res.json();

  setMpesaEnabled(!!settings.mpesa_enabled);
  setShortcodeType(settings.mpesa_shortcode_type || "paybill");
  setShortcode(settings.mpesa_shortcode || "");
  setConsumerKeySet(!!settings.mpesa_consumer_key_set);
  setConsumerSecretSet(!!settings.mpesa_consumer_secret_set);
  setPasskeySet(!!settings.mpesa_passkey_set);
  setManualMpesaEnabled(!!settings.manual_mpesa_enabled);
  setManualMpesaType(settings.manual_mpesa_type || "till");
  setManualMpesaNumber(settings.manual_mpesa_number || "");
  setManualMpesaName(settings.manual_mpesa_name || "");
  setBankEnabled(!!settings.bank_enabled);
  setBankName(settings.bank_name || "");
  setBankAccountName(settings.bank_account_name || "");
  setBankAccountNumber(settings.bank_account_number || "");
  setBankBranch(settings.bank_branch || "");
  setPaybillNumber(settings.paybill_number || "");
  setPaybillAccountPrefix(settings.paybill_account || "");
  setDueDay(String(settings.reminder_due_day ?? 5));
  setPenalties(settings.reminder_penalties !== false);

  setLoading(false);
}
init();
}, [router]);

async function save() {
setSaving(true);
setMessage("");
try {
  const res = await fetch("/api/payment-settings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + accessToken },
    body: JSON.stringify({
      mpesa_enabled: mpesaEnabled,
      mpesa_shortcode_type: shortcodeType,
      mpesa_shortcode: shortcode,
      mpesa_consumer_key: consumerKey,
      mpesa_consumer_secret: consumerSecret,
      mpesa_passkey: passkey,
      manual_mpesa_enabled: manualMpesaEnabled,
      manual_mpesa_type: manualMpesaType,
      manual_mpesa_number: manualMpesaNumber,
      manual_mpesa_name: manualMpesaName,
      bank_enabled: bankEnabled,
      bank_name: bankName,
      bank_account_name: bankAccountName,
      bank_account_number: bankAccountNumber,
      bank_branch: bankBranch,
      paybill_number: paybillNumber,
      paybill_account: paybillAccountPrefix,
      reminder_due_day: dueDay,
      reminder_penalties: penalties,
    }),
  });
  const result = await res.json();
  if (!res.ok) {
    setMessage("Error saving: " + (result.error || "unknown error"));
  } else {
    setMessage("Payment settings saved.");
    if (consumerKey) { setConsumerKeySet(true); setConsumerKey(""); }
    if (consumerSecret) { setConsumerSecretSet(true); setConsumerSecret(""); }
    if (passkey) { setPasskeySet(true); setPasskey(""); }
  }
} catch (err: any) {
  setMessage("Error saving: " + err.message);
} finally {
  setSaving(false);
}
}

if (loading) {
return (<main className="min-h-screen city-skyline-page flex items-center justify-center text-slate-500">Loading your payment settings...</main>);
}

return (
<main className="min-h-screen city-skyline-page">
<div className="h-1 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400" />
<header className="border-b bg-white">
<div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
<div>
<h1 className="text-2xl font-bold text-slate-900">MANAGIKA HOMES</h1>
<p className="text-sm text-slate-500">Property Management Made Simple</p>
</div>
<a href="/landlord/dashboard" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50">Dashboard</a>
</div>
</header>

  <section className="mx-auto max-w-3xl px-6 py-8">
    <div className="mb-8 flex items-center gap-4">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 text-3xl">💳</span>
      <div>
        <h2 className="text-3xl font-bold text-slate-900">Payment Settings</h2>
        <p className="mt-1 text-slate-500">Connect your own automated M-Pesa Paybill/Till, manual M-Pesa, or bank account so tenant payments come straight to you.</p>
      </div>
    </div>

    {message && (
      <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">{message}</div>
    )}

    <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
      <label className="flex items-center gap-3">
        <input type="checkbox" checked={mpesaEnabled} onChange={(e) => setMpesaEnabled(e.target.checked)} className="h-5 w-5" />
        <span className="text-lg font-semibold text-slate-900">Accept M-Pesa payments</span>
      </label>
      <p className="mt-1 text-sm text-slate-500">Have your own Paybill or Till Number? We&rsquo;ll help you get it connected — just reach out to our team once you&rsquo;ve entered your details below.</p>

      {mpesaEnabled && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Shortcode Type</label>
            <select value={shortcodeType} onChange={(e) => setShortcodeType(e.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500">
              <option value="paybill">Paybill</option>
              <option value="till">Till Number</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Shortcode (Paybill/Till Number)</label>
            <input type="text" value={shortcode} onChange={(e) => setShortcode(e.target.value)} placeholder="e.g. 400200" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Consumer Key {consumerKeySet && <span className="text-emerald-600">(saved)</span>}</label>
            <input type="password" value={consumerKey} onChange={(e) => setConsumerKey(e.target.value)} placeholder={consumerKeySet ? "Leave blank to keep current" : "Paste your Consumer Key"} className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Consumer Secret {consumerSecretSet && <span className="text-emerald-600">(saved)</span>}</label>
            <input type="password" value={consumerSecret} onChange={(e) => setConsumerSecret(e.target.value)} placeholder={consumerSecretSet ? "Leave blank to keep current" : "Paste your Consumer Secret"} className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Passkey {passkeySet && <span className="text-emerald-600">(saved)</span>}</label>
            <input type="password" value={passkey} onChange={(e) => setPasskey(e.target.value)} placeholder={passkeySet ? "Leave blank to keep current" : "Paste your Passkey"} className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500" />
          </div>
        </div>
      )}
    </div>

    <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
      <label className="flex items-center gap-3">
        <input type="checkbox" checked={manualMpesaEnabled} onChange={(e) => setManualMpesaEnabled(e.target.checked)} className="h-5 w-5" />
        <span className="text-lg font-semibold text-slate-900">Accept M-Pesa manually (no Paybill needed)</span>
      </label>
      <p className="mt-1 text-sm text-slate-500">Tenants send money the normal way to your Till Number or phone number - you mark invoices paid yourself once you see it land. No Safaricom application required.</p>

      {manualMpesaEnabled && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Type</label>
            <select value={manualMpesaType} onChange={(e) => setManualMpesaType(e.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500">
              <option value="till">Till Number</option>
              <option value="phone">Phone Number</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">{manualMpesaType === "till" ? "Till Number" : "Phone Number"}</label>
            <input type="text" value={manualMpesaNumber} onChange={(e) => setManualMpesaNumber(e.target.value)} placeholder={manualMpesaType === "till" ? "e.g. 123456" : "e.g. 0712345678"} className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Account/Recipient Name</label>
            <input type="text" value={manualMpesaName} onChange={(e) => setManualMpesaName(e.target.value)} placeholder="Name tenants will see" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500" />
          </div>
        </div>
      )}
    </div>

    <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
      <label className="flex items-center gap-3">
        <input type="checkbox" checked={bankEnabled} onChange={(e) => setBankEnabled(e.target.checked)} className="h-5 w-5" />
        <span className="text-lg font-semibold text-slate-900">Accept bank transfers</span>
      </label>
      <p className="mt-1 text-sm text-slate-500">Your bank details are shown to tenants as payment instructions - you mark invoices paid manually once you see the transfer.</p>

      {bankEnabled && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Bank Name</label>
            <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Equity Bank" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Account Name</label>
            <input type="text" value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} placeholder="Account holder name" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Account Number</label>
            <input type="text" value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Branch (optional)</label>
            <input type="text" value={bankBranch} onChange={(e) => setBankBranch(e.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500" />
          </div>
        </div>
      )}
    </div>

    <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Paybill for rent reminders</h3>
      <p className="mt-1 text-sm text-slate-500">If your tenants pay to a Paybill, enter it here. Every rent reminder (SMS and WhatsApp) and every tenant&rsquo;s dashboard will then tell them exactly where to pay. Leave it empty to send reminders without payment details.</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Paybill number</label>
          <input type="text" inputMode="numeric" value={paybillNumber} onChange={(e) => setPaybillNumber(e.target.value)} placeholder="e.g. 222111" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Account number (the part before the #)</label>
          <input type="text" value={paybillAccountPrefix} onChange={(e) => setPaybillAccountPrefix(e.target.value)} placeholder="e.g. 27833" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500" />
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">Each tenant&rsquo;s house number is added after the # so you can tell who paid. Leave the account empty to use just the house number.</p>

      {cleanPaybill(paybillNumber) && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">A tenant in house A14 will be told to pay:</p>
          <p className="mt-1">Paybill <strong>{cleanPaybill(paybillNumber)}</strong>, Account <strong>{paybillAccount({ paybill: cleanPaybill(paybillNumber), accountPrefix: cleanAccountPrefix(paybillAccountPrefix) }, "A14")}</strong></p>
        </div>
      )}
      {paybillNumber.trim() !== "" && !cleanPaybill(paybillNumber) && (
        <p className="mt-4 text-sm text-red-600">A Paybill number is 5 to 7 digits, like 222111.</p>
      )}
    </div>

    <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Rent reminder rules</h3>
      <p className="mt-1 text-sm text-slate-500">Set the rules your tenants&rsquo; rent reminders talk about, so the message matches how you really run your houses.</p>

      <div className="mt-5 max-w-xs">
        <label className="mb-2 block text-sm font-medium text-slate-700">Rent is due on day (1 to 28) of each month</label>
        <input type="text" inputMode="numeric" value={dueDay} onChange={(e) => setDueDay(e.target.value)} placeholder="e.g. 5" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500" />
      </div>
      {dueDay.trim() !== "" && cleanDueDay(dueDay) === null && (
        <p className="mt-2 text-sm text-red-600">Please enter a day from 1 to 28, like 5.</p>
      )}

      <label className="mt-5 flex items-start gap-3">
        <input type="checkbox" checked={penalties} onChange={(e) => setPenalties(e.target.checked)} className="mt-1 h-4 w-4" />
        <span className="text-sm text-slate-700">Late rent has penalties. Reminders will say &ldquo;avoid penalties&rdquo;. Untick this if you do not charge penalties.</span>
      </label>

      <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <p className="font-semibold">Your SMS reminders will say:</p>
        <p className="mt-1">Rent is due by the {ordinal(cleanDueDay(dueDay) ?? 5)}. {penalties ? "Please pay on time to avoid penalties." : "Please pay on time."}</p>
      </div>
      <p className="mt-2 text-xs text-slate-500">WhatsApp reminders use wording approved by Meta, which mentions penalties (and, when no Paybill is set, the 5th). If that does not match your settings, tenants get the SMS only, so nobody is told something untrue.</p>
    </div>

    <button onClick={save} disabled={saving} className="rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
      {saving ? "Saving..." : "Save Payment Settings"}
    </button>
  </section>

  <footer className="mt-10 border-t bg-white">
    <div className="mx-auto max-w-7xl px-6 py-6 text-sm text-slate-500">© 2026 Managika Homes. Property management made simple.</div>
  </footer>
</main>

);
}
