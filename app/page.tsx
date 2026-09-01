"use client";

import { useEffect, useRef } from "react";

// The site's homepage - a landlord-facing marketing page (pricing, trust,
// before/after). Tenants don't sign themselves up here; they're invited by
// their landlord straight to /tenant/login. "Get Started" below routes
// through /start, which is where a visitor picks landlord vs. tenant.
export default function Home() {
  const skylineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sky = skylineRef.current;
    if (!sky || sky.childElementCount > 0) return;
    const n = 14;
    const w = 100 / n;
    for (let i = 0; i < n; i++) {
      const h = 28 + Math.round(Math.sin(i * 1.3) * 18 + Math.random() * 22);
      const b = document.createElement("div");
      b.className = "bld";
      b.style.left = i * w + "%";
      b.style.width = w * 0.72 + "%";
      b.style.height = h + "px";
      sky.appendChild(b);
      const winCount = Math.max(1, Math.floor(h / 16));
      for (let j = 0; j < winCount; j++) {
        if (Math.random() > 0.45) continue;
        const win = document.createElement("div");
        win.className = "win";
        win.style.left = i * w + (w * 0.72) * 0.5 + (Math.random() - 0.5) * w * 0.4 + "%";
        win.style.bottom = 6 + j * 15 + "px";
        sky.appendChild(win);
      }
    }
    const horizon = document.createElement("div");
    horizon.className = "horizon";
    sky.appendChild(horizon);
  }, []);

  return (
    <main>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Work+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap"
      />
      <style>{`
        .lp-root{ --ink:#12213a; --ink-soft:#2a3a56; --muted:#5b6472; --gold:#c98a3e; --gold-bright:#e3ab5f; --paper:#f8f5ef; --card:#ffffff; --card-border:#e7e1d6; --hairline:#dcd5c8; --good:#3f7a5c; }
        @media (prefers-color-scheme: dark){
          .lp-root{ --ink:#eef1f6; --ink-soft:#c7cfdd; --muted:#93a1b8; --gold:#e3ab5f; --gold-bright:#f0c584; --paper:#0a1220; --card:#101b2e; --card-border:#223252; --hairline:#22314c; --good:#6fbb96; }
        }
        .lp-root *{ box-sizing:border-box; }
        .lp-root{ background:var(--paper); color:var(--ink); font-family:"Work Sans", -apple-system, "Segoe UI", sans-serif; line-height:1.55; -webkit-font-smoothing:antialiased; }
        .lp-root h1, .lp-root h2, .lp-root h3{ font-family:"Fraunces", Georgia, serif; color:var(--ink); text-wrap:balance; margin:0; }
        .lp-root .mono{ font-family:"IBM Plex Mono", ui-monospace, monospace; font-variant-numeric:tabular-nums; }
        .lp-root a{ color:inherit; }
        .lp-root ::selection{ background:var(--gold); color:#1a1206; }
        .lp-root :focus-visible{ outline:2px solid var(--gold); outline-offset:3px; }
        @media (prefers-reduced-motion: reduce){ .lp-root *{ animation-duration:0.001ms !important; transition-duration:0.001ms !important; } }

        .lp-wrap{ max-width:1120px; margin:0 auto; padding:0 clamp(20px,4vw,48px); }

        .lp-nav{ position:sticky; top:0; z-index:20; background:rgba(14,25,44,0.82); backdrop-filter:blur(10px); border-bottom:1px solid rgba(227,171,95,0.16); }
        .lp-nav-inner{ display:flex; align-items:center; justify-content:space-between; padding:16px 0; }
        .lp-nav-brand{ display:flex; flex-direction:column; text-decoration:none; }
        .lp-nav-brand strong{ font-family:"Fraunces", Georgia, serif; font-size:17px; font-weight:700; color:#f7f2e7; letter-spacing:0.02em; }
        .lp-nav-brand span{ font-size:11px; color:#93a1b8; font-weight:500; }
        .lp-nav-links{ display:flex; align-items:center; gap:clamp(14px,2vw,28px); }
        .lp-nav-links a{ font-size:14px; font-weight:600; text-decoration:none; color:#c9d2e2; white-space:nowrap; }
        .lp-nav-links a:hover{ color:#f0ead9; }
        .lp-nav-links .lp-nav-cta{ background:var(--gold); color:#1a1206; padding:9px 18px; border-radius:8px; }
        .lp-nav-links .lp-nav-cta:hover{ background:var(--gold-bright); color:#1a1206; }
        @media (max-width:640px){ .lp-nav-links a:not(.lp-nav-cta){ display:none; } }

        .lp-hero{ position:relative; overflow:hidden;
          background: radial-gradient(ellipse 60% 50% at 50% 100%, rgba(201,138,62,0.30), transparent 70%), linear-gradient(180deg, #0e192c 0%, #16273f 45%, #26385a 78%, #4a3f52 100%);
          padding:clamp(56px,9vw,110px) 0 0; }
        @media (prefers-color-scheme: dark){ .lp-hero{ background: radial-gradient(ellipse 60% 50% at 50% 100%, rgba(227,171,95,0.28), transparent 70%), linear-gradient(180deg, #0a1220 0%, #101d34 45%, #1c2c4a 78%, #35304a 100%); } }
        .lp-hero-inner{ position:relative; z-index:2; text-align:center; }
        .lp-eyebrow{ display:inline-flex; align-items:center; gap:8px; font-size:12px; letter-spacing:0.14em; text-transform:uppercase; color:var(--gold-bright); font-weight:600; background:rgba(227,171,95,0.12); border:1px solid rgba(227,171,95,0.35); padding:7px 16px; border-radius:999px; }
        .lp-hero h1{ color:#f7f2e7; font-size:clamp(32px,5.6vw,58px); font-weight:600; margin:22px auto 0; max-width:16ch; }
        .lp-hero p.lp-sub{ color:#c9d2e2; font-size:clamp(16px,2vw,19px); max-width:52ch; margin:20px auto 0; }
        .lp-hero-ctas{ display:flex; gap:14px; justify-content:center; margin:34px 0 0; flex-wrap:wrap; }
        .lp-btn{ display:inline-flex; align-items:center; gap:8px; padding:13px 26px; border-radius:9px; font-weight:600; font-size:15px; text-decoration:none; border:1px solid transparent; cursor:pointer; }
        .lp-btn-gold{ background:var(--gold); color:#1a1206; }
        .lp-btn-gold:hover{ background:var(--gold-bright); }
        .lp-btn-ghost{ background:transparent; color:#f0ead9; border-color:rgba(240,234,217,0.35); }
        .lp-btn-ghost:hover{ border-color:rgba(240,234,217,0.7); }
        .lp-hero-note{ margin-top:16px; font-size:13px; color:#93a1b8; }

        .lp-skyline{ position:relative; height:clamp(90px,14vw,150px); margin-top:clamp(30px,6vw,60px); z-index:1; }
        .lp-skyline .bld{ position:absolute; bottom:0; background:#0e192c; border-top:1px solid rgba(227,171,95,0.15); }
        @media (prefers-color-scheme: dark){ .lp-skyline .bld{ background:#0a1220; } }
        .lp-skyline .win{ position:absolute; width:3px; height:5px; background:var(--gold-bright); opacity:0.55; border-radius:1px; }
        .lp-skyline .horizon{ position:absolute; left:0; right:0; bottom:0; height:2px; background:linear-gradient(90deg, transparent, var(--gold-bright), transparent); opacity:0.6; }

        .lp-root section{ padding:clamp(56px,8vw,96px) 0; }
        .lp-section-head{ max-width:640px; margin:0 0 44px; }
        .lp-section-head .lp-kicker{ font-size:12px; letter-spacing:0.14em; text-transform:uppercase; color:var(--gold); font-weight:600; margin-bottom:10px; display:block; }
        .lp-section-head h2{ font-size:clamp(24px,3.4vw,36px); font-weight:600; }
        .lp-section-head p{ color:var(--muted); font-size:16px; margin-top:14px; max-width:56ch; }

        .lp-compare{ display:grid; grid-template-columns:1fr 1fr; gap:0; border:1px solid var(--card-border); border-radius:16px; overflow:hidden; background:var(--card); }
        @media (max-width:720px){ .lp-compare{ grid-template-columns:1fr; } }
        .lp-compare > div{ padding:clamp(24px,3vw,36px); }
        .lp-compare .lp-old{ background:color-mix(in srgb, var(--paper) 55%, var(--card)); border-right:1px solid var(--card-border); }
        @media (max-width:720px){ .lp-compare .lp-old{ border-right:none; border-bottom:1px solid var(--card-border); } }
        .lp-compare h3{ font-size:15px; font-weight:600; letter-spacing:0.02em; margin-bottom:18px; }
        .lp-compare .lp-old h3{ color:var(--muted); }
        .lp-compare .lp-new h3{ color:var(--good); }
        .lp-compare ul{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:14px; }
        .lp-compare li{ display:flex; gap:10px; font-size:15px; color:var(--ink-soft); }
        .lp-compare .lp-mark{ flex:none; width:18px; text-align:center; font-weight:700; margin-top:1px; }
        .lp-compare .lp-old .lp-mark{ color:#b25757; }
        .lp-compare .lp-new .lp-mark{ color:var(--good); }

        .lp-trust{ display:grid; grid-template-columns:repeat(3,1fr); gap:1px; background:var(--card-border); border:1px solid var(--card-border); border-radius:16px; overflow:hidden; }
        @media (max-width:760px){ .lp-trust{ grid-template-columns:1fr; } }
        .lp-trust > div{ background:var(--card); padding:clamp(22px,3vw,30px); }
        .lp-trust .lp-num{ font-family:"Fraunces", serif; font-size:34px; color:var(--gold); font-weight:600; }
        .lp-trust p{ margin:8px 0 0; color:var(--muted); font-size:14px; }

        .lp-price-note{ font-size:13px; color:var(--muted); margin-top:8px; }
        .lp-tiers{ display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:clamp(10px,1.6vw,20px); align-items:stretch; }
        @media (max-width:560px){ .lp-tiers{ grid-template-columns:1fr; } }
        .lp-tier{ background:var(--card); border:1px solid var(--card-border); border-radius:18px; padding:clamp(14px,2.2vw,32px); display:flex; flex-direction:column; min-width:0; position:relative; }
        .lp-tier.lp-featured{ border-color:var(--gold); box-shadow:0 0 0 1px var(--gold), 0 18px 40px -20px rgba(201,138,62,0.35); }
        .lp-tier .lp-tag{ position:absolute; top:-13px; left:50%; transform:translateX(-50%); background:var(--gold); color:#1a1206; font-size:11px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; padding:5px 14px; border-radius:999px; white-space:nowrap; }
        .lp-tier h3{ font-size:clamp(16px,2.4vw,20px); font-weight:600; }
        .lp-tier .lp-for{ font-size:clamp(11.5px,1.6vw,13px); color:var(--muted); margin-top:4px; }
        .lp-tier .lp-price{ margin-top:22px; display:flex; align-items:baseline; gap:6px; flex-wrap:wrap; }
        .lp-tier .lp-price .lp-amt{ font-size:clamp(20px,4vw,32px); font-weight:600; }
        .lp-tier .lp-price .lp-unit{ font-size:clamp(11px,1.5vw,13px); color:var(--muted); }
        .lp-tier .lp-min{ font-size:13px; color:var(--muted); margin-top:4px; }
        .lp-tier hr{ border:none; border-top:1px solid var(--hairline); margin:22px 0; }
        .lp-tier ul{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:11px; flex:1; }
        .lp-tier li{ display:flex; gap:9px; font-size:14.5px; color:var(--ink-soft); }
        .lp-tier li .lp-mark{ flex:none; color:var(--good); font-weight:700; }
        .lp-tier .lp-cta{ margin-top:24px; text-align:center; padding:11px; border-radius:9px; font-weight:600; font-size:14.5px; text-decoration:none; }
        .lp-tier.lp-featured .lp-cta{ background:var(--gold); color:#1a1206; }
        .lp-tier:not(.lp-featured) .lp-cta{ background:transparent; border:1px solid var(--card-border); color:var(--ink); }
        .lp-ladder{ margin-top:16px; font-size:12.5px; color:var(--muted); }
        .lp-ladder .lp-row{ display:flex; justify-content:space-between; padding:3px 0; }

        .lp-compare-market{ margin-top:28px; text-align:center; color:var(--muted); font-size:14px; }
        .lp-compare-market strong{ color:var(--ink); }

        .lp-closer{ border-radius:22px; padding:clamp(36px,5vw,56px); background:linear-gradient(135deg, #16273f 0%, #2c3f60 100%); color:#f2ede0; text-align:center; }
        @media (prefers-color-scheme: dark){ .lp-closer{ background:linear-gradient(135deg, var(--ink) 0%, #1c2c4a 100%); } }
        .lp-closer h2{ color:#f7f2e7; font-size:clamp(22px,3vw,30px); }
        .lp-closer p{ color:#c9d2e2; max-width:48ch; margin:14px auto 0; font-size:15px; }
        .lp-closer .lp-hero-ctas{ margin-top:26px; }

        .lp-footer{ padding:32px 0 56px; text-align:center; color:var(--muted); font-size:13px; }
        .lp-footer a{ text-decoration:underline; text-underline-offset:2px; }
        .lp-footer .lp-footer-tenant{ display:block; margin-top:10px; font-size:13px; }
      `}</style>

      <div className="lp-root">
        <nav className="lp-nav">
          <div className="lp-wrap lp-nav-inner">
            <a href="/" className="lp-nav-brand">
              <strong>MANAGIKA HOMES</strong>
              <span>Property Management Made Simple</span>
            </a>
            <div className="lp-nav-links">
              <a href="#pricing">Pricing</a>
              <a href="/tenant/login">Tenant Login</a>
              <a href="/landlord/login" className="lp-nav-cta">Landlord Login</a>
            </div>
          </div>
        </nav>

        <div className="lp-hero">
          <div className="lp-wrap lp-hero-inner">
            <span className="lp-eyebrow">For landlords across Kenya</span>
            <h1>Run your rental portfolio like a business, not a shoebox of receipts</h1>
            <p className="lp-sub">Managika Homes handles rent tracking, tenant communication, and M-Pesa payments — while your money still lands straight in your own Paybill, Till, or bank account. We never touch it.</p>
            <div className="lp-hero-ctas">
              <a className="lp-btn lp-btn-gold" href="/start">Get Started</a>
              <a className="lp-btn lp-btn-ghost" href="#pricing">See pricing</a>
            </div>
            <p className="lp-hero-note">No card required to get started · Already have an account? <a href="/landlord/login" style={{ textDecoration: "underline" }}>Log in</a></p>
          </div>
          <div className="lp-skyline" aria-hidden="true" ref={skylineRef}></div>
        </div>

        <div className="lp-wrap">
          <section>
            <div className="lp-section-head">
              <span className="lp-kicker">The problem today</span>
              <h2>Most landlords in Kenya still run this on WhatsApp and a notebook</h2>
              <p>Rent gets tracked in a diary. Reminders are a phone call you have to remember to make. And “did they pay?” means scrolling back through M-Pesa messages one by one.</p>
            </div>
            <div className="lp-compare">
              <div className="lp-old">
                <h3>WITHOUT MANAGIKA HOMES</h3>
                <ul>
                  <li><span className="lp-mark">−</span>Rent tracked in a notebook or a scattered spreadsheet</li>
                  <li><span className="lp-mark">−</span>Chasing tenants one by one over calls and texts</li>
                  <li><span className="lp-mark">−</span>“Who has paid this month?” means scrolling M-Pesa messages</li>
                  <li><span className="lp-mark">−</span>Maintenance requests get lost in chat threads</li>
                  <li><span className="lp-mark">−</span>No record a new caretaker or family member can pick up</li>
                </ul>
              </div>
              <div className="lp-new">
                <h3>WITH MANAGIKA HOMES</h3>
                <ul>
                  <li><span className="lp-mark">✓</span>Every property, unit, and tenant in one dashboard</li>
                  <li><span className="lp-mark">✓</span>Rent reminders sent automatically, every month, on time</li>
                  <li><span className="lp-mark">✓</span>Ask the AI assistant “who owes rent?” and get a straight answer</li>
                  <li><span className="lp-mark">✓</span>Tenants pay by M-Pesa straight into your own Paybill or Till</li>
                  <li><span className="lp-mark">✓</span>Maintenance and complaints logged, tracked, and resolved in one place</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <div className="lp-section-head">
              <span className="lp-kicker">Why it&rsquo;s safe to trust with rent money</span>
              <h2>Your money never passes through us</h2>
              <p>Some property platforms ask you to collect rent into their own account first. Managika Homes was built the other way round.</p>
            </div>
            <div className="lp-trust">
              <div>
                <div className="lp-num">100%</div>
                <p>of rent paid goes straight to your own M-Pesa Paybill, Till, or bank account — Managika Homes is never in that chain.</p>
              </div>
              <div>
                <div className="lp-num">Your</div>
                <p>own Daraja API credentials, stored encrypted and used only to confirm your tenants&rsquo; payments — never shared, never pooled with anyone else&rsquo;s.</p>
              </div>
              <div>
                <div className="lp-num">0</div>
                <p>hidden transaction cuts on the rent itself. You already pay Safaricom&rsquo;s normal M-Pesa charges — nothing extra to us on top.</p>
              </div>
            </div>
          </section>

          <section id="pricing">
            <div className="lp-section-head">
              <span className="lp-kicker">Pricing</span>
              <h2>Priced by the unit, so a 4-unit property and a 400-unit estate both pay a fair rate</h2>
              <p>Every plan includes the tenant portal, M-Pesa &amp; bank payment tracking, automated rent reminders, and the AI assistant. Larger tiers unlock more admin seats and support.</p>
            </div>

            <div className="lp-tiers">
              <div className="lp-tier">
                <h3>Starter</h3>
                <p className="lp-for">For landlords with a handful of units</p>
                <div className="lp-price"><span className="lp-amt mono">KSh 1,500</span><span className="lp-unit">/ month minimum</span></div>
                <p className="lp-min mono">≈ KSh 150 / unit / month</p>
                <div className="lp-ladder">
                  <div className="lp-row"><span>Units 1–10</span><span className="mono">KSh 150</span></div>
                </div>
                <hr />
                <ul>
                  <li><span className="lp-mark">✓</span>Up to 10 units, unlimited tenants</li>
                  <li><span className="lp-mark">✓</span>Tenant self-service portal</li>
                  <li><span className="lp-mark">✓</span>M-Pesa &amp; bank payment tracking</li>
                  <li><span className="lp-mark">✓</span>Automated monthly rent reminders</li>
                  <li><span className="lp-mark">✓</span>2 admin logins</li>
                </ul>
                <a className="lp-cta" href="/landlord/login?plan=starter">Get started</a>
              </div>

              <div className="lp-tier lp-featured">
                <span className="lp-tag">Most chosen</span>
                <h3>Growth</h3>
                <p className="lp-for">For portfolios that are actively expanding</p>
                <div className="lp-price"><span className="lp-amt mono">KSh 3,000</span><span className="lp-unit">/ month minimum</span></div>
                <p className="lp-min mono">≈ KSh 120 / unit / month</p>
                <div className="lp-ladder">
                  <div className="lp-row"><span>Units 1–50</span><span className="mono">KSh 120</span></div>
                  <div className="lp-row"><span>Units 51–150</span><span className="mono">KSh 90</span></div>
                </div>
                <hr />
                <ul>
                  <li><span className="lp-mark">✓</span>Everything in Starter</li>
                  <li><span className="lp-mark">✓</span>Up to 150 units</li>
                  <li><span className="lp-mark">✓</span>AI assistant for you and your tenants</li>
                  <li><span className="lp-mark">✓</span>Maintenance &amp; complaint tracking</li>
                  <li><span className="lp-mark">✓</span>10 admin logins</li>
                </ul>
                <a className="lp-cta" href="/landlord/login?plan=growth">Get started</a>
              </div>

              <div className="lp-tier">
                <h3>Portfolio</h3>
                <p className="lp-for">For estates, agencies &amp; large landlords</p>
                <div className="lp-price"><span className="lp-amt mono">KSh 6,500</span><span className="lp-unit">/ month minimum</span></div>
                <p className="lp-min mono">≈ KSh 65 / unit / month</p>
                <div className="lp-ladder">
                  <div className="lp-row"><span>Units 1–150</span><span className="mono">KSh 65</span></div>
                  <div className="lp-row"><span>Units 151+</span><span className="mono">KSh 45</span></div>
                </div>
                <hr />
                <ul>
                  <li><span className="lp-mark">✓</span>Everything in Growth</li>
                  <li><span className="lp-mark">✓</span>Unlimited units</li>
                  <li><span className="lp-mark">✓</span>Unlimited admin logins</li>
                  <li><span className="lp-mark">✓</span>Priority support</li>
                  <li><span className="lp-mark">✓</span>Dedicated onboarding</li>
                </ul>
                <a className="lp-cta" href="/landlord/login?plan=portfolio">Get started</a>
              </div>
            </div>

            <p className="lp-compare-market">Typical property management software in Kenya runs <strong>KSh 2,800–16,000+</strong> a month before you&rsquo;ve added a single extra unit. Managika Homes starts at <strong>KSh 1,500</strong> — and every tenant still pays straight into your own account.</p>
            <p className="lp-price-note" style={{ textAlign: "center" }}>Pay annually and save 20% on any plan. Prices exclude Safaricom&rsquo;s standard M-Pesa transaction charges.</p>
          </section>

          <section>
            <div className="lp-closer">
              <h2>Bring your properties. Keep your Paybill.</h2>
              <p>Set-up takes one afternoon — your properties, units, and tenants loaded in, your own M-Pesa or bank details connected, and your tenants notified. No card required to talk it through.</p>
              <div className="lp-hero-ctas">
                <a className="lp-btn lp-btn-gold" href="mailto:robertkimani83@gmail.com?subject=Managika%20Homes%20—%20Get%20started">Get in touch</a>
                <a className="lp-btn lp-btn-ghost" href="/landlord/login">Already a landlord? Log in</a>
              </div>
            </div>
          </section>
        </div>

        <footer className="lp-footer">
          <div className="lp-wrap">
            © 2026 Managika Homes · <a href="mailto:robertkimani83@gmail.com">robertkimani83@gmail.com</a> · managikahomes.co.ke
            <span className="lp-footer-tenant">Are you a tenant? <a href="/tenant/login">Sign in to your tenant portal →</a></span>
          </div>
        </footer>
      </div>
    </main>
  );
}
