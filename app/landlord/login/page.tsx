export default function LandlordLogin() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto flex min-h-[80vh] max-w-md items-center justify-center">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-slate-900">
              MANAGIKA HOMES
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Landlord Portal
            </p>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">
              Landlord Login
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Sign in to manage your properties and tenants.
            </p>
          </div>

          <form className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Email address
              </label>

              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Password
              </label>

              <input
                id="password"
                name="password"
                type="password"
                placeholder="Enter your password"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-slate-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                />
                Remember me
              </label>

              <button
                type="button"
                className="font-semibold text-slate-900 hover:underline"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800"
            >
              Sign In
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-400">OR</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            type="button"
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Create Landlord Account
          </button>

          <p className="mt-6 text-center text-sm text-slate-500">
            Are you a tenant?{" "}
            <a
              href="/tenant/login"
              className="font-semibold text-slate-900 hover:underline"
            >
              Tenant Login
            </a>
          </p>

          <div className="mt-6 text-center">
            <a
              href="/"
              className="text-sm font-medium text-slate-500 hover:text-slate-900"
            >
              ← Back to Managika Homes
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}