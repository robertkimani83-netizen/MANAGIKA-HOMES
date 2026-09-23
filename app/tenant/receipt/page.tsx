"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { trPeriod, useTenantLang } from "@/lib/tenant-i18n";

// A printable rent receipt for one payment, opened from the "Receipt" link in
// the tenant's Payment History (/tenant/receipt?id=<payment id>). The tenant
// can print it or save it as a PDF from their phone or computer.
//
// Access is enforced by the database, not by this page: a tenant can only read
// their own payments, so a receipt id that is not theirs simply comes back
// empty and the page says it could not be found.

type Receipt = {
  id: string;
  amount: number;
  method: string;
  reference: string | null;
  paidAt: string | null;
  invoiceNumber: string | null;
  period: string;
  totalDue: number;
  paidToDate: number;
  tenantName: string;
  tenantPhone: string | null;
  unitNumber: string | null;
  propertyName: string | null;
};

export default function TenantReceiptPage() {
  const router = useRouter();
  const { lang, setLang, tr } = useTenantLang();
  const [state, setState] = useState<"loading" | "missing" | "ready">("loading");
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { router.push("/tenant/login"); return; }

      const id = new URLSearchParams(window.location.search).get("id") || "";
      if (!id) { setState("missing"); return; }

      const { data: pay } = await supabase
        .from("payments")
        .select("id, amount_paid, payment_method, transaction_reference, paid_at, invoice_id, invoices(id, invoice_number, billing_period, total_due, tenants(full_name, phone_number), units(unit_number, properties(property_name)))")
        .eq("id", id)
        .maybeSingle();
      if (!pay) { setState("missing"); return; }

      const p: any = pay;
      const inv: any = Array.isArray(p.invoices) ? p.invoices[0] : p.invoices;
      const tenantRow: any = inv ? (Array.isArray(inv.tenants) ? inv.tenants[0] : inv.tenants) : null;
      const unitRow: any = inv ? (Array.isArray(inv.units) ? inv.units[0] : inv.units) : null;
      const propRow: any = unitRow ? (Array.isArray(unitRow.properties) ? unitRow.properties[0] : unitRow.properties) : null;

      // "Paid to date" counts this payment and everything paid before it on
      // the same invoice, so an older receipt keeps showing what was true then.
      let paidToDate = Number(p.amount_paid) || 0;
      if (p.invoice_id) {
        const { data: siblings } = await supabase.from("payments").select("id, amount_paid, paid_at").eq("invoice_id", p.invoice_id);
        if (siblings) {
          const thisTime = p.paid_at ? new Date(p.paid_at).getTime() : 0;
          paidToDate = (siblings as any[])
            .filter((s) => s.id === p.id || (s.paid_at ? new Date(s.paid_at).getTime() <= thisTime : false))
            .reduce((sum, s) => sum + (Number(s.amount_paid) || 0), 0);
        }
      }

      setReceipt({
        id: p.id,
        amount: Number(p.amount_paid) || 0,
        method: p.payment_method || "—",
        reference: p.transaction_reference,
        paidAt: p.paid_at,
        invoiceNumber: inv?.invoice_number || null,
        period: inv?.billing_period || "—",
        totalDue: Number(inv?.total_due) || 0,
        paidToDate,
        tenantName: tenantRow?.full_name || "",
        tenantPhone: tenantRow?.phone_number || null,
        unitNumber: unitRow?.unit_number || null,
        propertyName: propRow?.property_name || null,
      });
      setState("ready");
    }
    load();
  }, [router]);

  if (state === "loading") {
    return <main className="min-h-screen bg-gray-100 flex items-center justify-center text-gray-500">{tr("Loading receipt...")}</main>;
  }

  if (state === "missing" || !receipt) {
    return (
      <main className="min-h-screen bg-gray-100 flex flex-col items-center justify-center gap-4 px-6 text-center text-gray-600">
        <p>{tr("This receipt could not be found.")}</p>
        <a href="/tenant/dashboard" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700">{tr("Back to my account")}</a>
      </main>
    );
  }

  const locale = lang === "sw" ? "sw-KE" : "en-GB";
  const paidOn = receipt.paidAt ? new Date(receipt.paidAt).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" }) : "—";
  const money = (n: number) => "KSh " + n.toLocaleString("en-US");
  const balance = Math.max(receipt.totalDue - receipt.paidToDate, 0);
  const receiptNo = "RCT-" + receipt.id.slice(0, 8).toUpperCase();
  const home = [receipt.propertyName, receipt.unitNumber ? tr("Unit") + " " + receipt.unitNumber : null].filter(Boolean).join(" — ");

  const rows: [string, string][] = [
    [tr("Received from"), receipt.tenantName + (receipt.tenantPhone ? " (" + receipt.tenantPhone + ")" : "")],
    [tr("Property"), home || "—"],
    [tr("Period"), trPeriod(lang, receipt.period)],
    [tr("Payment method"), tr(String(receipt.method).replace("_", " "))],
  ];
  if (receipt.reference) rows.push([tr("Transaction reference"), receipt.reference]);

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-xl items-center justify-between gap-2 print:hidden">
        <a href="/tenant/dashboard" className="text-sm font-medium text-gray-600 hover:text-gray-900">← {tr("Back to my account")}</a>
        <div className="flex gap-1 text-xs font-semibold">
          <button onClick={() => setLang("en")} className={"rounded-full px-3 py-1.5 " + (lang === "en" ? "bg-gray-900 text-white" : "border border-gray-300 bg-white text-gray-600")}>English</button>
          <button onClick={() => setLang("sw")} className={"rounded-full px-3 py-1.5 " + (lang === "sw" ? "bg-gray-900 text-white" : "border border-gray-300 bg-white text-gray-600")}>Kiswahili</button>
        </div>
      </div>

      <div className="mx-auto max-w-xl rounded-2xl border bg-white p-8 shadow-sm print:max-w-none print:rounded-none print:border-0 print:shadow-none">
        <div className="border-b pb-5 text-center">
          <p className="text-xl font-bold tracking-wide text-gray-900">MANAGIKA HOMES</p>
          <p className="mt-1 text-lg font-semibold text-gray-700">{tr("Rent Receipt")}</p>
        </div>

        <div className="mt-5 flex items-start justify-between gap-4 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">{tr("Receipt No.")}</p>
            <p className="font-semibold text-gray-900">{receiptNo}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-gray-400">{tr("Date")}</p>
            <p className="font-semibold text-gray-900">{paidOn}</p>
          </div>
        </div>

        <dl className="mt-6 divide-y text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 py-3">
              <dt className="text-gray-500">{label}</dt>
              <dd className={"text-right font-medium text-gray-900 break-words " + (lang === "en" ? "capitalize" : "first-letter:uppercase")}>{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 rounded-xl bg-gray-50 p-5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-700">{tr("Amount paid")}</span>
            <span className="text-2xl font-bold text-green-700">{money(receipt.amount)}</span>
          </div>
          <div className="mt-4 space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">{tr("Invoice total")}</span><span className="font-medium text-gray-900">{money(receipt.totalDue)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">{tr("Paid to date")}</span><span className="font-medium text-gray-900">{money(receipt.paidToDate)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">{tr("Balance remaining")}</span><span className={"font-semibold " + (balance > 0 ? "text-amber-700" : "text-green-700")}>{money(balance)}</span></div>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-gray-600">{tr("Thank you for your payment.")}</p>
        <p className="mt-1 text-center text-xs text-gray-400">{tr("This receipt was generated by Managika Homes.")}</p>
      </div>

      <div className="mx-auto mt-5 flex max-w-xl justify-center print:hidden">
        <button onClick={() => window.print()} className="rounded-lg bg-black px-6 py-3 text-sm font-semibold text-white">{tr("Print / Save as PDF")}</button>
      </div>
    </main>
  );
}
