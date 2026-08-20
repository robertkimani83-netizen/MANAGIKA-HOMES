export default function Home() {
return (
<main className="min-h-screen bg-slate-50 flex flex-col">
<header className="border-b bg-white">
<div className="mx-auto max-w-7xl px-6 py-5">
<h1 className="text-2xl font-bold text-slate-900">MANAGIKA HOMES</h1>
<p className="text-sm text-slate-500">Property Management Made Simple</p>
</div>
</header>

  <section className="flex flex-1 items-center justify-center px-6 py-16">
    <div className="w-full max-w-md text-center">
      <h2 className="text-3xl font-bold text-slate-900">Welcome</h2>
      <p className="mt-3 text-slate-600">Choose how you'd like to sign in.</p>

      <div className="mt-8 flex flex-col gap-4">
        
          href="/landlord/login"
          className="rounded-lg bg-slate-900 px-6 py-4 font-semibold text-white hover:bg-slate-800"
        >
          Landlord Login
        </a>
        
          href="/tenant/login"
          className="rounded-lg border border-slate-300 bg-white px-6 py-4 font-semibold text-slate-700 hover:bg-slate-50"
        >
          Tenant Login
        </a>
      </div>
    </div>
  </section>

  <footer className="border-t bg-white">
    <div className="mx-auto max-w-7xl px-6 py-6 text-center text-sm text-slate-500">
      © 2026 Managika Homes. Property management made simple.
    </div>
  </footer>
</main>

);
}