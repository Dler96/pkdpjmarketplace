(() => {
  'use strict';
  const M = window.M;
  const { $, h, fill, icon, itemCard, market } = M;

  M.start(async s => {
    const shop = s.market.shop(new URLSearchParams(location.search).get('id'));
    const root = $('#shop-root');
    if (!shop) return fill(root, h('section', { class: 'wrap page-pad' }, M.empty('store', 'Shop not found', 'It may be closed or waiting for approval.', h('a', { class: 'btn btn-primary', href: '/market' }, 'Back to the market'))));
    document.title = `${shop.name} · ${M.BRAND}`;
    const c = market(shop.market_id);
    const items = shop.products.filter(p => p.active || shop.mine);
    const types = [...new Set(items.map(i => i.category))];
    let type = 'all';
    const grid = h('div', {});
    const chips = h('div', { class: 'chips' });
    const draw = () => {
      fill(chips, types.length > 1 ? [['all', 'All'], ...types.map(t => [t, M.CATEGORY_LABEL[t] || t])].map(([v, l]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(type === v), onclick: () => { type = v; draw(); } }, l)) : []);
      const list = items.filter(i => type === 'all' || i.category === type);
      fill(grid, list.length ? h('div', { class: 'item-grid' }, list.map(i => itemCard(i, { showShop: false })))
        : M.empty('box', shop.mine ? 'Add your first item' : 'No items yet', shop.mine ? 'Items you add appear here.' : 'This shop has not listed anything yet.', shop.mine ? h('a', { class: 'btn btn-primary', href: `/sell#shop-${shop.id}` }, 'Add an item') : null));
    };
    const wa = M.waLink(shop.whatsapp, `Hi ${shop.name}, I found your shop on ${M.BRAND}. `);
    fill(root, h('section', { class: 'wrap' },
      h('div', { class: 'shop-hero reveal', style: { '--banner': shop.theme || '#e5dfd1' } },
        shop.cover ? h('img', { src: shop.cover, alt: '' }) : [h('span', { class: 'banner-word', text: shop.word || 'made with care' }), h('span', { class: 'banner-symbol', 'aria-hidden': 'true', text: shop.symbol || '✨' })],
),
      h('div', { class: 'shop-info reveal d1' },
        !shop.open ? h('div', { class: 'notice notice-warn', style: { marginTop: 0 } }, h('b', { text: M.SHOP_STATUS[shop.status]?.[0] || shop.status }), shop.mine ? ' — only you can see this shop for now. You can already add items.' : '') : null,
        h('span', { class: 'badge', style: { background: c.color + '22', color: c.color, marginBottom: '8px' }, text: c.name }),
        h('h1', { text: shop.name }),
        shop.bio ? h('p', { class: 'muted', style: { margin: '0 0 6px' }, text: shop.bio }) : null,
        h('div', { class: 'info-list' },
          h('span', {}, icon('users'), shop.unit_department),
          h('span', {}, icon('pin'), `${shop.location} · ${c.name}`),
          h('span', {}, icon('wallet'), shop.payment_qr_path ? 'Cash or QR payment' : 'Cash payment')),
        h('div', { class: 'action-row', style: { justifyContent: 'flex-start', marginTop: '14px' } },
          shop.mine ? h('a', { class: 'btn btn-primary btn-sm', href: `/sell#shop-${shop.id}` }, icon('edit'), 'Manage my shop') : null,
          wa && !shop.mine ? h('a', { class: 'btn btn-soft btn-sm', href: wa, target: '_blank', rel: 'noopener' }, icon('whatsapp'), 'WhatsApp seller') : null,
          h('a', { class: 'btn btn-ghost btn-sm', href: '/market' }, icon('back'), 'All shops'))),
      h('section', { class: 'section' }, h('div', { class: 'section-head' }, h('h2', {}, 'Items ', h('em', { text: `(${items.length})` }))), chips, h('div', { style: { height: '10px' } }), grid)));
    draw();
  }, { auth: true, market: true });
})();
