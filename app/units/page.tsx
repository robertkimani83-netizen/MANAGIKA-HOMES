"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Property = { id: string; property_name: string };

type Unit = { id: string; unit_number: string; base_rent: number; garbage_fee: number; status: string; property_id: string; properties: { property_name: string } | null };

export default function UnitsPage() {
const router = useRouter();
const [landlordId, setLandlordId] = useState<string | null>(null);
const [units, setUnits] = useState<Unit[]>([]);
const [properties, setProperties] = useState<Property[]>([]);
const [loading, setLoading] = useState(true);
const [showForm, setShowForm] = useState(false);
const [propertyId, setPropertyId] = useState("");
const [unitNumber, setUnitNumber] = useState("");
const [baseRent, setBaseRent] = useState("");
const [garbageFee, setGarbageFee] = useState("");

useEffect(() => {
async function init() {
const { data } = await supabase.auth.getUser();
if (!data.user) { router.push("/landlord/login"); return; }
setLandlordId(data.user.id);
}
init();
}, []);

async function loadProperties(id: string) {
const { data } = await supabase.from("properties").select("id, property_name").eq("landlord_id", id).order("property_name", { ascending: true });
if (data) {
setProperties(data);
if (data.length > 0) setPropertyId((prev) => prev || data[0].id);
}
}

async function loadUnits(id: string) {
setLoading(true);
const { data, error } = await supabase.from("units").select("id, unit_number, base_rent, garbage_fee, status, property_id, properties!inner(property_name, landlord_id)").eq("properties.landlord_id", id).order("created_at", { ascending: false });
if (!error && data) setUnits(data as unknown as Unit[]);
setLoading(false);
}

useEffect(() => {
if (landlordId) {
loadProperties(landlordId);
loadUnits(landlordId);
}
}, [landlordId]);

async function addUnit() {
if (!landlordId) return;
if (!propertyId) { alert("Please add a property first, then select it here."); return; }
if (!unitNumber.trim()) { alert("Please enter the unit number."); return; }
const rent = Number(baseRent);
if (!Number.isFinite(rent) || rent <= 0) { alert("Please enter a valid monthly rent."); return; }
const garbage = Number(garbageFee) || 0;
const { error } = await supabase.from("units").insert({ property_id: propertyId, unit_number: unitNumber.trim(), base_rent: rent, garbage_fee: garbage });
if (error) { alert("Error saving unit: " + error.message); return; }
setUnitNumber(""); setBaseRent(""); setGarbageFee(""); setShowForm(false);
loadUnits(landlordId);
}

async function deleteUnit(id: string) {
if (!landlordId) return;
const confirmed = window.confirm("Are you sure you want to delete this unit?");
if (!confirmed) return;
const { error } = await supabase.from("units").delete().eq("id", id);
if (error) { alert("Error deleting unit: " + error.message); return; }
loadUnits(landlordId);
}

const totalUnits = units.length;
const occupied = units.filter((u) => u.status === "occupied").length;
const vacant = units.filter((u) => u.status === "vacant").length;
const totalRent = units.reduce((sum, u) => sum + (Number(u.base_rent) || 0), 0);

const statusPill = (status: string) => status === "occupied" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700";

return (
<main className="min-h-screen bg-slate-50">
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
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 text-3xl">🚪</span>
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Units</h2>
          <p className="text-slate-500 mt-1">Manage rental units, tenants and occupancy.</p>
        </div>
      </div>
      <button onClick={() => setShowForm(true)} className="px-5 py-3 rounded-lg bg-slate-900 text-white font-medium shadow-lg shadow-slate-900/10 hover:-translate-y-0.5 hover:bg-slate-800 transition">+ Add Unit</button>
    </div>

    {showForm && (
      <div className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="mb-5 text-xl font-bold text-slate-900">Add New Unit</h3>
        {properties.length === 0 ? (
          <p className="text-slate-500">Add a property first under the Properties page before adding units.</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Property</label>
              <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100">
                {properties.map((p) => (<option key={p.id} value={p.id}>{p.property_name}</option>))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Unit Number</label>
              <input type="text" value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} placeholder="e.g. A12" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Monthly Rent (KSh)</label>
              <input type="number" min="0" value={baseRent} onChange={(e) => setBaseRent(e.target.value)} placeholder="e.g. 15000" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Garbage Fee (KSh)</label>
              <input type="number" min="0" value={garbageFee} onChange={(e) => setGarbageFee(e.target.value)} placeholder="e.g. 200" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
            </div>
          </div>
        )}
        <div className="mt-6 flex gap-3">
          <button onClick={addUnit} className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-800">Save Unit</button>
          <button onClick={() => setShowForm(false)} className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
        </div>
      </div>
    )}

    <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 border shadow-sm text-white">
        <p className="text-sm text-slate-300">Total Units</p>
        <p className="text-3xl font-bold mt-2">{totalUnits}</p>
      </div>
      <div className="bg-white rounded-xl p-6 border shadow-sm">
        <p className="text-sm text-slate-500">Occupied</p>
        <p className="text-3xl font-bold mt-2 text-green-700">{occupied}</p>
      </div>
      <div className="bg-white rounded-xl p-6 border shadow-sm">
        <p className="text-sm text-slate-500">Vacant</p>
        <p className="text-3xl font-bold mt-2 text-amber-600">{vacant}</p>
      </div>
      <div className="bg-white rounded-xl p-6 border shadow-sm">
        <p className="text-sm text-slate-500">Total Monthly Rent</p>
        <p className="text-3xl font-bold mt-2">KSh {totalRent.toLocaleString()}</p>
      </div>
    </div>

    <div className="mt-8 bg-white rounded-xl border shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b"><h3 className="text-xl font-semibold">Unit Information</h3></div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Unit</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Property</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Monthly Rent</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Status</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-500">Loading units...</td></tr>
            ) : units.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-500">No units have been added yet.</td></tr>
            ) : (
              units.map((unit) => (
                <tr key={unit.id} className="border-t">
                  <td className="px-6 py-4">{unit.unit_number}</td>
                  <td className="px-6 py-4">{unit.properties?.property_name || "—"}</td>
                  <td className="px-6 py-4">KSh {Number(unit.base_rent).toLocaleString()}</td>
                  <td className="px-6 py-4"><span className={"inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize " + statusPill(unit.status)}>{unit.status}</span></td>
                  <td className="px-6 py-4"><button onClick={() => deleteUnit(unit.id)} className="text-sm font-medium text-red-600 hover:underline">Delete</button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <footer className="border-t bg-white mt-10">
    <div className="max-w-7xl mx-auto px-6 py-6 text-sm text-slate-500">© 2026 Managika Homes. Property management made simple.</div>
  </footer>
</main>

);
}