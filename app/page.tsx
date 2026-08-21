export default function Home() {
return (
<main className="min-h-screen bg-slate-50">
<section className="city-skyline-hero relative flex min-h-screen flex-col justify-between overflow-hidden px-6 py-10">
<div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400" />

    <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-black">MANAGIKA HOMES</h1>
        <p className="text-sm font-semibold text-slate-800">Property Management Made Simple</p>
      </div>
    </div>

    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center py-16 text-center">
      <div className="rounded-3xl bg-white/80 px-6 py-10 shadow-lg backdrop-blur-sm sm:px-12 sm:py-14">
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/60 bg-amber-100 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-amber-800">
          Property management, reimagined
        </span>

        <h2 className="mt-6 max-w-3xl text-4xl font-extrabold leading-tight text-black md:text-6xl">
          Where Landlords and Tenants
          <span className="block bg-gradient-to-r from-amber-500 via-orange-600 to-amber-500 bg-clip-text text-transparent">Meet, Simply.</span>
        </h2>

        <p className="mt-6 max-w-xl text-lg font-medium text-slate-800">One home for your properties, your rent, your maintenance and your peace of mind — whichever side of the door you're on.</p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
          <a href="/landlord/login" className="rounded-lg bg-amber-500 px-8 py-4 text-base font-bold text-slate-900 shadow-lg shadow-amber-500/20 transition hover:-translate-y-0.5 hover:bg-amber-400 hover:shadow-amber-500/30">I'm a Landlord</a>
          <a href="/tenant/login" className="rounded-lg border-2 border-slate-400 bg-white px-8 py-4 text-base font-bold text-slate-900 transition hover:-translate-y-0.5 hover:bg-slate-50">I'm a Tenant</a>
        </div>
      </div>
    </div>

    <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-4 border-t border-slate-900/10 pt-8 text-center sm:grid-cols-4">
      <div>
        <p className="text-2xl">🏠</p>
        <p className="mt-2 text-sm font-semibold text-slate-800">Properties & Units</p>
      </div>
      <div>
        <p className="text-2xl">💰</p>
        <p className="mt-2 text-sm font-semibold text-slate-800">Rent & Payments</p>
      </div>
      <div>
        <p className="text-2xl">🔧</p>
        <p className="mt-2 text-sm font-semibold text-slate-800">Maintenance Requests</p>
      </div>
      <div>
        <p className="text-2xl">👥</p>
        <p className="mt-2 text-sm font-semibold text-slate-800">Tenant Records</p>
      </div>
    </div>
  </section>

  <footer className="border-t bg-white">
    <div className="mx-auto max-w-6xl px-6 py-6 text-center text-sm text-slate-500">© 2026 Managika Homes. Property management made simple.</div>
  </footer>
</main>

);
}
