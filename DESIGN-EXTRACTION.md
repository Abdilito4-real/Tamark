# Tamark Solar Energy prototype: design extraction

## Source reviewed

The supplied workspace contains `Tamark Solar Energy.html` (341,806 bytes), not a file named `Tamark Solar Energy (2).html`. It is a standalone HTML document with embedded CSS, JavaScript, and base64-embedded imagery. This document records the existing design and maps it to a proposed Next.js application; it does not treat the prototype's data or simulated actions as production behavior.

## Existing design system

### Required identity tokens

| Token | Existing value | Use |
|---|---|---|
| `--navy` | `#102A2A` | Brand, hero, footer, and dashboard/sidebar surfaces |
| `--em` | `#159B62` | Primary actions, active navigation, and progress accents |
| `--lt` | `#E8F5EC` | Soft green surfaces and tags |
| `--bg` | `#FAFCFA` | Main page background |
| `--sun` | `#F4BD45` | Highlight, focus, and secondary-action accent |
| `--tx` | `#172522` | Main text |
| `--mu` | `#78847F` | Muted text |

Additional existing surface tokens are white cards (`#fff`), borders (`#dfe8e3`), and a soft navy-tinted card shadow (`0 10px 30px rgba(16,42,42,.08)`). Typography is Plus Jakarta Sans, with system sans-serif fallback. The main content container is 1180px maximum width with 20px horizontal padding.

### Visual language and responsive behavior

- Sticky, translucent public navigation with the sun-mark TAMARK wordmark, dropdowns, and a mobile menu.
- Dark emerald/navy gradient hero with a subtle grid, large headline, solar-engineering photography, and three floating glass information cards.
- Emerald primary buttons, outlined secondary buttons, and sun-yellow accent buttons; rounded corners and visible yellow focus outlines.
- White bordered cards, pale-green icon tiles/tags, compact status pills, and generous section spacing.
- Dark navy dashboard sidebars with emerald active states; white dashboard content with statistic cards, progress indicators, charts, and horizontally scrollable tables.
- Dark application-step sidebar that becomes a horizontal step strip on smaller screens.
- Centered white modal over a dark scrim, dark toast notifications with a sun accent, and a dark multi-column footer.
- Existing responsive breakpoints are primarily 860px and 600px; reduced-motion preferences are respected.
- Preserve the embedded solar imagery and icon-led composition as assets/components rather than retaining the single-file implementation.

## Screen and route mapping

| Prototype interface | Existing prototype behavior | Proposed production route(s) | Main production components |
|---|---|---|---|
| A. Public homepage (`#home`) | Navigation; hero; about/benefits; services; featured programmes; training call-to-action; contact and footer sections | `/` | `PublicHeader`, `Hero`, `AboutSection`, `ServiceGrid`, `FeaturedProgrammes`, `TrainingCTA`, configurable `ContactSection`, `PublicFooter` |
| B. Programme catalogue and details (`#training`) | Search and category filters; six cards; programme details open in a modal with curriculum, outcomes, entry requirements, duration, and sample fee | `/training`, `/training/[slug]` | `ProgrammeCatalog`, `ProgrammeFilters`, `ProgrammeCard`, `ProgrammeDetail`, `Curriculum`, shared modal/dialog primitives |
| C. Six-step application (`#apply`) | Personal information, contact information, education, programme selection, review, payment; client-side step validation | `/apply` with persisted step state | `ApplicationWizard`, `WizardProgress`, `PersonalInfoStep`, `ContactInfoStep`, `EducationStep`, `ProgrammeStep`, `ReviewStep`, `PaymentStep` |
| D. Checkout and confirmation (`#pay`) | Order summary; simulated Paystack action; timeout-based success; downloadable text demo receipt | `/checkout/[applicationId]`, `/checkout/confirmation` | `CheckoutSummary`, server-side Paystack initialization/verification and webhook handlers, verified `PaymentConfirmation`, downloadable verified receipt |
| E. Student dashboard (`#student`) | Overview, My Applications, My Payments, Training Schedule, Notifications, My Profile | `/student`, `/student/applications`, `/student/payments`, `/student/schedule`, `/student/notifications`, `/student/profile` | `StudentLayout`, `DashboardSidebar`, `DashboardHeader`, `OverviewCards`, `ApplicationList`, `PaymentList`, `Schedule`, `NotificationList`, `ProfileForm` |
| F. Administrator dashboard (`#admin`) | Dashboard, Applications, Students, Training Programmes, Payments, Reports, Announcements, Settings; chart, tables, review modal | `/admin`, `/admin/applications`, `/admin/students`, `/admin/programmes`, `/admin/payments`, `/admin/reports`, `/admin/announcements`, `/admin/settings` | `AdminLayout`, `AdminSidebar`, `DashboardStats`, `ActivityChart`, `DataTable`, `ApplicationReview`, and domain-specific admin pages/forms |

