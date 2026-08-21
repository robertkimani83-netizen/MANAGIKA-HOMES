export default function Home() {
return (
<main className="min-h-screen bg-slate-50">
<section className="city-skyline-hero relative flex min-h-screen flex-col justify-between overflow-hidden px-6 py-10">
<div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400" />

    <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">MANAGIKA HOMES</h1>
        <p className="text-sm text-slate-600">Property Management Made Simple</p>
      </div>
    </div>

    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center py-16 text-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/50 bg-amber-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-amber-700">
        Property management, reimagined
      </span>

      <h2 className="mt-6 max-w-3xl text-4xl font-bold leading-tight text-slate-900 md:text-6xl">
        Where Landlords and Tenants
        <span className="block bg-gradient-to-r from-amber-300 via-orange-400 to-amber-300 bg-clip-text text-transparent">Meet, Simply.</span>
      </h2>

      <p className="mt-6 max-w-xl text-lg text-slate-600">One home for your properties, your rent, your maintenance and your peace of mind — whichever side of the door you're on.</p>

      <div className="mt-10 flex flex-col gap-4 sm:flex-row">
        <a href="/landlord/login" className="rounded-lg bg-amber-500 px-8 py-4 text-base font-semibold text-slate-900 shadow-lg shadow-amber-500/20 transition hover:-translate-y-0.5 hover:bg-amber-400 hover:shadow-amber-500/30">I'm a Landlord</a>
        <a href="/tenant/login" className="rounded-lg border-2 border-slate-300 bg-white/70 px-8 py-4 text-base font-semibold text-slate-900 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white">I'm a Tenant</a>
      </div>
    </div>

    <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-4 border-t border-slate-900/10 pt-8 text-center sm:grid-cols-4">
      <div>
        <p className="text-2xl">🏠</p>
        <p className="mt-2 text-sm text-slate-600">Properties & Units</p>
      </div>
      <div>
        <p className="text-2xl">💰</p>
        <p className="mt-2 text-sm text-slate-600">Rent & Payments</p>
      </div>
      <div>
        <p className="text-2xl">🔧</p>
        <p className="mt-2 text-sm text-slate-600">Maintenance Requests</p>
      </div>
      <div>
        <p className="text-2xl">👥</p>
        <p className="mt-2 text-sm text-slate-600">Tenant Records</p>
      </div>
    </div>
  </section>

  <footer className="border-t bg-white">
    <div className="mx-auto max-w-6xl px-6 py-6 text-center text-sm text-slate-500">© 2026 Managika Homes. Property management made simple.</div>
  </footer>
</main>

);
}
