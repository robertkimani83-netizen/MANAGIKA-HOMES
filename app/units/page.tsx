export default function UnitsPage() {
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

          <a
            href="/"
            className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700"
          >
            Dashboard
          </a>
        </div>
      </header>

      {/* Content */}
      <section className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">
              Units
            </h2>
            <p className="text-gray-500 mt-1">
              Manage rental units, tenants and occupancy.
            </p>
          </div>

          <button className="px-5 py-3 rounded-lg bg-black text-white font-medium">
            + Add Unit
          </button>
        </div>

        {/* Unit summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
          <div className="bg-white rounded-xl p-6 border shadow-sm">
            <p className="text-sm text-gray-500">Total Units</p>
            <p className="text-3xl font-bold mt-2">0</p>
          </div>

          <div className="bg-white rounded-xl p-6 border shadow-sm">
            <p className="text-sm text-gray-500">Occupied</p>
            <p className="text-3xl font-bold mt-2">0</p>
          </div>

          <div className="bg-white rounded-xl p-6 border shadow-sm">
            <p className="text-sm text-gray-500">Vacant</p>
            <p className="text-3xl font-bold mt-2">0</p>
          </div>

          <div className="bg-white rounded-xl p-6 border shadow-sm">
            <p className="text-sm text-gray-500">Monthly Rent</p>
            <p className="text-3xl font-bold mt-2">KSh 0</p>
          </div>
        </div>

        {/* Empty state */}
        <div className="bg-white rounded-xl border shadow-sm p-10 text-center">
          <div className="text-5xl mb-5">🚪</div>

          <h3 className="text-2xl font-semibold text-gray-900">
            No units yet
          </h3>

          <p className="text-gray-500 max-w-md mx-auto mt-2">
            Add units to your properties so you can track rent,
            tenants and occupancy.
          </p>

          <button className="mt-6 px-5 py-3 rounded-lg bg-black text-white font-medium">
            + Add Your First Unit
          </button>
        </div>

        {/* Unit information */}
        <div className="mt-8 bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b">
            <h3 className="text-xl font-semibold">
              Unit Information
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                    Unit
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                    Property
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                    Tenant
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                    Monthly Rent
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-gray-500"
                  >
                    No units have been added yet.
                  </td>
                </tr>
              </tbody>
            </table>
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