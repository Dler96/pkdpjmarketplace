# Developer handoff — Klinik Kesihatan Presint 18 Marketplace

This package is a starting point for continued development of a workplace marketplace for Klinik Kesihatan Presint 18. The intended sellers are clinic units and departments. Buyers browse shop tiles, add items to a cart, then request cash-on-collection/delivery or QR payment.

## Project status

This is a responsive front-end prototype with a Supabase integration in progress. It is not ready for real orders or payment collection yet.

Included now:

- Login and registration UI with buyer/seller account type.
- Marketplace layout, shop tiles, shop/product customization UI and daily highlight areas.
- Five color-coded markets with individual and all-market browsing; shop creation includes a market selector.
- Listing categories for physical goods, digital goods and services, plus a condition label for new or used physical items.
- Cart and checkout form for buyer name, phone, delivery unit/location, quantities and payment preference.
- Clinic facade photos supplied for the visual theme.
- Supabase client hooks and initial PostgreSQL schema/RLS/Storage/order RPC in `supabase/schema.sql`.

Still required before production:

- Add the Supabase publishable (anon) key to `config.js` and run/review the SQL schema in the intended Supabase project.
- Finish moving shop, product, cart/order and image data from browser-local prototype behavior to Supabase. The UI currently has local/demo behavior in some flows.
- Review and test every RLS policy with buyer, seller and admin accounts; define who can approve sellers and manage highlights.
- Confirm whether users should be allowed to shop across regions and whether sellers may operate in more than one market; the current prototype assigns one market per shop.
- Configure Supabase Auth site and redirect URLs for the final GitHub Pages domain.
- Implement actual payment verification/receipt flow. The QR choice is an instruction/display flow; it does not process payment.
- Add operational rules for order fulfilment, stock edits, cancellations, privacy/retention and support contact.
- Test mobile layouts and end-to-end signup, login, listing, checkout and order management on the hosted HTTPS site.

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | Single-page interface and login/registration markup |
| `styles.css` | Responsive styling and visual theme |
| `auth.js` | Supabase Auth setup, sign-in, sign-up, session handling |
| `app.js` | Marketplace rendering and interactions; includes prototype/local behavior and Supabase integration points |
| `config.js` | Supabase project URL and public client key configuration |
| `supabase/schema.sql` | Initial database tables, policies, storage setup and order function |
| `assets/clinic-wide.png` | Supplied wide clinic image |
| `assets/clinic-facade.png` | Supplied facade photo |
| `README.md` | Quick start and deployment notes |

## Local setup

1. Extract the ZIP while preserving the folder structure.
2. Open the folder in a code editor.
3. For a static preview, open `index.html`. For Auth redirects and Supabase usage, serve it from an HTTP/HTTPS origin (for example, GitHub Pages or a local static server), not `file://`.
4. Update `supabaseAnonKey` in `config.js` with the project's Supabase publishable key (legacy `anon` key is also supported by Supabase). Keep the service-role key out of all browser code and GitHub.
5. In the Supabase SQL Editor, inspect and apply `supabase/schema.sql` to the correct project. Review it against the current project state before applying to a project with existing data.
6. In Supabase Auth URL Configuration, set the deployed site URL and add the exact GitHub Pages URL to allowed redirects.
7. Deploy the contents of this folder at the repository root, or configure GitHub Pages to serve this folder.

## Supabase and security notes

- `config.js` contains the project URL and a placeholder public key. The public/publishable key is expected in a browser application; it is not a substitute for Row Level Security.
- Never commit a Supabase service-role key, database password, personal access token or other server secret.
- RLS must remain enabled and be tested for each role. A client-side role selector is not authorization; database policies must enforce access.
- The current source contains a combination of browser-local prototype state and Supabase-backed paths. Treat browser data as device-specific and non-production until all workflows have been migrated and verified.
- The QR and cash options are order preferences, not a payment gateway. Do not represent an order as paid until a trusted verification process is implemented.
- Use synthetic accounts and products during development. Avoid real patient, staff or other sensitive personal information in marketplace records.

## Suggested development sequence

1. Confirm Supabase project ownership, target deployment URL and required seller/admin approval rules.
2. Apply the schema to a development project; validate table grants, RLS and Storage access.
3. Complete profile/shop/product CRUD and image upload using Supabase, removing reliance on `localStorage` for shared marketplace data.
4. Complete atomic checkout/order persistence, stock validation and seller order views; validate the SQL RPC and policies.
5. Add administrator workflows for seller approval and top-three/sponsored highlights.
6. Decide and implement QR payment confirmation and cash collection/delivery status transitions.
7. Run role-based acceptance checks, then deploy to the production GitHub Pages URL.

## Handover checklist

- [ ] Confirm the receiving developer can access the GitHub repository and Supabase project.
- [ ] Transfer ownership/invite the developer through the service's own access controls; do not send passwords in this archive.
- [ ] Share the deployment URL and intended repository branch.
- [ ] Provide the publishable key through an agreed project configuration process; never send a service-role key in the ZIP.
- [ ] Review the production readiness items above with the clinic's project owner before real use.

