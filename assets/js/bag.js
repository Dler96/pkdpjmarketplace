(() => {
  'use strict';
  const M = window.M;
  const { $, h, fill, icon, money, itemArt, bag, check, run, toast } = M;
  const REQ = 'pkdpj-checkout-key';
  let s, m, root;

  M.start(async st => {
    s = st; m = st.market; root = $('#bag-root');
    draw();
  }, { auth: true, market: true, fresh: true });

  function lines() {
    return bag.read().map(x => ({ ...x, item: m.item(x.id) })).filter(x => x.item);
  }
  function problem(l) {
    const i = l.item;
    if (i.shop.mine) return 'This is your own shop.';
    if (!i.shop.open) return 'This shop is not taking orders right now.';
    if (!i.active) return 'No longer available.';
    if (i.stock <= 0) return 'Sold out.';
    if (l.qty > i.stock) return `Only ${i.stock} left — reduce the quantity.`;
    return null;
  }

  function draw() {
    // Drop items that no longer exist at all.
    const known = lines();
    if (known.length !== bag.read().length) bag.write(known.map(({ id, qty }) => ({ id, qty })));
    const list = known;
    if (!list.length) {
      fill(root, h('section', { class: 'wrap page-pad' }, h('h1', { style: { fontSize: 'clamp(28px,7vw,44px)' } }, 'Your ', h('em', { text: 'bag' })),
        M.empty('bag', 'Your bag is empty', 'Tap + on any item to add it here.', h('a', { class: 'btn btn-primary', href: '/market?view=items' }, 'Browse items'))));
      return;
    }
    const groups = new Map();
    list.forEach(l => { const k = l.item.shop.id; groups.set(k, [...(groups.get(k) || []), l]); });
    const total = list.reduce((n, l) => n + l.item.price * l.qty, 0);
    const blocked = list.some(problem);
    const shops = [...groups.keys()].map(id => m.shop(id));
    const qrOk = shops.every(x => x.payment_qr_path);
    const p = s.profile || {};
    let lastLoc = ''; try { lastLoc = localStorage.getItem('pkdpj-last-location') || ''; } catch { /* ignore */ }

    const groupEls = [...groups.entries()].map(([sid, ls]) => {
      const shop = m.shop(sid);
      return h('div', { class: 'bag-group reveal' },
        h('div', { class: 'bag-group-head', style: { '--market': M.market(shop.market_id).color } },
          h('a', { href: M.shopUrl(shop) }, h('i', { class: 'dot' }), shop.name), h('b', { text: money(ls.reduce((n, l) => n + l.item.price * l.qty, 0)) })),
        ls.map(l => {
          const issue = problem(l);
          const max = Math.min(99, l.item.stock);
          return h('div', { class: 'bag-line' },
            h('a', { href: `/item?id=${l.item.id}` }, itemArt(l.item)),
            h('div', {}, h('strong', { text: l.item.name }), h('small', { text: `${money(l.item.price)} each` }),
              issue ? h('span', { class: 'warn', text: issue }) : null,
              h('div', { class: 'qty', style: { marginTop: '6px' } },
                h('button', { type: 'button', 'aria-label': l.qty === 1 ? `Remove ${l.item.name}` : 'One less', onclick: () => { bag.set(l.id, l.qty - 1); draw(); } }, icon(l.qty === 1 ? 'trash' : 'minus')),
                h('span', { text: String(l.qty) }),
                h('button', { type: 'button', 'aria-label': 'One more', disabled: l.qty >= max, onclick: () => { bag.set(l.id, l.qty + 1); draw(); } }, icon('plus')))),
            h('div', { class: 'line-total', text: money(l.item.price * l.qty) }));
        }));
    });

    const name = h('input', { id: 'co-name', value: p.full_name || '', autocomplete: 'name', maxlength: '100', required: true });
    const phone = h('input', { id: 'co-phone', type: 'tel', value: p.phone || '', autocomplete: 'tel', maxlength: '24', placeholder: '0123456789', required: true });
    const loc = h('input', { id: 'co-loc', value: lastLoc || p.department || '', maxlength: '200', placeholder: 'e.g. Unit Farmasi, KK Presint 18, Level 1', required: true });
    const note = h('textarea', { id: 'co-note', maxlength: '500', rows: '2', placeholder: 'Optional — e.g. please call when ready' });
    const save = h('input', { type: 'checkbox', checked: !p.phone || !p.full_name });
    const choice = (name, value, title, sub, ic, checked, disabled) => h('label', { class: 'choice' },
      h('input', { type: 'radio', name, value, checked, disabled }), h('span', { class: 'tick' }, icon('check')), icon(ic),
      h('span', {}, h('strong', { text: title }), h('small', { text: sub })));
    const form = h('form', { class: 'card reveal', novalidate: true },
      h('h2', { text: 'Checkout' }),
      h('div', { class: 'form-grid' },
        h('div', { class: 'field' }, h('label', { for: 'co-name', text: 'Your name' }), name),
        h('div', { class: 'field' }, h('label', { for: 'co-phone', text: 'Phone / WhatsApp' }), phone)),
      h('div', { class: 'field' }, h('label', { for: 'co-loc', text: 'Your unit / location' }), loc, h('small', { text: 'Where the seller can deliver to or find you.' })),
      h('span', { class: 'label', text: 'How do you want it?' }),
      h('div', { class: 'choices', style: { marginBottom: '16px' } },
        choice('fulfil', 'delivery', 'Deliver to my unit', 'The seller brings it to you.', 'truck', true),
        choice('fulfil', 'collection', "I'll collect it", 'Pick up from the shop location.', 'hand', false)),
      h('span', { class: 'label', text: 'How will you pay?' }),
      h('div', { class: 'choices', style: { marginBottom: '8px' } },
        choice('pay', 'cash', 'Cash', 'Pay when you receive or collect.', 'wallet', true),
        choice('pay', 'qr', 'QR transfer', qrOk ? "Scan each shop's QR, then upload the receipt." : 'Not available — a shop in your bag has no QR yet.', 'receipt', false, !qrOk)),
      h('div', { class: 'field', style: { marginTop: '14px' } }, h('label', { for: 'co-note', text: 'Note to seller(s)' }), note),
      h('label', { class: 'check' }, save, 'Save my name and phone for next time'));

    const placeBtn = h('button', { class: 'btn btn-primary btn-lg btn-block', type: 'button', disabled: blocked }, groups.size > 1 ? `Place ${groups.size} orders` : 'Place order', icon('check'));
    placeBtn.addEventListener('click', () => submit());
    const summary = h('div', { class: 'card sticky reveal d1' },
      h('h2', { text: 'Summary' }),
      shops.map(x => h('div', { class: 'sum-row' }, h('span', { text: x.name }), h('span', { text: money(groups.get(x.id).reduce((n, l) => n + l.item.price * l.qty, 0)) }))),
      h('div', { class: 'sum-total' }, h('span', { text: 'Total' }), h('strong', { text: money(total) })),
      groups.size > 1 ? h('p', { class: 'hint', text: `This becomes ${groups.size} separate orders — one per shop — so each seller handles their own.` }) : null,
      blocked ? h('div', { class: 'notice notice-warn', text: 'Fix the items marked in red before checking out.' }) : null,
      h('div', { style: { marginTop: '12px' } }, placeBtn));

    fill(root, h('section', { class: 'wrap page-pad' },
      h('div', { class: 'section-head' }, h('h1', { style: { fontSize: 'clamp(28px,7vw,44px)', margin: 0 } }, 'Your ', h('em', { text: 'bag' })),
        h('button', { class: 'link-btn', type: 'button', onclick: async () => { if (await M.confirmBox('Empty your bag?', 'All items will be removed.', 'Empty bag', true)) { bag.clear(); draw(); } } }, 'Empty bag')),
      h('div', { class: 'checkout-layout' }, h('div', {}, groupEls, form), summary)),
      h('div', { class: 'sticky-bar' }, h('div', {}, h('strong', { text: money(total) }), h('small', { text: `${list.reduce((n, l) => n + l.qty, 0)} item(s) · ${groups.size} shop(s)` })),
        h('button', { class: 'btn btn-primary', type: 'button', disabled: blocked, onclick: () => submit() }, 'Place order')));
    M.reveal(root);

    async function submit() {
      await run(async () => {
        if (blocked) throw new Error('Fix the items marked in red first.');
        const d = { name: name.value.trim(), phone: phone.value.trim(), loc: loc.value.trim(), note: note.value.trim(),
          fulfil: form.elements.fulfil.value, pay: form.elements.pay.value };
        if (d.name.length < 2) { name.focus(); throw new Error('Enter your name.'); }
        if (!M.PHONE.test(d.phone)) { phone.focus(); throw new Error('Enter a valid phone / WhatsApp number.'); }
        if (d.loc.length < 2) { loc.focus(); throw new Error('Enter your unit or location.'); }
        const items = lines().map(l => ({ product_id: l.id, quantity: l.qty, expected_price: l.item.price }));
        const fp = JSON.stringify([d, items]);
        let req; try { req = JSON.parse(sessionStorage.getItem(REQ) || 'null'); } catch { req = null; }
        if (!req || req.fp !== fp) { req = { fp, key: crypto.randomUUID() }; try { sessionStorage.setItem(REQ, JSON.stringify(req)); } catch { /* ignore */ } }
        let result;
        try {
          result = check(await M.db.rpc('place_marketplace_checkout', { p_buyer_name: d.name, p_phone: d.phone, p_delivery_location: d.loc,
            p_fulfillment: d.fulfil, p_payment_method: d.pay, p_note: d.note, p_items: items, p_request_key: req.key }));
        } catch (e) {
          if (/price|left of|no longer|removed|not taking/i.test(e.message || '')) { M.clearMarketCache(); m = await M.loadMarket(true); draw(); }
          throw e;
        }
        try { localStorage.setItem('pkdpj-last-location', d.loc); sessionStorage.removeItem(REQ); } catch { /* ignore */ }
        if (save.checked) {
          const upd = { full_name: d.name, phone: d.phone };
          const r = await M.db.from('profiles').update(upd).eq('id', s.user.id);
          if (!r.error) s.profile = { ...s.profile, ...upd };
        }
        bag.clear(); M.clearMarketCache();
        const ids = result.map(r => r.order_id);
        const orders = check(await M.db.from('orders').select('id,shop_id,total_rm,payment_method,payment_status,status,order_items(product_name,quantity,unit_price_rm)').in('id', ids));
        success(orders, d);
      }, placeBtn);
    }
  }

  function success(orders, d) {
    const all = orders.reduce((n, o) => n + Number(o.total_rm), 0);
    fill(root, h('section', { class: 'wrap page-pad', style: { maxWidth: '720px' } },
      h('div', { style: { textAlign: 'center' } },
        h('span', { class: 'empty-ico', style: { width: '76px', height: '76px' } }, icon('check')),
        h('span', { class: 'eyebrow', style: { display: 'block' }, text: 'Order sent' }),
        h('h1', { style: { fontSize: 'clamp(30px,8vw,46px)' } }, 'Terima ', h('em', { text: 'kasih!' })),
        h('p', { class: 'muted', text: orders.length > 1 ? `Your ${orders.length} orders were sent to each shop. Total ${money(all)}.` : `Your order was sent to the shop. Total ${money(all)}.` }),
        d.pay === 'qr' ? h('div', { class: 'notice notice-info', text: "Next: pay each shop by scanning its QR below, then upload your receipt. The seller confirms once they've checked their account." }) : h('div', { class: 'notice notice-ok', text: `Pay in cash when you ${d.fulfil === 'collection' ? 'collect' : 'receive'} your items. You can track everything in My orders.` })),
      orders.map(o => {
        const shop = m.shop(o.shop_id);
        const wa = shop && M.waLink(shop.whatsapp, `Hi ${shop.name}, I just placed order ${M.shortId(o.id)} on ${M.BRAND} (${money(o.total_rm)}).`);
        const card = h('div', { class: 'order-card' },
          h('div', { class: 'order-head' }, h('div', {}, h('strong', { text: shop?.name || 'Shop' }), h('small', { text: `Order ${M.shortId(o.id)}` })), h('span', { class: 'order-total', text: money(o.total_rm) })),
          h('ul', { class: 'order-lines' }, (o.order_items || []).map(i => h('li', {}, h('span', { text: `${i.product_name} × ${i.quantity}` }), h('span', { text: money(i.unit_price_rm * i.quantity) })))),
          wa ? h('a', { class: 'btn btn-soft btn-sm', href: wa, target: '_blank', rel: 'noopener' }, icon('whatsapp'), 'Message seller') : null);
        if (o.payment_method === 'qr' && shop) card.append(M.receiptBox(o, shop));
        return card;
      }),
      h('div', { class: 'action-row', style: { marginTop: '18px' } }, h('a', { class: 'btn btn-primary', href: '/orders' }, 'Track my orders'), h('a', { class: 'btn btn-ghost', href: '/market' }, 'Keep shopping'))));
    scrollTo({ top: 0, behavior: 'smooth' });
  }

})();
