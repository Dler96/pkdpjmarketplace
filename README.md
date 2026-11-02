# PKDPJ Market

A mobile-first marketplace for the units and departments of **Pejabat Kesihatan Daerah Putrajaya** and **Klinik Kesihatan Presint 9, 11, 14 and 18**. Units open shops, list food, goods, printables or services, and colleagues order and pay each shop by cash or QR.

**GitHub** stores the code · **Cloudflare Pages** hosts it · **Supabase** runs accounts, data, images and orders.

## What's in it

**Buyers**
- **Home:** greeting, search, *Today's finds*, shop by clinic, new arrivals, and shops, plus alerts for orders in progress.
- **Market:** shops or items view, clinic and type filters with counts, search, and sorting by price or newest.
- **Shop and item pages:** banner, details, *WhatsApp seller*, quantity picker, *Add to bag* / *Buy now*, and "More from this shop".
- **Bag and checkout:** one bag for several shops. Checkout creates **one order per shop**, offers *deliver to my unit* or *I'll collect*, and takes cash or QR. Your details are remembered.
- **QR payments:** each shop's QR is shown after ordering. You upload the receipt, and the seller confirms.
- **My orders:** a progress bar (Sent → Accepted → Ready → Done), cancelling before the seller accepts (stock goes back on sale), WhatsApp the seller, view your receipt, and *Order again*.

**Sellers** (*Sell* tab)
- **Turn on selling** from your account, open one or more shops, and customise the colour, symbol, banner words, cover photo, WhatsApp number and payment QR.
- **Items:** add or edit with photo (resized automatically for mobile data), icon, description, condition and price. Use **Quick stock** for restocking, hide items, and pause or reopen your shop.
- **Shop orders:** filters (To do, New, Accepted, Ready, Done, Cancelled) and one-tap Accept → Mark ready → Complete. Confirm cash received, view and verify QR receipts, cancel (stock is returned automatically), and send ready-written WhatsApp messages.
- **Sales:** paid this month, money waiting for payment, last 6 months and best sellers.

**Admins** (*Admin* in the menu)
- **Overview:** approve or decline new shops and set **Today's picks** (#1–#3, can be marked sponsored).
- **Shops, Orders and Members:** suspend or reactivate shops, update any order, and **make or remove admins**.

**Everywhere**
- **Separate pages** (`/market`, `/shop`, `/item`, `/bag`, `/orders`, `/sell`, `/admin`, `/account`) with smooth page transitions and sections that animate in.
- **Phone layout:** a bottom tab bar with the bag in the middle, and pop-ups that slide up from the bottom.
- **Installable:** staff can add it to their phone home screen like an app.

---

## Setup — step by step

### Step 1 — Upgrade the database (keeps all existing data)
Open **Supabase → your project → SQL Editor → New query**.

- **If your project already ran the old SQL files** (it has shops, products and orders tables): paste and run **`supabase/04-v2-upgrade.sql`** only.
- **If this is a brand-new Supabase project:** run the four files **in order** — `01-schema.sql` → `02-upgrade-marketplace-workflows.sql` → `03-fix-highlights-timezone.sql` → `04-v2-upgrade.sql`.
- **Not sure?** Run all four in order. They are all safe to run again. ⚠️ Always run **04 last**. If you ever re-run 01–03, run 04 again afterwards.

You should see "Success. No rows returned."

### Step 2 — Make yourself admin (skip if you already are)
1. Go to **Authentication → Users** and copy your user's **UID**.
2. In the SQL Editor, run:
```sql
update public.profiles set is_admin = true where id = 'PASTE-YOUR-UID-HERE';
```
After that you can make other admins from the website (**Admin → Members**).

### Step 3 — Check `public/config.js`
It already has your project URL and publishable key. You can also add an admin WhatsApp number for a *Get help* link:
```js
supportWhatsapp: "60123456789",
```
Never put the `service_role` / secret key in this file.

### Step 4 — Replace the files on GitHub
The site has a new folder layout. In your GitHub repository:
1. **Delete the old files** at the top level: `index.html`, `app.js`, `auth.js`, `workflows.js`, `styles.css`, `config.js`, `_headers`, `assets/`, and the old `supabase/` folder.
2. **Upload** the `public` folder, the `supabase` folder, the `tools` folder and `README.md` from this package, then commit.

### Step 5 — Cloudflare Pages settings
In **Cloudflare → Workers & Pages → your project → Settings → Build** (or create a new Pages project connected to the repo):
- Framework preset: **None**
- Build command: **`exit 0`**
- Build output directory: **`public`** ← changed from before
- Save, then **Deployments → Retry / Create deployment**.

(GitHub Pages is not recommended for this version. Use Cloudflare Pages so addresses like `/market` work.)

### Step 6 — Supabase login links
Go to **Supabase → Authentication → URL Configuration**:
- **Site URL:** your website, e.g. `https://pkdpjmarket.pages.dev`
- **Redirect URLs:** add `https://pkdpjmarket.pages.dev/account`

This makes the email confirmation and password-reset links come back to the site.

### Step 7 — Test on your phone
1. **Admin:** log in, open **Admin**, and approve any waiting shops.
2. **Seller:** create a second account → *Sell* → *Turn on selling* → open a shop (it waits for approval) → add an item with a photo → upload a payment QR in *Edit shop*.
3. **Admin:** approve that shop.
4. **Buyer:** with a third account, add items from two different shops → checkout. You get **two orders**. Pay one by QR and upload a receipt.
5. **Seller:** in *Sell → Orders*, Accept → Mark ready → view the receipt → confirm payment → Complete. Then check *Sales*.
6. **Buyer:** cancel a new order and check the stock went back up.

---

## Good to know
- **Existing data is kept.** Old orders that mixed several shops still show; each seller sees only their own items in them.
- **One order per shop:** every seller handles and gets paid for only their part of a checkout.
- **Stock:** taken off when someone orders, and returned automatically when an order is cancelled (once only).
- **Approval:** sellers can pause or reopen an approved shop themselves, but only admins can approve, decline or suspend.
- **QR receipts are not automatic bank verification.** Sellers must check their account before confirming payment. Receipts are private to the buyer, the seller and admins.
- **Privacy:** only signed-in members can see shops and items. Please don't put patient information on the market.
- **Email confirmation:** if *Confirm email* is on in Supabase (Authentication → Providers → Email), new members must click the link in their email before logging in.

## File map
```
public/                     ← the website (Cloudflare serves this folder)
  index.html                Home
  market.html               Browse shops / items
  shop.html, item.html      Shop and item pages
  bag.html                  Bag + checkout
  orders.html               My orders
  sell.html                 Seller hub (shops, items, orders, sales)
  admin.html                Admin control room
  account.html              Log in / register / reset / profile
  404.html                  Not found
  config.js                 Supabase URL + publishable key
  manifest.webmanifest      "Add to Home Screen" app settings
  _headers                  Security headers for Cloudflare
  assets/css/site.css       Design (mobile-first)
  assets/js/core.js         Shared: header, tab bar, login, market data, bag
  assets/js/*.js            One script per page
  assets/img/               Clinic photos and app icons
supabase/
  01 … 03                   Your original database files (unchanged)
  04-v2-upgrade.sql         New: per-shop checkout, cancellations, profiles, pause shop, etc.
tools/build-pages.py        Regenerates the HTML page shells (optional, for developers)
```
