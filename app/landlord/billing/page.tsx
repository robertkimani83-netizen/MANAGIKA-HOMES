"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

const PLANS = [
  { key: "starter", name: "Starter", price: 1500, blurb: "For a handful of units" },
  { key: "growth", name: "Growth", price: 3000, blurb: "Most chosen — for growing portfolios" },
  { key: "portfolio", name: "Portfolio", price: 6500, blurb: "For larger, established portfolios" },
];

function annualPrice(monthly: number) {
  return Math.round(monthly * 12 * 0.8);
}

function LandlordBillingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planFromUrl = searchParams.get("plan");

  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState("");
  const [subscription, setSubscription] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState(
    planFromUrl && PLANS.some((p) => p.key === planFromUrl) ? planFromUrl : "growth"
  );
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [paying, setPaying] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    init();
  }, []);

  async function init() {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      router.push("/landlord/login");
      return;
    }
    setAuthToken(sessionData.session.access_token);

    const { data: landlord } = await supabase
      .from("landlords")
      .select("phone_number")
      .eq("id", sessionData.session.user.id)
      .maybeSingle();
    if (landlord?.phone_number) setPhoneNumber(landlord.phone_number);

    const { data: sub } = await supabase
      .from("landlord_subscriptions")
      .select("plan, billing_cycle, status, current_period_end")
      .eq("landlord_id", sessionData.session.user.id)
      .maybeSingle();
    if (sub) {
      setSubscription(sub);
      setSelectedPlan(sub.plan);
      if (sub.billing_cycle === "annual" || sub.billing_cycle === "monthly") {
        setBillingCycle(sub.billing_cycle);
      }
    }
    setLoading(false);
  }

  async function refreshSubscription(userId: string) {
    const { data: sub } = await supabase
      .from("landlord_subscriptions")
      .select("plan, billing_cycle, status, current_period_end")
      .eq("landlord_id", userId)
      .maybeSingle();
    if (sub) setSubscription(sub);
    return sub;
  }

  async function payWithMpesa() {
    setError("");
    if (!phoneNumber.trim()) {
      setError("Enter the M-Pesa phone number to pay from.");
      return;
    }
    setPaying(true);
    setStatus("Sending payment prompt to your phone...");

    try {
      const res = await fetch("/api/subscription-stk-push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + authToken,
        },
        body: JSON.stringify({
          plan: selectedPlan,
          billingCycle,
          phoneNumber: phoneNumber.trim(),
        }),
      });
      const result = await res.json();

      if (!res.ok || result.error) {
        setError(result.error || "Could not start payment.");
        setPaying(false);
        setStatus("");
        return;
      }
      if (!result.CheckoutRequestID) {
        setError(result.errorMessage || "M-Pesa did not accept this request.");
        setPaying(false);
        setStatus("");
        return;
      }

      setStatus("Check your phone and enter your M-Pesa PIN to complete the payment.");

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) return;

      let attempts = 0;
      const poll = setInterval(async () => {
        attempts += 1;
        const sub = await refreshSubscription(userId);
        if (sub?.status === "active") {
          clearInterval(poll);
          setStatus("Payment received — you're all set.");
          setPaying(false);
        } else if (attempts >= 20) {
          clearInterval(poll);
          setPaying(false);
          setStatus("");
          setError("Didn't see the payment come through yet. If you completed it on your phone, refresh this page in a minute.");
        }
      }, 3000);
    } catch (e: any) {
      setError(e.message || "Something went wrong starting the payment.");
      setPaying(false);
      setStatus("");
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-12">
        <p className="text-center text-slate-500">Loading...</p>
      </main>
    );
  }

  const isActive = subscription?.status === "active";

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold text-slate-900">Billing</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your Managika Homes subscription.</p>

        {isActive && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-5">
            <p className="font-semibold text-emerald-800">
              You&rsquo;re on the {subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)} plan
              {subscription.billing_cycle === "annual" ? " (annual)" : ""}
            </p>
            <p className="mt-1 text-sm text-emerald-700">
              Renews {new Date(subscription.current_period_end).toLocaleDateString()}
            </p>
          </div>
        )}

        {!isActive && subscription?.status === "pending" && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-6 py-4 text-sm text-amber-800">
            Your last payment attempt didn&rsquo;t complete. Pick a plan below and try again.
          </div>
        )}

        <div className="mt-8 flex justify-center">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={
                "rounded-md px-4 py-2 text-sm font-semibold transition " +
                (billingCycle === "monthly" ? "bg-slate-900 text-white" : "text-slate-600")
              }
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("annual")}
              className={
                "rounded-md px-4 py-2 text-sm font-semibold transition " +
                (billingCycle === "annual" ? "bg-slate-900 text-white" : "text-slate-600")
              }
            >
              Annual — save 20%
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <button
              key={plan.key}
              type="button"
              onClick={() => setSelectedPlan(plan.key)}
              className={
                "rounded-2xl border-2 px-5 py-6 text-left transition " +
                (selectedPlan === plan.key ? "border-amber-500 bg-amber-50" : "border-slate-200 bg-white hover:border-slate-300")
              }
            >
              <p className="font-bold text-slate-900">{plan.name}</p>
              {billingCycle === "monthly" ? (
                <p className="mt-2 text-2xl font-extrabold text-slate-900">
                  KSh {plan.price.toLocaleString()}
                  <span className="text-sm font-medium text-slate-500"> /mo</span>
                </p>
              ) : (
                <>
                  <p className="mt-2 text-2xl font-extrabold text-slate-900">
                    KSh {annualPrice(plan.price).toLocaleString()}
                    <span className="text-sm font-medium text-slate-500"> /yr</span>
                  </p>
                  <p className="text-xs text-slate-400 line-through">KSh {(plan.price * 12).toLocaleString()} /yr</p>
                </>
              )}
              <p className="mt-2 text-xs text-slate-500">{plan.blurb}</p>
            </button>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
          <label className="mb-2 block text-sm font-semibold text-slate-700">M-Pesa phone number</label>
          <input
            type="text"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="e.g. 0712345678"
            className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
          />

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          {status && <p className="mt-4 text-sm text-slate-600">{status}</p>}

          <button
            type="button"
            disabled={paying}
            onClick={payWithMpesa}
            className="mt-6 w-full rounded-lg bg-amber-500 px-4 py-3 font-bold text-slate-900 transition hover:bg-amber-400 disabled:opacity-60"
          >
            {paying ? "Processing..." : "Pay with M-Pesa"}
          </button>
        </div>

        <div className="mt-6 text-center">
          <a href="/landlord/dashboard" className="text-sm font-medium text-slate-500 hover:text-slate-900">
            ← Back to dashboard
          </a>
        </div>
      </div>
    </main>
  );
}

export default function LandlordBilling() {
  return (
    <Suspense fallback={null}>
      <LandlordBillingInner />
    </Suspense>
  );
}
