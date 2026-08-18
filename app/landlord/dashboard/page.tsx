export default function LandlordDashboard() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-xl font-bold">MANAGIKA HOMES</h1>
            <p className="text-sm text-slate-500">Landlord Dashboard</p>
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
        {/* Welcome */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold">Dashboard</h2>
          <p className="mt-2 text-slate-600">
            Manage your properties, tenants, rent and maintenance from one
            place.
          </p>
        </div>

        {/* Statistics */}
        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Properties</p>
            <p className="mt-3 text-3xl font-bold">0</p>
            <p className="mt-2 text-sm text-slate-500">
              Buildings and properties
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Units</p>
            <p className="mt-3 text-3xl font-bold">0</p>
            <p className="mt-2 text-sm text-slate-500">
              Total rental units
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Tenants</p>
            <p className="mt-3 text-3xl font-bold">0</p>
            <p className="mt-2 text-sm text-slate-500">
              Active tenants
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Outstanding Rent
            </p>
            <p className="mt-3 text-3xl font-bold">KSh 0</p>
            <p className="mt-2 text-sm text-slate-500">
              Currently unpaid
            </p>
          </div>
        </section>

        {/* Main Actions */}
        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* Properties */}
          <div className="rounded-2xl border bg-white p-7 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-2xl">
                  🏠
                </div>

                <h3 className="text-xl font-bold">Properties</h3>

                <p className="mt-2 max-w-md text-slate-600">
                  Add and manage your buildings, apartments, rental units and
                  vacancies.
                </p>
              </div>
            </div>

            <a
              href="/properties"
              className="mt-6 inline-block rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800"
            >
              Manage Properties
            </a>
          </div>

          {/* Tenants */}
          <div className="rounded-2xl border bg-white p-7 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-2xl">
              👥
            </div>

            <h3 className="text-xl font-bold">Tenants</h3>

            <p className="mt-2 max-w-md text-slate-600">
              View tenants, assign them to units and send tenant invitations.
            </p>

            <a
              href="/tenants"
              className="mt-6 inline-block rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold hover:bg-slate-50"
            >
              Manage Tenants
            </a>
          </div>

          {/* Rent */}
          <div className="rounded-2xl border bg-white p-7 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-2xl">
              💰
            </div>

            <h3 className="text-xl font-bold">Rent & Payments</h3>

            <p className="mt-2 max-w-md text-slate-600">
              Track rent payments, invoices, arrears and payment history.
            </p>

            <a
              href="/payments"
              className="mt-6 inline-block rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold hover:bg-slate-50"
            >
              View Payments
            </a>
          </div>

          {/* Maintenance */}
          <div className="rounded-2xl border bg-white p-7 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-2xl">
              🔧
            </div>

            <h3 className="text-xl font-bold">Maintenance</h3>

            <p className="mt-2 max-w-md text-slate-600">
              Track maintenance requests and keep your properties in good
              condition.
            </p>

            <button className="mt-6 rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold hover:bg-slate-50">
              View Maintenance
            </button>
          </div>
        </section>

        {/* Recent Activity */}
        <section className="mt-8 rounded-2xl border bg-white p-7 shadow-sm">
          <h3 className="text-xl font-bold">Recent Activity</h3>

          <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center">
            <p className="font-semibold text-slate-700">
              No activity yet
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Your property, tenant and payment activity will appear here.
            </p>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="mt-10 border-t bg-white px-6 py-6 text-center text-sm text-slate-500">
        © 2026 Managika Homes. Property management made simple.
      </footer>
    </main>
  );
}