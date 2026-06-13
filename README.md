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
- `app/` - Existing compiled FlowSlot web application, preserved at `/app`
- `images/flowslot/` - Existing product screenshots used on the FlowSlot page
- `assets/css/styles.css` - Shared responsive design system
- `assets/js/main.js` - Mobile navigation and dynamic copyright year
- `assets/img/favicon.svg` - Brand favicon
- `robots.txt`, `sitemap.xml`, `.nojekyll` - GitHub Pages and SEO support

## Local Preview

Run any static web server from the project root, for example:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Contact Form

The static form uses FormSubmit and routes requests to `contact@hightechstl.com`. FormSubmit requires a one-time email activation after the first submission. Before launch, submit and verify the form or replace the endpoint with the preferred CRM/form service.

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
