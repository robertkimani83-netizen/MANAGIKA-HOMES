"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function UnitListingEditor() {
  const params = useParams();
  const router = useRouter();
  const unitId = params.id as string;

  const [authToken, setAuthToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [headline, setHeadline] = useState("");
  const [description, setDescription] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [publicUrl, setPublicUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push("/landlord/login");
        return;
      }
      setAuthToken(data.session.access_token);

      const { data: unit } = await supabase.from("units").select("id, unit_number, base_rent").eq("id", unitId).maybeSingle();
      if (!unit) {
        setError("Unit not found.");
        setLoading(false);
        return;
      }
      setHeadline("Unit " + unit.unit_number + " — KSh " + Number(unit.base_rent).toLocaleString() + "/month");

      const { data: listing } = await supabase.from("unit_listings").select("headline, description, contact_phone, photo_paths, is_published").eq("unit_id", unitId).maybeSingle();
      if (listing) {
        if (listing.headline) setHeadline(listing.headline);
        setDescription(listing.description || "");
        setContactPhone(listing.contact_phone || "");
        setIsPublished(listing.is_published);
        setPhotoPaths(listing.photo_paths || []);
      }
      setLoading(false);
    }
    init();
  }, [unitId, router]);

  async function save() {
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + authToken },
        body: JSON.stringify({ unitId, headline, description, contactPhone, isPublished }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error || "Could not save listing.");
        return;
      }
      setPublicUrl(result.publicUrl);
    } catch (e) {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhoto(file: File) {
    setError("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("unitId", unitId);
      const res = await fetch("/api/listings/photo", {
        method: "POST",
        headers: { Authorization: "Bearer " + authToken },
        body: formData,
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error || "Could not upload photo.");
        return;
      }
      setPhotoUrls((prev) => [...prev, result.photoUrl]);
      const path = result.photoUrl.split("/listing-photos/")[1];
      setPhotoPaths((prev) => [...prev, path]);
    } catch (e) {
      setError("Could not reach the server.");
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto(path: string) {
    const res = await fetch("/api/listings/photo", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + authToken },
      body: JSON.stringify({ unitId, path }),
    });
    if (res.ok) {
      setPhotoPaths((prev) => prev.filter((p) => p !== path));
      setPhotoUrls((prev) => prev.filter((u) => !u.includes(path)));
    }
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-gray-100 text-slate-500">Loading...</main>;
  }

  return (
    <main className="min-h-screen bg-gray-100 px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <a href="/units" className="text-sm font-medium text-slate-500 hover:text-slate-900">&larr; Back to Units</a>

        <div className="mt-4 mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Vacancy Listing</h1>
          <p className="mt-1 text-sm text-slate-500">Share this unit publicly to fill it faster — no login required to view.</p>
        </div>

        {error && <div className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {publicUrl && (
          <div className="mb-5 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
            Saved. Share this link: <span className="break-all font-mono text-xs">{publicUrl}</span>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Headline</label>
              <input type="text" value={headline} onChange={(e) => setHeadline(e.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="e.g. Spacious 2-bedroom, water included, 5 min walk to the bus stage." className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Contact Phone (shown publicly)</label>
              <input type="text" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="0712345678" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200" />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Photos ({photoPaths.length}/8)</label>
              <div className="flex flex-wrap gap-3">
                {photoUrls.length === 0 && photoPaths.length > 0 ? (
                  <p className="text-sm text-slate-500">Loaded — refresh to preview existing photos.</p>
                ) : (
                  photoUrls.map((url, i) => (
                    <div key={i} className="relative h-24 w-24 overflow-hidden rounded-lg border border-slate-200">
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(photoPaths[i])}
                        className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-xs text-white"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
              <label className="mt-3 inline-block cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                {uploading ? "Uploading..." : "Add Photo"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  className="hidden"
                  disabled={uploading || photoPaths.length >= 8}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadPhoto(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
              Published (visible to anyone with the link)
            </label>

            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="rounded-lg bg-amber-500 px-6 py-3 font-semibold text-slate-900 transition hover:bg-amber-400 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Listing"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
