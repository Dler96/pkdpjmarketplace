(() => {
  'use strict';
  const M = window.M;
  const { $, h, fill, icon, itemCard, shopCard } = M;

  M.start(async s => {
    const m = s.market;
    const q = new URLSearchParams(location.search);
    const st = {
      clinic: M.MARKETS.some(x => x.id === q.get('clinic')) ? q.get('clinic') : 'all',
      type: M.CATEGORIES.includes(q.get('type')) ? q.get('type') : 'all',
      q: q.get('q') || '', view: q.get('view') === 'items' ? 'items' : 'shops', sort: 'new'
    };
    // Your own pending/paused shops are shown to you as well.
    const shops = [...m.publicShops, ...m.myShops.filter(x => !x.open)];

    const searchInput = h('input', { type: 'search', value: st.q, placeholder: 'Search shops and items', 'aria-label': 'Search shops and items', enterkeyhint: 'search' });
    const clinicChips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Clinic' });
    const typeChips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Type' });
    const viewToggle = h('div', { class: 'view-toggle', role: 'group', 'aria-label': 'View' });
    const sortSel = h('select', { 'aria-label': 'Sort items', style: { width: 'auto', minHeight: '40px', padding: '6px 12px', fontSize: '14px' } },
      [['new', 'Newest'], ['low', 'Price: low to high'], ['high', 'Price: high to low']].map(([v, l]) => h('option', { value: v, text: l })));
    const count = h('span', {});
    const results = h('div', {});

    fill($('#market-root'), h('section', { class: 'wrap page-pad' },
      h('div', { class: 'reveal' }, h('span', { class: 'eyebrow', text: 'The market' }), h('h1', { style: { fontSize: 'clamp(28px,7vw,44px)' } }, 'Take a ', h('em', { text: 'look around' }))),
      h('label', { class: 'searchbar reveal d1' }, icon('search'), searchInput),
      h('div', { class: 'filters reveal d1' }, clinicChips, typeChips),
      h('div', { class: 'result-line' }, count, h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, sortSel, viewToggle)),
      results));

    const matchText = (txt) => !st.q || txt.toLowerCase().includes(st.q.toLowerCase().trim());
    const inClinic = x => st.clinic === 'all' || x.market_id === st.clinic;
    function filtered() {
      const its = shops.filter(inClinic).flatMap(x => x.products.filter(p => p.active || x.mine))
        .filter(i => (st.type === 'all' || i.category === st.type) && matchText(`${i.name} ${i.description} ${i.shop.name} ${i.shop.unit_department}`));
      const sh = shops.filter(inClinic).filter(x => (st.type === 'all' || x.category === st.type || x.products.some(p => p.category === st.type))
        && (matchText(`${x.name} ${x.unit_department} ${x.location} ${x.bio}`) || x.products.some(p => matchText(p.name))));
      return { its, sh };
    }
    function sync() {
      const p = new URLSearchParams();
      if (st.clinic !== 'all') p.set('clinic', st.clinic);
      if (st.type !== 'all') p.set('type', st.type);
      if (st.q) p.set('q', st.q);
      if (st.view === 'items') p.set('view', 'items');
      history.replaceState(null, '', '/market' + (p.toString() ? '?' + p : ''));
    }
    function draw() {
      const base = shops.filter(x => st.type === 'all' || x.category === st.type || x.products.some(p => p.category === st.type));
      fill(clinicChips, [{ id: 'all', short: 'All clinics', color: 'var(--ink)' }, ...M.MARKETS].map(c =>
        h('button', { type: 'button', class: 'chip', 'aria-pressed': String(st.clinic === c.id), style: { '--chip': c.color }, onclick: () => { st.clinic = c.id; draw(); } },
          c.id !== 'all' ? h('i', { class: 'dot' }) : null, c.short, h('small', { text: String(c.id === 'all' ? base.length : base.filter(x => x.market_id === c.id).length) }))));
      fill(typeChips, [['all', 'Everything'], ...M.CATEGORIES.map(c => [c, M.CATEGORY_LABEL[c]])].map(([v, l]) =>
        h('button', { type: 'button', class: 'chip', 'aria-pressed': String(st.type === v), onclick: () => { st.type = v; draw(); } }, l)));
      fill(viewToggle, [['shops', 'Shops'], ['items', 'Items']].map(([v, l]) => h('button', { type: 'button', 'aria-pressed': String(st.view === v), onclick: () => { st.view = v; draw(); } }, l)));
      sortSel.hidden = st.view !== 'items';
      const { its, sh } = filtered();
      if (st.view === 'items') {
        const list = [...its].sort((a, b) => st.sort === 'low' ? a.price - b.price : st.sort === 'high' ? b.price - a.price : String(b.created_at).localeCompare(String(a.created_at)));
        count.textContent = `${list.length} item${list.length === 1 ? '' : 's'}`;
        fill(results, list.length ? h('div', { class: 'item-grid' }, list.map(itemCard)) : nothing());
      } else {
        count.textContent = `${sh.length} shop${sh.length === 1 ? '' : 's'}`;
        fill(results, sh.length ? h('div', { class: 'shop-grid' }, sh.map(shopCard)) : nothing());
      }
      sync();
    }
    const nothing = () => !shops.length
      ? M.empty('store', 'No shops are open yet', 'Units are still setting up. Check back soon.', h('a', { class: 'btn btn-primary', href: '/sell' }, 'Open a unit shop'))
      : M.empty('search', 'Nothing matches that', 'Try another clinic, type or search word.', h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { st.clinic = 'all'; st.type = 'all'; st.q = ''; searchInput.value = ''; draw(); } }, 'Clear filters'));
    let t;
    searchInput.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { st.q = searchInput.value; draw(); }, 160); });
    sortSel.addEventListener('change', () => { st.sort = sortSel.value; draw(); });
    draw();
  }, { market: true });
})();
