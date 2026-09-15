"use client";

// Public page (no login required) — Terms of Service. Styled to match
// /download-app (same font pairing, same --ink/--muted/--gold/--paper
// tokens, same dark-mode handling) so it reads as part of the site rather
// than a bolted-on legal page. Linked from the homepage footer.

export default function TermsPage() {
  return (
    <main>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Work+Sans:wght@400;500;600;700&display=swap"
      />
      <style>{`
        .lg-root{ --ink:#12213a; --muted:#5b6472; --gold:#c98a3e; --gold-bright:#e3ab5f; --paper:#f8f5ef; --card:#ffffff; --card-border:#e7e1d6; }
        @media (prefers-color-scheme: dark){
          .lg-root{ --ink:#eef1f6; --muted:#93a1b8; --gold:#e3ab5f; --gold-bright:#f0c584; --paper:#0a1220; --card:#101b2e; --card-border:#223252; }
        }
        .lg-root *{ box-sizing:border-box; }
        .lg-root{ min-height:100vh; background:var(--paper); color:var(--ink); font-family:"Work Sans", -apple-system, "Segoe UI", sans-serif; line-height:1.65; -webkit-font-smoothing:antialiased; }
        .lg-root h1, .lg-root h2{ font-family:"Fraunces", Georgia, serif; margin:0; text-wrap:balance; }
        .lg-root a{ color:inherit; text-decoration:underline; text-underline-offset:2px; }
        .lg-wrap{ max-width:680px; margin:0 auto; padding:40px 20px 80px; }
        .lg-back{ font-size:14px; font-weight:600; color:var(--muted); text-decoration:none; }
        .lg-back:hover{ color:var(--ink); }
        .lg-eyebrow{ display:inline-block; margin-top:22px; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:var(--gold); }
        .lg-root h1{ margin-top:10px; font-size:clamp(28px,5vw,38px); }
        .lg-updated{ margin-top:10px; color:var(--muted); font-size:14px; }
        .lg-intro{ margin-top:22px; color:var(--ink); font-size:16px; }
        .lg-section{ margin-top:34px; }
        .lg-section h2{ font-size:19px; }
        .lg-section p, .lg-section li{ margin-top:10px; color:var(--muted); font-size:15px; }
        .lg-section ul{ margin:10px 0 0; padding-left:20px; }
        .lg-section li{ margin-top:6px; }
        .lg-section strong{ color:var(--ink); }
        .lg-foot{ margin-top:44px; padding-top:24px; border-top:1px solid var(--card-border); font-size:14px; color:var(--muted); }
      `}</style>

      <div className="lg-root">
        <div className="lg-wrap">
          <a href="/" className="lg-back">← Managika Homes</a>
          <span className="lg-eyebrow">Legal</span>
          <h1>Terms of Service</h1>
          <p className="lg-updated">Last updated 15 September 2026</p>

          <p className="lg-intro">
            These Terms govern your use of Managika Homes (the &quot;Service&quot;), operated
            by Managika Homes, a sole proprietorship registered in Kenya (Business
            Registration No. BN-WLSP3JJ5), owned by Robert Kimani Maina (&quot;we&quot;,
            &quot;us&quot;, &quot;our&quot;). By creating an account or using the Service, you
            (a landlord, a team member a landlord has added, or a tenant) agree to these
            Terms.
          </p>

          <div className="lg-section">
            <h2>1. Who this is for</h2>
            <p>
              Managika Homes is a property management tool for landlords and agents in
              Kenya, and their tenants. You must be at least 18 years old and legally
              able to enter a contract to use the Service.
            </p>
          </div>

          <div className="lg-section">
            <h2>2. Your account</h2>
            <p>
              You&apos;re responsible for the accuracy of what you enter — your own
              details, your properties, your tenants&apos; details — and for keeping your
              login credentials secure. You&apos;re responsible for activity under your
              account, whether you&apos;re a landlord, a caretaker or team member a
              landlord has added, or a tenant.
            </p>
          </div>

          <div className="lg-section">
            <h2>3. Rent money never passes through us</h2>
            <p>
              Managika Homes does not collect, hold, or move rent on your behalf. Tenant
              rent payments go directly to the landlord&apos;s own M-Pesa Paybill, Till, or
              bank account. We only read payment confirmations — via the landlord&apos;s own
              M-Pesa Daraja credentials, or manual entry — to keep records up to date. We
              are not a party to the underlying tenancy agreement between a landlord and
              tenant, and are not responsible for disputes about rent, deposits,
              evictions, or the condition of a property.
            </p>
          </div>

          <div className="lg-section">
            <h2>4. Free trial, subscriptions &amp; billing</h2>
            <p>
              Landlord accounts start with a free trial (currently 7 days, limited to a
              small number of units, no payment taken). Continued use after the trial
              requires an active paid subscription — Starter, Growth, or Portfolio, priced
              as shown on our pricing page. When your trial ends, we send an M-Pesa prompt
              for your first payment to the phone number you signed up with; you can also
              pay early anytime from your billing page. Prices exclude Safaricom&apos;s
              standard M-Pesa transaction charges. We may change pricing or plans with
              reasonable notice — never retroactively for a period you&apos;ve already paid
              for.
            </p>
          </div>

          <div className="lg-section">
            <h2>5. Cancellation</h2>
            <p>
              There&apos;s no lock-in contract. Cancel anytime from your billing page —
              you keep access until the end of your current paid period. Cancelling
              doesn&apos;t automatically entitle you to a refund for that period unless
              required by law.
            </p>
          </div>

          <div className="lg-section">
            <h2>6. Acceptable use</h2>
            <p>You agree not to:</p>
            <ul>
              <li>store or send unlawful, fraudulent, or harassing content through the Service;</li>
              <li>misrepresent a tenancy or rent record;</li>
              <li>attempt to access another landlord&apos;s or tenant&apos;s data; or</li>
              <li>interfere with the Service&apos;s normal operation, including the WhatsApp/SMS messaging sent through it.</li>
            </ul>
          </div>

          <div className="lg-section">
            <h2>7. Your data</h2>
            <p>
              How we collect, use, and protect personal data — yours and your
              tenants&apos; — is described in our <a href="/privacy">Privacy Policy</a>.
              As a landlord, you&apos;re responsible for having a lawful basis (such as
              your tenant&apos;s consent, or the tenancy agreement itself) to enter your
              tenants&apos; information into the Service.
            </p>
          </div>

          <div className="lg-section">
            <h2>8. Service availability</h2>
            <p>
              We aim to keep the Service reliable but don&apos;t guarantee uninterrupted
              access. We may suspend or restrict access for maintenance, security, or to
              address misuse, and will try to give notice where practical.
            </p>
          </div>

          <div className="lg-section">
            <h2>9. Limitation of liability</h2>
            <p>
              The Service is provided &quot;as is.&quot; To the fullest extent permitted by
              law, Managika Homes is not liable for indirect, incidental, or consequential
              losses — such as lost rent, lost profits, or a dispute with a tenant or
              landlord — arising from your use of the Service. Nothing here limits
              liability that cannot be limited under Kenyan law.
            </p>
          </div>

          <div className="lg-section">
            <h2>10. Changes to these Terms</h2>
            <p>
              We may update these Terms from time to time. Material changes will be
              posted here with a new &quot;last updated&quot; date. Continued use of the
              Service after a change means you accept the updated Terms.
            </p>
          </div>

          <div className="lg-section">
            <h2>11. Contact</h2>
            <p>
              Questions about these Terms? Email{" "}
              <a href="mailto:support@managikahomes.co.ke">support@managikahomes.co.ke</a>.
            </p>
          </div>

          <p className="lg-foot">
            See also our <a href="/privacy">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </main>
  );
}
