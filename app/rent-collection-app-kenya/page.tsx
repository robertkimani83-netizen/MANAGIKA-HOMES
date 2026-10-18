import type { Metadata } from "next";
import SeoLandingPage from "../_seo/SeoLandingPage";

const PATH = "/rent-collection-app-kenya";

export const metadata: Metadata = {
  title: "Rent Collection App for Landlords in Kenya",
  description:
    "Collect and track rent from every tenant in one app. Tenants pay into your own M-Pesa Paybill, Till or bank account, payments are recorded automatically, and SMS reminders go out on time. Free 7-day trial.",
  alternates: { canonical: PATH },
  openGraph: { url: PATH, title: "Rent Collection App for Landlords in Kenya | Managika Homes" },
};

export default function Page() {
  return (
    <SeoLandingPage
      path={PATH}
      eyebrow="Rent collection app · Kenya"
      title="The rent collection app for Kenyan landlords"
      intro="Stop chasing rent through notebooks, M-Pesa messages and WhatsApp threads. Managika Homes keeps every tenant's rent, balance and payment history in one place, while the money still goes straight into your own Paybill, Till or bank account."
      sections={[
        {
          heading: "Know who has paid, without checking your phone",
          body: "Every unit gets a monthly invoice for rent and any extra charges. When a tenant pays, the payment is recorded against their invoice, so your dashboard shows paid, partly paid and overdue units at a glance.",
          points: [
            "Monthly invoices for rent, water and other charges",
            "Running balances carried forward automatically",
            "Statements you can share with any tenant",
          ],
        },
        {
          heading: "Reminders that reach every tenant",
          body: "Rent reminders go out by SMS, so tenants on basic phones get them too, not only those with smartphones. Tenants who prefer can also check their balance in a simple web portal, with no app download needed.",
        },
        {
          heading: "Your money never passes through us",
          body: "Managika Homes never touches your rent. Tenants keep paying the same Paybill, Till or bank account they use today. We only read the payment confirmations to keep your records accurate.",
        },
        {
          heading: "Pricing that fits a few units or a whole estate",
          body: "Plans start at KSh 1,500 a month, with a lower per-unit rate as your portfolio grows. Pay annually and save 20%. Start with a free 7-day trial for up to 3 units.",
        },
      ]}
      faqs={[
        {
          q: "Do I need a new Paybill or Till to use Managika Homes?",
          a: "No. You connect the Paybill, Till or bank account you already have. Nothing changes about where the money lands.",
        },
        {
          q: "Do my tenants need smartphones?",
          a: "No. Reminders go out by SMS, which works on any phone. Tenants with smartphones can also use the web portal or the optional Android app.",
        },
        {
          q: "Can I bring in my existing tenants?",
          a: "Yes. Add properties, units and tenants one by one or bulk-import them, so you are not starting from zero.",
        },
        {
          q: "Is there a contract?",
          a: "No lock-in. Cancel anytime from your billing page and keep access until the end of your paid period.",
        },
      ]}
    />
  );
}
