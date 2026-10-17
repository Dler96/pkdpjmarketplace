# Presint 18 Market

A static, responsive marketplace prototype for Klinik Kesihatan Presint 18 that can be hosted with GitHub Pages. Sellers are framed as clinic units or departments, and prices display in RM.

The marketplace can show five locations separately or together: Pejabat Kesihatan Putrajaya and Klinik Kesihatan Presint 9, 11, 14 and 18. Each location has a color identity. Sellers can choose a location for a shop and classify listings as physical goods, digital goods or services; physical listings can be marked new or used.

Recent workflow upgrade adapted from the supplied Nyamnyam template: main-admin shop approval and top-three daily highlights, buyer order history with private QR-receipt submission, and seller/admin order status and manual QR payment review. Sellers submit shops for approval before they appear to other users. `_headers` adds browser security headers for Cloudflare Pages.

The hero uses the supplied clinic facade photos in `assets/`, with a warm contrast treatment and layered crop.

## Preview locally

Open `index.html` in a browser. No build step or package install is needed.

## Publish with GitHub Pages

1. Add these files to the root of a GitHub repository.
2. In **Settings → Pages**, choose **Deploy from a branch**, select your default branch and `/ (root)`, then save.
3. GitHub Pages will publish the site at the repository’s Pages URL.

For Cloudflare Pages, connect the GitHub repository, use branch `main`, Framework preset `None`, leave Build command empty, set Build output directory to `.`, and leave Root directory at its default. The project files live in the repository root; Cloudflare Pages publishes a `*.pages.dev` URL and redeploys when commits arrive.

## Current behavior

Without a Supabase publishable key, the page uses browser-local demo data. With Supabase configured, authentication, shops, products, images, and checkout use the database. Cart contents are still saved per user in that browser. QR payment is not processed by the site; uploaded receipts require manual checking by the seller/admin. Admin, seller-order and receipt workflows require the workflow migration below.

## Supabase Auth setup

The sign-in and registration screen uses Supabase Auth. In `config.js`, replace the placeholder with the project's **publishable key** (or legacy `anon` key). The project URL is already filled in. Never put the Supabase service-role key in this static site. The Supabase dashboard requested a fresh sign-in when I tried to read the key, so I left the placeholder in place.

In Supabase's SQL Editor, run [`supabase/schema.sql`](supabase/schema.sql) and then [`supabase/upgrade-marketplace-workflows.sql`](supabase/upgrade-marketplace-workflows.sql) for a new project. If `schema.sql` was already run in the existing marketplace project, run only the additive workflow migration; do not reset the database. It adds shop approval, receipt storage, fulfilment choice, and guarded order workflow functions.

Do not run the supplied Nyamnyam template's `database/01-new-project-base.sql` or `database/03-marketplace-and-latest-features.sql` on this project: those scripts target a different schema and can conflict with this marketplace database.

In Supabase, set the production GitHub Pages URL under **Authentication → URL Configuration** as the Site URL and add it to the allowed redirect URLs. Registration stores name, account type, and unit/department as Auth user metadata. Configure email confirmation in Supabase Auth as desired. Test sign-in from the hosted `https://` page; opening the file directly with `file://` does not provide the website origin needed for email redirects.

The marketplace is hidden until Supabase reports an authenticated session. Before real workplace use, verify account permissions and all RLS policies with buyer, seller and owner-admin accounts.

Checkout includes name, phone/WhatsApp, unit/department delivery location, item quantities, delivery or self-collection, and cash or QR preference. QR receipts are manually verified; no payment gateway is connected.
