"use client";

import { useEffect, useState } from "react";
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

type MaintenanceRequest = {
  id: string;
  status: string;
  urgency: string;
};

export default function LandlordDashboard() {
  const [propertyCount, setPropertyCount] = useState(0);
  const [unitCount, setUnitCount] = useState(0);
  const [tenantCount, setTenantCount] = useState(0);
  const [outstanding, setOutstanding] = useState(0);
  const [maintenanceCount, setMaintenanceCount] = useState(0);
  const [urgentMaintenance, setUrgentMaintenance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/landlord/login";
        return;
      }

      /*
       * SECURITY:
       * These queries rely on the Supabase RLS policies already
       * configured for the logged-in landlord.
       */

      const { count: properties } = await supabase
        .from("properties")
        .select("id", { count: "exact", head: true });

      const { count: units } = await supabase
        .from("units")
        .select("id", { count: "exact", head: true });

      const { count: tenants } = await supabase
        .from("tenants")
        .select("id", { count: "exact", head: true })
        .eq("status", "active");

      const { data: unitsWithRent } = await supabase
        .from("units")
        .select("base_rent, status");

      const rentExpected = (unitsWithRent || [])
        .filter((u) => u.status === "occupied")
        .reduce(
          (sum, u) => sum + (Number(u.base_rent) || 0),
          0
        );

      const period = currentPeriod();

      const { data: paymentsThisMonth } = await supabase
        .from("payments")
        .select("amount_paid, invoices(billing_period)");

      const collected = (paymentsThisMonth || [])
        .filter(
          (p: any) =>
            p.invoices?.billing_period === period
        )
        .reduce(
          (sum: number, p: any) =>
            sum + (Number(p.amount_paid) || 0),
          0
        );

      const { data: maintenanceRequests } = await supabase
        .from("maintenance_requests")
        .select("id, status, urgency");

      const requests =
        (maintenanceRequests || []) as MaintenanceRequest[];

      const openRequests = requests.filter(
        (r) => r.status !== "completed"
      );

      const urgentRequests = openRequests.filter(
        (r) => r.urgency === "urgent"
      );

      setPropertyCount(properties || 0);
      setUnitCount(units || 0);
      setTenantCount(tenants || 0);
      setOutstanding(
        Math.max(rentExpected - collected, 0)
      );
      setMaintenanceCount(openRequests.length);
      setUrgentMaintenance(urgentRequests.length);

      setLoading(false);
    }

    loadStats();
  }, []);

  const formatMoney = (amount: number) =>
    "KSh " + amount.toLocaleString();

  const steps = [
    {
      number: "①",
      icon: "🏠",
      title: "Properties",
      description: "Add and manage your buildings and apartments.",
      label: "Properties",
      value: propertyCount,
      button: "Manage Properties",
      href: "/properties",
    },
    {
      number: "②",
      icon: "🚪",
      title: "Units",
      description: "Add rental units inside your properties.",
      label: "Total Units",
      value: unitCount,
      button: "Manage Units",
      href: "/units",
    },
    {
      number: "③",
      icon: "👥",
      title: "Tenants",
      description: "Add tenants and assign them to units.",
      label: "Active Tenants",
      value: tenantCount,
      button: "Manage Tenants",
      href: "/tenants",
    },
    {
      number: "④",
      icon: "💰",
      title: "Payments",
      description: "Record rent and track outstanding payments.",
      label: "Outstanding Rent",
      value: outstanding,
      button: "View Payments",
      href: "/payments",
    },
    {
      number: "⑤",
      icon: "🔧",
      title: "Maintenance",
      description: "Record and track maintenance requests.",
      label: "Open Requests",
      value: maintenanceCount,
      button: "View Maintenance",
      href: "/maintenance",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              MANAGIKA HOMES
            </h1>
            <p className="text-sm text-slate-500">
              Property Management Made Simple
            </p>
          </div>

          <a
            href="/landlord/login"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Sign Out
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b bg-slate-900 text-white">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <p className="text-sm font-semibold uppercase tracking-widest text-slate-300">
            Landlord Portal
          </p>

          <h2 className="mt-2 text-3xl font-bold md:text-4xl">
            Dashboard
          </h2>

          <p className="mt-3 max-w-2xl text-slate-300">
            Follow the steps from left to right to manage your
            property.
          </p>
        </div>
      </section>

      {/* Main */}
      <section className="mx-auto max-w-7xl px-6 py-8">

        {/* Workflow */}
        <div className="mb-8">
          <div className="flex items-center gap-2 overflow-x-auto pb-4">
            {steps.map((step, index) => (
              <div
                key={step.number}
                className="flex min-w-[250px] flex-1 items-center"
              >
                <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">

                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-2xl font-bold text-slate-400">
                      {step.number}
                    </span>

                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-2xl">
                      {step.icon}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold">
                    {step.title}
                  </h3>

                  <p className="mt-2 min-h-[48px] text-sm leading-6 text-slate-500">
                    {step.description}
                  </p>

                  <div className="mt-5 rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {step.label}
                    </p>

                    <p className="mt-1 text-2xl font-bold text-slate-900">
                      {loading
                        ? "—"
                        : step.title === "Payments"
                        ? formatMoney(step.value)
                        : step.title === "Maintenance" &&
                          urgentMaintenance > 0
                        ? `${step.value} (${urgentMaintenance} urgent)`
                        : step.value}
                    </p>
                  </div>

                  <a
                    href={step.href}
                    className="mt-5 flex items-center justify-center rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                  >
                    {step.button}
                  </a>
                </div>

                {index < steps.length - 1 && (
                  <div className="hidden px-2 text-2xl font-bold text-slate-400 xl:block">
                    →
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="mb-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Properties
            </p>
            <p className="mt-2 text-3xl font-bold">
              {loading ? "—" : propertyCount}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Buildings and properties
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Units
            </p>
            <p className="mt-2 text-3xl font-bold">
              {loading ? "—" : unitCount}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Total rental units
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Active Tenants
            </p>
            <p className="mt-2 text-3xl font-bold">
              {loading ? "—" : tenantCount}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Currently active tenants
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Outstanding Rent
            </p>
            <p className="mt-2 text-3xl font-bold">
              {loading
                ? "—"
                : formatMoney(outstanding)}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              This month, currently unpaid
            </p>
          </div>
        </div>

        {/* Maintenance Alert */}
        {!loading && maintenanceCount > 0 && (
          <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-bold text-amber-900">
                  Maintenance requires attention
                </p>

                <p className="mt-1 text-sm text-amber-800">
                  You have {maintenanceCount} open maintenance{" "}
                  {maintenanceCount === 1
                    ? "request"
                    : "requests"}
                  {urgentMaintenance > 0 &&
                    `, including ${urgentMaintenance} urgent ${
                      urgentMaintenance === 1
                        ? "request"
                        : "requests"
                    }`}
                  .
                </p>
              </div>

              <a
                href="/maintenance"
                className="rounded-lg bg-amber-900 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-amber-800"
              >
                Review Maintenance
              </a>
            </div>
          </div>
        )}

        {/* Quick Navigation */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-bold">
            Quick Navigation
          </h3>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <a
              href="/properties"
              className="rounded-xl border border-slate-200 px-4 py-4 text-center font-semibold hover:bg-slate-50"
            >
              🏠 Properties
            </a>

            <a
              href="/units"
              className="rounded-xl border border-slate-200 px-4 py-4 text-center font-semibold hover:bg-slate-50"
            >
              🚪 Units
            </a>

            <a
              href="/tenants"
              className="rounded-xl border border-slate-200 px-4 py-4 text-center font-semibold hover:bg-slate-50"
            >
              👥 Tenants
            </a>

            <a
              href="/payments"
              className="rounded-xl border border-slate-200 px-4 py-4 text-center font-semibold hover:bg-slate-50"
            >
              💰 Payments
            </a>

            <a
              href="/maintenance"
              className="rounded-xl border border-slate-200 px-4 py-4 text-center font-semibold hover:bg-slate-50"
            >
              🔧 Maintenance
            </a>
          </div>
        </div>
      </section>

      <footer className="mt-10 border-t bg-white">
        <div className="mx-auto max-w-7xl px-6 py-6 text-center text-sm text-slate-500">
          © 2026 Managika Homes. Property management made simple.
        </div>
      </footer>
    </main>
  );
}