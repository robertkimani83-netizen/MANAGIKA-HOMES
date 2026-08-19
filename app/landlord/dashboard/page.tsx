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

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/landlord/login");
        return;
      }

      const landlordId = user.id;

      // PROPERTIES
      const { count: properties } = await supabase
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("landlord_id", landlordId);

      // GET THIS LANDLORD'S PROPERTY IDS
      const { data: landlordProperties } = await supabase
        .from("properties")
        .select("id")
        .eq("landlord_id", landlordId);

      const propertyIds = (landlordProperties || []).map(
        (p) => p.id
      );

      // UNITS
      let unitsWithRent: {
        base_rent: number;
        status: string;
      }[] = [];

      if (propertyIds.length > 0) {
        const { data: units } = await supabase
          .from("units")
          .select("base_rent, status")
          .in("property_id", propertyIds);

        unitsWithRent = units || [];
      }

      // TENANTS
      let tenantCountValue = 0;

      if (propertyIds.length > 0) {
        const { data: landlordUnits } = await supabase
          .from("units")
          .select("id")
          .in("property_id", propertyIds);

        const unitIds = (landlordUnits || []).map(
          (u) => u.id
        );

        if (unitIds.length > 0) {
          const { count: tenants } = await supabase
            .from("tenants")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq("status", "active")
            .in("unit_id", unitIds);

          tenantCountValue = tenants || 0;
        }
      }

      // EXPECTED RENT
      const rentExpected = unitsWithRent
        .filter((u) => u.status === "occupied")
        .reduce(
          (sum, u) => sum + (Number(u.base_rent) || 0),
          0
        );

      // PAYMENTS
      let collected = 0;

      if (propertyIds.length > 0) {
        const { data: landlordUnits } = await supabase
          .from("units")
          .select("id")
          .in("property_id", propertyIds);

        const unitIds = (landlordUnits || []).map(
          (u) => u.id
        );

        if (unitIds.length > 0) {
          const { data: invoices } = await supabase
            .from("invoices")
            .select("id")
            .in("unit_id", unitIds);

          const invoiceIds = (invoices || []).map(
            (i) => i.id
          );

          if (invoiceIds.length > 0) {
            const { data: payments } = await supabase
              .from("payments")
              .select(
                "amount_paid, invoices(billing_period)"
              )
              .in("invoice_id", invoiceIds);

            const period = currentPeriod();

            collected = (payments || [])
              .filter(
                (p: any) =>
                  p.invoices?.billing_period === period
              )
              .reduce(
                (sum: number, p: any) =>
                  sum + (Number(p.amount_paid) || 0),
                0
              );
          }
        }
      }

      setPropertyCount(properties || 0);
      setUnitCount(unitsWithRent.length);
      setTenantCount(tenantCountValue);
      setOutstanding(
        Math.max(rentExpected - collected, 0)
      );

      setLoading(false);
    }

    loadStats();
  }, [router]);

  const nextStep =
    propertyCount === 0
      ? 1
      : unitCount === 0
      ? 2
      : tenantCount === 0
      ? 3
      : 4;

  const steps = [
    {
      number: 1,
      icon: "🏠",
      title: "Properties",
      description:
        "Create your building or apartment first.",
      button: "Manage Properties",
      href: "/properties",
      complete: propertyCount > 0,
    },
    {
      number: 2,
      icon: "🚪",
      title: "Units",
      description:
        "Add the rental units inside your property.",
      button: "Manage Units",
      href: "/units",
      complete: unitCount > 0,
    },
    {
      number: 3,
      icon: "👥",
      title: "Tenants",
      description:
        "Add tenants and assign them to units.",
      button: "Manage Tenants",
      href: "/tenants",
      complete: tenantCount > 0,
    },
    {
      number: 4,
      icon: "💰",
      title: "Payments",
      description:
        "Record rent payments and track outstanding rent.",
      button: "View Payments",
      href: "/payments",
      complete: false,
    },
    {
      number: 5,
      icon: "🔧",
      title: "Maintenance",
      description:
        "Track and manage maintenance requests.",
      button: "View Maintenance",
      href: "/maintenance",
      complete: false,
    },
  ];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-xl font-bold">
              MANAGIKA HOMES
            </h1>
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
          <h2 className="text-3xl font-bold">
            Dashboard
          </h2>

          <p className="mt-2 text-slate-600">
            Manage your properties, tenants, rent and
            maintenance from one place.
          </p>
        </div>

        {/* SUMMARY */}
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
                : "KSh " +
                  outstanding.toLocaleString()}
            </p>

            <p className="mt-2 text-sm text-slate-500">
              This month, currently unpaid
            </p>
          </div>
        </section>

        {/* WORKFLOW */}
        <section className="mt-10">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">
              How to get started
            </h2>

            <p className="mt-1 text-slate-600">
              Follow these steps to set up and manage your
              property.
            </p>
          </div>

          <div className="space-y-4">
            {steps.map((step) => {
              const isNext = step.number === nextStep;
              const isComplete = step.complete;

              return (
                <div key={step.number}>
                  <div
                    className={`rounded-2xl border bg-white p-6 shadow-sm ${
                      isNext
                        ? "border-slate-900 ring-2 ring-slate-100"
                        : ""
                    }`}
                  >
                    <div className="flex flex-col gap-5 md:flex-row md:items-center">
                      <div
                        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-bold ${
                          isComplete
                            ? "bg-slate-900 text-white"
                            : isNext
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {isComplete
                          ? "✓"
                          : step.number}
                      </div>

                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-2xl">
                            {step.icon}
                          </span>

                          <h3 className="text-xl font-bold">
                            {step.title}
                          </h3>

                          {isComplete && (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                              Complete
                            </span>
                          )}

                          {isNext && (
                            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                              Next step
                            </span>
                          )}
                        </div>

                        <p className="mt-2 text-slate-600">
                          {step.description}
                        </p>
                      </div>

                      <a
                        href={step.href}
                        className={`rounded-lg px-5 py-3 text-center font-semibold ${
                          isNext
                            ? "bg-slate-900 text-white hover:bg-slate-800"
                            : "border border-slate-300 bg-white hover:bg-slate-50"
                        }`}
                      >
                        {step.button}
                      </a>
                    </div>
                  </div>

                  {step.number < 5 && (
                    <div className="flex justify-center py-2">
                      <div className="text-xl text-slate-300">
                        ↓
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <footer className="mt-10 border-t bg-white px-6 py-6 text-center text-sm text-slate-500">
        © 2026 Managika Homes. Property management made
        simple.
      </footer>
    </main>
  );
}