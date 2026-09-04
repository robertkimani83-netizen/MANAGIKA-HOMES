"use client";

// Public page (no login required) where both landlords and tenants can get
// the Managika Homes app - either the real installable Android app (a TWA
// wrapping this same site, built via PWABuilder/Bubblewrap, served from
// public/managika.apk) or, for iPhone/iPad where no native app exists,
// instructions to add the site to the home screen as a PWA instead. Linked
// from the landing page nav/footer and from inside both dashboards.

export default function DownloadApp() {
  return (
    <main>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Work+Sans:wght@400;500;600;700&display=swap"
      />
      <style>{`
        .da-root{ --ink:#12213a; --muted:#5b6472; --gold:#c98a3e; --gold-bright:#e3ab5f; --paper:#f8f5ef; --card:#ffffff; --card-border:#e7e1d6; }
        @media (prefers-color-scheme: dark){
          .da-root{ --ink:#eef1f6; --muted:#93a1b8; --gold:#e3ab5f; --gold-bright:#f0c584; --paper:#0a1220; --card:#101b2e; --card-border:#223252; }
        }
        .da-root *{ box-sizing:border-box; }
        .da-root{ min-height:100vh; background:var(--paper); color:var(--ink); font-family:"Work Sans", -apple-system, "Segoe UI", sans-serif; line-height:1.6; -webkit-font-smoothing:antialiased; }
        .da-root h1, .da-root h2{ font-family:"Fraunces", Georgia, serif; margin:0; text-wrap:balance; }
        .da-root a{ color:inherit; }
        .da-wrap{ max-width:640px; margin:0 auto; padding:40px 20px 80px; }
        .da-back{ font-size:14px; font-weight:600; color:var(--muted); text-decoration:none; }
        .da-back:hover{ color:var(--ink); }
        .da-eyebrow{ display:inline-block; margin-top:22px; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:var(--gold); }
        .da-root h1{ margin-top:10px; font-size:clamp(28px,5vw,38px); }
        .da-sub{ margin-top:12px; color:var(--muted); font-size:16px; max-width:52ch; }
        .da-card{ margin-top:28px; border:1px solid var(--card-border); background:var(--card); border-radius:16px; padding:26px 28px; }
        .da-card h2{ font-size:20px; }
        .da-card > p{ margin:8px 0 0; color:var(--muted); font-size:15px; }
        .da-btn{ display:inline-flex; align-items:center; gap:8px; margin-top:16px; padding:13px 22px; border-radius:10px; background:var(--gold); color:#1a1206; font-weight:700; text-decoration:none; font-size:15px; }
        .da-btn:hover{ background:var(--gold-bright); }
        .da-steps{ margin:14px 0 0; padding-left:20px; color:var(--muted); font-size:14px; }
        .da-steps li{ margin-top:6px; }
        .da-note{ margin-top:14px; font-size:13px; color:var(--muted); }
        .da-foot{ margin-top:36px; font-size:14px; color:var(--muted); }
        .da-foot a{ font-weight:600; text-decoration:underline; }
      `}</style>

      <div className="da-root">
        <div className="da-wrap">
          <a href="/" className="da-back">← Managika Homes</a>
          <span className="da-eyebrow">For landlords &amp; tenants</span>
          <h1>Get the Managika Homes app</h1>
          <p className="da-sub">
            You never have to install anything — the landlord and tenant portals work fully in any phone
            browser. But if you&apos;d rather have it as an app icon on your home screen, here&apos;s how.
          </p>

          <div className="da-card">
            <h2>📲 Android</h2>
            <p>Download the Managika Homes app directly — no Play Store needed.</p>
            <a className="da-btn" href="/managika.apk" download>
              Download for Android (.apk)
            </a>
            <ol className="da-steps">
              <li>Tap the button above to download the file.</li>
              <li>Open it from your notifications or Downloads folder.</li>
              <li>
                If Android warns about an &quot;unknown source&quot;, tap <strong>Install anyway</strong> — that
                just means it isn&apos;t from the Play Store, it&apos;s still the real Managika Homes app.
              </li>
            </ol>
            <p className="da-note">Landlords and tenants use the exact same app — you&apos;ll see your own dashboard once you log in.</p>
          </div>

          <div className="da-card">
            <h2>🍎 iPhone &amp; iPad</h2>
            <p>There isn&apos;t an iPhone app yet — but you can add Managika Homes to your home screen and it opens just like one.</p>
            <ol className="da-steps">
              <li>Open <strong>managikahomes.co.ke</strong> in Safari.</li>
              <li>Tap the Share icon (the square with an arrow pointing up).</li>
              <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
            </ol>
          </div>

          <p className="da-foot">
            Already registered? <a href="/landlord/login">Landlord login</a> · <a href="/tenant/login">Tenant login</a>
          </p>
        </div>
      </div>
    </main>
  );
}
