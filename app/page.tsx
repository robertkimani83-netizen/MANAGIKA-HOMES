export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              MANAGIKA HOMES
            </h1>
            <p className="text-sm text-gray-500">
              Property Management Made Simple
            </p>
          </div>

          <div className="flex gap-3">
            <button className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700">
              Tenant Login
            </button>
            <button className="px-4 py-2 rounded-lg bg-black text-white">
              Landlord Login
            </button>
          </div>
        </div>
      </header>

      {/* Dashboard */}
      <section className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">
            Landlord Dashboard
          </h2>
          <p className="text-gray-500 mt-1">
            Manage your properties, tenants and rent from one place.
          </p>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <p className="text-sm text-gray-500">Properties</p>
            <p className="text-3xl font-bold mt-2">0</p>
            <p className="text-sm text-gray-400 mt-2">
              Total properties
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <p className="text-sm text-gray-500">Units</p>
            <p className="text-3xl font-bold mt-2">0</p>
            <p className="text-sm text-gray-400 mt-2">
              Total rental units
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <p className="text-sm text-gray-500">Tenants</p>
            <p className="text-3xl font-bold mt-2">0</p>
            <p className="text-sm text-gray-400 mt-2">
              Active tenants
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <p className="text-sm text-gray-500">Outstanding Rent</p>
            <p className="text-3xl font-bold mt-2">KSh 0</p>
            <p className="text-sm text-gray-400 mt-2">
              Current arrears
            </p>
          </div>
        </div>

        {/* Main actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <div className="text-3xl mb-4">🏢</div>
            <h3 className="text-xl font-semibold">
              Properties
            </h3>
            <p className="text-gray-500 mt-2">
              Add and manage buildings, apartments, units and vacancies.
            </p>

            <button className="mt-5 px-4 py-2 rounded-lg bg-black text-white">
              Manage Properties
            </button>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <div className="text-3xl mb-4">👥</div>
            <h3 className="text-xl font-semibold">
              Tenants
            </h3>
            <p className="text-gray-500 mt-2">
              View tenants, assign units and manage tenant information.
            </p>

            <button className="mt-5 px-4 py-2 rounded-lg bg-black text-white">
              Manage Tenants
            </button>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <div className="text-3xl mb-4">💰</div>
            <h3 className="text-xl font-semibold">
              Rent & Payments
            </h3>
            <p className="text-gray-500 mt-2">
              Track rent payments, invoices, arrears and expenses.
            </p>

            <button className="mt-5 px-4 py-2 rounded-lg bg-black text-white">
              View Payments
            </button>
          </div>
        </div>

        {/* Recent activity */}
        <div className="bg-white rounded-xl p-6 shadow-sm border mt-8">
          <h3 className="text-xl font-semibold">
            Recent Activity
          </h3>

          <div className="mt-5 border-t pt-5 text-gray-500">
            No activity yet.
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white mt-10">
        <div className="max-w-7xl mx-auto px-6 py-6 text-sm text-gray-500">
          © 2026 Managika Homes. Property management made simple.
        </div>
      </footer>
    </main>
  );
}