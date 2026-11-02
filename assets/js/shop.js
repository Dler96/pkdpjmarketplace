(() => {
  'use strict';
  const M = window.M;
  const { $, h, fill, icon, itemCard, market, money } = M;

  // Works for /s/<shop-link>, /shop?s=<shop-link> and the old /shop?id=<uuid>
  const keyFromUrl = () => {
    const m = location.pathname.match(/^\/s\/([^/?#]+)/);
    if (m) return decodeURIComponent(m[1]);
    const q = new URLSearchParams(location.search);
    return q.get('s') || q.get('id');
  };

  M.start(async s => {
    const shop = s.market.shop(keyFromUrl());
    const root = $('#shop-root');
    if (!shop) return fill(root, h('section', { class: 'wrap page-pad' }, M.empty('store', 'Shop not found', 'The link may be wrong, or the shop is closed or waiting for approval.', h('a', { class: 'btn btn-primary', href: '/market' }, 'Back to the market'))));

    // Always show the shop's own pretty link in the address bar
    const pretty = M.shopUrl(shop);
    if (location.pathname !== pretty) history.replaceState(null, '', pretty);
    document.title = `${shop.name} · ${M.BRAND}`;
    document.body.style.setProperty('--shop', shop.theme || '#e5dfd1');

    const c = market(shop.market_id);
    const items = shop.products;
    const live = items.filter(i => i.active);
    const inStock = live.filter(i => i.stock > 0).length;
    const types = [...new Set(items.map(i => i.category))];
    const since = new Date(shop.created_at).toLocaleDateString('en-MY', { month: 'short', year: 'numeric' });
    let type = 'all', q = '', sort = 'featured';

    // ---------- hero ----------
    const symbols = Array.from({ length: 6 }, (_, i) => h('span', { class: `sf-float f${i + 1}`, 'aria-hidden': 'true', text: shop.symbol || '✨' }));
    const cover = h('div', { class: 'sf-cover' },
      shop.cover ? h('img', { src: shop.cover, alt: '' }) : [h('div', { class: 'sf-pattern' }, symbols), h('span', { class: 'sf-word', text: shop.word || 'made with care' })],
      h('span', { class: 'market-tag' }, h('i', { class: 'dot' }), c.name));

    const wa = M.waLink(shop.whatsapp, `Hi ${shop.name}, I found your shop on ${M.BRAND}. `);
    const head = h('div', { class: 'sf-head reveal' },
      M.shopLogo(shop, 'sf-logo'),
      h('div', { class: 'sf-title' },
        h('div', { class: 'pills' },
          h('span', { class: 'sf-status ' + (shop.open ? 'on' : 'off') }, h('i'), shop.open ? 'Open for orders' : (M.SHOP_STATUS[shop.status]?.[0] || shop.status)),
          h('span', { class: 'badge', style: { background: c.color + '22', color: c.color }, text: c.short })),
        h('h1', { text: shop.name }),
        h('p', { class: 'sf-sub', text: `${shop.unit_department} · ${shop.location}` })),
      !shop.open && shop.mine ? h('div', { class: 'notice notice-warn', style: { margin: 0 } }, 'Only you can see this shop for now. You can already add items and share your link once it is approved.') : null,
      shop.bio ? h('p', { class: 'sf-bio pre', text: shop.bio }) : null,
      h('div', { class: 'sf-actions' },
        shop.mine ? h('a', { class: 'btn btn-primary', href: `/sell#shop-${shop.id}` }, icon('edit'), 'Manage shop') : null,
        wa && !shop.mine ? h('a', { class: 'btn btn-primary', href: wa, target: '_blank', rel: 'noopener' }, icon('whatsapp'), 'WhatsApp') : null,
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => shareShop(shop) }, icon('share'), 'Share shop')),
      h('div', { class: 'sf-stats' },
        stat(live.length, live.length === 1 ? 'item' : 'items'),
        stat(inStock, 'in stock'),
        stat(types.length || '—', types.length === 1 ? 'category' : 'categories'),
        stat(since, 'on the market')),
      h('div', { class: 'sf-pay' }, icon('wallet'), shop.payment_qr_path ? 'Pay cash or DuitNow QR' : 'Pay cash on collection / delivery'));

    // ---------- items ----------
    const search = h('input', { type: 'search', placeholder: `Search ${shop.name}`, 'aria-label': 'Search this shop', oninput: e => { q = e.target.value.trim().toLowerCase(); draw(); } });
    const sorter = h('select', { 'aria-label': 'Sort items', onchange: e => { sort = e.target.value; draw(); } },
      [['featured', 'Featured'], ['new', 'Newest'], ['low', 'Price: low to high'], ['high', 'Price: high to low']].map(([v, l]) => h('option', { value: v, text: l })));
    const chips = h('div', { class: 'chips' });
    const grid = h('div', {});
    const count = h('span', {});

    const draw = () => {
      fill(chips, types.length > 1 ? [['all', 'All'], ...types.map(t => [t, M.CATEGORY_LABEL[t] || t])].map(([v, l]) =>
        h('button', { class: 'chip', type: 'button', 'aria-pressed': String(type === v), onclick: () => { type = v; draw(); } }, l,
          h('small', { text: String(v === 'all' ? items.length : items.filter(i => i.category === v).length) }))) : []);
      let list = items.filter(i => (type === 'all' || i.category === type) && (!q || `${i.name} ${i.description || ''}`.toLowerCase().includes(q)));
      if (sort === 'new') list = [...list].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      if (sort === 'low') list = [...list].sort((a, b) => a.price - b.price);
      if (sort === 'high') list = [...list].sort((a, b) => b.price - a.price);
      count.textContent = `${list.length} of ${items.length}`;
      fill(grid, list.length ? h('div', { class: 'item-grid stagger' }, list.map((i, n) => { const el = itemCard(i, { showShop: false }); el.style.setProperty('--i', Math.min(n, 12)); return el; }))
        : items.length ? M.empty('search', 'Nothing matches', 'Try another word or category.')
          : M.empty('box', shop.mine ? 'Add your first item' : 'No items yet', shop.mine ? 'Items you add appear here.' : 'This shop has not listed anything yet.', shop.mine ? h('a', { class: 'btn btn-primary', href: `/sell#shop-${shop.id}` }, 'Add an item') : null));
    };

    // ---------- more shops nearby ----------
    const others = s.market.publicShops.filter(x => x.id !== shop.id && x.market_id === shop.market_id).slice(0, 3);
    const more = others.length ? h('section', { class: 'section reveal' },
      h('div', { class: 'section-head' }, h('h2', {}, 'More from ', h('em', { text: c.short })), h('a', { href: '/market' }, 'All shops')),
      h('div', { class: 'shop-grid sf-more' }, others.map(M.shopCard))) : null;

    fill(root,
      h('section', { class: 'storefront', style: { '--banner': shop.theme || '#e5dfd1', '--market': c.color } },
        h('div', { class: 'wrap' }, cover, head)),
      h('section', { class: 'wrap section' },
        h('div', { class: 'section-head' }, h('h2', {}, 'The ', h('em', { text: 'shelf' })), h('span', { class: 'muted small' }, count)),
        items.length > 3 ? h('div', { class: 'sf-tools' }, h('label', { class: 'searchbar' }, icon('search'), search), h('label', { class: 'sf-sort' }, icon('sort'), sorter)) : null,
        chips, h('div', { style: { height: '12px' } }), grid),
      h('div', { class: 'wrap' }, more));
    draw();
  }, { auth: true, market: true });

  function stat(v, label) { return h('div', { class: 'sf-stat' }, h('b', { text: String(v) }), h('small', { text: label })); }

  // ---------- share: link, native share, QR poster ----------
  function shareShop(shop) {
    const url = M.shopLink(shop);
    const input = h('input', { value: url, readonly: true, onclick: e => e.target.select() });
    const qrBox = h('div', { class: 'qr-poster' }, h('div', { class: 'skeleton', style: { height: '260px' } }));
    const dl = h('button', { class: 'btn btn-ghost btn-block', type: 'button', disabled: true }, icon('qr'), 'Download QR poster');
    M.modal('Share your shop', h('div', {},
      h('p', { class: 'muted', text: 'Anyone at PKDPJ can open this link after they sign in.' }),
      h('div', { class: 'copy-row' }, input,
        h('button', { class: 'btn btn-primary', type: 'button', onclick: async () => {
          try { await navigator.clipboard.writeText(url); M.toast('Link copied'); } catch { input.select(); document.execCommand('copy'); M.toast('Link copied'); }
        } }, icon('copy'), 'Copy')),
      navigator.share ? h('button', { class: 'btn btn-soft btn-block', type: 'button', style: { marginTop: '10px' }, onclick: () => navigator.share({ title: shop.name, text: `${shop.name} on ${M.BRAND}`, url }).catch(() => {}) }, icon('share'), 'Share to WhatsApp, Telegram…') : null,
      qrBox, dl), { eyebrow: shop.name });

    loadQr().then(() => {
      const canvas = poster(shop, url);
      fill(qrBox, canvas);
      dl.disabled = false;
      dl.onclick = () => canvas.toBlob(b => {
        const a = h('a', { href: URL.createObjectURL(b), download: `${shop.slug || 'shop'}-qr.png` });
        document.body.append(a); a.click(); a.remove();
      });
    }).catch(() => fill(qrBox, h('p', { class: 'muted small', text: 'QR code could not load. The link above still works.' })));
  }

  let qrLib;
  function loadQr() {
    if (window.qrcode) return Promise.resolve();
    return qrLib = qrLib || new Promise((ok, bad) => {
      const sc = document.createElement('script');
      sc.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
      sc.onload = ok; sc.onerror = bad; document.head.append(sc);
    });
  }

  // A printable 1080x1350 poster: shop colour, name, QR and link
  function poster(shop, url) {
    const W = 1080, H = 1350, cv = document.createElement('canvas');
    cv.width = W; cv.height = H; cv.className = 'qr-canvas';
    const x = cv.getContext('2d');
    x.fillStyle = shop.theme || '#e5dfd1'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#fffdf8'; roundRect(x, 70, 70, W - 140, H - 140, 48); x.fill();
    x.textAlign = 'center'; x.fillStyle = '#2f6b52';
    x.font = '700 30px "DM Sans", sans-serif'; x.fillText('SCAN TO SHOP ON PKDPJ MARKET', W / 2, 170);
    x.fillStyle = '#1d2c25'; x.font = '800 74px Manrope, sans-serif';
    wrapText(x, shop.name, W / 2, 265, W - 240, 82);
    const qr = window.qrcode(0, 'M'); qr.addData(url); qr.make();
    const n = qr.getModuleCount(), size = 640, cell = Math.floor(size / n), qs = cell * n, ox = (W - qs) / 2, oy = 420;
    x.fillStyle = '#1d2c25';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) x.fillRect(ox + c * cell, oy + r * cell, cell, cell);
    x.font = '64px serif'; x.fillText(shop.symbol || '✨', W / 2, oy + qs + 100);
    x.fillStyle = '#66726a'; x.font = '600 30px "DM Sans", sans-serif';
    x.fillText(url.replace(/^https?:\/\//, ''), W / 2, oy + qs + 160);
    return cv;
  }
  function roundRect(x, l, t, w, hh, r) { x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + hh, r); x.arcTo(l + w, t + hh, l, t + hh, r); x.arcTo(l, t + hh, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath(); }
  function wrapText(x, text, cx, y, max, lh) {
    const words = text.split(' '); let line = '', lines = [];
    words.forEach(w => { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > max && line) { lines.push(line); line = w; } else line = t; });
    lines.push(line); lines.slice(0, 2).forEach((l, i) => x.fillText(l, cx, y + i * lh));
  }
})();
