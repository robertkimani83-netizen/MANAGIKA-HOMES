// Shared template for long-form guides under /guides. Server component so
// the full text is in the HTML for search engines. Same tokens and fonts as
// the landing pages in SeoLandingPage.tsx.
import Link from "next/link";
import type { ReactNode } from "react";

export type ArticleProps = {
  path: string;
  title: string;
  description: string;
  published: string; // ISO date, e.g. "2026-10-18"
  readMinutes: number;
  children: ReactNode;
};

const SITE_URL = "https://managikahomes.co.ke";

export default function ArticlePage({ path, title, description, published, readMinutes, children }: ArticleProps) {
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    datePublished: published,
    dateModified: published,
    mainEntityOfPage: `${SITE_URL}${path}`,
    author: { "@type": "Organization", name: "Managika Homes", url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: "Managika Homes",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/icon-512-v2.png` },
    },
  };
  const dateLabel = new Date(published + "T00:00:00Z").toLocaleDateString("en-KE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <main>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Work+Sans:wght@400;500;600;700&display=swap"
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <style>{`
        .ar-root{ --ink:#12213a; --muted:#5b6472; --gold:#c98a3e; --gold-bright:#e3ab5f; --paper:#f8f5ef; --card:#ffffff; --card-border:#e7e1d6; }
        @media (prefers-color-scheme: dark){
          .ar-root{ --ink:#eef1f6; --muted:#a3afc2; --gold:#e3ab5f; --gold-bright:#f0c584; --paper:#0a1220; --card:#101b2e; --card-border:#223252; }
        }
        .ar-root *{ box-sizing:border-box; }
        .ar-root{ min-height:100vh; background:var(--paper); color:var(--ink); font-family:"Work Sans", -apple-system, "Segoe UI", sans-serif; line-height:1.7; -webkit-font-smoothing:antialiased; }
        .ar-root h1, .ar-root h2, .ar-root h3{ font-family:"Fraunces", Georgia, serif; margin:0; text-wrap:balance; color:var(--ink); }
        .ar-root a{ color:inherit; }
        .ar-nav{ background:#12213a; }
        .ar-nav-inner{ max-width:720px; margin:0 auto; padding:14px 20px; display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .ar-root .ar-brand{ text-decoration:none; font-family:"Fraunces", Georgia, serif; font-weight:700; color:#f7f2e7; letter-spacing:0.02em; }
        .ar-root .ar-nav-cta{ text-decoration:none; background:#c98a3e; color:#1a1206; font-weight:700; font-size:14px; padding:9px 16px; border-radius:8px; }
        .ar-wrap{ max-width:720px; margin:0 auto; padding:36px 20px 72px; }
        .ar-crumb{ font-size:13px; color:var(--muted); }
        .ar-crumb a{ text-decoration:underline; text-underline-offset:2px; }
        .ar-root h1{ margin-top:14px; font-size:clamp(28px,5.5vw,40px); line-height:1.15; }
        .ar-meta{ margin-top:12px; font-size:13px; color:var(--muted); }
        .ar-body{ margin-top:26px; font-size:16.5px; }
        .ar-body p{ margin:16px 0 0; color:var(--ink); }
        .ar-body h2{ margin-top:40px; font-size:clamp(21px,3.6vw,26px); }
        .ar-body h3{ margin-top:26px; font-size:18px; }
        .ar-body ul, .ar-body ol{ margin:14px 0 0; padding-left:22px; }
        .ar-body li{ margin-top:8px; }
        .ar-body strong{ font-weight:600; }
        .ar-body .ar-tip{ margin-top:22px; padding:16px 18px; border-left:3px solid var(--gold); background:var(--card); border-radius:0 10px 10px 0; color:var(--muted); font-size:15px; }
        .ar-body table{ width:100%; margin-top:18px; border-collapse:collapse; font-size:14.5px; }
        .ar-body th, .ar-body td{ text-align:left; padding:10px 12px; border-bottom:1px solid var(--card-border); vertical-align:top; }
        .ar-body th{ font-weight:600; }
        .ar-table-wrap{ overflow-x:auto; }
        .ar-cta{ margin-top:48px; padding:24px; border:1px solid var(--card-border); border-radius:14px; background:var(--card); }
        .ar-cta h2{ font-size:22px; }
        .ar-cta p{ margin-top:10px; color:var(--muted); }
        .ar-btn{ display:inline-block; margin-top:16px; text-decoration:none; font-weight:700; font-size:15px; padding:13px 20px; border-radius:9px; background:var(--gold); color:#1a1206; }
        .ar-btn:hover{ background:var(--gold-bright); }
      `}</style>

      <div className="ar-root">
        <nav className="ar-nav">
          <div className="ar-nav-inner">
            <Link href="/" className="ar-brand">MANAGIKA HOMES</Link>
            <Link href="/#get-started" className="ar-nav-cta">Start free trial</Link>
          </div>
        </nav>

        <article className="ar-wrap">
          <div className="ar-crumb">
            <Link href="/guides">Landlord guides</Link>
          </div>
          <h1>{title}</h1>
          <p className="ar-meta">
            Managika Homes · {dateLabel} · {readMinutes} min read
          </p>
          <div className="ar-body">{children}</div>

          <div className="ar-cta">
            <h2>Let Managika Homes do the matching for you</h2>
            <p>
              Tenants keep paying your own Paybill, Till or bank account. Managika Homes records each payment against the
              right unit and sends SMS confirmations. Try it free for 7 days on up to 3 units.
            </p>
            <Link className="ar-btn" href="/#get-started">Start your free trial</Link>
          </div>
        </article>
      </div>
    </main>
  );
}
