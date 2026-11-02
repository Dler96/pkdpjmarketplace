# Generates the HTML page shells from one shared head. Run: python3 tools/build-pages.py
import os
ROOT = os.path.join(os.path.dirname(__file__), '..', 'public')
HEAD = '''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>{title}</title>
  <meta name="description" content="{desc}">
  <meta name="theme-color" content="#f6f3ec">
  <link rel="icon" href="/assets/img/icon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/assets/img/icon-192.png">
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Manrope:wght@600;700;800&family=Fraunces:ital,opsz,wght@1,9..144,500&display=swap">
  <link rel="stylesheet" href="/assets/css/site.css">
  <script defer src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
  <script defer src="/config.js"></script>
  <script defer src="/assets/js/core.js"></script>
{scripts}</head>
<body data-page="{key}">
  <div id="site-header"></div>
  <main id="main">
{main}
  </main>
  <div id="site-footer"></div>
</body>
</html>
'''
SK = '<section class="wrap page-pad"><div class="skeleton" style="height:{h}px"></div></section>'
PAGES = [
  ('index', 'home', 'PKDPJ Market · Buy and sell within the PKD Putrajaya community', 'Food, goods, printables and services from the units of PKD Putrajaya and Klinik Kesihatan Presint 9, 11, 14 and 18.', ['home.js'], '<div id="home-root">' + SK.format(h=420) + '</div>'),
  ('market', 'market', 'Market · PKDPJ Market', 'Browse every shop and item.', ['market.js'], '<div id="market-root">' + SK.format(h=520) + '</div>'),
  ('shop', 'shop', 'Shop · PKDPJ Market', 'Shop details and items.', ['shop.js'], '<div id="shop-root">' + SK.format(h=480) + '</div>'),
  ('item', 'item', 'Item · PKDPJ Market', 'Item details.', ['item.js'], '<div id="item-root">' + SK.format(h=480) + '</div>'),
  ('bag', 'bag', 'Your bag · PKDPJ Market', 'Your bag and checkout.', ['bag.js'], '<div id="bag-root">' + SK.format(h=420) + '</div>'),
  ('orders', 'orders', 'My orders · PKDPJ Market', 'Track your orders and payments.', ['orders.js'], '<div id="orders-root">' + SK.format(h=420) + '</div>'),
  ('sell', 'sell', 'Sell · PKDPJ Market', 'Run your unit shop.', ['sell.js'], '<div id="sell-root">' + SK.format(h=420) + '</div>'),
  ('admin', 'admin', 'Admin · PKDPJ Market', 'Marketplace administration.', ['admin.js'], '<div id="admin-root">' + SK.format(h=420) + '</div>'),
  ('account', 'account', 'Account · PKDPJ Market', 'Log in or create your account.', ['account.js'], '<div id="account-root">' + SK.format(h=420) + '</div>'),
  ('404', '404', 'Page not found · PKDPJ Market', 'Page not found.', ['notfound.js'], '<section class="wrap page-pad"><div class="empty"><h1>Wrong <em>turn</em></h1><p class="muted">That page does not exist.</p><div class="action-row"><a class="btn btn-primary" href="/">Go home</a><a class="btn btn-ghost" href="/market">Browse the market</a></div></div></section>'),
]
for name, key, title, desc, scripts, main in PAGES:
    s = ''.join(f'  <script defer src="/assets/js/{x}"></script>\n' for x in scripts)
    open(os.path.join(ROOT, name + '.html'), 'w').write(HEAD.format(title=title, desc=desc, key=key, scripts=s, main='    ' + main))
print('ok')
