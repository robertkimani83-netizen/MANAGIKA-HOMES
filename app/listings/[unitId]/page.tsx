"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Listing = {
  unitNumber: string | null;
  propertyName: string | null;
  baseRent: number | null;
  headline: string | null;
  description: string | null;
  contactPhone: string | null;
  photoUrls: string[];
};

// Public page - no login, no auth header. Meant to be shared as a plain
// link (WhatsApp, Facebook, wherever a landlord would normally post a
// vacancy). Fetches from /api/listings, which itself requires no auth
// for a published listing.
export default function PublicListingPage() {
  const params = useParams();
  const unitId = params.unitId as string;
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/listings?unitId=" + unitId);
        const result = await res.json();
        if (!res.ok) {
          setError(result.error || "This listing isn't available.");
          setLoading(false);
          return;
        }
        setListing(result);
      } catch (e) {
        setError("Could not load this listing.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [unitId]);

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">Loading...</main>;
  }

  if (error || !listing) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Listing not found</h1>
          <p className="mt-2 text-sm text-slate-500">{error || "This unit may no longer be available."}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-amber-600">Available for Rent</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">{listing.headline || "Unit " + (listing.unitNumber || "")}</h1>
          {listing.propertyName && <p className="mt-1 text-slate-500">{listing.propertyName}</p>}
        </div>

        {listing.photoUrls.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {listing.photoUrls.map((url, i) => (
              <img key={i} src={url} alt="" className="aspect-square w-full rounded-xl object-cover shadow-sm" />
            ))}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {listing.baseRent && (
            <p className="text-2xl font-bold text-slate-900">KSh {Number(listing.baseRent).toLocaleString()} <span className="text-sm font-normal text-slate-500">/ month</span></p>
          )}
          {listing.description && <p className="mt-4 whitespace-pre-wrap text-slate-700">{listing.description}</p>}
          {listing.contactPhone && (
            <a href={"tel:" + listing.contactPhone} className="mt-6 inline-block w-full rounded-lg bg-amber-500 px-6 py-3 text-center font-semibold text-slate-900 hover:bg-amber-400">
              Call {listing.contactPhone}
            </a>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">Listed with Managika Homes</p>
      </div>
    </main>
  );
}
