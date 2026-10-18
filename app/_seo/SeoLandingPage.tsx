// Shared template for the public, search-focused landing pages
// (/rent-collection-app-kenya, /mpesa-rent-tracking,
// /property-management-software-nairobi). Server component: no client JS,
// fully rendered HTML so Google can read every word. Styling reuses the
// homepage tokens (ink / muted / gold / paper, Fraunces + Work Sans) and
// follows the same dark-mode handling as /privacy and /terms.
//
// Keep claims here in line with the homepage (app/page.tsx): pricing, the
// 7-day trial and "we never touch your money" are stated there first.

import Link from "next/link";

export type SeoSection = { heading: string; body: string; points?: string[] };
export type SeoFaq = { q: string; a: string };

export type SeoLandingProps = {
  path: string;
  eyebrow: string;
  title: string;
  intro: string;
  sections: SeoSection[];
  faqs: SeoFaq[];
};

const SITE_URL = "https://managikahomes.co.ke";

const RELATED = [
  { href: "/rent-collection-app-kenya", label: "Rent collection app for Kenyan landlords" },
  { href: "/mpesa-rent-tracking", label: "M-Pesa rent tracking" },
  { href: "/property-management-software-nairobi", label: "Property management software in Nairobi" },
];

export default function SeoLandingPage({ path, eyebrow, title, intro, sections, faqs }: SeoLandingProps) {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  const appJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Managika Homes",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, Android",
    url: `${SITE_URL}${path}`,
    areaServed: "KE",
    offers: { "@type": "Offer", price: "1500", priceCurrency: "KES" },
  };

  return (
    <main>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Work+Sans:wght@400;500;600;700&display=swap"
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appJsonLd) }} />
      <style>{`
        .sl-root{ --ink:#12213a; --muted:#5b6472; --gold:#c98a3e; --gold-bright:#e3ab5f; --paper:#f8f5ef; --card:#ffffff; --card-border:#e7e1d6; }
        @media (prefers-color-scheme: dark){
          .sl-root{ --ink:#eef1f6; --muted:#93a1b8; --gold:#e3ab5f; --gold-bright:#f0c584; --paper:#0a1220; --card:#101b2e; --card-border:#223252; }
        }
        .sl-root *{ box-sizing:border-box; }
        .sl-root{ min-height:100vh; background:var(--paper); color:var(--ink); font-family:"Work Sans", -apple-system, "Segoe UI", sans-serif; line-height:1.65; -webkit-font-smoothing:antialiased; }
        .sl-root h1, .sl-root h2, .sl-root h3{ font-family:"Fraunces", Georgia, serif; margin:0; text-wrap:balance; }
        .sl-root a{ color:inherit; }
        .sl-nav{ background:#12213a; }
        .sl-nav-inner{ max-width:760px; margin:0 auto; padding:14px 20px; display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .sl-root .sl-brand{ text-decoration:none; font-family:"Fraunces", Georgia, serif; font-weight:700; color:#f7f2e7; letter-spacing:0.02em; }
        .sl-root .sl-nav-cta{ text-decoration:none; background:#c98a3e; color:#1a1206; font-weight:700; font-size:14px; padding:9px 16px; border-radius:8px; }
        .sl-wrap{ max-width:760px; margin:0 auto; padding:40px 20px 72px; }
        .sl-eyebrow{ display:inline-block; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:var(--gold); }
        .sl-root h1{ margin-top:10px; font-size:clamp(28px,5.5vw,42px); line-height:1.15; }
        .sl-intro{ margin-top:18px; font-size:17px; color:var(--ink); max-width:62ch; }
        .sl-ctas{ margin-top:26px; display:flex; flex-wrap:wrap; gap:12px; }
        .sl-btn{ display:inline-block; text-decoration:none; font-weight:700; font-size:15px; padding:13px 20px; border-radius:9px; }
        .sl-btn-gold{ background:var(--gold); color:#1a1206; }
        .sl-btn-gold:hover{ background:var(--gold-bright); }
        .sl-btn-ghost{ border:1px solid var(--card-border); color:var(--ink); }
        .sl-note{ margin-top:10px; font-size:13px; color:var(--muted); }
        .sl-section{ margin-top:44px; }
        .sl-section h2{ font-size:clamp(21px,3.5vw,26px); }
        .sl-section p{ margin-top:12px; color:var(--muted); font-size:16px; max-width:65ch; }
        .sl-section ul{ margin:14px 0 0; padding-left:20px; }
        .sl-section li{ margin-top:8px; color:var(--muted); font-size:15.5px; }
        .sl-faq{ margin-top:16px; border:1px solid var(--card-border); border-radius:12px; background:var(--card); }
        .sl-faq + .sl-faq{ margin-top:10px; }
        .sl-faq summary{ cursor:pointer; padding:16px 18px; font-weight:600; font-size:15.5px; }
        .sl-faq p{ margin:0; padding:0 18px 16px; color:var(--muted); font-size:15px; }
        .sl-related{ margin-top:48px; padding-top:24px; border-top:1px solid var(--card-border); font-size:14px; color:var(--muted); }
        .sl-related ul{ margin:10px 0 0; padding-left:18px; }
        .sl-related a{ text-decoration:underline; text-underline-offset:2px; }
      `}</style>

      <div className="sl-root">
        <nav className="sl-nav">
          <div className="sl-nav-inner">
            <Link href="/" className="sl-brand">MANAGIKA HOMES</Link>
            <Link href="/#get-started" className="sl-nav-cta">Start free trial</Link>
          </div>
        </nav>

        <div className="sl-wrap">
          <span className="sl-eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p className="sl-intro">{intro}</p>
          <div className="sl-ctas">
            <Link className="sl-btn sl-btn-gold" href="/#get-started">Start your free 7-day trial</Link>
            <Link className="sl-btn sl-btn-ghost" href="/#pricing">See pricing</Link>
          </div>
          <p className="sl-note">Plans from KSh 1,500 a month. No payment needed to start.</p>

          {sections.map((s) => (
            <section className="sl-section" key={s.heading}>
              <h2>{s.heading}</h2>
              <p>{s.body}</p>
              {s.points && (
                <ul>
                  {s.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <section className="sl-section">
            <h2>Common questions</h2>
            {faqs.map((f) => (
              <details className="sl-faq" key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </section>

          <section className="sl-section">
            <h2>Try it on your own units</h2>
            <p>Add up to 3 units during the free 7-day trial and see your rent records fill in. No contract, cancel anytime.</p>
            <div className="sl-ctas">
              <Link className="sl-btn sl-btn-gold" href="/#get-started">Get started</Link>
            </div>
          </section>

          <div className="sl-related">
            More from Managika Homes:
            <ul>
              {RELATED.filter((r) => r.href !== path).map((r) => (
                <li key={r.href}>
                  <Link href={r.href}>{r.label}</Link>
                </li>
              ))}
              <li>
                <Link href="/">Managika Homes home page</Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
