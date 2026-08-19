"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function currentPeriod() {
  const d = new Date();
  const names = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return names[d.getMonth()] + " " + d.getFullYear();
}

export default function LandlordDashboard() {
  const router = useRouter();

  const [propertyCount, setPropertyCount] = useState(0);
  const [unitCount, setUnitCount] = useState(0);
  const [tenantCount, setTenantCount] = useState(0);
  const [outstanding, setOutstanding] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      setLoading(true);

      // Get the real logged-in landlord
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/landlord/login");
        return;
      }

      const landlordId = user.id;

      // Properties belonging to this landlord
      const { count: properties } = await supabase
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("landlord_id", landlordId);

      // Units belonging to this landlord through properties
      const { data: landlordProperties } = await supabase
        .from("properties")
        .select("id")
        .eq("landlord_id", landlordId);

      const propertyIds = (landlordProperties || []).map((p) => p.id);

      let unitsWithRent: { base_rent: number; status: string }[] = [];

      if (propertyIds.length > 0) {
        const { data: units } = await supabase
          .from("units")
          .select("base_rent, status")
          .in("property_id", propertyIds);

        unitsWithRent = units || [];
      }

      const unitCountValue = unitsWithRent.length;

      // Active tenants belonging to this landlord through their units
      const { data: landlordTenants } = await supabase
        .from("tenants")
        .select("id, unit_id, status, units!inner(property_id)")
        .eq("status", "active")
        .in("units.property_id", propertyIds);

      const tenantCountValue = (landlordTenants || []).length;

      // Expected rent from occupied units belonging to this landlord
      const rentExpected = unitsWithRent
        .filter((u) => u.status === "occupied")
        .reduce(
          (sum, u) => sum + (Number(u.base_rent) || 0),
          0
        );

      // Payments belonging to this landlord through invoices → units → properties
      let collected = 0;

      if (propertyIds.length > 0) {
        const { data: paymentsThisMonth } = await supabase
          .from("payments")
          .select(
            `
              amount_paid,
              invoices!inner(
                billing_period,
                unit_id,
                units!inner(
                  property_id
                )
              )
            `
          )
          .eq(
            "invoices.units.property_id",
            propertyIds[0]
          );

        const period = currentPeriod();

        collected = (paymentsThisMonth || [])
          .filter(
            (p: any) =>
              p.invoices?.billing_period === period &&
              propertyIds.includes(
                p.invoices?.units?.property_id
              )
          )
          .reduce(
            (sum: number, p: any) =>
              sum + (Number(p.amount_paid) || 0),
            0
          );
      }

      setPropertyCount(properties || 0);
      setUnitCount(unitCountValue);
      setTenantCount(tenantCountValue);
      setOutstanding(Math.max(rentExpected - collected, 0));

      setLoading(false);
    }

    loadStats();
  }, [router]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-xl font-bold">MANAGIKA HOMES</h1>
            <p className="text-sm text-slate-500">
              Landlord Dashboard
            </p>
          </div>

          <a
            href="/landlord/login"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
          >
            Sign Out
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold">Dashboard</h2>

          <p className="mt-2 text-slate-600">
            Manage your properties, tenants, rent and maintenance
            from one place.
          </p>
        </div>

        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Properties
            </p>

            <p className="mt-3 text-3xl font-bold">
              {loading ? "—" : propertyCount}
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Buildings and properties
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Units
            </p>

            <p className="mt-3 text-3xl font-bold">
              {loading ? "—" : unitCount}
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Total rental units
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Tenants
            </p>

            <p className="mt-3 text-3xl font-bold">
              {loading ? "—" : tenantCount}
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Active tenants
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Outstanding Rent
            </p>

            <p className="mt-3 text-3xl font-bold">
              {loading
                ? "—"
                : "KSh " + outstanding.toLocaleString()}
            </p>

            <p className="mt-2 text-sm text-slate-500">
              This month, currently unpaid
            </p>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border bg-white p-7 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-2xl">
              🏠
            </div>

            <h3 className="text-xl font-bold">Properties</h3>

            <p className="mt-2 max-w-md text-slate-600">
              Add and manage your buildings, apartments, rental
              units and vacancies.
            </p>

            <a
              href="/properties"
              className="mt-6 inline-block rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800"
            >
              Manage Properties
            </a>
          </div>

          <div className="rounded-2xl border bg-white p-7 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-2xl">
              👥
            </div>

            <h3 className="text-xl font-bold">Tenants</h3>

            <p className="mt-2 max-w-md text-slate-600">
              View tenants, assign them to units and send tenant
              invitations.
            </p>

            <a
              href="/tenants"
              className="mt-6 inline-block rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold hover:bg-slate-50"
            >
              Manage Tenants
            </a>
          </div>

          <div className="rounded-2xl border bg-white p-7 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-2xl">
              💰
            </div>

            <h3 className="text-xl font-bold">
              Rent & Payments
            </h3>

            <p className="mt-2 max-w-md text-slate-600">
              Track rent payments, invoices, arrears and payment
              history.
            </p>

            <a
              href="/payments"
              className="mt-6 inline-block rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold hover:bg-slate-50"
            >
              View Payments
            </a>
          </div>

          <div className="rounded-2xl border bg-white p-7 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-2xl">
              🚪
            </div>

            <h3 className="text-xl font-bold">Units</h3>

            <p className="mt-2 max-w-md text-slate-600">
              Add rental units to your properties and track
              occupancy.
            </p>

            <a
              href="/units"
              className="mt-6 inline-block rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold hover:bg-slate-50"
            >
              Manage Units
            </a>
          </div>

          <div className="rounded-2xl border bg-white p-7 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-2xl">
              🔧
            </div>

            <h3 className="text-xl font-bold">Maintenance</h3>

            <p className="mt-2 max-w-md text-slate-600">
              Track maintenance requests and keep your properties
              in good condition.
            </p>

            <a
              href="/maintenance"
              className="mt-6 inline-block rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold hover:bg-slate-50"
            >
              View Maintenance
            </a>
          </div>
        </section>
      </div>

      <footer className="mt-10 border-t bg-white px-6 py-6 text-center text-sm text-slate-500">
        © 2026 Managika Homes. Property management made simple.
      </footer>
    </main>
  );
}