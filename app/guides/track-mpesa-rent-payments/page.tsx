import type { Metadata } from "next";
import Link from "next/link";
import ArticlePage from "../../_seo/ArticlePage";

const PATH = "/guides/track-mpesa-rent-payments";
const TITLE = "How to Track M-Pesa Rent Payments From Tenants";
const DESCRIPTION =
  "A practical guide for Kenyan landlords: how to set up your Paybill or Till so every M-Pesa rent payment can be matched to the right tenant, how to handle partial and wrong payments, and a simple monthly routine.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { type: "article", url: PATH, title: `${TITLE} | Managika Homes`, description: DESCRIPTION },
};

export default function Page() {
  return (
    <ArticlePage path={PATH} title={TITLE} description={DESCRIPTION} published="2026-10-18" readMinutes={6}>
      <p>
        Most landlords in Kenya now collect rent through M-Pesa. Getting paid is easy. Knowing <strong>who</strong> paid,
        <strong> for which unit</strong> and <strong>how much is still owed</strong> is the hard part, especially once you
        have more than a handful of tenants and the confirmation messages start piling up.
      </p>
      <p>
        This guide walks through how to set up rent collection so every payment can be traced back to a tenant, the
        problems that cause most of the confusion, and a simple routine you can follow each month.
      </p>

      <h2>1. Decide how tenants will pay you</h2>
      <p>The option you choose decides how easy it is to tell payments apart later.</p>
      <div className="ar-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Option</th>
              <th>How tenants pay</th>
              <th>How easy to track</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Personal M-Pesa number (Send Money)</td>
              <td>Send to your phone number</td>
              <td>Hardest. Rent mixes with personal money and there is no reference field.</td>
            </tr>
            <tr>
              <td>Till number (Buy Goods)</td>
              <td>Pay to your Till</td>
              <td>Better. Rent is separate, but there is no account field, so you match by the payer&rsquo;s name.</td>
            </tr>
            <tr>
              <td>Paybill (yours or your bank&rsquo;s)</td>
              <td>Pay to the Paybill and type an account number</td>
              <td>Easiest. The account number tells you which unit the payment is for.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        If you can, use a Paybill. Many banks let you collect into your bank account through the bank&rsquo;s own Paybill,
        with your account number plus a reference, which gives you the same benefit without applying for your own.
      </p>

      <h2>2. Give every unit its own reference</h2>
      <p>
        The single biggest fix is a unique, simple reference for each unit, such as <strong>A1</strong>,{" "}
        <strong>B4</strong> or <strong>SHOP2</strong>. Tell each tenant exactly what to type in the account or
        reference field, and put it on their invoice or reminder every month.
      </p>
      <ul>
        <li>Use the unit, not the tenant&rsquo;s name. Tenants move out; units don&rsquo;t.</li>
        <li>Keep it short and without spaces so it is easy to type on a basic phone.</li>
        <li>Avoid references that look alike, such as &ldquo;1A&rdquo; and &ldquo;A1&rdquo; in the same building.</li>
      </ul>
      <p className="ar-tip">
        Tip: write the payment instructions (Paybill, account format and the unit&rsquo;s reference) on a small card or
        sticker inside each unit. New tenants get it right from the first month.
      </p>

      <h2>3. Know the problems before they happen</h2>
      <h3>Payments with no reference or the wrong one</h3>
      <p>
        Someone types their phone number or their name instead of the unit. Match it using the payer&rsquo;s name and the
        amount, then remind that tenant of the right reference so it doesn&rsquo;t repeat.
      </p>
      <h3>Someone else pays for the tenant</h3>
      <p>
        A spouse, employer or relative pays, so the name on the confirmation doesn&rsquo;t match your records. This is
        another reason the unit reference matters more than the name.
      </p>
      <h3>Partial payments</h3>
      <p>
        A tenant pays half now and half later. Record each payment separately against the same month and carry the
        remaining balance forward, instead of waiting for the full amount before writing anything down.
      </p>
      <h3>Overpayments and advance rent</h3>
      <p>
        Record the extra as a credit on the tenant&rsquo;s account and apply it to the next invoice, so you don&rsquo;t
        have to remember it.
      </p>

      <h2>4. A simple monthly routine</h2>
      <ol>
        <li>
          <strong>Before the due date:</strong> send each tenant their amount due, including any balance carried forward,
          and their unit reference.
        </li>
        <li>
          <strong>As payments arrive:</strong> record each one against the unit, with the M-Pesa transaction code, the
          amount and the date.
        </li>
        <li>
          <strong>A few days after the due date:</strong> list who has paid in full, who has paid part and who
          hasn&rsquo;t paid. Follow up with the last two groups.
        </li>
        <li>
          <strong>At month end:</strong> compare your records with your Paybill, Till or bank statement. Every transaction
          on the statement should match a recorded payment.
        </li>
        <li>
          <strong>Carry balances forward</strong> into next month&rsquo;s invoices.
        </li>
      </ol>
      <p>
        Keeping the M-Pesa transaction code for every payment matters. When a tenant disputes a balance, the code lets you
        both find the exact payment in seconds.
      </p>

      <h2>5. Don&rsquo;t forget tenants without smartphones</h2>
      <p>
        Many tenants still use basic phones. Reminders and payment confirmations sent by SMS reach everyone, while app
        notifications or WhatsApp messages only reach some of them. A short SMS with the amount, the reference and the
        Paybill is usually all a tenant needs.
      </p>

      <h2>Doing it automatically</h2>
      <p>
        A spreadsheet works for a few units. Beyond that, the matching takes hours each month. Managika Homes was built to
        handle exactly this: tenants keep paying into your own Paybill, Till or bank account, payments are recorded
        against each unit&rsquo;s invoice, balances carry forward automatically and tenants get SMS reminders and
        confirmations. See how it works on the <Link href="/mpesa-rent-tracking">M-Pesa rent tracking</Link> page.
      </p>
    </ArticlePage>
  );
}