Route names are proposed production URLs, not routes already present in the prototype. Programme detail is currently a modal, while dashboard panels are client-rendered within a single hash route.

## Programme records found

The prototype has six JavaScript-embedded programme records, each with a category, summary, duration, fee, curriculum, learning outcomes, and entry requirements:

1. Solar PV Installation and Maintenance
2. Inverter Installation and Troubleshooting
3. Solar System Design and Sizing
4. Battery Technology and Energy Storage
5. Off-Grid Systems for Rural Communities
6. Solar Business and Entrepreneurship

These are suitable only as initial draft/catalogue seed records. Existing durations and fees are demonstration values; keep commercial values configurable and unpublished until Tamark approves them. Programme records should be database-driven and editable by authorized administrators.

## Production data and behavior that must not be copied

- Application defaults contain a sample name, birth date, email, phone, street address, qualification, and institution.
- Student/dashboard content includes a named sample student, fake application/payment references, sample statuses and decisions, sample notifications, and a fabricated training schedule.
- Administrator screens contain sample applicants/students, mocked application/payment rows, hard-coded enrollment and revenue statistics, and chart values.
- Programme fees/durations and an application fee are demonstration values, not approved commercial terms.
- Contact and footer copy includes organization/location claims that must be confirmed or made configurable before publication.
- The payment button is explicitly a demo: JavaScript produces a random reference, waits 1.4 seconds, declares success, and downloads a text file labeled as a simulated receipt. None of this is payment processing or evidence of payment.
- Review decisions, report export, announcements, profile/settings saves, and notification actions are client-side demonstrations, not authorized backend operations.

Production pages must use authenticated database records and server-authorized mutations. A payment must be verified server-side (including webhook handling) before an application is finalized or a receipt can be issued. Keep unapproved organizational claims and contact details configurable rather than inventing replacements.

## Proposed reusable implementation layers

1. **Design foundation:** CSS custom properties/Tailwind theme, typography setup, content-width and responsive utilities, shared buttons, cards, tags, badges, form controls, tables, modal, toast, and icon treatment.
2. **Public shell:** brand/navigation, mobile menu, page heading, public footer, hero, service and programme sections.
3. **Training and application:** database-backed programme cards/details and an accessible six-step form with validation and draft autosave.
4. **Checkout:** server-only Paystack secret usage, transaction initialization, return verification, webhook reconciliation, and receipts generated only for verified payments.
5. **Authenticated dashboards:** shared dashboard shell with separate student/admin navigation and role-checked pages/actions backed by Supabase/PostgreSQL.

This document records the source audit and initial route/component proposal. The prototype HTML is retained as a visual reference only and is not served or embedded by the production application. Implementation has now begun in a Next.js App Router project, with database-driven catalogue pages, configurable empty states, student/admin route shells, authenticated Supabase foundations, and server-side Paystack transaction flows. See `README.md` for setup and current implementation boundaries.
