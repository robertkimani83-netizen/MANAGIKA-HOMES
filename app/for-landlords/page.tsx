import { redirect } from "next/navigation";

// This page's content moved to the homepage (app/page.tsx). Keeping this
// route alive as a redirect so any old links or bookmarks to /for-landlords
// still land somewhere useful instead of 404ing.
export default function ForLandlords() {
  redirect("/");
}
