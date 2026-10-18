import type { Metadata } from "next";
import SeoLandingPage from "../_seo/SeoLandingPage";

const PATH = "/mpesa-rent-tracking";

export const metadata: Metadata = {
  title: "M-Pesa Rent Tracking for Landlords",
  description:
    "Track M-Pesa rent payments to your own Paybill or Till automatically. See who has paid, who is overdue and every tenant's balance in one dashboard. Built for landlords in Kenya. Free 7-day trial.",
  alternates: { canonical: PATH },
  openGraph: { url: PATH, title: "M-Pesa Rent Tracking for Landlords | Managika Homes" },
};

export default function Page() {
  return (
    <SeoLandingPage
      path={PATH}
      eyebrow="M-Pesa rent tracking"
      title="Track every M-Pesa rent payment automatically"
      intro="When rent comes in through M-Pesa, matching each payment to the right tenant by hand takes hours every month. Managika Homes records M-Pesa and bank payments against each tenant's invoice for you, so your books stay current without scrolling through messages."
      sections={[
        {
          heading: "Payments land in your account, records update in ours",
          body: "Tenants pay your existing Paybill, Till or bank account exactly as they do today. Managika Homes reads the payment confirmation and records it against the right unit, so you never have to forward money or change how tenants pay.",
        },
        {
          heading: "See the month at a glance",
          body: "Your dashboard shows what has been collected this month, which units are paid or partly paid, and who is overdue.",
          points: [
            "Paid, partly paid and overdue status for every unit",
            "Each payment's M-Pesa reference kept with the record",
            "Balances carried into next month's invoice",
          ],
        },
        {
          heading: "Confirmations tenants actually receive",
          body: "Tenants get a payment confirmation and rent reminders by SMS, so even tenants without smartphones are kept in the loop.",
        },
        {
          heading: "Simple pricing",
          body: "Plans start at KSh 1,500 a month. Prices exclude Safaricom's standard M-Pesa transaction charges. Try it free for 7 days on up to 3 units.",
        },
      ]}
      faqs={[
        {
          q: "Does Managika Homes hold or forward my rent money?",
          a: "No. Rent goes straight to your own Paybill, Till or bank account. We only use the payment confirmations to update your records.",
        },
        {
          q: "Does it work with a bank Paybill as well as M-Pesa?",
          a: "Yes. M-Pesa and bank payments are both tracked against your tenants' invoices.",
        },
        {
          q: "What if a tenant pays the wrong amount?",
          a: "The payment is recorded as a partial payment and the remaining balance carries forward, so you always know exactly what is still owed.",
        },
      ]}
    />
  );
}
