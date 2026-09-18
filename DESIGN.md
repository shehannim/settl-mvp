# Settl Design System: Modern Financial Inclusion
> Sourced directly from Stitch Project `12860544196208032886` ("Settl Fintech Onboarding Flow")

---

## Brand & Style

This design system establishes a high-trust, progressive digital banking standard specifically tailored for modern independent earners, freelancers, and gig economy workers in Sri Lanka. Blending the institutional authority of a tier-one financial institution with the agility and clarity of contemporary global fintechs, the aesthetic centers on transparency, precision, and frictionless utility.

### Visual Character
- **Corporate / Modern Minimal:** Crisp, clinical surfaces anchored by a decisive royal blue, eliminating decorative visual clutter in favor of typographic rigor, intentional negative space, and unambiguous data hierarchy.
- **Tone & Demeanor:** Objective, enabling, secure, and respectful. Financial health and credit metrics are communicated without paternalism or anxiety-inducing alert motifs.
- **Product Signals:** Tactile feedback, crisp micro-borders, deep ink typography, and high-legibility tabular figures designed to instill uncompromised credibility.

---

## Design Tokens

### 1. Colors

| Token Role | Hex Code | Purpose / Usage |
| :--- | :--- | :--- |
| **Primary** | `#004FC5` | Primary buttons, active tabs, brand verification indicators |
| **Primary Dark / Hover** | `#003A94` / `#0043A8` | Interactive hover and active states |
| **Primary Container** | `#004FC5` | Highlighted functional container backgrounds |
| **On Primary** | `#FFFFFF` | Text/icons on primary fill |
| **Secondary (Success)** | `#0D9488` | Cleared settlements, prime credit score, verified accounts |
| **Secondary Container** | `#86F2E4` | Soft teal container accents |
| **Tertiary (Warning)** | `#F59E0B` | Pending reviews, platform sync latency, developing tier |
| **Tertiary Container** | `#7C4D00` | Warning container accents |
| **Error** | `#DC2626` / `#BA1A1A` | Failed authentications, form validation errors |
| **Canvas / Off-White** | `#FAFAFC` / `#F8F9FF` | Main page background |
| **Card / Surface Base** | `#FFFFFF` | Core card surfaces |
| **Surface Low** | `#EFF4FF` | Subtle elevated panels / tinted cards |
| **Surface Container** | `#E6EEFF` | Nested section backgrounds |
| **Border / Hairline Grid** | `#E2E8F0` | Card borders, dividers, subtle inputs |
| **Text Primary (Deep Ink)**| `#0F172A` / `#0D1C2E` | Headings, primary body copy, values |
| **Text Secondary (Slate)** | `#475569` / `#434654` | Descriptions, labels, hints |
| **Text Muted** | `#94A3B8` / `#737685` | Placeholders, inactive captions |

### 2. Typography

- **Primary Font Family:** `Plus Jakarta Sans`, sans-serif
- **Technical & Numeric Font Family:** `Geist Mono` / `Space Mono` / monospace

| Text Style | Font Family | Size | Weight | Line Height | Tracking |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display Hero** | Plus Jakarta Sans | 44px | 800 (Extra Bold) | 52px | -0.03em |
| **Display Hero Mobile** | Plus Jakarta Sans | 34px | 800 (Extra Bold) | 40px | -0.025em |
| **Headline Large** | Plus Jakarta Sans | 32px | 700 (Bold) | 38px | -0.02em |
| **Headline Medium** | Plus Jakarta Sans | 22px | 600 (Semi Bold) | 28px | -0.015em |
| **Headline Small** | Plus Jakarta Sans | 18px | 600 (Semi Bold) | 24px | -0.01em |
| **Body Large** | Plus Jakarta Sans | 16px | 400 (Regular) | 24px | -0.005em |
| **Body Medium** | Plus Jakarta Sans | 14px | 400 (Regular) | 20px | 0em |
| **Body Small** | Plus Jakarta Sans | 12px | 400 (Regular) | 16px | 0.01em |
| **Label Large** | Plus Jakarta Sans | 14px | 600 (Semi Bold) | 20px | -0.005em |
| **Label Medium** | Plus Jakarta Sans | 12px | 600 (Semi Bold) | 16px | 0.02em |
| **Label Small** | Plus Jakarta Sans | 11px | 600 (Semi Bold) | 14px | 0.04em |
| **Numeric Score** | Geist Mono | 48px | 700 (Bold) | 52px | -0.04em |
| **Numeric Data** | Geist Mono | 15px | 500 (Medium) | 20px | -0.01em |

### 3. Layout & Spacing

