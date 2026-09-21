import { useCallback, useEffect, useState } from "react";

// English / Kiswahili switch for the tenant pages.
//
// The English text stays right where it is in each page. tr("Sign In") looks
// that exact English text up in the SW table below and returns the Kiswahili
// version; if a phrase has no Kiswahili entry yet, the English text is shown,
// so a missing translation can never break a page. The chosen language is
// remembered on the tenant's own phone.

export type Lang = "en" | "sw";

const STORAGE_KEY = "mh_tenant_lang";

const SW_MONTHS: Record<string, string> = {
  January: "Januari",
  February: "Februari",
  March: "Machi",
  April: "Aprili",
  May: "Mei",
  June: "Juni",
  July: "Julai",
  August: "Agosti",
  September: "Septemba",
  October: "Oktoba",
  November: "Novemba",
  December: "Desemba",
};

// "September 2026" -> "Septemba 2026" (billing periods are stored in English).
export function trPeriod(lang: Lang, period: string): string {
  if (lang !== "sw" || !period) return period;
  const [month, ...rest] = period.split(" ");
  return [SW_MONTHS[month] || month, ...rest].join(" ");
}

const SW: Record<string, string> = {
  // Header and navigation
  "Tenant Portal": "Tovuti ya Mpangaji",
  "🤖 AI Assistant": "🤖 Msaidizi wa AI",
  "📄 My Lease": "📄 Mkataba Wangu",
  "💬 Chat on WhatsApp": "💬 Ongea kwa WhatsApp",
  "📲 Get App": "📲 Pakua Programu",
  "Sign Out": "Toka",
  "Loading your account...": "Inapakia akaunti yako...",
  "Welcome,": "Karibu,",
  "No unit assigned yet": "Bado hujapewa nyumba",
  "Unit": "Nyumba",
  // Notices, home summary
  "📣 Notices": "📣 Matangazo",
  "🏠 My Home": "🏠 Nyumba Yangu",
  "Rent": "Kodi",
  "Last Payment": "Malipo ya Mwisho",
  "None yet": "Bado hakuna",
  "No invoice yet": "Bado hakuna ankara",
  "Monthly Rent": "Kodi ya Kila Mwezi",
  "Open Maintenance": "Matengenezo Yanayoendelea",
  // Paying
  "Pay with M-Pesa": "Lipa kwa M-Pesa",
  "Starting...": "Inaanza...",
  "Pay via M-Pesa:": "Lipa kupitia M-Pesa:",
  "Pay via M-Pesa Paybill:": "Lipa kupitia M-Pesa Paybill:",
  "Business Number:": "Namba ya Biashara:",
  "Account Number:": "Namba ya Akaunti:",
  "Use this account number exactly, so your payment is matched to your home.": "Tumia namba hii ya akaunti kama ilivyo, ili malipo yako yahusishwe na nyumba yako.",
  "Till Number": "Namba ya Till",
  "Phone Number": "Namba ya Simu",
  "After paying, tap below to let your landlord know.": "Baada ya kulipa, bonyeza hapa chini kumjulisha mwenye nyumba wako.",
  "✓ Marked as paid - waiting for your landlord to confirm.": "✓ Umeonyesha umelipa - unasubiri mwenye nyumba wako athibitishe.",
  "I've Paid": "Nimelipa",
  "Notifying...": "Inatuma taarifa...",
  "Pay by bank transfer:": "Lipa kwa uhamisho wa benki:",
  "Acc:": "Akaunti:",
  "Branch:": "Tawi:",
  "After transferring, tap below to let your landlord know.": "Baada ya kuhamisha, bonyeza hapa chini kumjulisha mwenye nyumba wako.",
  "Online payment isn't set up yet - please contact your landlord directly to pay rent.": "Malipo ya mtandaoni bado hayajawekwa - tafadhali wasiliana na mwenye nyumba wako moja kwa moja ili ulipe kodi.",
  // Documents
  "📄 My Documents": "📄 Nyaraka Zangu",
  "Your landlord hasn't shared any documents with you yet.": "Mwenye nyumba wako bado hajakushirikisha nyaraka zozote.",
  "View": "Angalia",
  // Invoices and payments tables
  "My Invoices": "Ankara Zangu",
  "Period": "Kipindi",
  "Amount": "Kiasi",
  "Due Date": "Tarehe ya Mwisho",
  "Status": "Hali",
  "No invoices yet.": "Bado hakuna ankara.",
  "Payment History": "Historia ya Malipo",
  "Date": "Tarehe",
  "Method": "Njia",
  "Reference": "Rejea",
  "Receipt": "Risiti",
  "No payments recorded yet.": "Bado hakuna malipo yaliyorekodiwa.",
  // Maintenance
  "My Maintenance Requests": "Maombi Yangu ya Matengenezo",
  "+ New Request": "+ Ombi Jipya",
  "Category": "Aina",
  "Plumbing": "Mabomba",
  "Electrical": "Umeme",
  "Structural": "Muundo wa jengo",
  "Other": "Nyingine",
  "Urgency": "Uharaka",
  "Normal": "Kawaida",
  "Urgent": "Haraka",
  "Short Title": "Kichwa Kifupi",
  "e.g. Kitchen sink leaking": "mf. Sinki ya jikoni inavuja",
  "Description": "Maelezo",
  "Describe the issue": "Eleza tatizo",
  "Submit Request": "Tuma Ombi",
  "Cancel": "Ghairi",
  "Issue": "Tatizo",
  "No maintenance requests yet.": "Bado hakuna maombi ya matengenezo.",
  "Received": "Imepokelewa",
  "Assigned": "Imekabidhiwa",
  "In Progress": "Inaendelea",
  "Completed": "Imekamilika",
  "Reported": "Liliripotiwa",
  "We have received your request.": "Tumepokea ombi lako.",
  "Technician:": "Fundi:",
  "A technician has been assigned.": "Fundi amekabidhiwa kazi.",
  "Work is in progress.": "Kazi inaendelea.",
  "This repair is finished.": "Matengenezo yamekamilika.",
  // Complaints
  "My Complaints": "Malalamiko Yangu",
  "+ New Complaint": "+ Malalamiko Mapya",
  "Describe your complaint": "Eleza malalamiko yako",
  "e.g. Noisy neighbor at night": "mf. Jirani ana kelele usiku",
  "Submit Complaint": "Tuma Malalamiko",
  "Complaint": "Malalamiko",
  "No complaints yet.": "Bado hakuna malalamiko.",
  "© 2026 Managika Homes. Property management made simple.": "© 2026 Managika Homes. Usimamizi wa mali kwa urahisi.",
  // Status words (invoices, requests, complaints, payment methods)
  "paid": "imelipwa",
  "unpaid": "haijalipwa",
  "partial": "sehemu",
  "partially paid": "imelipwa sehemu",
  "bank transfer": "uhamisho wa benki",
  "overdue": "imechelewa",
  "submitted": "imewasilishwa",
  "pending": "inasubiri",
  "resolved": "imetatuliwa",
  "in progress": "inaendelea",
  "completed": "imekamilika",
  "assigned": "imekabidhiwa",
  "normal": "kawaida",
  "urgent": "haraka",
  "cash": "pesa taslimu",
  "bank": "benki",
  "mpesa": "M-Pesa",
  // Messages shown in pop-ups
  "You don't have a unit assigned yet, so your landlord would not see this. Please ask your landlord to assign your unit first.": "Bado hujapewa nyumba, kwa hiyo mwenye nyumba wako hangeona hili. Tafadhali mwombe mwenye nyumba wako akupe nyumba kwanza.",
  "Please fill in the title and description.": "Tafadhali jaza kichwa na maelezo.",
  "Please describe your complaint.": "Tafadhali eleza malalamiko yako.",
  "Missing phone number or unit information.": "Namba ya simu au taarifa za nyumba hazipo.",
  "Your session expired - please refresh and log in again.": "Muda wako umeisha - tafadhali pakia upya na uingie tena.",
  "Check your phone to complete the M-Pesa payment.": "Angalia simu yako ukamilishe malipo ya M-Pesa.",
  "Could not open document: ": "Hati haikuweza kufunguliwa: ",
  "Error submitting request: ": "Hitilafu kutuma ombi: ",
  "Error submitting complaint: ": "Hitilafu kutuma malalamiko: ",
  "Payment could not be started: ": "Malipo hayakuweza kuanzishwa: ",
  "Error starting payment: ": "Hitilafu kuanzisha malipo: ",
  "Could not notify your landlord: ": "Mwenye nyumba wako hakuweza kujulishwa: ",
  "Error: ": "Hitilafu: ",
  "English": "English",
  "Kiswahili": "Kiswahili",
  // Receipt page
  "Rent Receipt": "Risiti ya Kodi",
  "Receipt No.": "Risiti Na.",
  "Received from": "Imepokelewa kutoka kwa",
  "Property": "Mali",
  "Payment method": "Njia ya malipo",
  "Transaction reference": "Rejea ya muamala",
  "Amount paid": "Kiasi kilicholipwa",
  "Invoice total": "Jumla ya ankara",
  "Paid to date": "Yaliyolipwa hadi sasa",
  "Balance remaining": "Salio lililobaki",
  "Print / Save as PDF": "Chapisha / Hifadhi kama PDF",
  "Back to my account": "Rudi kwenye akaunti yangu",
  "Loading receipt...": "Inapakia risiti...",
  "This receipt could not be found.": "Risiti hii haikupatikana.",
  "Thank you for your payment.": "Asante kwa malipo yako.",
  "This receipt was generated by Managika Homes.": "Risiti hii imetolewa na Managika Homes.",
  // Login page
  "Tenant Login": "Kuingia kwa Mpangaji",
  "Tenant Sign Up": "Kujisajili kwa Mpangaji",
  "Sign in with your email or phone number to view your home, rent and payments.": "Ingia kwa barua pepe au namba ya simu uone nyumba yako, kodi na malipo.",
  "Use the email or phone number your landlord registered you with.": "Tumia barua pepe au namba ya simu ambayo mwenye nyumba wako alikusajili nayo.",
  "Email or Phone Number": "Barua pepe au Namba ya Simu",
  "Password": "Nenosiri",
  "Enter your password": "Weka nenosiri lako",
  "Forgot password?": "Umesahau nenosiri?",
  "Please wait...": "Tafadhali subiri...",
  "Sign In": "Ingia",
  "Create Account": "Fungua Akaunti",
  "OR": "AU",
  "First time? Set up your account": "Mara ya kwanza? Weka akaunti yako",
  "Already have an account? Sign In": "Una akaunti tayari? Ingia",
  "Are you a landlord?": "Wewe ni mwenye nyumba?",
  "Landlord Login": "Kuingia kwa Mwenye Nyumba",
  "← Back to Managika Homes": "← Rudi Managika Homes",
  "Reset Your Password": "Weka Nenosiri Jipya",
  "Enter the email or phone number your landlord registered you with.": "Weka barua pepe au namba ya simu ambayo mwenye nyumba wako alikusajili nayo.",
  "Enter the code we texted you and your new password.": "Weka msimbo tuliokutumia kwa SMS na nenosiri lako jipya.",
  "Check your email for a reset link.": "Angalia barua pepe yako kwa kiungo cha kuweka upya.",
  "Send Reset Code": "Tuma Msimbo wa Kuweka Upya",
  "Sending...": "Inatuma...",
  "Reset Code": "Msimbo wa Kuweka Upya",
  "6-digit code": "Msimbo wa tarakimu 6",
  "New Password": "Nenosiri Jipya",
  "At least 6 characters": "Angalau herufi 6",
  "Reset Password": "Weka Nenosiri Upya",
  "Didn’t get a code? Send again": "Hukupata msimbo? Tuma tena",
  "Back to Sign In": "Rudi kwenye Kuingia",
  "Please enter your email or phone number, and your password.": "Tafadhali weka barua pepe au namba ya simu, na nenosiri lako.",
  "Please enter your email or phone number, and a password.": "Tafadhali weka barua pepe au namba ya simu, na nenosiri.",
  "Password must be at least 6 characters.": "Nenosiri lazima liwe na angalau herufi 6.",
  "Enter a valid email address or phone number (e.g. 07XXXXXXXX).": "Weka barua pepe au namba ya simu sahihi (mf. 07XXXXXXXX).",
  "Enter a valid phone number (e.g. 07XXXXXXXX) or an email address.": "Weka namba ya simu sahihi (mf. 07XXXXXXXX) au barua pepe.",
  "This email is not registered as a tenant by your landlord. Please contact them first.": "Barua pepe hii haijasajiliwa kama mpangaji na mwenye nyumba wako. Tafadhali wasiliana naye kwanza.",
  "Account created. Check your email to confirm, then log in.": "Akaunti imefunguliwa. Angalia barua pepe yako kuthibitisha, kisha uingie.",
  "Could not create your account. Please try again.": "Akaunti haikuweza kufunguliwa. Tafadhali jaribu tena.",
  "Could not reach the server. Please try again.": "Seva haikupatikana. Tafadhali jaribu tena.",
  "Account created. Please sign in with your new password.": "Akaunti imefunguliwa. Tafadhali ingia kwa nenosiri lako jipya.",
  "Enter your email or phone number first.": "Weka barua pepe au namba ya simu kwanza.",
  "Could not send a reset code. Please try again.": "Msimbo haukuweza kutumwa. Tafadhali jaribu tena.",
  "Enter the code we sent you.": "Weka msimbo tuliokutumia.",
  "Could not reset your password. Please try again.": "Nenosiri halikuweza kuwekwa upya. Tafadhali jaribu tena.",
  "Password updated. Please sign in with your new password.": "Nenosiri limesasishwa. Tafadhali ingia kwa nenosiri lako jipya.",
};

export function useTenantLang() {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "sw" || saved === "en") setLangState(saved);
    } catch {
      // Storage can be blocked (private mode) - English is fine.
    }
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not remembered this time; the switch still works for this visit.
    }
  }, []);

  const tr = useCallback((text: string) => (lang === "sw" ? SW[text] ?? text : text), [lang]);

  return { lang, setLang, tr };
}
