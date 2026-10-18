import type { Metadata } from "next";
import SeoLandingPage from "../_seo/SeoLandingPage";

const PATH = "/property-management-software-nairobi";

export const metadata: Metadata = {
  title: "Property Management Software in Nairobi",
  description:
    "Property management software for Nairobi landlords and agents: rent tracking, tenant records, SMS reminders, M-Pesa payments and maintenance requests in one dashboard. Plans from KSh 1,500/month.",
  alternates: { canonical: PATH },
  openGraph: { url: PATH, title: "Property Management Software in Nairobi | Managika Homes" },
};

export default function Page() {
  return (
    <SeoLandingPage
      path={PATH}
      eyebrow="Property management software · Nairobi"
      title="Property management software built for Nairobi landlords"
      intro="Whether you own a single block or manage several estates across Nairobi, Managika Homes puts your properties, units, tenants, rent and maintenance in one dashboard you can open from any phone or computer."
      sections={[
        {
          heading: "Everything about your rentals in one place",
          body: "Stop keeping tenant details in one notebook, payments in your M-Pesa messages and repairs in WhatsApp.",
          points: [
            "Properties, blocks and units organised in one dashboard",
            "Tenant records, invoices and statements",
            "Rent tracking for M-Pesa and bank payments",
            "Maintenance requests logged and followed up",
            "An AI assistant you can ask questions like who still owes rent",
          ],
        },
        {
          heading: "Made for how Kenyan tenants pay",
          body: "Tenants pay into your own Paybill, Till or bank account, and reminders go out by SMS so tenants on basic phones are included. Tenants with smartphones can use a web portal, no download required.",
        },
        {
          heading: "Fair pricing from 4 units to 400",
          body: "Each plan has a monthly minimum, from KSh 1,500, and a per-unit rate that drops as your portfolio grows. Typical property management software in Kenya costs far more before you add a single extra unit.",
        },
      ]}
      faqs={[
        {
          q: "Is Managika Homes only for Nairobi?",
          a: "No. It works for landlords anywhere in Kenya. Many of our features, like SMS reminders and M-Pesa tracking, are built around how rent is paid across the country.",
        },
        {
          q: "Can property agents use it for several landlords' buildings?",
          a: "Yes. The Portfolio plan is designed for estates and agencies with larger numbers of units.",
        },
        {
          q: "How long does setup take?",
          a: "You can add your first property and units in minutes, and bulk-import existing tenants so you are not starting from zero.",
        },
      ]}
    />
  );
}
