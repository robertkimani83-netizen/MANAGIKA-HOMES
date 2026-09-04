"use client";

import { useEffect } from "react";

// Marks <html> with "mh-app-shell" ONLY when the site is running inside the
// installed Android app (the wrapped APK), never in a normal browser tab.
// Two checks, because the APK currently falls back to showing Chrome's
// Custom Tab UI (URL bar visible) instead of a true fullscreen standalone
// window, so display-mode alone isn't reliable yet:
//  - display-mode: standalone/fullscreen/minimal-ui - true once the app
//    launches as a real trusted web activity.
//  - document.referrer starting with "android-app:" - true whenever the
//    page was opened via an installed Android app's intent, which covers
//    today's Custom Tab fallback too.
// Anything scoped under html.mh-app-shell in globals.css is invisible to
// regular website visitors on desktop or mobile browsers.
export default function AppShellDetect() {
  useEffect(() => {
    try {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: fullscreen)").matches ||
        window.matchMedia("(display-mode: minimal-ui)").matches;
      const fromAndroidApp = document.referrer.startsWith("android-app:");
      if (standalone || fromAndroidApp) {
        document.documentElement.classList.add("mh-app-shell");
      }
    } catch {
      // Detection is best-effort only - never breaks the page if it fails.
    }
  }, []);
  return null;
}
