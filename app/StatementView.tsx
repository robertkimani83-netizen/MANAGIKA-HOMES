"use client";

import { statementDate, type StatementEntry } from "@/lib/statement";

function kes(amount: number) {
  return "KSh " + Math.round(amount).toLocaleString("en-US");
}

// The account statement itself (used on the tenant's page and on the
// landlord's page for one tenant). `tr` and `formatPeriod` let the tenant
// page show it in Kiswahili; the landlord page uses the plain English text.
export default function StatementView({
  tenantName,
  unitLabel,
  entries,
  tr = (text: string) => text,
  formatPeriod = (period: string) => period,
}: {
  tenantName: string;
  unitLabel: string;
  entries: StatementEntry[];
  tr?: (text: string) => string;
  formatPeriod?: (period: string) => string;
}) {
  const totalCharged = entries.reduce((sum, e) => sum + e.charged, 0);
  const totalPaid = entries.reduce((sum, e) => sum + e.paid, 0);
  const owed = totalCharged - totalPaid;
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  function describe(e: StatementEntry) {
    if (e.kind === "payment") {
      const method = e.method ? " (" + tr(String(e.method).replace(/_/g, " ")) + ")" : "";
      return tr("Payment") + method + (e.reference ? " · " + e.reference : "");
    }
    const parts = [tr("Rent")];
    if (e.water > 0) parts.push(tr("Water"));
    if (e.garbage > 0) parts.push(tr("Garbage"));
    return parts.join(" + ") + " — " + formatPeriod(e.period);
  }

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm print:border-0 print:p-0 print:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{tr("Account Statement")}</h2>
          <p className="mt-1 text-gray-700">{tenantName}{unitLabel && " — " + unitLabel}</p>
          <p className="text-sm text-gray-500">{tr("Statement date")}: {today}</p>
        </div>
        <button onClick={() => window.print()} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 print:hidden">🖨 {tr("Print / Save as PDF")}</button>
      </div>

      <div className="my-5 grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-gray-50 p-3 print:border">
          <p className="text-xs uppercase tracking-wide text-gray-400">{tr("Total charged")}</p>
          <p className="mt-1 font-semibold text-gray-900">{kes(totalCharged)}</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 print:border">
          <p className="text-xs uppercase tracking-wide text-gray-400">{tr("Total paid")}</p>
          <p className="mt-1 font-semibold text-green-700">{kes(totalPaid)}</p>
        </div>
        <div className={"rounded-lg p-3 print:border " + (owed > 0 ? "bg-amber-50" : "bg-green-50")}>
          <p className="text-xs uppercase tracking-wide text-gray-400">{owed < 0 ? tr("Credit") : tr("Amount owed")}</p>
          <p className={"mt-1 font-semibold " + (owed > 0 ? "text-amber-800" : "text-green-700")}>{kes(Math.abs(owed))}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2 pr-3 font-semibold">{tr("Date")}</th>
              <th className="py-2 pr-3 font-semibold">{tr("Description")}</th>
              <th className="py-2 pr-3 text-right font-semibold">{tr("Charged")}</th>
              <th className="py-2 pr-3 text-right font-semibold">{tr("Paid")}</th>
              <th className="py-2 text-right font-semibold">{tr("Balance")}</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr><td colSpan={5} className="py-8 text-center text-gray-500">{tr("No charges or payments yet.")}</td></tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 whitespace-nowrap">{statementDate(e.date)}</td>
                  <td className="py-2 pr-3">{describe(e)}</td>
                  <td className="py-2 pr-3 text-right whitespace-nowrap">{e.charged > 0 ? kes(e.charged) : ""}</td>
                  <td className="py-2 pr-3 text-right whitespace-nowrap text-green-700">{e.paid > 0 ? kes(e.paid) : ""}</td>
                  <td className="py-2 text-right whitespace-nowrap font-medium">{e.balance < 0 ? "(" + kes(-e.balance) + ")" : kes(e.balance)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {entries.some((e) => e.balance < 0) && <p className="mt-3 text-xs text-gray-500">{tr("A balance in brackets means the tenant has paid ahead.")}</p>}
    </div>
  );
}
