"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// The site's homepage - a single landlord-facing page: what Managika Homes
// is, why it's safe to trust with rent money, pricing, and - right here on
// this same page, no detour through a separate login screen - the actual
// "pick a plan, create your account, pay by M-Pesa" flow. Nothing else is
// offered before payment. Once the subscription is confirmed active, the
// visitor is sent to /start (the landlord/tenant portal chooser).
const PLANS = [
  { key: "starter", name: "Starter", monthly: 1500, blurb: "A handful of units" },
  { key: "growth", name: "Growth", monthly: 3000, blurb: "Most chosen" },
  { key: "portfolio", name: "Portfolio", monthly: 6500, blurb: "Estates & agencies" },
];

function annualPrice(monthly: number) {
  return Math.round(monthly * 12 * 0.8);
}

export default function Home() {
  const router = useRouter();
  const skylineRef = useRef<HTMLDivElement>(null);

  const [selectedPlan, setSelectedPlan] = useState("growth");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

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

  async function handleSubscribe() {
    setError("");
    if (!fullName.trim() || !email.trim() || !phone.trim() || !password) {
      setError("Please fill in all fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setSubmitting(true);
    setStatus("Creating your account...");

    const { data, error: signupError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: "https://managikahomes.co.ke/landlord/login" },
    });
    if (signupError) {
      setError(signupError.message);
      setSubmitting(false);
      setStatus("");
      return;
    }
    if (!data.user) {
      setError("Could not create your account. Please try again.");
      setSubmitting(false);
      setStatus("");
      return;
    }

    await supabase.from("landlords").insert({ id: data.user.id, full_name: fullName.trim(), email: email.trim(), phone_number: phone.trim() });

    if (!data.session) {
      setSubmitting(false);
      setStatus("");
      setError("Account created - check your email to confirm it, then log in to finish paying and get started.");
      return;
    }

    const token = data.session.access_token;
    const userId = data.user.id;
    setStatus("Sending the M-Pesa payment prompt to your phone...");

    try {
      const res = await fetch("/api/subscription-stk-push", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ plan: selectedPlan, billingCycle, phoneNumber: phone.trim() }),
      });
      const result = await res.json();

      if (!res.ok || result.error) {
        setError(result.error || "Could not start payment.");
        setSubmitting(false);
        setStatus("");
        return;
      }
      if (!result.CheckoutRequestID) {
        setError(result.errorMessage || "M-Pesa did not accept this request.");
        setSubmitting(false);
        setStatus("");
        return;
      }

      setStatus("Check your phone and enter your M-Pesa PIN to complete the payment.");

      let attempts = 0;
      const poll = setInterval(async () => {
        attempts += 1;
        const { data: sub } = await supabase.from("landlord_subscriptions").select("status").eq("landlord_id", userId).maybeSingle();
        if (sub?.status === "active") {
          clearInterval(poll);
          setStatus("Payment received - taking you onward...");
          setTimeout(() => router.push("/start"), 1500);
        } else if (attempts >= 20) {
          clearInterval(poll);
          setSubmitting(false);
          setStatus("");
          setError("Didn't see the payment come through yet. If you completed it on your phone, refresh this page in a minute.");
        }
      }, 3000);
    } catch (e: any) {
      setError(e.message || "Something went wrong starting the payment.");
      setSubmitting(false);
      setStatus("");
    }
  }

  const activePlan = PLANS.find((p) => p.key === selectedPlan) || PLANS[1];
  const activePrice = billingCycle === "annual" ? annualPrice(activePlan.monthly) : activePlan.monthly;

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
        .lp-section-head.lp-center{ margin-left:auto; margin-right:auto; text-align:center; }
        .lp-section-head .lp-kicker{ font-size:12px; letter-spacing:0.14em; text-transform:uppercase; color:var(--gold); font-weight:600; margin-bottom:10px; display:block; }
        .lp-section-head h2{ font-size:clamp(24px,3.4vw,36px); font-weight:600; }
        .lp-section-head p{ color:var(--muted); font-size:16px; margin-top:14px; max-width:56ch; }
        .lp-section-head.lp-center p{ margin-left:auto; margin-right:auto; }

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
        .lp-tier .lp-cta{ margin-top:24px; text-align:center; padding:11px; border-radius:9px; font-weight:600; font-size:14.5px; text-decoration:none; border:none; width:100%; cursor:pointer; font-family:inherit; }
        .lp-tier.lp-featured .lp-cta{ background:var(--gold); color:#1a1206; }
        .lp-tier:not(.lp-featured) .lp-cta{ background:transparent; border:1px solid var(--card-border); color:var(--ink); }
        .lp-ladder{ margin-top:16px; font-size:12.5px; color:var(--muted); }
        .lp-ladder .lp-row{ display:flex; justify-content:space-between; padding:3px 0; }

        .lp-compare-market{ margin-top:28px; text-align:center; color:var(--muted); font-size:14px; }
        .lp-compare-market strong{ color:var(--ink); }

        .lp-why{ display:grid; grid-template-columns:repeat(4,1fr); gap:20px; }
        @media (max-width:760px){ .lp-why{ grid-template-columns:repeat(2,1fr); } }
        .lp-why-item{ text-align:center; padding:22px 12px; background:var(--card); border:1px solid var(--card-border); border-radius:16px; }
        .lp-why-item .lp-why-icon{ font-size:32px; display:block; }
        .lp-why-item h3{ font-size:15px; font-weight:600; margin-top:12px; }
        .lp-why-item p{ font-size:13px; color:var(--muted); margin-top:6px; }

        .lp-steps{ display:grid; grid-template-columns:repeat(3,1fr); gap:clamp(16px,3vw,32px); }
        @media (max-width:760px){ .lp-steps{ grid-template-columns:1fr; } }
        .lp-step{ text-align:center; }
        .lp-step .lp-step-num{ width:44px; height:44px; border-radius:50%; background:var(--gold); color:#1a1206; display:flex; align-items:center; justify-content:center; font-weight:700; font-family:"Fraunces",serif; font-size:18px; margin:0 auto 16px; }
        .lp-step h3{ font-size:16px; font-weight:600; }
        .lp-step p{ font-size:13.5px; color:var(--muted); margin-top:8px; max-width:30ch; margin-left:auto; margin-right:auto; }

        .lp-start{ background:var(--card); border:1px solid var(--card-border); border-radius:20px; padding:clamp(24px,4vw,44px); max-width:600px; margin:0 auto; }
        .lp-start-toggle{ display:flex; justify-content:center; gap:8px; margin-bottom:22px; }
        .lp-start-toggle button{ padding:9px 18px; border-radius:8px; border:1px solid var(--card-border); background:transparent; font-size:13px; font-weight:600; color:var(--ink); cursor:pointer; font-family:inherit; }
        .lp-start-toggle button.active{ background:var(--ink); color:#fff; border-color:var(--ink); }
        .lp-start-plans{ display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:20px; }
        .lp-start-plans button{ padding:14px 8px; border-radius:12px; border:2px solid var(--card-border); background:var(--card); cursor:pointer; text-align:center; font-family:inherit; }
        .lp-start-plans button.active{ border-color:var(--gold); background:color-mix(in srgb, var(--gold) 12%, var(--card)); }
        .lp-start-plans .lp-sp-name{ font-weight:700; font-size:14px; color:var(--ink); display:block; }
        .lp-start-plans .lp-sp-blurb{ font-size:11px; color:var(--muted); display:block; margin-top:2px; }
        .lp-start-price{ text-align:center; margin-bottom:26px; padding-bottom:22px; border-bottom:1px solid var(--hairline); }
        .lp-start-price .lp-amt{ font-size:36px; font-weight:600; }
        .lp-start-price .lp-unit{ color:var(--muted); font-size:13px; margin-left:4px; }
        .lp-start-field{ margin-bottom:16px; }
        .lp-start-field label{ display:block; font-size:13px; font-weight:600; color:var(--ink-soft); margin-bottom:6px; }
        .lp-start-field input{ width:100%; padding:12px 14px; border-radius:9px; border:1px solid var(--card-border); background:var(--paper); color:var(--ink); font-size:14px; font-family:inherit; }
        .lp-start-field input:focus-visible{ outline:2px solid var(--gold); outline-offset:1px; }
        .lp-start-error{ background:rgba(178,87,87,0.12); border:1px solid rgba(178,87,87,0.35); color:#b25757; font-size:13px; padding:10px 14px; border-radius:9px; margin-bottom:16px; }
        .lp-start-status{ background:rgba(63,122,92,0.12); border:1px solid rgba(63,122,92,0.35); color:var(--good); font-size:13px; padding:10px 14px; border-radius:9px; margin-bottom:16px; }
        .lp-start-submit{ width:100%; padding:15px; border-radius:9px; border:none; background:var(--gold); color:#1a1206; font-weight:700; font-size:15px; cursor:pointer; font-family:inherit; margin-top:6px; }
        .lp-start-submit:hover{ background:var(--gold-bright); }
        .lp-start-submit:disabled{ opacity:0.6; cursor:default; }
        .lp-start-login{ text-align:center; margin-top:18px; font-size:13px; color:var(--muted); }
        .lp-start-login a{ text-decoration:underline; font-weight:600; }

        .lp-footer{ padding:32px 0 56px; text-align:center; color:var(--muted); font-size:13px; }
        .lp-footer a{ text-decoration:underline; text-underline-offset:2px; }
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
              <a href="#get-started" className="lp-nav-cta">Get Started</a>
            </div>
          </div>
        </nav>

        <div className="lp-hero">
          <div className="lp-wrap lp-hero-inner">
            <span className="lp-eyebrow">For landlords across Kenya</span>
            <h1>Run your rental portfolio like a business, not a shoebox of receipts</h1>
            <p className="lp-sub">Managika Homes handles rent tracking, tenant communication, and M-Pesa payments — while your money still lands straight in your own Paybill, Till, or bank account. We never touch it.</p>
            <div className="lp-hero-ctas">
              <a className="lp-btn lp-btn-gold" href="#get-started">Get Started</a>
              <a className="lp-btn lp-btn-ghost" href="#pricing">See pricing</a>
            </div>
            <p className="lp-hero-note">Already have an account? <a href="/landlord/login" style={{ textDecoration: "underline" }}>Log in</a></p>
          </div>
          <div className="lp-skyline" aria-hidden="true" ref={skylineRef}></div>
        </div>

        <div className="lp-wrap">
          <section>
            <div className="lp-section-head lp-center">
              <span className="lp-kicker">Everything in one place</span>
              <h2>Why landlords switch to Managika Homes</h2>
            </div>
            <div className="lp-why">
              <div className="lp-why-item">
                <span className="lp-why-icon">🏠</span>
                <h3>Properties &amp; Units</h3>
                <p>Every property, block, and unit organized in one dashboard.</p>
              </div>
              <div className="lp-why-item">
                <span className="lp-why-icon">💰</span>
                <h3>Rent &amp; Payments</h3>
                <p>M-Pesa and bank payments tracked automatically, straight to your account.</p>
              </div>
              <div className="lp-why-item">
                <span className="lp-why-icon">🔧</span>
                <h3>Maintenance</h3>
                <p>Requests logged, tracked, and resolved without a single lost WhatsApp message.</p>
              </div>
              <div className="lp-why-item">
                <span className="lp-why-icon">🤖</span>
                <h3>AI Assistant</h3>
                <p>Ask &ldquo;who owes rent?&rdquo; and get a straight answer, instantly.</p>
              </div>
            </div>
          </section>

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

          <section>
            <div className="lp-section-head lp-center">
              <span className="lp-kicker">How it works</span>
              <h2>Three steps and you&rsquo;re running your portfolio properly</h2>
            </div>
            <div className="lp-steps">
              <div className="lp-step">
                <div className="lp-step-num">1</div>
                <h3>Pick a plan &amp; pay</h3>
                <p>Create your account and pay by M-Pesa below — takes about a minute.</p>
              </div>
              <div className="lp-step">
                <div className="lp-step-num">2</div>
                <h3>Add your properties</h3>
                <p>Load in your properties, units, and tenants — or bulk-import them in one go.</p>
              </div>
              <div className="lp-step">
                <div className="lp-step-num">3</div>
                <h3>Get paid, stay on top</h3>
                <p>Tenants pay straight into your own account. Reminders and reports run themselves.</p>
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
                <button type="button" className="lp-cta" onClick={() => { setSelectedPlan("starter"); document.getElementById("get-started")?.scrollIntoView({ behavior: "smooth" }); }}>Get started</button>
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
                <button type="button" className="lp-cta" onClick={() => { setSelectedPlan("growth"); document.getElementById("get-started")?.scrollIntoView({ behavior: "smooth" }); }}>Get started</button>
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
                <button type="button" className="lp-cta" onClick={() => { setSelectedPlan("portfolio"); document.getElementById("get-started")?.scrollIntoView({ behavior: "smooth" }); }}>Get started</button>
              </div>
            </div>

            <p className="lp-compare-market">Typical property management software in Kenya runs <strong>KSh 2,800–16,000+</strong> a month before you&rsquo;ve added a single extra unit. Managika Homes starts at <strong>KSh 1,500</strong> — and every tenant still pays straight into your own account.</p>
            <p className="lp-price-note" style={{ textAlign: "center" }}>Pay annually and save 20% on any plan. Prices exclude Safaricom&rsquo;s standard M-Pesa transaction charges.</p>
          </section>

          <section id="get-started">
            <div className="lp-section-head lp-center">
              <span className="lp-kicker">Get started</span>
              <h2>Create your account and pay — right here, in one step</h2>
              <p>Pick your plan, fill in your details, and pay by M-Pesa. As soon as your payment is confirmed you&rsquo;re taken straight on to set up your portfolio.</p>
            </div>

            <div className="lp-start">
              <div className="lp-start-toggle">
                <button type="button" className={billingCycle === "monthly" ? "active" : ""} onClick={() => setBillingCycle("monthly")}>Monthly</button>
                <button type="button" className={billingCycle === "annual" ? "active" : ""} onClick={() => setBillingCycle("annual")}>Annual — save 20%</button>
              </div>

              <div className="lp-start-plans">
                {PLANS.map((p) => (
                  <button key={p.key} type="button" className={selectedPlan === p.key ? "active" : ""} onClick={() => setSelectedPlan(p.key)}>
                    <span className="lp-sp-name">{p.name}</span>
                    <span className="lp-sp-blurb">{p.blurb}</span>
                  </button>
                ))}
              </div>

              <div className="lp-start-price">
                <span className="lp-amt mono">KSh {activePrice.toLocaleString()}</span>
                <span className="lp-unit">/ {billingCycle === "annual" ? "year" : "month"} minimum</span>
              </div>

              <div className="lp-start-field">
                <label>Full Name</label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Robert Kimani" />
              </div>
              <div className="lp-start-field">
                <label>Email address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div className="lp-start-field">
                <label>M-Pesa Phone Number</label>
                <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 0712345678" />
              </div>
              <div className="lp-start-field">
                <label>Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
              </div>

              {error && <div className="lp-start-error">{error}</div>}
              {status && <div className="lp-start-status">{status}</div>}

              <button type="button" className="lp-start-submit" disabled={submitting} onClick={handleSubscribe}>
                {submitting ? "Please wait..." : "Pay with M-Pesa & Get Started"}
              </button>

              <p className="lp-start-login">Already have an account? <a href="/landlord/login">Log in</a></p>
            </div>
          </section>
        </div>

        <footer className="lp-footer">
          <div className="lp-wrap">
            © 2026 Managika Homes · <a href="mailto:robertkimani83@gmail.com">robertkimani83@gmail.com</a> · managikahomes.co.ke
          </div>
        </footer>
      </div>
    </main>
  );
}
