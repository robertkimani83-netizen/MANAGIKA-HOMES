export default function PaymentsPage() {
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
              Rent & Payments
            </h2>
            <p className="text-gray-500 mt-1">
              Track rent, payments, invoices and outstanding balances.
            </p>
          </div>

          <button className="px-5 py-3 rounded-lg bg-black text-white font-medium">
            + Record Payment
          </button>
        </div>

        {/* Payment summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
          <div className="bg-white rounded-xl p-6 border shadow-sm">
            <p className="text-sm text-gray-500">Rent Expected</p>
            <p className="text-3xl font-bold mt-2">KSh 0</p>
          </div>

          <div className="bg-white rounded-xl p-6 border shadow-sm">
            <p className="text-sm text-gray-500">Rent Collected</p>
            <p className="text-3xl font-bold mt-2">KSh 0</p>
          </div>

          <div className="bg-white rounded-xl p-6 border shadow-sm">
            <p className="text-sm text-gray-500">Outstanding</p>
            <p className="text-3xl font-bold mt-2">KSh 0</p>
          </div>

          <div className="bg-white rounded-xl p-6 border shadow-sm">
            <p className="text-sm text-gray-500">Payments</p>
            <p className="text-3xl font-bold mt-2">0</p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 border shadow-sm">
            <div className="text-3xl mb-4">💳</div>
            <h3 className="text-xl font-semibold">
              Record Payment
            </h3>
            <p className="text-gray-500 mt-2">
              Record a rent payment received from a tenant.
            </p>
            <button className="mt-5 px-4 py-2 rounded-lg bg-black text-white">
              Record Payment
            </button>
          </div>

          <div className="bg-white rounded-xl p-6 border shadow-sm">
            <div className="text-3xl mb-4">📄</div>
            <h3 className="text-xl font-semibold">
              Rent Invoices
            </h3>
            <p className="text-gray-500 mt-2">
              Create and manage monthly rent invoices.
            </p>
            <button className="mt-5 px-4 py-2 rounded-lg bg-black text-white">
              View Invoices
            </button>
          </div>

          <div className="bg-white rounded-xl p-6 border shadow-sm">
            <div className="text-3xl mb-4">⚠️</div>
            <h3 className="text-xl font-semibold">
              Arrears
            </h3>
            <p className="text-gray-500 mt-2">
              See tenants with outstanding rent balances.
            </p>
            <button className="mt-5 px-4 py-2 rounded-lg bg-black text-white">
              View Arrears
            </button>
          </div>
        </div>

        {/* Payment table */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b">
            <h3 className="text-xl font-semibold">
              Recent Payments
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                    Tenant
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                    Unit
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                    Amount
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                    Date
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                    Method
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-10 text-center text-gray-500"
                  >
                    No payments have been recorded yet.
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