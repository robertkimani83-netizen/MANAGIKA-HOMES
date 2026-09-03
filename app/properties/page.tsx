"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Property = { id: string; property_name: string; location: string };

export default function PropertiesPage() {
const router = useRouter();
const [landlordId, setLandlordId] = useState<string | null>(null);
const [properties, setProperties] = useState<Property[]>([]);
const [loading, setLoading] = useState(true);
const [showForm, setShowForm] = useState(false);
const [name, setName] = useState("");
const [location, setLocation] = useState("");

useEffect(() => {
async function init() {
const { data } = await supabase.auth.getUser();
if (!data.user) { router.push("/landlord/login"); return; }
setLandlordId(data.user.id);
}
init();
}, []);

async function loadProperties(id: string) {
setLoading(true);
const { data, error } = await supabase.from("properties").select("id, property_name, location").eq("landlord_id", id).order("created_at", { ascending: false });
if (!error && data) setProperties(data);
setLoading(false);
}

useEffect(() => {
if (landlordId) loadProperties(landlordId);
}, [landlordId]);

async function addProperty() {
if (!landlordId) return;
if (!name.trim()) { alert("Please enter the property name."); return; }
if (!location.trim()) { alert("Please enter the property location."); return; }
const { error } = await supabase.from("properties").insert({ landlord_id: landlordId, property_name: name.trim(), location: location.trim() });
if (error) { alert("Error saving property: " + error.message); return; }
setName(""); setLocation(""); setShowForm(false);
loadProperties(landlordId);
}

async function deleteProperty(id: string) {
if (!landlordId) return;
// Check for units attached to this property first. Whether the
// database's foreign key would cascade-delete those units (and their
// tenants, invoices, payments...) or simply block the delete with a
// constraint error isn't something we can verify without live DB
// access, so instead of relying on either behavior, refuse up front
// and tell the landlord exactly what to do about it.
const { data: attachedUnits, error: countError } = await supabase.from("units").select("id").eq("property_id", id);
if (countError) { alert("Could not check this property's units: " + countError.message); return; }
const attachedCount = attachedUnits?.length || 0;
if (attachedCount > 0) {
  alert("This property still has " + attachedCount + " unit(s) attached. Please delete or reassign those units first, then delete the property.");
  return;
}
const confirmed = window.confirm("Are you sure you want to delete this property?");
if (!confirmed) return;
// Scope the delete to this landlord's own row as a second line of
// defense alongside RLS - matches the pattern used for deleteTenant in
// app/tenants/page.tsx, so a bad ID can never touch another landlord's
// property even if a policy is ever misconfigured.
const { error } = await supabase.from("properties").delete().eq("id", id).eq("landlord_id", landlordId);
if (error) { alert("Error deleting property: " + error.message); return; }
loadProperties(landlordId);
}

const totalProperties = properties.length;

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

  <section className="mx-auto max-w-7xl px-6 py-8">
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 text-3xl">🏢</span>
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Properties</h2>
          <p className="mt-1 text-slate-500">Manage all your properties and rental units.</p>
        </div>
      </div>
      <button onClick={() => setShowForm(true)} className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white shadow-lg shadow-slate-900/10 hover:-translate-y-0.5 hover:bg-slate-800 transition">+ Add Property</button>
    </div>

    {showForm && (
      <div className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="mb-5 text-xl font-bold text-slate-900">Add New Property</h3>
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Property Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sunrise Apartments" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Location</label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Nairobi" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <button onClick={addProperty} className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-800">Save Property</button>
          <button onClick={() => setShowForm(false)} className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
        </div>
      </div>
    )}

    <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-3">
      <div className="rounded-xl border bg-gradient-to-br from-slate-900 to-slate-800 p-6 shadow-sm text-white">
        <p className="text-sm text-slate-300">Total Properties</p>
        <p className="mt-2 text-3xl font-bold">{totalProperties}</p>
      </div>
    </div>

    {loading ? (
      <div className="rounded-xl border bg-white p-10 text-center shadow-sm text-slate-500">Loading properties...</div>
    ) : properties.length > 0 ? (
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {properties.map((property) => (
          <div key={property.id} className="rounded-xl border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 text-2xl">🏢</div>
            <h3 className="text-xl font-bold text-slate-900">{property.property_name}</h3>
            <p className="mt-2 text-slate-500">📍 {property.location}</p>
            <button onClick={() => deleteProperty(property.id)} className="mt-5 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">Delete</button>
          </div>
        ))}
      </div>
    ) : (
      <div className="rounded-xl border bg-white p-10 text-center shadow-sm">
        <div className="mb-5 text-5xl">🏢</div>
        <h3 className="text-2xl font-semibold text-slate-900">No properties yet</h3>
        <p className="mx-auto mt-2 max-w-md text-slate-500">Add your first property to start managing buildings, apartments, units and tenants.</p>
        <button onClick={() => setShowForm(true)} className="mt-6 rounded-lg bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-800">+ Add Your First Property</button>
      </div>
    )}
  </section>

  <footer className="mt-10 border-t bg-white">
    <div className="mx-auto max-w-7xl px-6 py-6 text-sm text-slate-500">© 2026 Managika Homes. Property management made simple.</div>
  </footer>
</main>

);
}