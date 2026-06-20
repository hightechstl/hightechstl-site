# High Tech STL Website

Static, responsive website for High Tech STL, a managed IT services and technology consulting company serving the St. Louis metropolitan area.

## Site Structure

- `index.html` - Lead-generation homepage
- `services.html` - Managed IT and consulting services
- `pricing.html` - Monthly support plans and project pricing
- `industries.html` - Industry-specific technology challenges and outcomes
- `about.html` - Joshua Hancock's IT operations and leadership background
- `contact.html` - Free technology assessment form
- `flowslot.html` - Standalone FlowSlot Innovation Lab project page
- `adventure-nights/` - Adventure Nights public library, purchase, and account entry page
- `adventure-nights/lanterns-below-marrow-hill/` - Public product/detail page for Lanterns Below Marrow Hill
- `adventure-nights/redeem/` - Redeem-code and purchase-email account flow scaffold
- `adventure-nights/play/lanterns-below-marrow-hill/` - Future protected browser-play route loaded from the paid bundle
- `content/adventures/` - Normalized Adventure Nights source content and edition configuration
- `adventure-nights.html` - Legacy interactive product prototype for two-player one-night campaign packages
- `app/` - Existing compiled FlowSlot web application, preserved at `/app`
- `images/flowslot/` - Existing product screenshots used on the FlowSlot page
- `assets/css/styles.css` - Shared responsive design system
- `assets/js/main.js` - Mobile navigation and dynamic copyright year
- `assets/img/favicon.svg` - Brand favicon
- `admin.html` - Private Firebase-backed client and trouble-ticket dashboard
- `assets/js/admin.js`, `assets/css/admin.css` - Service desk application
- `firestore.rules`, `firestore.indexes.json`, `functions/` - Service desk data security and owner-only account creation
- `docs/adventure-nights-shopify.md` - Shopify purchase entitlement setup notes
- `docs/adventure-nights-entitlements.md` - Purchase email, redeem code, and entitlement model
- `docs/shopify-adventure-nights-fulfillment.md` - J2 Crafts fulfillment and webhook flow
- `scripts/build-adventure-products.mjs` - Builds Shopify-ready Quick-Play and Deluxe ZIP files
- `scripts/register-shopify-adventure-webhooks.mjs` - Helper for registering Adventure Nights Shopify webhooks after function deployment
- `robots.txt`, `sitemap.xml`, `.nojekyll` - GitHub Pages and SEO support

## Local Preview

Run any static web server from the project root, for example:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Contact Form

The static form uses FormSubmit and routes requests to `contact@j2crafts.com`. FormSubmit requires a one-time email activation after the first submission. Before launch, submit and verify the form or replace the endpoint with the preferred CRM/form service.

## Service Desk

The private dashboard at `/admin.html` tracks clients, trouble tickets, and
ticket activity using Firebase Authentication and Firestore. Follow
`docs/service-desk-setup.md` before using it. A separate Firebase project from
FlowSlot is recommended.

## Adventure Nights Products

Lanterns Below Marrow Hill is normalized under
`content/adventures/lanterns-below-marrow-hill/` and can be packaged as two
Shopify digital products:

```sh
npm run build:adventure-products
```

The build creates:

- `dist/shopify-digital-products/Lanterns_Below_Marrow_Hill_Quick_Play_Edition.zip`
- `dist/shopify-digital-products/Lanterns_Below_Marrow_Hill_Deluxe_Edition.zip`

The ZIPs intentionally do not contain unique unlock codes. Static Shopify
digital files are shared for every customer, so purchase access should be
created by webhook/order automation and tied to checkout email plus a separately
generated redeem code when needed.

The current browser play route uses Firebase Authentication plus
`ownedAdventureIds`/`ownedAdventureEditions` to decide which adventures appear
in a signed-in account. Because this is still a static GitHub Pages style site,
files under `public/` remain directly reachable. True paid content protection
requires backend-protected files, Firebase Storage rules, Cloud Functions, or
signed download URLs before production launch.

## SEO Recommendations

1. Connect Google Search Console and submit `sitemap.xml` after deployment.
2. Create and optimize a Google Business Profile for the St. Louis service area.
3. Add verified client testimonials and case studies with measurable outcomes.
4. Add unique Open Graph images once final photography or branded artwork is available.
5. Publish useful local content around IT planning, business continuity, WiFi reliability, and vendor management.
6. Add LocalBusiness details such as a verified phone number and business address to structured data when available.

## Future Improvements

1. Replace the founder initials panel with professional photography.
2. Connect the assessment form to a CRM, analytics conversion event, and spam protection.
3. Add verified testimonials, customer logos, and two or three detailed case studies.
4. Add a scheduling integration once a preferred calendar tool is selected.
5. Replace FlowSlot placeholders with real product screenshots and a development signup list.
6. Run Lighthouse and Search Console checks against the production domain after deployment.
