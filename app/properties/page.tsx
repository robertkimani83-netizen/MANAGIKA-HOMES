"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const LANDLORD_ID = "25577765-142e-49b4-88c8-925678e13d3f";

type Property = {
  id: string;
  property_name: string;
  location: string;
};

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");

  async function loadProperties() {
    setLoading(true);
    const { data, error } = await supabase
      .from("properties")
      .select("id, property_name, location")
      .eq("landlord_id", LANDLORD_ID)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setProperties(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadProperties();
  }, []);

  async function addProperty() {
    if (!name.trim()) {
      alert("Please enter the property name.");
      return;
    }
    if (!location.trim()) {
      alert("Please enter the property location.");
      return;
    }

    const { error } = await supabase.from("properties").insert({
      landlord_id: LANDLORD_ID,
      property_name: name.trim(),
      location: location.trim(),
    });

    if (error) {
      alert("Error saving property: " + error.message);
      return;
    }

    setName("");
    setLocation("");
    setShowForm(false);
    loadProperties();
  }

  async function deleteProperty(id: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this property?"
    );
    if (!confirmed) return;

    const { error } = await supabase.from("properties").delete().eq("id", id);
    if (error) {
      alert("Error deleting property: " + error.message);
      return;
    }
    loadProperties();
  }

  const totalProperties = properties.length;

  return (
    <main className="min-h-screen bg-gray-100">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">MANAGIKA HOMES</h1>
            <p className="text-sm text-gray-500">Property Management Made Simple</p>
          </div>
          
            href="/landlord/dashboard"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            Dashboard
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Properties</h2>
            <p className="mt-1 text-gray-500">Manage all your properties and rental units.</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800"
          >
            + Add Property
          </button>
        </div>

        {showForm && (
          <div className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
            <h3 className="mb-5 text-xl font-bold text-gray-900">Add New Property</h3>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Property Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sunrise Apartments"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Nairobi"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={addProperty}
                className="rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800"
              >
                Save Property
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-gray-300 bg-white px-5 py-3 font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-3">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">Total Properties</p>
            <p className="mt-2 text-3xl font-bold">{totalProperties}</p>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border bg-white p-10 text-center shadow-sm text-gray-500">
            Loading properties...
          </div>
        ) : properties.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {properties.map((property) => (
              <div key={property.id} className="rounded-xl border bg-white p-6 shadow-sm">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-2xl">
                  🏢
                </div>
                <h3 className="text-xl font-bold text-gray-900">{property.property_name}</h3>
                <p className="mt-2 text-gray-500">📍 {property.location}</p>
                <button
                  onClick={() => deleteProperty(property.id)}
                  className="mt-5 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border bg-white p-10 text-center shadow-sm">
            <div className="mb-5 text-5xl">🏢</div>
            <h3 className="text-2xl font-semibold text-gray-900">No properties yet</h3>
            <p className="mx-auto mt-2 max-w-md text-gray-500">
              Add your first property to start managing buildings, apartments, units and tenants.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-6 rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800"
            >
              + Add Your First Property
            </button>
          </div>
        )}
      </section>

      <footer className="mt-10 border-t bg-white">
        <div className="mx-auto max-w-7xl px-6 py-6 text-sm text-gray-500">
          © 2026 Managika Homes. Property management made simple.
        </div>
      </footer>
    </main>
  );
}
