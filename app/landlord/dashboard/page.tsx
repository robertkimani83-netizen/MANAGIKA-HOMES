"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type DashboardStats = {
  propertyCount: number;
  unitCount: number;
  tenantCount: number;
  outstanding: number;
  maintenanceCount: number;
};

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

  const [stats, setStats] = useState<DashboardStats>({
    propertyCount: 0,
    unitCount: 0,
    tenantCount: 0,
    outstanding: 0,
    maintenanceCount: 0,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/landlord/login");
        return;
      }

      const landlordId = user.id;

      /*
       * PROPERTIES
       */
      const { count: propertyCount } = await supabase
        .from("properties")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("landlord_id", landlordId);

      /*
       * UNITS
       *
       * We first get the landlord's properties,
       * then only count units belonging to those properties.
       */
      const { data: landlordProperties } = await supabase
        .from("properties")
        .select("id")
        .eq("landlord_id", landlordId);

      const propertyIds = (landlordProperties || []).map(
        (property) => property.id
      );

      let unitCount = 0;
      let landlordUnits: {
        id: string;
        base_rent: number;
        status: string;
        property_id: string;
      }[] = [];

      if (propertyIds.length > 0) {
        const { data: units } = await supabase
          .from("units")
          .select("id, base_rent, status, property_id")
          .in("property_id", propertyIds);

        landlordUnits = units || [];
        unitCount = landlordUnits.length;
      }

      /*
       * TENANTS
       *
       * Only tenants assigned to this landlord's units.
       */
      let tenantCount = 0;
      let tenantIds: string[] = [];

      const unitIds = landlordUnits.map((unit) => unit.id);

      if (unitIds.length > 0) {
        const { data: tenants } = await supabase
          .from("tenants")
          .select("id")
          .eq("status", "active")
          .in("unit_id", unitIds);

        tenantIds = (tenants || []).map((tenant) => tenant.id);
        tenantCount = tenantIds.length;
      }

      /*
       * EXPECTED RENT
       *
       * Only occupied units belonging to this landlord.
       */
      const rentExpected = landlordUnits
        .filter((unit) => unit.status === "occupied")
        .reduce(
          (sum, unit) => sum + (Number(unit.base_rent) || 0),
          0
        );

      /*
       * PAYMENTS
       *
       * Only payments belonging to this landlord's tenants/invoices.
       */
      const period = currentPeriod();

      let collected = 0;

      if (tenantIds.length > 0) {
        const { data: invoices } = await supabase
          .from("invoices")
          .select("id")
          .in("tenant_id", tenantIds)
          .eq("billing_period", period);

        const invoiceIds = (invoices || []).map(
          (invoice) => invoice.id
        );

        if (invoiceIds.length > 0) {
          const { data: payments } = await supabase
            .from("payments")
            .select("amount_paid")
            .in("invoice_id", invoiceIds);

          collected = (payments || []).reduce(
            (sum, payment) =>
              sum + (Number(payment.amount_paid) || 0),
            0
          );
        }
      }

      const outstanding = Math.max(
        rentExpected - collected,
        0
      );

      /*
       * MAINTENANCE
       *
       * Only requests belonging to this landlord's units.
       */
      let maintenanceCount = 0;

      if (unitIds.length > 0) {
        const { count } = await supabase
          .from("maintenance_requests")
          .select("id", {
            count: "exact",
            head: true,
          })
          .in("unit_id", unitIds)
          .neq("status", "completed");

        maintenanceCount = count || 0;
      }

      setStats({
        propertyCount: propertyCount || 0,
        unitCount,
        tenantCount,
        outstanding,
        maintenanceCount,
      });

      setLoading(false);
    }

    loadDashboard();
  }, [router]);

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
            Follow the steps from left to right to manage your
            property.
          </p>
        </div>

        {/* SETUP FLOW */}

        <section className="mb-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
            
            {/* 1 PROPERTIES */}

            <div className="relative flex-1 rounded-2xl border bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-2xl font-bold">
                  ①
                </span>

                <span className="text-2xl">
                  🏠
                </span>
              </div>

              <h3 className="text-xl font-bold">
                Properties
              </h3>

              <p className="mt-2 text-sm text-slate-600">
                Add and manage your buildings and apartments.
              </p>

              <p className="mt-5 text-sm font-medium text-slate-500">
                Properties
              </p>

              <p className="mt-1 text-3xl font-bold">
                {loading ? "—" : stats.propertyCount}
              </p>

              <a
                href="/properties"
                className="mt-5 inline-block rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800"
              >
                Manage Properties
              </a>

              <div className="mt-4 text-right text-2xl font-bold text-slate-400">
                →
              </div>
            </div>

            {/* 2 UNITS */}

            <div className="relative flex-1 rounded-2xl border bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-2xl font-bold">
                  ②
                </span>

                <span className="text-2xl">
                  🚪
                </span>
              </div>

              <h3 className="text-xl font-bold">
                Units
              </h3>

              <p className="mt-2 text-sm text-slate-600">
                Add rental units inside your properties.
              </p>

              <p className="mt-5 text-sm font-medium text-slate-500">
                Total Units
              </p>

              <p className="mt-1 text-3xl font-bold">
                {loading ? "—" : stats.unitCount}
              </p>

              <a
                href="/units"
                className="mt-5 inline-block rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold hover:bg-slate-50"
              >
                Manage Units
              </a>

              <div className="mt-4 text-right text-2xl font-bold text-slate-400">
                →
              </div>
            </div>

            {/* 3 TENANTS */}

            <div className="relative flex-1 rounded-2xl border bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-2xl font-bold">
                  ③
                </span>

                <span className="text-2xl">
                  👥
                </span>
              </div>

              <h3 className="text-xl font-bold">
                Tenants
              </h3>

              <p className="mt-2 text-sm text-slate-600">
                Add tenants and assign them to units.
              </p>

              <p className="mt-5 text-sm font-medium text-slate-500">
                Active Tenants
              </p>

              <p className="mt-1 text-3xl font-bold">
                {loading ? "—" : stats.tenantCount}
              </p>

              <a
                href="/tenants"
                className="mt-5 inline-block rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold hover:bg-slate-50"
              >
                Manage Tenants
              </a>

              <div className="mt-4 text-right text-2xl font-bold text-slate-400">
                →
              </div>
            </div>

            {/* 4 PAYMENTS */}

            <div className="relative flex-1 rounded-2xl border bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-2xl font-bold">
                  ④
                </span>

                <span className="text-2xl">
                  💰
                </span>
              </div>

              <h3 className="text-xl font-bold">
                Payments
              </h3>

              <p className="mt-2 text-sm text-slate-600">
                Record rent and track outstanding payments.
              </p>

              <p className="mt-5 text-sm font-medium text-slate-500">
                Outstanding Rent
              </p>

              <p className="mt-1 text-3xl font-bold">
                {loading
                  ? "—"
                  : "KSh " +
                    stats.outstanding.toLocaleString()}
              </p>

              <a
                href="/payments"
                className="mt-5 inline-block rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold hover:bg-slate-50"
              >
                View Payments
              </a>

              <div className="mt-4 text-right text-2xl font-bold text-slate-400">
                →
              </div>
            </div>

            {/* 5 MAINTENANCE */}

            <div className="relative flex-1 rounded-2xl border bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-2xl font-bold">
                  ⑤
                </span>

                <span className="text-2xl">
                  🔧
                </span>
              </div>

              <h3 className="text-xl font-bold">
                Maintenance
              </h3>

              <p className="mt-2 text-sm text-slate-600">
                Record and track maintenance requests.
              </p>

              <p className="mt-5 text-sm font-medium text-slate-500">
                Open Requests
              </p>

              <p className="mt-1 text-3xl font-bold">
                {loading
                  ? "—"
                  : stats.maintenanceCount}
              </p>

              <a
                href="/maintenance"
                className="mt-5 inline-block rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold hover:bg-slate-50"
              >
                View Maintenance
              </a>
            </div>
          </div>
        </section>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h3 className="text-xl font-bold">
            Property Setup Order
          </h3>

          <p className="mt-2 text-slate-600">
            Start with your properties, then create units,
            assign tenants, record rent and manage maintenance.
          </p>
        </div>
      </div>

      <footer className="mt-10 border-t bg-white px-6 py-6 text-center text-sm text-slate-500">
        © 2026 Managika Homes. Property management made simple.
      </footer>
    </main>
  );
}