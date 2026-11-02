(() => {
  'use strict';
  const M = window.M;
  const { $, h, fill, icon, money, check, run, toast, badge, STATUS, PAY, bag } = M;
  const SELECT = 'id,shop_id,buyer_id,buyer_name,phone,delivery_location,fulfillment_method,payment_method,payment_status,status,total_rm,note,cancel_reason,created_at,payment_receipt_path,payment_reference,order_items(id,shop_id,product_id,product_name,quantity,unit_price_rm)';
  let s, orders = [], tab = 'active';
  const active = o => ['pending', 'accepted', 'ready'].includes(o.status);

  M.start(async st => {
    s = st;
    await load();
    addEventListener('focus', () => run(load));
  }, { auth: true, market: true });

  async function load() {
    orders = check(await M.db.from('orders').select(SELECT).eq('buyer_id', s.user.id).order('created_at', { ascending: false }).limit(200));
    const missing = orders.flatMap(o => [o.shop_id, ...(o.order_items || []).map(i => i.shop_id)]).filter(id => id && !s.market.shop(id));
    if (missing.length) {
      // Shops that closed since the order was placed: fetch just their names.
      const extra = await M.db.from('shops').select('id,name,whatsapp,market_id').in('id', [...new Set(missing)]);
      (extra.data || []).forEach(x => s.market.shops.push({ ...x, products: [], open: false }));
    }
    draw();
  }
  const shopOf = o => s.market.shop(o.shop_id || o.order_items?.[0]?.shop_id) || null;

  function draw() {
    const act = orders.filter(active), past = orders.filter(o => !active(o));
    const list = tab === 'active' ? act : past;
    const spent = orders.filter(o => o.payment_status === 'confirmed' && o.status !== 'cancelled').reduce((n, o) => n + Number(o.total_rm), 0);
    fill($('#orders-root'), h('section', { class: 'wrap page-pad' },
      h('div', { class: 'reveal' }, h('span', { class: 'eyebrow', text: 'Order history' }), h('h1', { style: { fontSize: 'clamp(28px,7vw,44px)' } }, 'My ', h('em', { text: 'orders' }))),
      h('div', { class: 'tabs', role: 'tablist' },
        [['active', 'In progress', act.length], ['past', 'History', past.length]].map(([k, l, n]) =>
          h('button', { role: 'tab', 'aria-selected': String(tab === k), onclick: () => { tab = k; draw(); } }, l, h('span', { class: 'count', text: String(n) })))),
      tab === 'past' && spent ? h('p', { class: 'muted small', text: `You have spent ${money(spent)} on paid orders. Thank you for supporting our units!` }) : null,
      list.length ? list.map(card) : M.empty('receipt', tab === 'active' ? 'Nothing in progress' : 'No past orders yet', tab === 'active' ? 'Orders you place show up here so you can track them.' : null, h('a', { class: 'btn btn-primary', href: '/market' }, 'Browse the market'))));
  }

  function progress(o) {
    if (o.status === 'cancelled') return null;
    const step = { pending: 1, accepted: 2, ready: 3, completed: 4 }[o.status] || 1;
    return [h('div', { class: 'progress' }, [1, 2, 3, 4].map(n => h('span', { class: n <= step ? 'on' : '' }))),
      h('div', { class: 'progress-labels' }, ['Sent', 'Accepted', 'Ready', 'Done'].map(t => h('span', { text: t })))];
  }

  function card(o) {
    const shop = shopOf(o);
    const items = o.order_items || [];
    const wa = shop && M.waLink(shop.whatsapp, `Hi ${shop.name}, about my order ${M.shortId(o.id)} on ${M.BRAND}: `);
    const actions = [];
    if (o.status === 'pending') actions.push(h('button', { class: 'btn btn-danger btn-xs', type: 'button', onclick: () => cancel(o) }, icon('x'), 'Cancel'));
    if (wa) actions.push(h('a', { class: 'btn btn-soft btn-xs', href: wa, target: '_blank', rel: 'noopener' }, icon('whatsapp'), 'Message seller'));
    if (o.payment_receipt_path) actions.push(h('button', { class: 'btn btn-ghost btn-xs', type: 'button', onclick: () => viewReceipt(o) }, icon('receipt'), 'My receipt'));
    if (!active(o)) actions.push(h('button', { class: 'btn btn-ghost btn-xs', type: 'button', onclick: () => again(o) }, icon('refresh'), 'Order again'));
    const el = h('article', { class: 'order-card reveal in' },
      h('div', { class: 'order-head' },
        h('div', {}, shop ? h('a', { href: `/shop?id=${shop.id}` }, h('strong', { text: shop.name })) : h('strong', { text: 'Order' }), h('small', { text: `${M.shortId(o.id)} · ${M.when(o.created_at)}` })),
        h('span', { class: 'order-total', text: money(o.total_rm) })),
      progress(o),
      h('div', { class: 'pills' }, badge(STATUS, o.status), badge(PAY, o.payment_status), h('span', { class: 'badge badge-grey', text: o.payment_method === 'qr' ? 'QR' : 'Cash' })),
      h('ul', { class: 'order-lines' }, items.map(i => h('li', {}, h('span', { text: `${i.product_name} × ${i.quantity}` }), h('span', { text: money(i.unit_price_rm * i.quantity) })))),
      h('div', { class: 'order-meta' },
        h('span', {}, h('b', { text: o.fulfillment_method === 'collection' ? 'Self-collect' : 'Deliver to' }), ` · ${o.delivery_location}`),
        o.note ? h('span', {}, h('b', { text: 'Note' }), ` · ${o.note}`) : null,
        o.status === 'cancelled' && o.cancel_reason ? h('span', {}, h('b', { text: 'Reason' }), ` · ${o.cancel_reason}`) : null),
      o.status === 'ready' ? h('div', { class: 'notice notice-ok', text: o.fulfillment_method === 'collection' ? 'Ready for you to collect!' : 'Ready — on its way to you.' }) : null,
      o.payment_method === 'qr' && o.payment_status === 'unpaid' && o.status !== 'cancelled' && shop ? M.receiptBox(o, shop, () => run(load)) : null,
      o.payment_method === 'qr' && o.payment_status === 'awaiting_confirmation' ? h('p', { class: 'hint', text: 'Receipt sent — waiting for the seller to confirm.' }) : null,
      actions.length ? h('div', { class: 'order-actions' }, actions) : null);
    return el;
  }

  function cancel(o) {
    const reason = h('textarea', { maxlength: '300', rows: '3', placeholder: 'Optional — let the seller know why' });
    const btn = h('button', { class: 'btn btn-danger', type: 'button' }, 'Cancel order');
    const m = M.modal('Cancel this order?', h('div', {},
      h('p', { class: 'muted', text: 'You can cancel until the seller accepts it. The items go back on sale.' }),
      o.payment_status !== 'unpaid' ? h('div', { class: 'notice notice-warn', text: 'You already sent a payment receipt. Contact the seller about your refund.' }) : null,
      h('div', { class: 'field' }, h('label', { text: 'Reason' }), reason),
      h('div', { class: 'row-end' }, h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => m.close() }, 'Keep order'), btn)));
    btn.addEventListener('click', () => run(async () => {
      check(await M.db.rpc('buyer_cancel_marketplace_order', { p_order_id: o.id, p_reason: reason.value.trim() }));
      m.close(); M.clearMarketCache(); toast('Order cancelled.'); await load();
    }, btn));
  }

  async function viewReceipt(o) {
    await run(async () => {
      const url = check(await M.db.storage.from('marketplace-receipts').createSignedUrl(o.payment_receipt_path, 300)).signedUrl;
      M.modal('Your receipt', h('div', {}, h('img', { class: 'receipt-img', src: url, alt: 'Payment receipt' }), o.payment_reference ? h('p', { class: 'muted', text: 'Reference: ' + o.payment_reference }) : null));
    });
  }

  function again(o) {
    let added = 0, missing = 0;
    for (const i of o.order_items || []) {
      const item = s.market.item(i.product_id);
      if (item && item.shop.open && item.active && item.stock > 0 && !item.shop.mine) {
        bag.set(item.id, Math.min(item.stock, bag.qty(item.id) + i.quantity)); added++;
      } else missing++;
    }
    if (!added) return toast('These items are no longer available.', 'error');
    toast(missing ? `Added ${added} item(s). ${missing} no longer available.` : 'Added to your bag.');
    setTimeout(() => { location.href = '/bag'; }, 600);
  }
})();
