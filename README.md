# Lyons Interiors

Canonical source repository for the Lyons Interiors plastering and interior-finishing website.

## Editable source

The readable website source lives in **site/**.

- `site/content.mjs` — services, advice articles and business information
- `site/build.mjs` — page templates and generated-page structure
- `site/style.css` — presentation and responsive styling
- `site/app.js` — browser interactions

Run `npm run build` with Node.js 22. The dependency-free build generates and validates 31 HTML pages in `public/`. Vercel configuration is included.

## Deployment

Existing production deployment:

https://lyons-interiors-nufi2.vercel.app/

Vercel project: `lyons-interiors`

The source was recovered from the previously preserved `lyons-interiors` branch in `Website-Scrapper` and migrated into this standalone repository. The archived `source/part*.txt` files remain for reproducibility; future editing should use `site/`.

The GitHub workflow now builds and validates the site from `main` on pushes and pull requests.

## Enquiries and evidence

The enquiry modal creates a message draft to send by text or WhatsApp. The visitor must press Send in their messaging app. It is not a background form submission or database-backed enquiry system, so Supabase is not required for the current implementation.

No testimonials, verified rating badge, fixed prices, years of experience, accreditations or project counts are invented. Interior inspiration images are not presented as completed Lyons Interiors projects.

## Before production marketing

Confirm:

- authentic project photography
- Google review link
- preferred production domain
- WhatsApp availability and preferred enquiry route

See `site/README.md` for development notes and `site/test-report.json` for the retained local browser checks.
