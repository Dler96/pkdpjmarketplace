/* Seller hub: open / edit shops, manage items & stock, handle orders, see sales. */
(() => {
  'use strict';
  const M = window.M;
  const { $, h, fill, icon, money, check, run, toast, modal, confirmBox, badge, STATUS, PAY, SHOP_STATUS, itemArt, market } = M;
  const OSEL = 'id,shop_id,buyer_name,phone,delivery_location,fulfillment_method,payment_method,payment_status,status,total_rm,note,cancel_reason,created_at,paid_at,payment_receipt_path,payment_reference,order_items(id,shop_id,product_name,quantity,unit_price_rm)';
  let s, root, orders = [], orderFilter = 'open';

  M.start(async st => {
    s = st; root = $('#sell-root');
    addEventListener('hashchange', route);
    await route();
  }, { auth: true, market: true, fresh: true });

  const section = () => (location.hash.slice(1).split('-')[0] || 'shops');
  async function route() {
    if (!s.seller) return becomeSeller();
    const sec = ['shops', 'orders', 'sales'].includes(section()) ? section() : 'shops';
    if (sec !== 'shops' || !orders.length) await loadOrders();
    const pending = orders.filter(o => o.status === 'pending' || o.payment_status === 'awaiting_confirmation').filter(o => o.status !== 'cancelled').length;
    const body = h('div', {});
    fill(root, h('section', { class: 'wrap page-pad' },
      h('div', { class: 'reveal' }, h('span', { class: 'eyebrow', text: s.profile.department || 'Seller workspace' }), h('h1', { style: { fontSize: 'clamp(28px,7vw,44px)' } }, 'Your ', h('em', { text: 'shop' }))),
      h('nav', { class: 'sub-nav', 'aria-label': 'Seller sections' },
        h('a', { href: '#shops', 'aria-current': sec === 'shops' ? 'page' : null }, icon('store'), 'Shops & items'),
        h('a', { href: '#orders', 'aria-current': sec === 'orders' ? 'page' : null }, icon('receipt'), 'Orders', pending ? h('span', { class: 'count', text: String(pending) }) : null),
        h('a', { href: '#sales', 'aria-current': sec === 'sales' ? 'page' : null }, icon('chart'), 'Sales')),
      body));
    if (sec === 'shops') shopsView(body);
    if (sec === 'orders') ordersView(body);
    if (sec === 'sales') salesView(body);
    M.reveal(root);
    const target = location.hash.startsWith('#shop-') && document.getElementById(location.hash.slice(1));
    if (target) setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }
  async function refresh() { M.clearMarketCache(); s.market = await M.loadMarket(true); await route(); }

  // ---------------- become a seller ----------------
  function becomeSeller() {
    const dept = h('input', { id: 'dept', maxlength: '120', value: s.profile.department || '', placeholder: 'e.g. Unit Pemakanan, KK Presint 18', required: true });
    const form = h('form', { class: 'card' },
      h('h2', {}, 'Start ', h('em', { text: 'selling' })),
      h('p', { class: 'muted', text: 'Run a shop for your unit or department — food, crafts, printables or services. New shops are checked by the market admin before they go live.' }),
      h('div', { class: 'field' }, h('label', { for: 'dept', text: 'Your unit / department' }), dept),
      h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Turn on selling', icon('arrow')));
    form.addEventListener('submit', e => { e.preventDefault(); run(async () => {
      check(await M.db.rpc('become_marketplace_seller', { p_department: dept.value.trim() }));
      s.seller = true; s.profile = { ...s.profile, account_type: 'seller', department: dept.value.trim() };
      M.renderHeader(); toast('Selling is on. Now open your shop!'); route(); shopEditor(null);
    }, form); });
    fill(root, h('section', { class: 'wrap page-pad', style: { maxWidth: '620px' } }, form));
  }

  // ---------------- shops & items ----------------
  function shopsView(body) {
    const mine = s.market.myShops;
    if (!mine.length) {
      fill(body, M.empty('store', 'Open your first shop', 'Set the name, where buyers find you and how they can pay. Takes about a minute.', h('button', { class: 'btn btn-primary', type: 'button', onclick: () => shopEditor(null) }, icon('plus'), 'Open a shop')));
      return;
    }
    fill(body, mine.map(shop => {
      const c = market(shop.market_id);
      const items = shop.products;
      const canPause = ['active', 'paused'].includes(shop.status);
      return h('div', { class: 'hub-shop reveal', id: `shop-${shop.id}`, style: { scrollMarginTop: '90px' } },
        h('div', { class: 'hub-shop-head', style: { '--banner': shop.theme || '#e5dfd1' } },
          M.shopLogo(shop, 'symbol'),
          h('div', {}, h('strong', { text: shop.name }), h('span', { class: 'small muted', text: `${c.short} · ${shop.location}` })),
          badge(SHOP_STATUS, shop.status)),
        shop.status === 'pending' ? h('div', { class: 'notice notice-warn', style: { margin: '12px 14px 0' }, text: 'Waiting for admin approval. You can add items now — buyers see the shop once it is approved.' }) : null,
        shop.status === 'suspended' ? h('div', { class: 'notice notice-warn', style: { margin: '12px 14px 0' }, text: 'This shop was declined or suspended by the admin. Contact the market admin for details.' }) : null,
        h('div', { class: 'hub-link' }, icon('link'), h('a', { href: M.shopUrl(shop), text: M.shopLink(shop).replace(/^https?:\/\//, '') }),
          h('button', { class: 'btn btn-soft btn-xs', type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(M.shopLink(shop)); toast('Shop link copied — share it on WhatsApp!'); } catch { toast(M.shopLink(shop)); } } }, icon('copy'), 'Copy link')),
        !shop.payment_qr_path ? h('div', { class: 'notice notice-info', style: { margin: '12px 14px 0' }, text: 'Tip: upload your DuitNow / bank QR in Edit shop so buyers can pay by QR.' }) : null,
        h('div', { class: 'hub-actions' },
          h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => itemEditor(shop, null) }, icon('plus'), 'Add item'),
          h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => shopEditor(shop) }, icon('edit'), 'Edit shop'),
          h('a', { class: 'btn btn-ghost btn-sm', href: M.shopUrl(shop) }, 'View'),
          canPause ? h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => togglePause(shop) }, icon(shop.status === 'active' ? 'pause' : 'play'), shop.status === 'active' ? 'Pause shop' : 'Reopen shop') : null),
        items.length ? items.map(i => h('div', { class: 'list-row' + (i.active ? '' : ' hidden-item') },
          itemArt(i),
          h('div', {}, h('strong', { text: i.name }), h('small', { text: `${money(i.price)} · ${i.stock <= 0 ? 'Sold out' : i.stock + ' in stock'}${i.active ? '' : ' · Hidden'}` })),
          h('div', { class: 'row-tools' },
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Restock ${i.name}`, title: 'Quick stock', onclick: () => stockEditor(i) }, icon('box')),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Edit ${i.name}`, onclick: () => itemEditor(shop, i) }, icon('edit')))))
          : h('p', { class: 'muted', style: { padding: '14px', margin: 0 }, text: 'No items yet. Add your first one — a photo helps it sell.' }));
    }), h('div', { class: 'row-end' }, h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => shopEditor(null) }, icon('plus'), 'Open another shop')));
  }

  async function togglePause(shop) {
    const pause = shop.status === 'active';
    if (pause && !(await confirmBox('Pause this shop?', 'Buyers will not see it or be able to order until you reopen it. Existing orders are not affected.', 'Pause shop'))) return;
    await run(async () => {
      check(await M.db.from('shops').update({ status: pause ? 'paused' : 'active' }).eq('id', shop.id));
      toast(pause ? 'Shop paused.' : 'Shop reopened.'); await refresh();
    });
  }

  function shopEditor(shop) {
    const p = s.profile;
    const f = { name: shop?.name || '', unit: shop?.unit_department || p.department || '', loc: shop?.location || '', market: shop?.market_id || 'presint-18',
      cat: shop?.category || 'Physical goods', bio: shop?.bio || '', wa: shop?.whatsapp || p.phone || '', theme: shop?.theme || M.THEMES[0],
      symbol: shop?.symbol || M.SYMBOLS[0], word: shop?.word || 'made with care' };
    const name = h('input', { maxlength: '80', value: f.name, required: true, placeholder: 'e.g. Dapur Sihat' });
    const unit = h('input', { maxlength: '120', value: f.unit, required: true });
    const loc = h('input', { maxlength: '160', value: f.loc, required: true, placeholder: 'e.g. Ground floor, beside the pharmacy' });
    const mkt = h('select', {}, M.MARKETS.map(c => h('option', { value: c.id, text: c.name, selected: c.id === f.market })));
    const cat = h('select', {}, M.CATEGORIES.map(c => h('option', { value: c, text: M.CATEGORY_LABEL[c], selected: c === f.cat })));
    const bio = h('textarea', { maxlength: '400', rows: '3', placeholder: 'What do you sell? When are you open?' }); bio.value = f.bio;
    const wa = h('input', { type: 'tel', maxlength: '24', value: f.wa, placeholder: '0123456789' });
    const word = h('input', { maxlength: '40', value: f.word });
    const hasSlug = shop && 'slug' in shop;
    const slug = h('input', { maxlength: '40', value: shop?.slug || '', placeholder: 'e.g. dapur-sihat', autocapitalize: 'off', spellcheck: 'false',
      oninput: e => { e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-'); } });
    const cover = h('input', { type: 'file', accept: 'image/*' });
    const logo = h('input', { type: 'file', accept: 'image/*' });
    const sample = shop || s.market?.shops?.[0];
    const canLogo = !sample || 'logo_image_path' in sample;   // needs 06-shop-pages.sql
    let removeLogo = false;
    const qr = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp' });
    let removeCover = false;
    const banner = h('div', { class: 'shop-hero', style: { minHeight: '130px', margin: 0 } });
    const avatar = h('span', { class: 'sf-logo edit-logo' });
    const preview = h('div', { class: 'edit-preview' }, banner, avatar);
    const drawPreview = () => {
      const file = cover.files[0], lf = logo.files[0], theme = $('input[name=theme]:checked', form)?.value || f.theme;
      preview.style.setProperty('--banner', theme);
      fill(avatar, lf ? h('img', { src: URL.createObjectURL(lf), alt: '' }) : shop?.logo && !removeLogo ? h('img', { src: shop.logo, alt: '' }) : ($('input[name=symbol]:checked', form)?.value || f.symbol));
      fill(banner,
        file ? h('img', { src: URL.createObjectURL(file), alt: '' }) : shop?.cover && !removeCover ? h('img', { src: shop.cover, alt: '' }) :
          [h('span', { class: 'banner-word', style: { fontSize: '24px' }, text: word.value || 'made with care' }), h('span', { class: 'banner-symbol', text: $('input[name=symbol]:checked', form)?.value || f.symbol })],
        h('span', { class: 'market-tag', style: { '--market': market(mkt.value).color } }, h('i', { class: 'dot' }), market(mkt.value).short));
    };
    const form = h('form', { novalidate: true },
      preview,
      h('div', { class: 'field' }, h('label', { text: 'Shop name' }), name),
      hasSlug ? h('div', { class: 'field' }, h('label', { text: 'Your shop link' }), h('div', { class: 'slug-field' }, h('span', { text: location.host + '/s/' }), slug),
        h('small', { text: 'Letters, numbers and dashes. Changing it breaks links you already shared.' })) : null,
      h('div', { class: 'form-grid' },
        h('div', { class: 'field' }, h('label', { text: 'Unit / department' }), unit),
        h('div', { class: 'field' }, h('label', { text: 'Clinic' }), mkt)),
      h('div', { class: 'field' }, h('label', { text: 'Where buyers find you' }), loc),
      h('div', { class: 'form-grid' },
        h('div', { class: 'field' }, h('label', { text: 'Main type' }), cat),
        h('div', { class: 'field' }, h('label', { text: 'WhatsApp for buyers' }), wa, h('small', { text: 'Optional. Shown as a “WhatsApp seller” button.' }))),
      h('div', { class: 'field' }, h('label', { text: 'About your shop' }), bio),
      h('span', { class: 'label', text: 'Banner colour' }),
      h('div', { class: 'swatches', style: { marginBottom: '16px' } }, M.THEMES.map(t => h('label', { class: 'swatch', title: t }, h('input', { type: 'radio', name: 'theme', value: t, checked: t === f.theme, onchange: drawPreview }), h('span', { style: { '--c': t } })))),
      h('span', { class: 'label', text: 'Banner symbol' }),
      h('div', { class: 'emoji-grid', style: { marginBottom: '16px' } }, M.SYMBOLS.map(x => h('label', { class: 'emoji-opt' }, h('input', { type: 'radio', name: 'symbol', value: x, checked: x === f.symbol, onchange: drawPreview }), h('span', { text: x })))),
      h('div', { class: 'field' }, h('label', { text: 'Banner words' }), word),
      canLogo ? h('div', { class: 'field' }, h('label', { text: 'Profile picture (optional)' }), logo, h('small', { text: 'Your shop logo or a photo. It is cropped to a square. Without one, your banner symbol is used.' }),
        shop?.logo_image_path ? h('label', { class: 'check', style: { marginTop: '8px' } }, h('input', { type: 'checkbox', onchange: e => { removeLogo = e.target.checked; drawPreview(); } }), 'Remove current profile picture') : null) : null,
      h('div', { class: 'field' }, h('label', { text: 'Banner photo (optional)' }), cover, h('small', { text: 'Wide photo across the top of your shop page. Replaces the colour banner. Landscape photos look best.' }),
        shop?.cover_image_path ? h('label', { class: 'check', style: { marginTop: '8px' } }, h('input', { type: 'checkbox', onchange: e => { removeCover = e.target.checked; drawPreview(); } }), 'Remove current cover photo') : null),
      h('div', { class: 'field' }, h('label', { text: shop?.payment_qr_path ? 'Replace payment QR' : 'Payment QR (DuitNow / bank)' }), qr,
        h('small', { text: shop?.payment_qr_path ? 'A QR is already set. Leave empty to keep it.' : 'Lets buyers pay you by QR. PNG, JPG or WebP up to 5 MB.' })),
      shop?.qr ? h('img', { src: shop.qr, alt: 'Current QR', style: { width: '140px', background: '#fff', padding: '6px', borderRadius: '10px', border: '1px solid var(--line)', marginBottom: '16px' } }) : null,
      !shop ? h('div', { class: 'notice notice-info', text: 'New shops are reviewed by the market admin before buyers can see them.' }) : null,
      h('div', { class: 'row-end', style: { justifyContent: shop ? 'space-between' : 'flex-end' } },
        shop ? h('button', { class: 'btn btn-danger', type: 'button', onclick: () => deleteShop(shop, mdl) }, icon('trash'), 'Delete shop') : null,
        h('button', { class: 'btn btn-primary', type: 'submit' }, shop ? 'Save shop' : 'Submit for approval')));
    [word, mkt].forEach(x => x.addEventListener('input', drawPreview));
    cover.addEventListener('change', drawPreview);
    logo.addEventListener('change', drawPreview);
    const mdl = modal(shop ? 'Edit shop' : 'Open a shop', form, { wide: true, eyebrow: 'Seller' });
    drawPreview();
    form.addEventListener('submit', e => { e.preventDefault(); run(async () => {
      const row = { name: name.value.trim(), unit_department: unit.value.trim(), location: loc.value.trim(), market_id: mkt.value, category: cat.value,
        bio: bio.value.trim(), whatsapp: wa.value.trim(), theme: form.elements.theme.value, symbol: form.elements.symbol.value, word: word.value.trim() || 'made with care' };
      if (row.name.length < 2) throw new Error('Enter a shop name (2+ characters).');
      if (row.unit_department.length < 2) throw new Error('Enter your unit or department.');
      if (row.location.length < 2) throw new Error('Enter where buyers can find you.');
      if (row.whatsapp && !M.PHONE.test(row.whatsapp)) throw new Error('Enter a valid WhatsApp number, or leave it empty.');
      if (hasSlug) {
        const sl = slug.value.replace(/^-+|-+$/g, '');
        if (sl && sl.length < 3) throw new Error('Shop link needs at least 3 characters.');
        if (sl !== shop.slug) row.slug = sl || null;
      }
      let id = shop?.id;
      if (!shop) {
        id = check(await M.db.from('shops').insert({ ...row, owner_id: s.user.id, status: 'pending' }).select('id').single()).id;
      }
      const upd = shop ? { ...row } : {};
      if (cover.files[0]) upd.cover_image_path = await M.uploadShopImage(cover.files[0], id, 'cover-', false, { maxSide: 1800 });
      else if (removeCover) upd.cover_image_path = null;
      if (canLogo && logo.files[0]) upd.logo_image_path = await M.uploadShopImage(logo.files[0], id, 'logo-', false, { maxSide: 500, square: true });
      else if (canLogo && removeLogo) upd.logo_image_path = null;
      if (qr.files[0]) upd.payment_qr_path = await M.uploadShopImage(qr.files[0], id, 'qr-', true);
      if (Object.keys(upd).length) check(await M.db.from('shops').update(upd).eq('id', id));
      mdl.close(); toast(shop ? 'Shop saved.' : 'Shop submitted! You can add items while it waits for approval.');
      await refresh();
      if (!shop) itemEditor(s.market.shop(id), null);
    }, form); });
  }

  async function deleteShop(shop, mdl) {
    if (!(await confirmBox('Delete this shop?', `“${shop.name}” and all its items will be removed. This cannot be undone. Shops with past orders cannot be deleted — pause them instead.`, 'Delete shop', true))) return;
    await run(async () => {
      const r = await M.db.from('shops').delete().eq('id', shop.id);
      if (r.error) throw new Error(/foreign key|violates/i.test(r.error.message) ? 'This shop has orders, so it cannot be deleted. Pause it instead.' : r.error.message);
      mdl.close(); toast('Shop deleted.'); await refresh();
    });
  }

  function itemEditor(shop, item) {
    const name = h('input', { maxlength: '100', value: item?.name || '', required: true, placeholder: 'e.g. Nasi kerabu set' });
    const price = h('input', { type: 'number', inputmode: 'decimal', min: '0.01', max: '99999', step: '0.01', value: item ? item.price.toFixed(2) : '', placeholder: '8.00', required: true });
    const stock = h('input', { type: 'number', inputmode: 'numeric', min: '0', max: '99999', step: '1', value: item ? item.stock : 10, required: true });
    const cat = h('select', {}, M.CATEGORIES.map(c => h('option', { value: c, text: M.CATEGORY_LABEL[c], selected: c === (item?.category || shop.category) })));
    const cond = h('select', {}, M.CONDITIONS.map(c => h('option', { value: c, text: c, selected: c === (item?.condition || 'New') })));
    const condField = h('div', { class: 'field' }, h('label', { text: 'Condition' }), cond);
    const desc = h('textarea', { maxlength: '600', rows: '3', placeholder: 'What is included? Size, flavour, how it is delivered…' }); desc.value = item?.description || '';
    const photo = h('input', { type: 'file', accept: 'image/*' });
    const active = h('input', { type: 'checkbox', checked: item ? item.active : true });
    let removePhoto = false;
    const pv = h('div', { class: 'item-hero', style: { maxWidth: '180px', margin: '0 auto 16px', borderRadius: '18px' } });
    const draw = () => {
      const f = photo.files[0], em = form.elements.emoji?.value || item?.emoji || M.EMOJIS[0];
      fill(pv, h('span', { class: 'art item-art', style: { '--tint': shop.theme || '#ece6d8' } },
        f ? h('img', { src: URL.createObjectURL(f), alt: '' }) : item?.photo && !removePhoto ? h('img', { src: item.photo, alt: '' }) : h('span', { class: 'art-emoji', text: em })));
      condField.hidden = cat.value !== 'Physical goods';
    };
    const form = h('form', { novalidate: true },
      pv,
      h('div', { class: 'field' }, h('label', { text: 'Item or service name' }), name),
      h('div', { class: 'form-grid' },
        h('div', { class: 'field' }, h('label', { text: 'Price (RM)' }), price),
        h('div', { class: 'field' }, h('label', { text: 'How many available?' }), stock, h('small', { text: 'For services, the number of slots you can take.' }))),
      h('div', { class: 'form-grid' }, h('div', { class: 'field' }, h('label', { text: 'Type' }), cat), condField),
      h('div', { class: 'field' }, h('label', { text: 'Description' }), desc),
      h('div', { class: 'field' }, h('label', { text: 'Photo (optional)' }), photo, h('small', { text: 'Resized automatically for fast loading.' }),
        item?.image_path ? h('label', { class: 'check', style: { marginTop: '8px' } }, h('input', { type: 'checkbox', onchange: e => { removePhoto = e.target.checked; draw(); } }), 'Remove current photo') : null),
      h('span', { class: 'label', text: 'Icon (shown when there is no photo)' }),
      h('div', { class: 'emoji-grid', style: { marginBottom: '16px' } }, M.EMOJIS.map((x, n) => h('label', { class: 'emoji-opt' }, h('input', { type: 'radio', name: 'emoji', value: x, checked: item ? x === item.emoji : n === 0, onchange: draw }), h('span', { text: x })))),
      h('label', { class: 'check' }, active, 'Show this item to buyers'),
      h('div', { class: 'row-end', style: { justifyContent: item ? 'space-between' : 'flex-end' } },
        item ? h('button', { class: 'btn btn-danger', type: 'button', onclick: () => deleteItem(item, mdl) }, icon('trash'), 'Delete') : null,
        h('button', { class: 'btn btn-primary', type: 'submit' }, item ? 'Save item' : 'Add to my shop')));
    [cat, photo].forEach(x => x.addEventListener('change', draw));
    const mdl = modal(item ? 'Edit item' : `Add to ${shop.name}`, form, { wide: true, eyebrow: 'Seller' });
    draw();
    form.addEventListener('submit', e => { e.preventDefault(); run(async () => {
      const row = { name: name.value.trim(), unit_price_rm: Math.round(Number(price.value) * 100) / 100, stock_qty: Number(stock.value), category: cat.value,
        condition: cat.value === 'Physical goods' ? cond.value : 'New', description: desc.value.trim(), emoji: form.elements.emoji.value || '🛍️', active: active.checked };
      if (row.name.length < 2) throw new Error('Enter a name (2+ characters).');
      if (!(row.unit_price_rm > 0)) throw new Error('Enter a price above RM 0.');
      if (!Number.isInteger(row.stock_qty) || row.stock_qty < 0) throw new Error('Stock must be a whole number, 0 or more.');
      if (photo.files[0]) row.image_path = await M.uploadShopImage(photo.files[0], shop.id, 'item-');
      else if (removePhoto) row.image_path = null;
      check(await (item ? M.db.from('products').update(row).eq('id', item.id) : M.db.from('products').insert({ ...row, shop_id: shop.id })));
      mdl.close(); toast(item ? 'Item saved.' : 'Item added.'); await refresh();
    }, form); });
  }

  function stockEditor(i) {
    const input = h('input', { type: 'number', inputmode: 'numeric', min: '0', max: '99999', step: '1', value: i.stock });
    const quick = n => h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { input.value = Math.max(0, Number(input.value || 0) + n); } }, (n > 0 ? '+' : '') + n);
    const btn = h('button', { class: 'btn btn-primary', type: 'button' }, 'Save stock');
    const mdl = modal(`Stock · ${i.name}`, h('div', {},
      h('div', { class: 'field' }, h('label', { text: 'In stock now' }), input),
      h('div', { class: 'action-row', style: { justifyContent: 'flex-start' } }, quick(-1), quick(1), quick(5), quick(10)),
      h('div', { class: 'row-end' }, h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => run(async () => { check(await M.db.from('products').update({ stock_qty: 0 }).eq('id', i.id)); mdl.close(); toast('Marked sold out.'); await refresh(); }) }, 'Mark sold out'), btn)));
    btn.addEventListener('click', () => run(async () => {
      const v = Number(input.value);
      if (!Number.isInteger(v) || v < 0) throw new Error('Enter a whole number, 0 or more.');
      check(await M.db.from('products').update({ stock_qty: v }).eq('id', i.id));
      mdl.close(); toast('Stock updated.'); await refresh();
    }, btn));
  }

  async function deleteItem(item, mdl) {
    if (!(await confirmBox('Delete this item?', `“${item.name}” will be removed. Past orders keep their record. To hide it for now, untick “Show this item to buyers” instead.`, 'Delete', true))) return;
    await run(async () => { check(await M.db.from('products').delete().eq('id', item.id)); mdl.close(); toast('Item deleted.'); await refresh(); });
  }

  // ---------------- orders ----------------
  async function loadOrders() {
    const ids = s.market.myShops.map(x => x.id);
    if (!ids.length) { orders = []; return; }
    const [byShop, legacy] = await Promise.all([
      M.db.from('orders').select(OSEL).in('shop_id', ids).order('created_at', { ascending: false }).limit(500),
      M.db.from('orders').select(OSEL).is('shop_id', null).order('created_at', { ascending: false }).limit(200)
    ]);
    const mine = new Set(ids);
    orders = [...check(byShop), ...check(legacy).map(o => ({ ...o, order_items: (o.order_items || []).filter(i => mine.has(i.shop_id)), legacy: true })).filter(o => o.order_items.length)]
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }
  const subtotal = o => o.legacy ? o.order_items.reduce((n, i) => n + i.unit_price_rm * i.quantity, 0) : Number(o.total_rm);

  function ordersView(body) {
    const groups = [
      ['open', 'To do', o => ['pending', 'accepted', 'ready'].includes(o.status) || (o.payment_status === 'awaiting_confirmation' && o.status !== 'cancelled')],
      ['pending', 'New', o => o.status === 'pending'], ['accepted', 'Accepted', o => o.status === 'accepted'], ['ready', 'Ready', o => o.status === 'ready'],
      ['completed', 'Done', o => o.status === 'completed'], ['cancelled', 'Cancelled', o => o.status === 'cancelled'], ['all', 'All', () => true]];
    const g = groups.find(x => x[0] === orderFilter) || groups[0];
    const list = orders.filter(g[2]);
    fill(body,
      h('div', { class: 'chips', style: { marginBottom: '14px' } }, groups.map(([k, l, f]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(orderFilter === k), onclick: () => { orderFilter = k; ordersView(body); } }, l, h('small', { text: String(orders.filter(f).length) })))),
      h('div', { class: 'row-end', style: { marginTop: 0, marginBottom: '10px' } }, h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => run(async () => { await loadOrders(); ordersView(body); }) }, icon('refresh'), 'Refresh')),
      list.length ? list.map(sellerOrderCard) : M.empty('receipt', 'No orders here', orders.length ? 'Try another filter.' : 'When colleagues order from your shop, it shows up here.'));
  }

  function sellerOrderCard(o) {
    const shop = s.market.shop(o.shop_id || o.order_items[0]?.shop_id);
    const first = String(o.buyer_name).split(' ')[0];
    const tpl = {
      accepted: `Hi ${first}, ${shop?.name || 'we'} accepted your order ${M.shortId(o.id)} (${money(subtotal(o))}). We'll let you know when it's ready.`,
      ready: o.fulfillment_method === 'collection' ? `Hi ${first}, your order ${M.shortId(o.id)} from ${shop?.name || 'us'} is ready to collect at ${shop?.location || 'our shop'}.` : `Hi ${first}, your order ${M.shortId(o.id)} from ${shop?.name || 'us'} is on its way to ${o.delivery_location}.`,
      paid: `Hi ${first}, we received your payment of ${money(subtotal(o))} for order ${M.shortId(o.id)}. Thank you!`
    };
    const set = (status, pay, msg) => run(async () => {
      check(await M.db.rpc('manage_marketplace_order', { p_order_id: o.id, p_status: status, p_payment_status: pay }));
      toast(msg); M.clearMarketCache(); await loadOrders(); await route();
    });
    const acts = [];
    if (o.status === 'pending') acts.push(h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => set('accepted', o.payment_status, 'Order accepted.') }, icon('check'), 'Accept'));
    if (o.status === 'accepted') acts.push(h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => set('ready', o.payment_status, 'Marked ready.') }, 'Mark ready'));
    if (o.status === 'ready') acts.push(h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: async () => {
      let pay = o.payment_status;
      if (pay !== 'confirmed' && (o.payment_method === 'cash' || o.payment_receipt_path) && await confirmBox('Mark payment received?', `Did you receive ${money(subtotal(o))}${o.payment_method === 'qr' ? ' in your account' : ' in cash'}?`, 'Yes, received')) pay = 'confirmed';
      set('completed', pay, 'Order completed.');
    } }, 'Complete'));
    if (o.payment_status !== 'confirmed' && o.status !== 'cancelled' && (o.payment_method === 'cash' || o.payment_receipt_path)) acts.push(h('button', { class: 'btn btn-soft btn-sm', type: 'button', onclick: async () => {
      if (await confirmBox('Confirm payment?', o.payment_method === 'qr' ? 'Only confirm after checking the money arrived in your bank / e-wallet. A screenshot alone is not proof.' : `Confirm you received ${money(subtotal(o))} in cash.`, 'Confirm paid')) set(o.status, 'confirmed', 'Payment confirmed.');
    } }, icon('wallet'), o.payment_method === 'qr' ? 'Verify payment' : 'Cash received'));
    if (!['completed', 'cancelled'].includes(o.status)) acts.push(h('button', { class: 'btn btn-danger btn-sm', type: 'button', onclick: async () => {
      if (await confirmBox('Cancel this order?', 'The items go back into stock. Let the buyer know why on WhatsApp.', 'Cancel order', true)) set('cancelled', o.payment_status, 'Order cancelled. Stock returned.');
    } }, 'Cancel'));
    const waBtns = [['accepted', 'Accepted'], ['ready', 'Ready'], ['paid', 'Paid']].map(([k, l]) => { const link = M.waLink(o.phone, tpl[k]); return link ? h('a', { class: 'btn btn-ghost btn-xs', href: link, target: '_blank', rel: 'noopener' }, icon('whatsapp'), l) : null; });
    const receipt = h('div', {});
    if (o.payment_receipt_path) receipt.append(h('button', { class: 'btn btn-ghost btn-xs', type: 'button', onclick: () => run(async () => {
      const url = check(await M.db.storage.from('marketplace-receipts').createSignedUrl(o.payment_receipt_path, 300)).signedUrl;
      fill(receipt, h('a', { href: url, target: '_blank', rel: 'noopener' }, h('img', { class: 'receipt-img', src: url, alt: 'Payment receipt' })), o.payment_reference ? h('p', { class: 'small muted', text: 'Reference: ' + o.payment_reference }) : null,
        h('p', { class: 'hint', text: 'Check your bank / e-wallet before confirming.' }));
    }) }, icon('receipt'), 'View receipt'));
    return h('article', { class: 'order-card' },
      h('div', { class: 'order-head' }, h('div', {}, h('strong', { text: o.buyer_name }), h('small', { text: `${M.shortId(o.id)} · ${M.when(o.created_at)}${s.market.myShops.length > 1 && shop ? ' · ' + shop.name : ''}` })), h('span', { class: 'order-total', text: money(subtotal(o)) })),
      h('div', { class: 'pills' }, badge(STATUS, o.status), badge(PAY, o.payment_status), h('span', { class: 'badge badge-grey', text: o.payment_method === 'qr' ? 'QR' : 'Cash' })),
      h('ul', { class: 'order-lines' }, o.order_items.map(i => h('li', {}, h('span', { text: `${i.product_name} × ${i.quantity}` }), h('span', { text: money(i.unit_price_rm * i.quantity) })))),
      h('div', { class: 'order-meta' },
        h('span', {}, h('b', { text: o.fulfillment_method === 'collection' ? 'Buyer collects' : 'Deliver to' }), ` · ${o.delivery_location}`),
        h('span', {}, h('b', { text: 'Phone' }), ' · ', h('a', { href: `tel:${String(o.phone).replace(/[^0-9+]/g, '')}`, text: o.phone })),
        o.note ? h('span', {}, h('b', { text: 'Note' }), ` · ${o.note}`) : null,
        o.cancel_reason ? h('span', {}, h('b', { text: 'Cancel reason' }), ` · ${o.cancel_reason}`) : null,
        o.legacy ? h('span', { class: 'hint', text: 'Older combined order — totals show your items only.' }) : null),
      receipt,
      acts.length ? h('div', { class: 'order-actions' }, acts) : null,
      h('div', { class: 'order-actions' }, waBtns));
  }

  // ---------------- sales ----------------
  function salesView(body) {
    const paid = orders.filter(o => o.payment_status === 'confirmed' && o.status !== 'cancelled');
    const now = new Date(), key = d => new Intl.DateTimeFormat('en-CA', { timeZone: M.TZ, year: 'numeric', month: '2-digit' }).format(new Date(d));
    const thisMonth = key(now);
    const monthPaid = paid.filter(o => key(o.paid_at || o.created_at) === thisMonth);
    const months = [];
    for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 15); months.push(key(d)); }
    const byMonth = months.map(mo => ({ mo, v: paid.filter(o => key(o.paid_at || o.created_at) === mo).reduce((n, o) => n + subtotal(o), 0) }));
    const max = Math.max(1, ...byMonth.map(x => x.v));
    const top = new Map();
    paid.forEach(o => o.order_items.forEach(i => { const t = top.get(i.product_name) || { q: 0, v: 0 }; t.q += i.quantity; t.v += i.quantity * i.unit_price_rm; top.set(i.product_name, t); }));
    const label = mo => new Date(mo + '-15T00:00:00Z').toLocaleDateString('en-MY', { month: 'short', year: '2-digit', timeZone: 'UTC' });
    const owed = orders.filter(o => o.status !== 'cancelled' && o.payment_status !== 'confirmed');
    fill(body,
      h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('small', { text: 'Paid this month' }), h('strong', { text: money(monthPaid.reduce((n, o) => n + subtotal(o), 0)) })),
        h('div', { class: 'stat' }, h('small', { text: 'Paid orders this month' }), h('strong', { text: String(monthPaid.length) })),
        h('div', { class: 'stat' + (owed.length ? ' attention' : '') }, h('small', { text: 'Waiting for payment' }), h('strong', { text: money(owed.reduce((n, o) => n + subtotal(o), 0)) })),
        h('div', { class: 'stat' }, h('small', { text: 'All-time paid' }), h('strong', { text: money(paid.reduce((n, o) => n + subtotal(o), 0)) }))),
      h('div', { class: 'two-col' },
        h('div', { class: 'card' }, h('h2', { text: 'Last 6 months' }), h('div', { class: 'mini-bars' }, byMonth.map(x => h('div', { class: 'mini-bar' }, h('span', { text: label(x.mo) }), h('div', { class: 'track' }, h('div', { class: 'fill', style: { width: (100 * x.v / max) + '%' } })), h('strong', { text: money(x.v) }))))),
        h('div', { class: 'card' }, h('h2', { text: 'Best sellers' }), top.size ? h('div', {}, [...top.entries()].sort((a, b) => b[1].v - a[1].v).slice(0, 8).map(([n, t]) => h('div', { class: 'sum-row' }, h('span', { text: `${n} × ${t.q}` }), h('b', { text: money(t.v) })))) : h('p', { class: 'muted', text: 'No paid sales yet.' }))),
      h('p', { class: 'hint', text: 'Sales count orders marked as paid (by payment date, Malaysia time). Cancelled orders are excluded.' }));
  }
})();
