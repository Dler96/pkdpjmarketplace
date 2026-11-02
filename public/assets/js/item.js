(() => {
  'use strict';
  const M = window.M;
  const { $, h, fill, icon, money, itemArt, itemCard, market, bag } = M;

  M.start(async s => {
    const i = s.market.item(new URLSearchParams(location.search).get('id'));
    const root = $('#item-root');
    if (!i) return fill(root, h('section', { class: 'wrap page-pad' }, M.empty('box', 'Item not found', 'It may have been removed or sold out.', h('a', { class: 'btn btn-primary', href: '/market?view=items' }, 'Browse items'))));
    document.title = `${i.name} · ${M.BRAND}`;
    const shop = i.shop, c = market(shop.market_id);
    const available = shop.open && i.active && i.stock > 0 && !shop.mine;
    let qty = 1;
    const qtyText = h('span', { text: '1' });
    const minus = h('button', { type: 'button', 'aria-label': 'One less', onclick: () => setQty(qty - 1) }, icon('minus'));
    const plus = h('button', { type: 'button', 'aria-label': 'One more', onclick: () => setQty(qty + 1) }, icon('plus'));
    const inBag = h('p', { class: 'hint' });
    const room = () => Math.max(0, Math.min(99, i.stock) - bag.qty(i.id));
    function setQty(n) {
      qty = Math.max(1, Math.min(room() || 1, n));
      qtyText.textContent = String(qty); minus.disabled = qty <= 1; plus.disabled = qty >= room();
      const have = bag.qty(i.id);
      inBag.textContent = have ? `${have} already in your bag.` : '';
    }
    const add = (thenBag) => { if (bag.add(i, qty)) { setQty(1); if (thenBag) location.href = '/bag'; } };
    const more = shop.products.filter(p => p.id !== i.id && p.active).slice(0, 4);
    const wa = M.waLink(shop.whatsapp, `Hi ${shop.name}, I'm interested in "${i.name}" on ${M.BRAND}. `);

    fill(root, h('section', { class: 'wrap' },
      h('div', { class: 'item-page' },
        h('div', { class: 'item-hero reveal' }, itemArt(i, 'item-art')),
        h('div', { class: 'item-detail reveal d1' },
          h('a', { href: `/shop?id=${shop.id}`, class: 'eyebrow', style: { color: c.color } }, `${shop.name} · ${c.short}`),
          h('h1', { text: i.name }),
          h('div', { class: 'item-price', text: money(i.price) }),
          h('div', { class: 'meta-chips' },
            h('span', { class: 'meta-chip', text: M.CATEGORY_LABEL[i.category] || i.category }),
            i.category === 'Physical goods' ? h('span', { class: 'meta-chip', text: i.condition }) : null,
            h('span', { class: 'meta-chip', style: { color: i.stock <= 0 ? 'var(--red)' : i.stock <= 3 ? 'var(--amber)' : null } }, i.stock <= 0 ? 'Sold out' : i.stock <= 3 ? `Only ${i.stock} left` : `${i.stock} available`)),
          i.description ? h('p', { class: 'pre', text: i.description }) : null,
          available ? [
            h('div', { class: 'buy-row' }, h('div', { class: 'qty' }, minus, qtyText, plus), h('button', { class: 'btn btn-primary btn-lg', type: 'button', onclick: () => add(false) }, icon('bag'), 'Add to bag')),
            h('button', { class: 'btn btn-ghost btn-block', type: 'button', onclick: () => add(true) }, 'Buy now'), inBag
          ] : h('div', { class: 'notice' + (shop.mine ? ' notice-info' : ' notice-warn') }, shop.mine ? 'This is your item. Manage stock and price in Sell.' : !shop.open ? 'This shop is not taking orders right now.' : i.stock <= 0 ? 'Sold out for now — check back later.' : 'This item is not available.'),
          shop.mine ? h('a', { class: 'btn btn-primary', href: `/sell#shop-${shop.id}` }, icon('edit'), 'Edit in Sell') : null,
          h('a', { class: 'seller-box', href: `/shop?id=${shop.id}`, style: { '--banner': shop.theme || '#e5dfd1' } },
            h('span', { class: 'symbol', text: shop.symbol || '✨' }),
            h('div', {}, h('strong', { text: shop.name }), h('small', { text: `${shop.unit_department} · ${shop.location}` })), icon('arrow')),
          wa && !shop.mine ? h('a', { class: 'btn btn-soft btn-block', style: { marginTop: '10px' }, href: wa, target: '_blank', rel: 'noopener' }, icon('whatsapp'), 'Ask the seller') : null,
          h('p', { class: 'hint', style: { marginTop: '14px' } }, icon('wallet'), ` Pay ${shop.name} directly — cash${shop.payment_qr_path ? ' or QR' : ''}. ${i.category === 'Services' ? 'The seller will contact you to arrange a time.' : ''}`))),
      more.length ? h('section', { class: 'section' }, h('div', { class: 'section-head' }, h('h2', {}, 'More from ', h('em', { text: shop.name }))), h('div', { class: 'item-grid' }, more.map(p => itemCard(p, { showShop: false })))) : null));
    if (available) setQty(1);
  }, { auth: true, market: true });
})();
