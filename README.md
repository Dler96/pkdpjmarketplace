# Presint 18 Market

A static, responsive marketplace prototype for Klinik Kesihatan Presint 18 that can be hosted with GitHub Pages. Sellers are framed as clinic units or departments, and prices display in RM.

The marketplace can show five locations separately or together: Pejabat Kesihatan Putrajaya and Klinik Kesihatan Presint 9, 11, 14 and 18. Each location has a color identity. Sellers can choose a location for a shop and classify listings as physical goods, digital goods or services; physical listings can be marked new or used.

The hero uses the supplied clinic facade photos in `assets/`, with a warm contrast treatment and layered crop.

## Preview locally

Open `index.html` in a browser. No build step or package install is needed.

## Publish with GitHub Pages

1. Add these files to the root of a GitHub repository.
2. In **Settings → Pages**, choose **Deploy from a branch**, select your default branch and `/ (root)`, then save.
3. GitHub Pages will publish the site at the repository’s Pages URL.

## Prototype behavior

Shop listings, unit/department locations, uploaded shopfront and product photos, cart contents, and demo orders are saved in the current browser using `localStorage`. Uploaded pictures are resized in the browser. Sign-in and registration use Supabase Auth after configuration. The QR payment display is illustrative only and no payment is processed. The market data is not yet shared, and inventory synchronization, seller approval, and payment verification are not connected.

## Supabase Auth setup

The sign-in and registration screen uses Supabase Auth. In `config.js`, replace the placeholder with the project's **publishable key** (or legacy `anon` key). The project URL is already filled in. Never put the Supabase service-role key in this static site. The Supabase dashboard requested a fresh sign-in when I tried to read the key, so I left the placeholder in place.

In Supabase's SQL Editor, run [`supabase/schema.sql`](supabase/schema.sql). It creates profiles, shops, products, daily highlights, orders, Row Level Security policies, a private image bucket, and an atomic order function that checks stock and prices on the server.

In Supabase, set the production GitHub Pages URL under **Authentication → URL Configuration** as the Site URL and add it to the allowed redirect URLs. Registration stores name, account type, and unit/department as Auth user metadata. Configure email confirmation in Supabase Auth as desired. Test sign-in from the hosted `https://` page; opening the file directly with `file://` does not provide the website origin needed for email redirects.

The marketplace is hidden until Supabase reports an authenticated session. Shop listings, photos, cart contents, and demo orders are still browser-local. Before using real workplace data, move those records to Postgres/Storage and add reviewed Row Level Security policies; the login screen alone does not secure database rows.

Checkout includes name, phone/WhatsApp, unit/department delivery location, item quantities, and cash-on-collection or QR selection. It remains demo-only: orders are saved in the current browser and no payment is processed.
