"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Unit = { id: string; unit_number: string; base_rent: number; status: string; property_id: string; properties: { property_name: string } | null };

type Tenant = { id: string; full_name: string; phone_number: string; email: string | null; status: string; unit_id: string | null; units: { unit_number: string; base_rent: number; properties: { property_name: string } | null } | null };

// Pulls a phone number out of a messy pasted line regardless of where it
// sits (start, end, with dashes/spaces) - matches 07xx / +254xx / 254xx
// style Kenyan numbers, 9-13 digits once separators are stripped.
function extractPhone(line: string): { phone: string | null; rest: string } {
  const match = line.match(/(\+?254|0)?[\s-]?\d{2,3}[\s-]?\d{3}[\s-]?\d{3,4}/);
  if (!match) return { phone: null, rest: line.trim() };
  const digitsOnly = match[0].replace(/[\s-]/g, "");
  if (digitsOnly.replace(/^\+?254|^0/, "").length < 8) return { phone: null, rest: line.trim() };
  const rest = (line.slice(0, match.index) + line.slice((match.index ?? 0) + match[0].length)).trim();
  return { phone: digitsOnly, rest };
}

// Splits a pasted line into a name, whatever's left after pulling the phone
// number out - handles "Name, Phone", "Name<tab>Phone" (Excel/Sheets paste),
// and "Name - Phone" all the same way.
function parseBulkLine(line: string): { name: string; phone: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const { phone, rest } = extractPhone(trimmed);
  if (!phone) return null;
  const name = rest.replace(/^[,\-â€“\t]+|[,\-â€“\t]+$/g, "").trim();
  if (!name) return null;
  return { name, phone };
}

// Reads a File into a base64 string (without the data: URL prefix) for
// sending to the Gemini vision API.
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function TenantsPage() {
const router = useRouter();
const [landlordId, setLandlordId] = useState<string | null>(null);
const [tenants, setTenants] = useState<Tenant[]>([]);
const [vacantUnits, setVacantUnits] = useState<Unit[]>([]);
const [loading, setLoading] = useState(true);
const [showForm, setShowForm] = useState(false);
const [fullName, setFullName] = useState("");
const [phone, setPhone] = useState("");
const [email, setEmail] = useState("");
const [unitId, setUnitId] = useState("");
const [showBulkForm, setShowBulkForm] = useState(false);
const [bulkText, setBulkText] = useState("");
const [bulkSaving, setBulkSaving] = useState(false);
const [bulkResult, setBulkResult] = useState<{ added: number; skipped: string[] } | null>(null);
const [scanning, setScanning] = useState(false);
const [scanError, setScanError] = useState<string | null>(null);

useEffect(() => {
async function init() {
const { data: { user } } = await supabase.auth.getUser();
if (!user) { router.push("/landlord/login"); return; }
setLandlordId(user.id);
}
init();
}, [router]);

async function loadVacantUnits(id: string) {
const { data, error } = await supabase.from("units").select("id, unit_number, base_rent, status, property_id, properties!inner(property_name, landlord_id)").eq("status", "vacant").eq("properties.landlord_id", id).order("unit_number", { ascending: true });
if (error) { console.error("Vacant units error:", error); setVacantUnits([]); return; }
setVacantUnits(data as unknown as Unit[]);
}

async function loadTenants(id: string) {
setLoading(true);
const { data, error } = await supabase.from("tenants").select("id, full_name, phone_number, email, status, unit_id, units(unit_number, base_rent, property_id, properties(property_name, landlord_id))").eq("landlord_id", id).order("created_at", { ascending: false });
if (error) { console.error("Tenants error:", error); setTenants([]); } else if (data) { setTenants(data as unknown as Tenant[]); }
setLoading(false);
}

useEffect(() => {
if (!landlordId) return;
loadVacantUnits(landlordId);
loadTenants(landlordId);
}, [landlordId]);

async function addTenant() {
if (!landlordId) return;
if (!fullName.trim()) { alert("Please enter the tenant's name."); return; }
if (!phone.trim()) { alert("Please enter the tenant's phone number."); return; }
if (unitId) {
const selectedUnit = vacantUnits.find((unit) => unit.id === unitId);
if (!selectedUnit) { alert("Invalid unit selected."); return; }
}
const { error: tenantError } = await supabase.from("tenants").insert({ landlord_id: landlordId, full_name: fullName.trim(), phone_number: phone.trim(), email: email.trim() || null, unit_id: unitId || null, status: "active", joined_at: new Date().toISOString() });
if (tenantError) { alert("Error saving tenant: " + tenantError.message); return; }
if (unitId) {
const { error: unitError } = await supabase.from("units").update({ status: "occupied" }).eq("id", unitId);
if (unitError) console.error("Unit status error:", unitError);
}
setFullName(""); setPhone(""); setEmail(""); setUnitId(""); setShowForm(false);
await loadVacantUnits(landlordId);
await loadTenants(landlordId);
}

async function addBulkTenants() {
if (!landlordId) return;
const lines = bulkText.split("\n");
const parsed: { name: string; phone: string }[] = [];
const skipped: string[] = [];
for (const line of lines) {
if (!line.trim()) continue;
const result = parseBulkLine(line);
if (result) parsed.push(result);
else skipped.push(line.trim());
}
if (parsed.length === 0) {
setBulkResult({ added: 0, skipped });
return;
}
setBulkSaving(true);
const rows = parsed.map((p) => ({
landlord_id: landlordId,
full_name: p.name,
phone_number: p.phone,
email: null,
unit_id: null,
status: "active",
joined_at: new Date().toISOString(),
}));
const { error } = await supabase.from("tenants").insert(rows);
setBulkSaving(false);
if (error) { alert("Error saving tenants: " + error.message); return; }
setBulkResult({ added: parsed.length, skipped });
setBulkText("");
await loadTenants(landlordId);
}

async function handleScanFile(e: React.ChangeEvent<HTMLInputElement>) {
const file = e.target.files && e.target.files[0];
e.target.value = "";
if (!file) return;

if (file.size > 8 * 1024 * 1024) {
  setScanError("That file is too large (over 8MB). Try taking the photo again with a bit less zoom, or crop it to just the tenant list.");
  return;
}

setScanning(true);
setScanError(null);
try {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) { setScanError("You've been signed out - please refresh the page and log in again."); setScanning(false); return; }

  const imageBase64 = await fileToBase64(file);
  const res = await fetch("/api/tenants/scan-list", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + accessToken },
    body: JSON.stringify({ imageBase64, mimeType: file.type || "image/jpeg" }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    setScanError(data.error || "Could not read that file. Try a clearer photo, or type the list in manually below.");
    setScanning(false);
    return;
  }
  if (!data.text) {
    setScanError("Couldn't find any names or numbers in that image. Try a clearer, well-lit photo of the page.");
    setScanning(false);
    return;
  }
  setBulkText((prev) => (prev.trim() ? prev.trim() + "\n" + data.text : data.text));
} catch (err: any) {
  setScanError(err.message || "Something went wrong reading that file.");
} finally {
  setScanning(false);
}
}

