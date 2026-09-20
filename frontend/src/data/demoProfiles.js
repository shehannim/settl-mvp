// Hardcoded demo personas for the demo video + staged walkthroughs.
// Three points on the credit spectrum: struggling, stable, exceptional.
// All figures are realistic Sri Lankan freelancer economics (LKR) and are
// kept consistent with the scoring math: thin/irregular → low score +
// low confidence; deep/steady → high score + high confidence.
//
// Usage: import { DEMO_PROFILES } from "../data/demoProfiles.js";
// key = "struggling" | "stable" | "exceptional".

export const DEMO_PROFILES = [
  {
    key: "struggling",
    label: "Struggling starter",
    tagline: "Irregular gigs, thin file, real need",
    identity: {
      name: "Kasun Fernando",
      settl_id: "STL-2026-DM01",
      email: "kasun.f.demo@settl-demo.com",
      age: 24,
      city: "Matara",
      education: "NVQ Level 4 — Graphic Design, DTET",
      occupation: "Part-time Fiverr seller (logo & social-media kits)",
      employment_type: "Self-employed, no EPF/ETF",
      kyc_verified: true,
      nic_on_file: true,
    },
    backstory:
      "Left a Colombo print shop in 2025 to freelance full-time. Work comes in bursts "
      + "around festival seasons; three dry months this year. Shares a rented annex room; "
      + "the CEB bill is in the landlord's name, so only his Dialog reloads prove payment "
      + "discipline. Has never held a bank loan — CRIB returns a No-Hit.",
    public_summary:
      "Young freelancer, single irregular income stream, thin verifiable file.",
    income_sources: [
      {
        platform: "Fiverr",
        handle: "@kasuncreates",
        level: "New Seller",
        connected_via: "PayPal",
        monthly_avg_lkr: 38000,
        tenure_months: 9,
        transactions_12m: 31,
        on_time_payout_rate: 1.0,
        note: "US $90–140 per order, 2–6 orders in good months, zero in dry months",
      },
    ],
    monthly_lkr_12m: [52000, 0, 61000, 0, 0, 0, 35000, 0, 22000, 0, 41000, 38000],
    income_features: {
      income_cv: 0.9,
      income_trend_slope: -0.15,
      income_gap_months: 6,
      income_source_count: 1,
      income_3m_avg: 0.15,
      income_6m_avg: 0.15,
      income_yoy_growth: -0.2,
    },
    bills: [
      { biller: "Dialog Mobile Prepaid", months: 12, ontime_rate: 0.75, avg_bill_lkr: 1490, holder: "self" },
      { biller: "CEB (landlord account)", months: 0, ontime_rate: null, avg_bill_lkr: null, holder: "landlord", note: "Cannot attribute — excluded" },
      { biller: "SLT Fibre (shared)", months: 0, ontime_rate: null, avg_bill_lkr: null, holder: "shared", note: "Cannot attribute — excluded" },
    ],
    payment_features: {
      bill_ontime_rate: 0.42,
      bill_months_coverage: 5,
      bnpl_repayment_rate: 0.5,
      avg_days_late: 0.58,
      payment_regularity: 0.45,
      debit_consistency: 0.42,
      payment_source_count: 1,
    },
    platform: {
      fiverr_level: "New Seller",
      fiverr_orders_completed: 34,
      fiverr_completion_rate: 0.82,
      fiverr_review_avg: 4.3,
      fiverr_response_time: "Same day",
      upwork: null,
      disputes_12m: 2,
      client_retention_rate: 0.18,
      platform_account_age_months: 9,
    },
    footprint: {
      total_source_count: 1,
      digital_tenure_months: 9,
      source_diversity_score: 0.25,
      business_continuity: 0.42,
      identity_consistency_score: 0.7,
      fraud_flag_count: 0,
    },
    expected_score: {
      score: 305,
      band: "poor",
      confidence: 0.3,
      verdict: "Decline for now — but this is exactly the file CRIB returns nothing on. Support, don't reject.",
      top_positive_factors: ["Identity verified", "9-month platform history", "Prepaid discipline (Dialog 75%)"],
      top_negative_factors: ["6 income gap months", "Single income source", "Low bill coverage (landlord-held utilities)"],
      improvement_tips: [
        "Connect a second platform (Upwork/Payoneer) to remove the single-source penalty.",
        "Put one utility (SLT/DOC) in own name and pay on time for 3 months.",
      ],
    },
    video_beats: [
      "Show the 6 zero months on the income chart — then the score that still exists.",
      "Contrast: CRIB screen = No-Hit vs Settl screen = 305 with reasons.",
      "Close on tip #1 as the 'path to 550' hook.",
    ],
  },
  {
    key: "stable",
    label: "Stable mid-career",
    tagline: "Steady contracts, full household bills, prime NBFI target",
    identity: {
      name: "Sanduni Perera",
      settl_id: "STL-2026-DM02",
      email: "sanduni.p.demo@settl-demo.com",
      age: 31,
      city: "Colombo (Nugegoda)",
      education: "BSc IT, SLIIT",
      occupation: "Upwork full-stack developer (UK/US SaaS clients)",
      employment_type: "Self-employed, no EPF/ETF",
      kyc_verified: true,
      nic_on_file: true,
    },
    backstory:
      "Seven years in a software firm, freelance since 2023. Two anchor retainers plus overflow "
      + "gigs; income dipped once when a client paused. Mortgages nothing — rents, but every utility "
      + "is in her name and paid via standing order. Rejected for a personal loan in 2024 for 'insufficient "
      + "salary evidence' despite LKR 200k+ months. The demo's NBFI heroine.",
    public_summary:
      "Mid-career freelancer, two steady income streams, full household bill history.",
    income_sources: [
      {
        platform: "Upwork",
        handle: "Top Rated, 100% JSS",
        level: "Top Rated",
        connected_via: "Payoneer",
        monthly_avg_lkr: 185000,
        tenure_months: 28,
        transactions_12m: 96,
        on_time_payout_rate: 1.0,
        note: "2 retainers ($450 + $380/mo) + 1–3 fixed-price gigs",
      },
      {
        platform: "Direct clients",
        handle: "2 retainer contracts",
        level: "—",
        connected_via: "PayPal",
        monthly_avg_lkr: 65000,
        tenure_months: 16,
        transactions_12m: 34,
        on_time_payout_rate: 0.97,
        note: "Local startups paying via PayPal in USD",
      },
    ],
    monthly_lkr_12m: [238000, 251000, 229000, 264000, 171000, 245000, 258000, 272000, 236000, 249000, 261000, 255000],
    income_features: {
      income_cv: 0.35,
      income_trend_slope: 0.05,
      income_gap_months: 0,
      income_source_count: 2,
      income_3m_avg: 1.3,
      income_6m_avg: 1.2,
      income_yoy_growth: 0.1,
    },
    bills: [
      { biller: "CEB", months: 24, ontime_rate: 0.92, avg_bill_lkr: 6850, holder: "self", account: "CEB-41XXXXXX" },
      { biller: "SLT Fibre", months: 20, ontime_rate: 0.9, avg_bill_lkr: 4990, holder: "self", account: "047XXXXXXX" },
      { biller: "Dialog Postpaid", months: 28, ontime_rate: 0.96, avg_bill_lkr: 2490, holder: "self" },
      { biller: "NWSDB Water", months: 18, ontime_rate: 0.83, avg_bill_lkr: 1980, holder: "self" },
    ],
    payment_features: {
      bill_ontime_rate: 0.9,
      bill_months_coverage: 20,
      bnpl_repayment_rate: 0.5,
      avg_days_late: 0.1,
      payment_regularity: 0.9,
      debit_consistency: 1.0,
      payment_source_count: 2,
    },
    platform: {
      upwork_level: "Top Rated",
      upwork_jss: 1.0,
      upwork_hours_12m: 1180,
      upwork_earnings_12m_usd: 7400,
      paypal_tenure_months: 16,
      disputes_12m: 0,
      client_retention_rate: 0.64,
      platform_account_age_months: 28,
    },
    footprint: {
      total_source_count: 3,
      digital_tenure_months: 28,
      source_diversity_score: 0.75,
      business_continuity: 0.95,
      identity_consistency_score: 0.92,
      fraud_flag_count: 0,
    },
    expected_score: {
      score: 730,
      band: "good",
      confidence: 0.64,
      verdict: "Approve with standard terms — the profile banks reject on paperwork and should accept on data.",
      top_positive_factors: ["Income stability (CV 0.11)", "20-month bill history at 90% on-time", "2 independent income streams"],
      top_negative_factors: ["No BNPL history (default penalty)", "Single-year YoY window"],
      improvement_tips: [
        "Connect Koko BNPL history to lift the default penalty.",
        "A third income stream would push confidence past 80%.",
      ],
    },
    video_beats: [
      "Open on the 2024 rejection letter — same woman, same income, different verdict.",
      "Animate the 12-month chart: one dip, instant recovery — stability the model rewards.",
      "Lender view: 688 GOOD at 72% confidence → 'Approve' click.",
    ],
  },
  {
    key: "exceptional",
    label: "Top-tier exporter",
    tagline: "Diversified, documented, derisked — your showcase score",
    identity: {
      name: "Ayesha Rahman",
      settl_id: "STL-2026-DM03",
      email: "ayesha.r.demo@settl-demo.com",
      age: 35,
      city: "Kandy",
      education: "BSc Computer Science, University of Colombo; AWS Solutions Architect",
      occupation: "Fiverr Top Rated Seller + Upwork agency owner (cloud migration studio, 4 subcontractors)",
      employment_type: "Self-employed, BR registered 2021",
      kyc_verified: true,
      nic_on_file: true,
    },
    backstory:
      "Runs a four-person cloud studio serving US/EU clients. Money arrives via Fiverr, Upwork and "
      + "direct wire to Payoneer; every household bill is in her name on autopay. Holds a BR, files taxes, "
      + "and still gets treated as 'unverifiable' for anything beyond secured lending. The profile that makes "
      + "judges ask why the system ever said no.",
    public_summary:
      "Established exporter, three diversified income streams, multi-year verified record.",
    income_sources: [
      {
        platform: "Fiverr",
        handle: "Top Rated Seller, Fiverr Pro",
        level: "Top Rated Seller",
        connected_via: "Payoneer",
        monthly_avg_lkr: 420000,
        tenure_months: 48,
        transactions_12m: 210,
        on_time_payout_rate: 1.0,
        note: "Cloud migration packages, $800–2,500 per order",
      },
      {
        platform: "Upwork",
        handle: "Agency — 98% JSS, $30k+ earned",
        level: "Top Rated Plus (agency)",
        connected_via: "Payoneer",
        monthly_avg_lkr: 310000,
        tenure_months: 40,
        transactions_12m: 150,
        on_time_payout_rate: 1.0,
        note: "Retainer bench of 5 clients + subcontractor payouts",
      },
      {
        platform: "Direct / wire",
        handle: "2 EU contracts",
        level: "—",
        connected_via: "Payoneer",
        monthly_avg_lkr: 150000,
        tenure_months: 30,
        transactions_12m: 48,
        on_time_payout_rate: 1.0,
        note: "Quarterly invoiced, wired to Payoneer USD balance",
      },
    ],
    monthly_lkr_12m: [820000, 860000, 845000, 900000, 870000, 915000, 890000, 930000, 905000, 940000, 918000, 955000],
    income_features: {
      income_cv: 0.04,
      income_trend_slope: 0.09,
      income_gap_months: 0,
      income_source_count: 3,
      income_3m_avg: 6.14,
      income_6m_avg: 6.02,
      income_yoy_growth: 0.31,
    },
    bills: [
      { biller: "CEB", months: 48, ontime_rate: 1.0, avg_bill_lkr: 12400, holder: "self", account: "CEB-52XXXXXX" },
      { biller: "SLT Fibre + PEO TV", months: 44, ontime_rate: 0.98, avg_bill_lkr: 8900, holder: "self" },
      { biller: "Dialog Postpaid ×2", months: 48, ontime_rate: 1.0, avg_bill_lkr: 5200, holder: "self" },
      { biller: "NWSDB Water", months: 40, ontime_rate: 0.95, avg_bill_lkr: 3400, holder: "self" },
      { biller: "Koko BNPL", months: 14, ontime_rate: 1.0, avg_bill_lkr: 18000, holder: "self", note: "Removes BNPL default penalty" },
    ],
    payment_features: {
      bill_ontime_rate: 0.99,
      bill_months_coverage: 44,
      bnpl_repayment_rate: 1.0,
      avg_days_late: 0.01,
      payment_regularity: 0.99,
      debit_consistency: 1.0,
      payment_source_count: 3,
    },
    platform: {
      fiverr_level: "Top Rated Seller (Pro)",
      fiverr_orders_completed: 640,
      fiverr_completion_rate: 0.99,
      fiverr_review_avg: 4.9,
      upwork_level: "Top Rated Plus agency",
      upwork_jss: 0.98,
      disputes_12m: 0,
      client_retention_rate: 0.81,
      platform_account_age_months: 48,
    },
    footprint: {
      total_source_count: 5,
      digital_tenure_months: 48,
      source_diversity_score: 1.0,
      business_continuity: 1.0,
      identity_consistency_score: 0.97,
      fraud_flag_count: 0,
    },
    expected_score: {
      score: 833,
      band: "excellent",
      confidence: 0.88,
      verdict: "Approve at prime terms — safer than most salaried files in the book.",
      top_positive_factors: ["Income stability (CV 0.04)", "48-month perfect bill record", "3 diversified income streams + BNPL history"],
      top_negative_factors: ["Platform concentration (62% via one marketplace family)"],
      improvement_tips: ["Nothing required — profile is reference-grade."],
    },
    video_beats: [
      "The gasp moment: 791 EXCELLENT at 88% — higher than most salaried applicants.",
      "Overlay: same woman, 'unverifiable' stamp vs Settl verdict.",
      "End card: three scores side by side — 431 / 688 / 791 — one engine, full spectrum.",
    ],
  },
];

export function getDemoProfile(key) {
  return DEMO_PROFILES.find((p) => p.key === key) || null;
}
