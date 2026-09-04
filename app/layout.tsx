import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "./service-worker-register";
import AppShellDetect from "./app-shell-detect";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Managika Homes",
  description: "Property management made simple",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192-v2.png",
    apple: "/icon-192-v2.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Managika Homes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

// Organization structured data - tells Google this domain IS the company
// "Managika Homes" (name, logo, description), which helps a plain brand-name
// search surface the right site instead of nothing/unrelated results.
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Managika Homes",
  alternateName: "Managika",
  url: "https://managikahomes.co.ke",
  logo: "https://managikahomes.co.ke/icon-512-v2.png",
  description:
    "Property management software for landlords in Kenya - rent tracking, tenant communication, and M-Pesa payments, with money landing straight in the landlord's own account.",
  address: {
    "@type": "PostalAddress",
    addressCountry: "KE",
    addressLocality: "Nairobi",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        {children}
        <ServiceWorkerRegister />
        <AppShellDetect />
      </body>
    </html>
  );
}
