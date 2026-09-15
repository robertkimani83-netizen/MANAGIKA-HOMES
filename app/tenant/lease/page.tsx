"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Lease {
  id: string;
  terms_text: string;
  monthly_rent: number | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  accepted_full_name: string | null;
  accepted_at: string | null;
  signature_data_url: string | null;
  signed_hash: string | null;
}

// Tenant-facing lease view + e-sign. The canvas below captures a drawn
// signature (not just a typed name); accepting also records the signer's
// IP address, device/browser, and a SHA-256 fingerprint of the exact terms
// shown at that moment (see app/api/tenant/lease/route.ts). Still not a
// certified e-signature service - no identity verification - but a real
// step up from a typed name alone, with a downloadable signed PDF as the
// paper trail (app/api/tenant/lease/pdf).
export default function TenantLeasePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState("");
  const [lease, setLease] = useState<Lease | null>(null);
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSignature, setHasSignature] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { router.push("/tenant/login"); return; }
      setAuthToken(token);

      try {
        const res = await fetch("/api/tenant/lease", { headers: { Authorization: "Bearer " + token } });
        const result = await res.json();
        if (res.ok) setLease(result.lease || null);
      } catch {
        // leave lease null - shown as "no lease yet"
      }
      setLoading(false);
    }
    init();
  }, [router]);

  function getCanvasPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function startDrawing(e: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = true;
    lastPointRef.current = getCanvasPoint(e);
  }

  function draw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !lastPointRef.current) return;
    const point = getCanvasPoint(e);
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;
    setHasSignature(true);
  }

  function stopDrawing() {
    drawingRef.current = false;
    lastPointRef.current = null;
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  async function downloadSignedPdf() {
    try {
      const res = await fetch("/api/tenant/lease/pdf", { headers: { Authorization: "Bearer " + authToken } });
      if (!res.ok) { alert("Could not generate the PDF - please try again."); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "managika-lease-agreement.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Could not generate the PDF - please try again.");
    }
  }

  async function acceptLease() {
    if (!lease) return;
    if (!fullName.trim()) { setError("Type your full name."); return; }
    if (!hasSignature) { setError("Draw your signature in the box below."); return; }
    const canvas = canvasRef.current;
    if (!canvas) return;

    setSubmitting(true);
    setError(null);
    try {
      const signatureDataUrl = canvas.toDataURL("image/png");
      const res = await fetch("/api/tenant/lease", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + authToken },
        body: JSON.stringify({ fullName: fullName.trim(), signatureDataUrl }),
      });
      const result = await res.json();
      if (!res.ok) { setError(result.error || "Could not accept lease."); setSubmitting(false); return; }
      setLease({ ...lease, status: "accepted", accepted_full_name: fullName.trim(), accepted_at: new Date().toISOString(), signature_data_url: signatureDataUrl });
    } catch {
      setError("Network error - please try again.");
    }
    setSubmitting(false);
  }

  if (loading) {
    return (<main className="min-h-screen bg-gray-100 flex items-center justify-center text-gray-500">Loading your lease...</main>);
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">MANAGIKA HOMES</h1>
            <p className="text-sm text-gray-500">Property Management Made Simple</p>
          </div>
          <a href="/tenant/dashboard" className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700">Back to Dashboard</a>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-6 py-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">My Lease</h2>

        {!lease ? (
          <div className="bg-white rounded-xl border shadow-sm p-6 text-gray-500">Your landlord hasn&apos;t sent you a lease yet.</div>
        ) : (
          <>
            <div className="bg-white rounded-xl border shadow-sm p-6 mb-6">
              <div className="mb-4 text-sm text-gray-600">
                {lease.monthly_rent ? <p>Monthly rent: <span className="font-medium text-gray-900">KSh {Number(lease.monthly_rent).toLocaleString()}</span></p> : null}
                <p>Lease period: <span className="font-medium text-gray-900">{lease.start_date || "?"} to {lease.end_date || "?"}</span></p>
              </div>
              <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 bg-gray-50 border rounded-lg p-4 max-h-96 overflow-y-auto">{lease.terms_text}</pre>
            </div>

            {lease.status === "accepted" ? (
              <div className="bg-white rounded-xl border shadow-sm p-6">
                <p className="text-emerald-700 font-medium mb-4">
                  You accepted this lease{lease.accepted_at ? " on " + new Date(lease.accepted_at).toLocaleString() : ""}.
                </p>
                {lease.signature_data_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={lease.signature_data_url} alt="Your signature" className="border rounded-lg bg-white mb-4" style={{ maxWidth: 220 }} />
                ) : null}
                <button onClick={downloadSignedPdf} className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-800">
                  Download signed lease (PDF)
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-xl border shadow-sm p-6">
                <h3 className="text-xl font-semibold mb-4">Accept this lease</h3>
                <label className="mb-2 block text-sm font-medium text-gray-700">Type your full legal name</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 mb-4" />

                <label className="mb-2 block text-sm font-medium text-gray-700">Sign in the box below (use your finger or mouse)</label>
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={160}
                  onPointerDown={startDrawing}
                  onPointerMove={draw}
                  onPointerUp={stopDrawing}
                  onPointerLeave={stopDrawing}
                  className="w-full max-w-full border-2 border-dashed border-gray-300 rounded-lg bg-white touch-none"
                  style={{ height: 160 }}
                />
                <button type="button" onClick={clearSignature} className="mt-2 text-sm text-gray-500 underline">Clear signature</button>

                <p className="mt-4 text-xs text-gray-400">
                  By typing your name and signing above, you confirm you have read and agree to these terms. Your signature, IP address, device, and the time of signing are recorded with this lease as your acceptance record.
                </p>

                {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
                <button onClick={acceptLease} disabled={submitting} className="mt-4 rounded-lg bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-800 disabled:opacity-50">
                  {submitting ? "Submitting..." : "Sign and accept lease"}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