- **Mobile (< 768px):** 4-column system, 16px margin, 12px/16px internal card padding.
- **Tablet (768px – 1024px):** 8-column system, 24px margin, 2-column card layouts.
- **Desktop (> 1024px):** 12-column max-width container capped at 1200px.

Cadence:
- `space-xs`: `0.25rem` (4px)
- `space-sm`: `0.5rem` (8px)
- `space-md`: `1rem` (16px)
- `space-lg`: `1.5rem` (24px)
- `space-xl`: `2.5rem` (40px)

### 4. Elevation & Depth

- **Level 0 (Canvas):** Flat `#FAFAFC` / `#F8F9FF` plane.
- **Level 1 (Card & Module Layer):** Solid `#FFFFFF` background bound by `1px solid #E2E8F0`, shadow `0px 1px 3px rgba(15, 23, 42, 0.04), 0px 6px 16px rgba(15, 23, 42, 0.02)`.
- **Level 2 (Floating & Active Drawers):** `0px 8px 24px -4px rgba(0, 79, 197, 0.08), 0px 4px 12px -2px rgba(15, 23, 42, 0.05)`.
- **Level 3 (Modals & Overlays):** `backdrop-filter: blur(8px)`, overlay `#0F172A` @ 30%, shadow `0px 20px 40px -8px rgba(15, 23, 42, 0.16)`.

### 5. Shapes & Radii

- **Pills (`rounded-full` / 9999px):** Primary interactive buttons, category tags, transactional CTAs, status badges.
- **Surface Enclosures (`rounded-2xl` / 16px):** Data cards, analytical readouts, breakdown charts, verification containers.
- **Sub-elements (`rounded-lg` / 8px):** Form fields, inputs, dropdown selectors.

---

## Component Specifications

### Buttons
- **Primary:** Full pill shape (`rounded-full`), height `48px` or `52px`. Solid `#004FC5` fill, `#FFFFFF` text. Hover `#0043A8`. Active press `scale-[0.985]`.
- **Secondary:** Hairline `1.5px solid #E2E8F0`, `#FFFFFF` background, `#0F172A` text. Hover `#F1F5F9`.
- **Ghost:** No border, transparent background, text `#004FC5` or `#475569`.

### Data Cards
- White `#FFFFFF`, `rounded-2xl`, `border border-[#E2E8F0]`, `p-5` or `p-6`.

### Inputs
- Height `48px`, `rounded-lg` (8px), border `1px solid #E2E8F0`, background `#FFFFFF`, text `#0F172A`. Focus border `#004FC5`, ring `box-shadow: 0 0 0 3px rgba(0, 79, 197, 0.12)`.
- **OTP Cell:** 48px x 56px square cells, centered digits in `font-mono text-xl font-bold`.

### Credit Score Radial Gauge
- High-prominence circular track (`#E2E8F0` at 10px stroke), semantic active fill:
  - Prime: `#0D9488`
  - Standard: `#004FC5`
  - Developing: `#F59E0B`
- Center numeric score in `font-mono text-4xl font-bold`, paired with uppercase `label-sm` tier descriptor.

---

## Screen Layouts in Stitch Project 12860544196208032886

1. **Settl Desktop 01 - Login & Sign Up** (`abe65e99332b4785a068639c427d421f`):
   - Left hero column: Deep blue gradient with brand showcase, social proof baseline metric (Score 784, LKR 450k limit), bank verification badges.
   - Right interaction column: Sign in / Create Account tabs, National ID (NIC) / Phone authentication, Google & Bank SSO options.
2. **Settl Desktop 02 - OTP Verification** (`c0f26be618c34eb8a8111b52002afba7`):
   - Secure 6-digit numeric verification with timer countdown and auto-resend.
3. **Settl Desktop 03 - Personal Details** (`a9ce6a1650914fe8a4d1178ea431070b` / `4af1ee495a564022a47379ec3565348c`):
   - Freelancer profile capture: primary income source (Upwork, Fiverr, PickMe, Freelance direct), monthly LKR estimate, bank account selection.
4. **Settl Desktop 05 - Onboarding Complete** (`c2f4227d9e6a4b9aa8a904567c0c2764` / `ef3020b84cdc45f99aaf1be2fdc39b21`):
   - Milestone celebration: instant baseline credit score generation, pre-approved credit tier card, and direct jump to dashboard.
5. **Settl - Mobile-First Onboarding** (`9ccfc2127e0645eaaf49b8c584a08c43`):
   - Adaptive mobile-first viewport adaptations for single-thumb ergonomics.
6. **Settl Logos**:
   - `Settl Brand Wordmark Logo` (`2cf9c03c605440bf9bbab53d1e49fd33`)
   - `Settl Logo with Stepped 3D Bars Mark` (`9015d405741c4bc9a5afadc141e01dcb`)
