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

const SITE_URL = "https://managikahomes.co.ke";
const SEO_TITLE = "Managika Homes - Property Management Software for Landlords in Kenya";
const SEO_DESCRIPTION =
  "Track rent, tenants, and M-Pesa payments in one place. Automatic rent reminders, tenant statements, and maintenance tracking for Kenyan landlords - money goes straight to your own Paybill or Till. Free 7-day trial.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SEO_TITLE,
    template: "%s | Managika Homes",
  },
  description: SEO_DESCRIPTION,
  keywords: [
    "property management software Kenya",
    "landlord app Kenya",
    "rent collection software Kenya",
    "rent tracking app",
    "M-Pesa rent payments",
    "tenant management system",
    "rental property software Nairobi",
  ],
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
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Managika Homes",
    title: SEO_TITLE,
    description: SEO_DESCRIPTION,
    locale: "en_KE",
    images: [
      {
        url: "/icon-512-v2.png",
        width: 512,
        height: 512,
        alt: "Managika Homes",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SEO_TITLE,
    description: SEO_DESCRIPTION,
    images: ["/icon-512-v2.png"],
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

// SoftwareApplication structured data - lets Google show pricing directly in
// search results for a query like "property management software Kenya".
// Only real, current numbers from the pricing table on the homepage go here.
const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Managika Homes",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, Android",
  url: SITE_URL,
  description: SEO_DESCRIPTION,
  offers: {
    "@type": "Offer",
    price: "1500",
    priceCurrency: "KES",
    priceValidUntil: "2027-12-31",
    description: "Starter plan, monthly minimum",
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
        />
        {children}
        <ServiceWorkerRegister />
        <AppShellDetect />
      </body>
    </html>
  );
}
