// Dummy customer directory for lender walkthroughs.
// Clearly demo data — live lookups still hit /api/lender/query/:settl_id first.
// Search by Settl ID, click a row to see score + confidence + factors.

export const DEMO_CUSTOMERS = [
  {
    settl_id: "STL-2026-A41F9C",
    applicant_name: "T. Jayawardena",
    email: "t.jayawardena@example.lk",
    kyc_verified: true,
    score: 782,
    band: "excellent",
    confidence: 0.86,
    model_version: "v1.1-native",
    scored_at: "2026-09-10",
    top_positive_factors: [
      { display_label: "Utility bill on-time rate", shap_value: 18.4, reason_code: "Utility bills paid on time consistently — strong positive signal." },
      { display_label: "Income stability", shap_value: 12.1, reason_code: "Very stable monthly income — reduces lending risk." },
      { display_label: "Identity verified", shap_value: 8.6, reason_code: "Identity verified — improves both score and confidence level." },
    ],
    top_negative_factors: [
      { display_label: "Dispute rate", shap_value: -3.2, reason_code: "Minor platform dispute history." },
    ],
  },
  {
    settl_id: "STL-2026-77B2E0",
    applicant_name: "R. Akram",
    email: "r.akram@example.lk",
    kyc_verified: true,
    score: 694,
    band: "good",
    confidence: 0.74,
    model_version: "v1.1-native",
    scored_at: "2026-09-12",
    top_positive_factors: [
      { display_label: "Income stability", shap_value: 14.2, reason_code: "Very stable monthly income — reduces lending risk." },
      { display_label: "Utility bill on-time rate", shap_value: 9.8, reason_code: "Utility bills paid on time consistently — strong positive signal." },
    ],
    top_negative_factors: [
      { display_label: "Number of income sources", shap_value: -11.5, reason_code: "Only one income platform connected — add more to improve your score." },
      { display_label: "Platform history", shap_value: -4.1, reason_code: "Limited platform history — your score will improve over time." },
    ],
  },
  {
    settl_id: "STL-2026-C9031D",
    applicant_name: "S. Musthaq",
    email: "s.musthaq@example.lk",
    kyc_verified: true,
    score: 655,
    band: "good",
    confidence: 0.61,
    model_version: "v1.1-native",
    scored_at: "2026-09-08",
    top_positive_factors: [
      { display_label: "Payment regularity", shap_value: 10.4, reason_code: "Regular payment behaviour across connected sources." },
    ],
    top_negative_factors: [
      { display_label: "Income variability", shap_value: -9.7, reason_code: "High income variability — irregular earnings reduce your score." },
      { display_label: "Data sources", shap_value: -6.3, reason_code: "Each additional verified source adds to confidence and score." },
    ],
  },
  {
    settl_id: "STL-2026-51D8A2",
    applicant_name: "D. Senanayake",
    email: "d.senanayake@example.lk",
    kyc_verified: true,
    score: 612,
    band: "fair",
    confidence: 0.44,
    model_version: "v1.1-native",
    scored_at: "2026-09-14",
    top_positive_factors: [
      { display_label: "Identity verified", shap_value: 7.9, reason_code: "Identity verified — improves both score and confidence level." },
    ],
    top_negative_factors: [
      { display_label: "Utility bills on-time", shap_value: -13.8, reason_code: "Utility bills not consistently paid on time — this reduces your score." },
      { display_label: "Income gaps", shap_value: -8.2, reason_code: "Income gaps detected in the past year — this reduces your score." },
    ],
  },
  {
    settl_id: "STL-2026-9E44B7",
    applicant_name: "M. Huzna",
    email: "m.huzna@example.lk",
    kyc_verified: true,
    score: 588,
    band: "fair",
    confidence: 0.58,
    model_version: "v1.1-native",
    scored_at: "2026-09-11",
    top_positive_factors: [
      { display_label: "Payment regularity", shap_value: 8.8, reason_code: "Regular payment behaviour across connected sources." },
    ],
    top_negative_factors: [
      { display_label: "Income variability", shap_value: -12.4, reason_code: "High income variability — irregular earnings reduce your score." },
      { display_label: "BNPL history", shap_value: -5.5, reason_code: "No BNPL history available — default penalty applied." },
    ],
  },
  {
    settl_id: "STL-2026-2F60C9",
    applicant_name: "A. Wickramasinghe",
    email: "a.wickramasinghe@example.lk",
    kyc_verified: false,
    score: 472,
    band: "weak",
    confidence: 0.52,
    model_version: "v1.1-native",
    scored_at: "2026-09-05",
    top_positive_factors: [
      { display_label: "Identity verified", shap_value: 6.1, reason_code: "Identity verified — improves both score and confidence level." },
    ],
    top_negative_factors: [
      { display_label: "Income gaps", shap_value: -16.9, reason_code: "Income gaps detected in the past year — this reduces your score." },
      { display_label: "Utility bills on-time", shap_value: -11.2, reason_code: "Utility bills not consistently paid on time — this reduces your score." },
      { display_label: "Fraud flags", shap_value: -7.4, reason_code: "Fraud flags on your profile reduce your confidence score." },
    ],
  },
];

export function searchDemoCustomers(term) {
  const q = String(term || "").toLowerCase().trim();
  if (!q) return DEMO_CUSTOMERS;
  return DEMO_CUSTOMERS.filter(
    (c) =>
      c.settl_id.toLowerCase().includes(q) ||
      c.applicant_name.toLowerCase().includes(q)
  );
}
