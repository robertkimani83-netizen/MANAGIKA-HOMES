import type { Metadata } from "next";
import Link from "next/link";

// Index of landlord guides. Add each new guide to GUIDES (newest first) and
// to app/sitemap.ts.
const GUIDES = [
  {
    href: "/guides/track-mpesa-rent-payments",
    title: "How to Track M-Pesa Rent Payments From Tenants",
    blurb: "Set up your Paybill or Till so every payment can be matched to the right unit, and a simple monthly routine.",
    date: "18 October 2026",
  },
];

export const metadata: Metadata = {
  title: "Landlord Guides",
  description: "Practical guides for landlords in Kenya on collecting rent, M-Pesa payments and managing tenants.",
  alternates: { canonical: "/guides" },
};

export default function GuidesIndex() {
  return (
    <main>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Work+Sans:wght@400;500;600;700&display=swap"
      />
      <style>{`
        .gi-root{ --ink:#12213a; --muted:#5b6472; --gold:#c98a3e; --paper:#f8f5ef; --card:#ffffff; --card-border:#e7e1d6; }
        @media (prefers-color-scheme: dark){
          .gi-root{ --ink:#eef1f6; --muted:#a3afc2; --gold:#e3ab5f; --paper:#0a1220; --card:#101b2e; --card-border:#223252; }
        }
        .gi-root{ min-height:100vh; background:var(--paper); color:var(--ink); font-family:"Work Sans", -apple-system, "Segoe UI", sans-serif; line-height:1.6; }
        .gi-root h1, .gi-root h2{ font-family:"Fraunces", Georgia, serif; margin:0; color:var(--ink); }
        .gi-nav{ background:#12213a; }
        .gi-nav-inner{ max-width:720px; margin:0 auto; padding:14px 20px; }
        .gi-root .gi-brand{ text-decoration:none; font-family:"Fraunces", Georgia, serif; font-weight:700; color:#f7f2e7; }
        .gi-wrap{ max-width:720px; margin:0 auto; padding:36px 20px 72px; }
        .gi-root h1{ font-size:clamp(28px,5vw,38px); }
        .gi-intro{ margin-top:10px; color:var(--muted); }
        .gi-card{ display:block; margin-top:18px; padding:20px; border:1px solid var(--card-border); border-radius:14px; background:var(--card); text-decoration:none; color:inherit; }
        .gi-card h2{ font-size:20px; }
        .gi-card p{ margin:8px 0 0; color:var(--muted); font-size:15px; }
        .gi-date{ font-size:13px; color:var(--gold); margin-top:10px; }
      `}</style>
      <div className="gi-root">
        <nav className="gi-nav">
          <div className="gi-nav-inner">
            <Link href="/" className="gi-brand">MANAGIKA HOMES</Link>
          </div>
        </nav>
        <div className="gi-wrap">
          <h1>Landlord guides</h1>
          <p className="gi-intro">Practical help for landlords in Kenya on rent, M-Pesa and tenants.</p>
          {GUIDES.map((g) => (
            <Link key={g.href} href={g.href} className="gi-card">
              <h2>{g.title}</h2>
              <p>{g.blurb}</p>
              <div className="gi-date">{g.date}</div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