async function deleteTenant(tenant: Tenant) {
if (!landlordId) return;
const confirmed = window.confirm("Are you sure you want to remove this tenant?");
if (!confirmed) return;
const { error } = await supabase.from("tenants").delete().eq("id", tenant.id).eq("landlord_id", landlordId);
if (error) { alert("Error removing tenant: " + error.message); return; }
if (tenant.unit_id) {
const { error: unitError } = await supabase.from("units").update({ status: "vacant" }).eq("id", tenant.unit_id);
if (unitError) console.error("Unit status error:", unitError);
}
await loadVacantUnits(landlordId);
await loadTenants(landlordId);
}

const totalTenants = tenants.length;
const activeTenants = tenants.filter((tenant) => tenant.status === "active").length;
const totalRent = tenants.reduce((sum, tenant) => sum + (Number(tenant.units?.base_rent) || 0), 0);

return (
<main className="min-h-screen city-skyline-page">
<div className="h-1 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400" />
<header className="bg-white border-b">
<div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
<div>
<h1 className="text-2xl font-bold text-slate-900">MANAGIKA HOMES</h1>
<p className="text-sm text-slate-500">Property Management Made Simple</p>
</div>
<a href="/landlord/dashboard" className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700">Dashboard</a>
</div>
</header>

  <section className="max-w-7xl mx-auto px-6 py-8">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 text-3xl">ðŸ‘¥</span>
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Tenants</h2>
          <p className="text-slate-500 mt-1">Manage tenants, assignments and rental information.</p>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={() => setShowBulkForm(true)} className="px-5 py-3 rounded-lg border-2 border-slate-900 bg-white text-slate-900 font-medium hover:-translate-y-0.5 hover:bg-slate-50 transition">ðŸ“‹ Paste a List</button>
        <button onClick={() => setShowForm(true)} className="px-5 py-3 rounded-lg bg-slate-900 text-white font-medium shadow-lg shadow-slate-900/10 hover:-translate-y-0.5 hover:bg-slate-800 transition">+ Add Tenant</button>
      </div>
    </div>

    {showBulkForm && (
      <div className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="mb-2 text-xl font-bold text-slate-900">Add Many Tenants at Once</h3>
        <p className="mb-4 text-sm text-slate-500">
          Skip typing them one by one - paste a list below, or upload a photo of a handwritten or printed notebook page and let the app read it for you.
        </p>

        <div className="mb-5 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center">
          <label className="cursor-pointer">
            <span className="inline-block rounded-lg bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-800">
              {scanning ? "Reading document..." : "ðŸ“· Upload a Photo or PDF"}
            </span>
            <input type="file" accept="image/*,application/pdf" onChange={handleScanFile} disabled={scanning} className="hidden" />
          </label>
          <p className="mt-3 text-xs text-slate-500">A clear, well-lit photo of the page works best. Names and numbers found will be added to the box below for you to check.</p>
          {scanError && <p className="mt-3 text-sm font-medium text-red-600">{scanError}</p>}
        </div>

        <p className="mb-2 text-sm font-medium text-slate-700">Or type / paste directly:</p>
        <textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          rows={8}
          placeholder={"John Kamau, 0712345678\nMary Wanjiru, 0798765432\nPeter Otieno - 0722334455"}
          className="w-full rounded-lg border border-slate-300 px-4 py-3 font-mono text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
        />
        <p className="mt-2 text-xs text-slate-500">Works with "Name, 0712345678" per line, a list copied from Excel/Sheets, or names and numbers copied from your phone. You can assign units to each tenant afterwards from their profile.</p>
        {bulkResult && (
          <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm">
            <p className="font-semibold text-slate-800">Added {bulkResult.added} tenant{bulkResult.added === 1 ? "" : "s"}.</p>
            {bulkResult.skipped.length > 0 && (
              <div className="mt-2">
                <p className="font-medium text-red-600">Couldn't read {bulkResult.skipped.length} line{bulkResult.skipped.length === 1 ? "" : "s"} (no phone number found):</p>
                <ul className="mt-1 list-disc pl-5 text-slate-600">
                  {bulkResult.skipped.map((line, i) => (<li key={i}>{line}</li>))}
                </ul>
              </div>
            )}
          </div>
        )}
        <div className="mt-6 flex gap-3">
          <button onClick={addBulkTenants} disabled={bulkSaving || !bulkText.trim()} className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-800 disabled:opacity-50">
            {bulkSaving ? "Adding..." : "Add All"}
          </button>
          <button onClick={() => { setShowBulkForm(false); setBulkResult(null); setScanError(null); }} className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-medium text-slate-700 hover:bg-slate-50">Close</button>
        </div>
      </div>
    )}

    {showForm && (
      <div className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="mb-5 text-xl font-bold text-slate-900">Add New Tenant</h3>
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Full Name</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. John Kamau" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Phone Number</label>
            <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 0712345678" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Email (optional)</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. john@email.com" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Assign to Unit</label>
            <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100">
              <option value="">No unit yet</option>
              {vacantUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>{unit.properties?.property_name} - {unit.unit_number} (KSh {Number(unit.base_rent).toLocaleString()})</option>
              ))}
            </select>
            {vacantUnits.length === 0 && (<p className="mt-2 text-sm text-slate-500">No vacant units available. Add units first, or leave unassigned.</p>)}
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <button onClick={addTenant} className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-800">Save Tenant</button>
          <button onClick={() => setShowForm(false)} className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
        </div>
      </div>
    )}

    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 border shadow-sm text-white">
        <p className="text-sm text-slate-300">Total Tenants</p>
        <p className="text-3xl font-bold mt-2">{totalTenants}</p>
      </div>
      <div className="bg-white rounded-xl p-6 border shadow-sm">
        <p className="text-sm text-slate-500">Active Tenants</p>
        <p className="text-3xl font-bold mt-2">{activeTenants}</p>
      </div>
      <div className="bg-white rounded-xl p-6 border shadow-sm">
        <p className="text-sm text-slate-500">Total Monthly Rent</p>
        <p className="text-3xl font-bold mt-2">KSh {totalRent.toLocaleString()}</p>
      </div>
    </div>

    <div className="mt-8 bg-white rounded-xl border shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b"><h3 className="text-xl font-semibold">Tenant Information</h3></div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Tenant</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Phone</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Property</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Unit</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Rent</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-500">Loading tenants...</td></tr>
            ) : tenants.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-500">No tenants have been added yet.</td></tr>
            ) : (
              tenants.map((tenant) => (
                <tr key={tenant.id} className="border-t">
                  <td className="px-6 py-4"><a href={"/tenants/" + tenant.id} className="font-medium text-amber-600 hover:underline">{tenant.full_name}</a></td>
                  <td className="px-6 py-4">{tenant.phone_number}</td>
                  <td className="px-6 py-4">{tenant.units?.properties?.property_name || "â€”"}</td>
                  <td className="px-6 py-4">{tenant.units?.unit_number || "Unassigned"}</td>
                  <td className="px-6 py-4">{tenant.units ? "KSh " + Number(tenant.units.base_rent).toLocaleString() : "â€”"}</td>
                  <td className="px-6 py-4"><button onClick={() => deleteTenant(tenant)} className="text-sm font-medium text-red-600 hover:underline">Remove</button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <footer className="border-t bg-white mt-10">
    <div className="max-w-7xl mx-auto px-6 py-6 text-sm text-slate-500">Â© 2026 Managika Homes. Property management made simple.</div>
  </footer>
</main>

);
}