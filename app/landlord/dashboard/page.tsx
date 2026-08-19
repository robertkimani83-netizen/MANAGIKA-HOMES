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
  const [maintenanceCount, setMaintenanceCount] = useState(0);
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

      // =====================================================
      // 1. PROPERTIES
      // =====================================================

      const { data: landlordProperties, error: propertyError } =
        await supabase
          .from("properties")
          .select("id")
          .eq("landlord_id", landlordId);

      if (propertyError) {
        console.error("Properties error:", propertyError);
      }

      const propertyIds = (landlordProperties || []).map(
        (property) => property.id
      );

      setPropertyCount(propertyIds.length);

      // =====================================================
      // 2. UNITS
      // =====================================================

      let units: {
        id: string;
        base_rent: number;
        status: string;
      }[] = [];

      if (propertyIds.length > 0) {
        const { data: landlordUnits, error: unitError } =
          await supabase
            .from("units")
            .select("id, base_rent, status")
            .in("property_id", propertyIds);

        if (unitError) {
          console.error("Units error:", unitError);
        }

        units = landlordUnits || [];
      }

      const unitIds = units.map((unit) => unit.id);

      setUnitCount(units.length);

      // =====================================================
      // 3. TENANTS
      // =====================================================

      if (unitIds.length > 0) {
        const { count: tenants, error: tenantError } =
          await supabase
            .from("tenants")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq("status", "active")
            .in("unit_id", unitIds);

        if (tenantError) {
          console.error("Tenants error:", tenantError);
        }

        setTenantCount(tenants || 0);
      } else {
        setTenantCount(0);
      }

      // =====================================================
      // 4. EXPECTED RENT
      // =====================================================

      const rentExpected = units
        .filter((unit) => unit.status === "occupied")
        .reduce(
          (sum, unit) => sum + (Number(unit.base_rent) || 0),
          0
        );

      // =====================================================
      // 5. PAYMENTS
      // =====================================================

      let collected = 0;

      if (unitIds.length > 0) {
        const { data: landlordInvoices, error: invoiceError } =
          await supabase
            .from("invoices")
            .select("id, billing_period")
            .in("unit_id", unitIds);

        if (invoiceError) {
          console.error("Invoices error:", invoiceError);
        }

        const period = currentPeriod();

        const currentInvoiceIds = (landlordInvoices || [])
          .filter(
            (invoice) =>
              invoice.billing_period === period
          )
          .map((invoice) => invoice.id);

        if (currentInvoiceIds.length > 0) {
          const { data: payments, error: paymentError } =
            await supabase
              .from("payments")
              .select("amount_paid")
              .in("invoice_id", currentInvoiceIds);

          if (paymentError) {
            console.error("Payments error:", paymentError);
          }

          collected = (payments || []).reduce(
            (sum, payment) =>
              sum + (Number(payment.amount_paid) || 0),
            0
          );
        }
      }

      setOutstanding(
        Math.max(rentExpected - collected, 0)
      );

      // =====================================================
      // 6. MAINTENANCE REQUESTS
      // =====================================================

      if (unitIds.length > 0) {
        const { count: maintenance, error: maintenanceError } =
          await supabase
            .from("maintenance_requests")
            .select("id", {
              count: "exact",
              head: true,
            })
            .in("unit_id", unitIds)
            .eq("status", "submitted");

        if (maintenanceError) {
          console.error(
            "Maintenance error:",
            maintenanceError
          );
        }

        setMaintenanceCount(maintenance || 0);
      } else {
        setMaintenanceCount(0);
      }

      setLoading(false);
    }

    loadStats();
  }, [router]);

  // ===========================================================
  // DASHBOARD FLOW
  // ===========================================================

  const steps = [
    {
      number: "①",
      icon: "🏠",
      title: "Properties",
      description:
        "Add and manage your buildings and apartments.",
      count: propertyCount,
      label: "Properties",
      button: "Manage Properties",
      link: "/properties",
      money: false,
    },
    {
      number: "②",
      icon: "🚪",
      title: "Units",
      description:
        "Add rental units inside your properties.",
      count: unitCount,
      label: "Total Units",
      button: "Manage Units",
      link: "/units",
      money: false,
    },
    {
      number: "③",
      icon: "👥",
      title: "Tenants",
      description:
        "Add tenants and assign them to units.",
      count: tenantCount,
      label: "Active Tenants",
      button: "Manage Tenants",
      link: "/tenants",
      money: false,
    },
    {
      number: "④",
      icon: "💰",
      title: "Payments",
      description:
        "Record rent and track outstanding payments.",
      count: outstanding,
      label: "Outstanding Rent",
      button: "View Payments",
      link: "/payments",
      money: true,
    },
    {
      number: "⑤",
      icon: "🔧",
      title: "Maintenance",
      description:
        "Record and track maintenance requests.",
      count: maintenanceCount,
      label: "Open Requests",
      button: "View Maintenance",
      link: "/maintenance",
      money: false,
    },
  ];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">

      {/* HEADER */}

      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-6 py-5">

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

      {/* MAIN */}

      <div className="mx-auto max-w-[1500px] px-6 py-8">

        <div className="mb-8">

          <h2 className="text-3xl font-bold">
            Dashboard
          </h2>

          <p className="mt-2 text-slate-600">
            Follow the steps from left to right to manage
            your property.
          </p>

        </div>

        {/* =====================================================
            MAIN PROPERTY MANAGEMENT FLOW
        ===================================================== */}

        <section className="flex items-stretch gap-3 overflow-x-auto pb-4">

          {steps.map((step, index) => (

            <div
              key={step.number}
              className="flex min-w-[245px] flex-1 items-center"
            >

              <div className="w-full rounded-2xl border bg-white p-6 shadow-sm">

                {/* NUMBER + ICON */}

                <div className="flex items-center justify-between">

                  <span className="text-3xl font-bold">
                    {step.number}
                  </span>

                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-2xl">
                    {step.icon}
                  </div>

                </div>

                {/* TITLE */}

                <h3 className="mt-5 text-xl font-bold">
                  {step.title}
                </h3>

                {/* DESCRIPTION */}

                <p className="mt-2 min-h-[48px] text-sm text-slate-600">
                  {step.description}
                </p>

                {/* NUMBER */}

                <div className="mt-5 border-t pt-4">

                  <p className="text-sm text-slate-500">
                    {step.label}
                  </p>

                  <p className="mt-1 text-2xl font-bold">

                    {loading
                      ? "—"
                      : step.money
                      ? `KSh ${Number(
                          step.count
                        ).toLocaleString()}`
                      : step.count}

                  </p>

                </div>

                {/* BUTTON */}

                <a
                  href={step.link}
                  className="mt-5 block rounded-lg bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-slate-800"
                >
                  {step.button}
                </a>

              </div>

              {/* ARROW */}

              {index < steps.length - 1 && (

                <div className="px-1 text-3xl font-bold text-slate-400">
                  →
                </div>

              )}

            </div>

          ))}

        </section>

        {/* =====================================================
            SETUP ORDER
        ===================================================== */}

        <section className="mt-8 rounded-2xl border bg-white p-7 shadow-sm">

          <h3 className="text-xl font-bold">
            Property Setup Order
          </h3>

          <div className="mt-6 rounded-xl bg-slate-50 p-5 text-center">

            <p className="text-lg font-bold">
              ① Properties → ② Units → ③ Tenants → ④ Payments → ⑤ Maintenance
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Follow this order when setting up a new property.
            </p>

          </div>

        </section>

      </div>

      {/* FOOTER */}

      <footer className="mt-10 border-t bg-white px-6 py-6 text-center text-sm text-slate-500">
        © 2026 Managika Homes. Property management made simple.
      </footer>

    </main>
  );
}