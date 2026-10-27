# Presint 18 Market

A small marketplace website for Klinik Kesihatan Presint 18 and the clinics around it (Pejabat Kesihatan Putrajaya, KK Presint 9, 11, 14 and 18). Units and departments open shops, list food, goods, printables or services, and colleagues order with cash or QR payment. Prices are in RM.

It's a plain static site — HTML, CSS and JavaScript, no build step — with [Supabase](https://supabase.com) for accounts, data, images and orders.

## Try it in 30 seconds

1. Unzip the folder.
2. **Windows:** double-click `start-local-server.bat`. **Mac:** double-click `start-local-server.command`. (Both need Python. Or use VS Code's *Live Server* extension.)
3. Your browser opens `http://localhost:8080`. Sign in, or click **Look around with sample data** to explore everything without an account.

Opening `index.html` directly also works for browsing, but email links (confirmation, password reset) need the site to be served over `http://` or `https://`.

## Accounts

- **Buyer** — browse, add to bag, check out, see *My orders*, upload QR receipts.
- **Buyer & seller** — everything above, plus open a unit shop, add items, manage stock and prices, and see *Shop orders*.
- **Admin** — approves new shops, picks *Today's finds*, and can update any order. Make someone admin in the Supabase SQL editor:
  ```sql
  update public.profiles set is_admin = true where id = '<auth user UUID>';
  ```

New shops start as **waiting for approval**. The seller can see their own shop and add items straight away; everyone else sees it once an admin approves it.

## Supabase setup

`config.js` already holds the project URL and publishable key. Never put the `service_role` key in this site.

In the Supabase **SQL Editor**, run the files in `supabase/`:

| Situation | Run |
| --- | --- |
| Brand-new project | `schema.sql` → `upgrade-marketplace-workflows.sql` → `fix-highlights-timezone.sql` |
| Project that already ran the base schema | `upgrade-marketplace-workflows.sql` (if not yet run) → `fix-highlights-timezone.sql` |

All three are additive; don't reset the database.

Then in **Authentication → URL Configuration**, set the Site URL to where the site is hosted (and add `http://localhost:8080` to the redirect URLs if you test locally).

## Publishing

- **GitHub Pages:** push these files to the repo root, then *Settings → Pages → Deploy from a branch → main / root*.
- **Cloudflare Pages:** connect the repo, framework preset *None*, no build command, output directory `.`. The `_headers` file adds security headers.

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | Page structure: sign-in screen, market, bag, dialogs |
| `styles.css` | All styling (responsive, phone-friendly) |
| `auth.js` | Sign in, create account, password reset, sample preview |
| `app.js` | Shops, items, bag, checkout, seller tools |
| `workflows.js` | My orders, Shop orders, receipts, admin control room |
| `config.js` | Supabase URL + publishable key |
| `supabase/*.sql` | Database tables, security policies, storage and order functions |
| `start-local-server.*` | One-click local preview |

## What was fixed in this version

- **The site crashed on load.** `app.js` had a stray `})` that stopped the entire marketplace script from running, so after signing in nothing worked.
- **Sellers couldn't open shops.** The page created shops as `active`, which the database rejects for non-admins. Shops are now submitted as *pending*, and sellers can see and stock their pending shops.
- **"Customize" appeared on everyone's shops.** Edit tools now show only on your own shop.
- **Today's finds disappeared between midnight and 8 am** (UTC vs Malaysia date). Fixed in the page and in `fix-highlights-timezone.sql`.
- The README pointed to `supabase/upgrade-marketplace-workflows.sql`, which didn't exist; the SQL is now in `supabase/`.
- The bag showed `$0.00`, demo shop categories didn't match the filters, and admin approvals didn't refresh the market.

**Easier to use:** larger readable text, a header that fits on phones, clinic and type filters with counts, "Only 2 left" / "Sold out" labels, a one-step checkout with delivery-or-collect and remembered contact details, clear QR payment steps, an account menu, password reset and show-password, friendly error messages, loading and empty states, a sample-data preview, and a *Stock & prices* editor for sellers.

## Before real use

- Test sign-up, shop approval, checkout and receipts on the hosted site with a buyer, seller and admin account.
- QR payments are **not** verified automatically — sellers must check their bank account before marking an order paid.
- Use test data while developing; avoid patient or sensitive personal information.
