"use client";

// Public page (no login required) — Privacy Policy. Styled to match
// /download-app and /terms (same font pairing, same --ink/--muted/--gold/
// --paper tokens, same dark-mode handling). Linked from the homepage
// footer and from the Terms of Service page.

export default function PrivacyPage() {
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
          <h1>Privacy Policy</h1>
          <p className="lg-updated">Last updated 15 September 2026</p>

          <p className="lg-intro">
            This Privacy Policy explains how Managika Homes (&quot;we&quot;, &quot;us&quot;,
            &quot;our&quot;) — a sole proprietorship registered in Kenya (Business
            Registration No. BN-WLSP3JJ5) — collects, uses, stores, and protects personal
            data through the Managika Homes platform (the &quot;Service&quot;). We handle
            data in line with Kenya&apos;s Data Protection Act, 2019.
          </p>

          <div className="lg-section">
            <h2>1. What we collect</h2>
            <p><strong>From landlords and their team members:</strong></p>
            <ul>
              <li>Name, email, phone number, and login credentials</li>
              <li>Property, unit, and tenant records you enter into the Service</li>
              <li>Your M-Pesa Paybill/Till or Daraja API credentials, if you connect one — stored encrypted, used only to confirm rent payments</li>
              <li>Billing details needed to process your own subscription payment</li>
            </ul>
            <p><strong>From tenants</strong> (entered by their landlord, or by the tenant directly):</p>
            <ul>
              <li>Name, phone number, and unit/lease details</li>
              <li>Payment history for their tenancy</li>
              <li>Maintenance requests, complaints, and messages sent through the Service</li>
            </ul>
            <p>
              We also automatically collect basic technical data — error logs, general
              usage patterns — to keep the Service reliable and secure.
            </p>
          </div>

          <div className="lg-section">
            <h2>2. How we use it</h2>
            <ul>
              <li>To run your landlord or tenant account and dashboard</li>
              <li>To send rent reminders and payment confirmations, by SMS and/or WhatsApp</li>
              <li>To match M-Pesa/bank payments to the right tenant and invoice</li>
              <li>To power the AI assistant, which answers from your own account&apos;s data only</li>
              <li>To bill landlord subscriptions and communicate about your account</li>
              <li>To detect and prevent misuse, fraud, or security issues</li>
            </ul>
            <p>
              We do not sell personal data, and we never pool one landlord&apos;s rent
              money or payment credentials with another&apos;s.
            </p>
          </div>

          <div className="lg-section">
            <h2>3. Who can see your data</h2>
            <p>
              Landlord and tenant accounts are kept separate and access-controlled — a
              landlord sees only their own properties, units, and tenants; a tenant sees
              only their own tenancy and payment record. We use trusted infrastructure
              providers (our database and hosting, our SMS and WhatsApp/Meta messaging
              providers, and our payment-confirmation provider) to run the Service — they
              process data only to provide that infrastructure, under their own security
              obligations, not for their own purposes. We don&apos;t share your data with
              other landlords, other tenants, or unrelated third parties, except where
              required by law.
            </p>
          </div>

          <div className="lg-section">
            <h2>4. How long we keep it</h2>
            <p>
              We keep account and tenancy data for as long as the account is active, and
              for a reasonable period afterward in case you return, or as needed for
              legal, tax, or dispute-resolution purposes. You can ask us to delete your
              data sooner, subject to Section 6.
            </p>
          </div>

          <div className="lg-section">
            <h2>5. Security</h2>
            <p>
              Access to landlord and tenant data is restricted so one landlord&apos;s data
              isn&apos;t visible to another, and payment credentials are stored encrypted.
              No system is perfectly secure, and we can&apos;t guarantee absolute
              security, but we take reasonable technical and organizational steps to
              protect your data, and will notify affected users of any data breach as
              required by law.
            </p>
          </div>

          <div className="lg-section">
            <h2>6. Your rights</h2>
            <p>
              Under Kenya&apos;s Data Protection Act, 2019, you have the right to know what
              personal data we hold about you, to ask us to correct or delete it, to
              object to certain uses, and to lodge a complaint with the Office of the Data
              Protection Commissioner (ODPC) if you believe your data has been mishandled.
              If you&apos;re a tenant, some data — like your payment history — may need to
              stay in your landlord&apos;s tenancy record even after a deletion request;
              where that&apos;s the case, we&apos;ll let you know. To make a request, email{" "}
              <a href="mailto:support@managikahomes.co.ke">support@managikahomes.co.ke</a>.
            </p>
          </div>

          <div className="lg-section">
            <h2>7. Children</h2>
            <p>
              The Service is intended for adults managing or renting property. We don&apos;t
              knowingly collect data from children.
            </p>
          </div>

          <div className="lg-section">
            <h2>8. Changes to this policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Material changes will
              be posted here with a new &quot;last updated&quot; date.
            </p>
          </div>

          <div className="lg-section">
            <h2>9. Contact</h2>
            <p>
              Questions about this policy or your data? Email{" "}
              <a href="mailto:support@managikahomes.co.ke">support@managikahomes.co.ke</a>.
            </p>
          </div>

          <p className="lg-foot">
            See also our <a href="/terms">Terms of Service</a>.
          </p>
        </div>
      </div>
    </main>
  );
}
