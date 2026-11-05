(() => {
  'use strict';
  const M = window.M;
  const { $, h, fill, icon, money, itemCard, shopCard, itemArt, market } = M;

  M.start(async s => {
    const root = $('#home-root');
    const guestMode = !s.user;   // guests can look around; buying needs an account
    const m = s.market;
    const first = (s.profile?.full_name || '').split(' ')[0];
    const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: M.TZ, hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
    const hello = hour < 12 ? 'Selamat pagi' : hour < 15 ? 'Selamat tengah hari' : hour < 19 ? 'Selamat petang' : 'Selamat malam';

    // Today's picks (admin-chosen), else a few in-stock items
    let picks = m.picks.map(p => ({ ...p, item: m.item(p.product_id) })).filter(p => p.item && p.item.shop.open && p.item.active);
    // Top up empty positions with in-stock items so there are always three.
    const used = new Set(picks.map(p => p.item.id));
    for (const item of m.publicItems.filter(i => i.stock > 0 && !used.has(i.id))) {
      if (picks.length >= 3) break;
      const rank = [1, 2, 3].find(r => !picks.some(p => p.rank === r));
      picks.push({ rank, item });
    }
    picks.sort((a, b) => a.rank - b.rank);
    const fresh = [...m.publicItems].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 8);
    const shops = m.publicShops.slice(0, 6);

    const search = h('form', { class: 'searchbar reveal', role: 'search', onsubmit: e => { e.preventDefault(); const q = e.currentTarget.q.value.trim(); location.href = '/market' + (q ? '?q=' + encodeURIComponent(q) : ''); } },
      icon('search'), h('input', { name: 'q', type: 'search', placeholder: 'Search food, items, shops…', 'aria-label': 'Search the market', enterkeyhint: 'search' }));

    const attention = h('div', {});
    const newsBox = h('div', {});
    fill(root, guestMode ? guestHero() : null, h('section', { class: 'wrap' },
      guestMode ? null : h('div', { class: 'greeting reveal' }, h('div', {}, h('span', { class: 'eyebrow', text: hello }), h('h1', {}, first ? `Hi, ${first} ` : 'Hello ', h('em', { text: '👋' })), M.roleTag(s.user.id))),
      search, guestMode ? null : attention, guestMode ? null : newsBox,
      picks.length ? h('section', { class: 'section' },
        h('div', { class: 'section-head reveal' }, h('div', {}, h('span', { class: 'eyebrow', text: 'Clinic picks' }), h('h2', {}, "Today's ", h('em', { text: 'finds' })))),
        h('div', { class: 'picks reveal d1' }, picks.slice(0, 3).map(p => h('a', { class: 'pick', href: `/item?id=${p.item.id}` },
          h('span', { class: 'rank', text: p.sponsored ? `#${p.rank} · Sponsored` : `#${p.rank}` }), itemArt(p.item),
          h('span', {}, h('strong', { text: p.item.name }), h('small', { text: `${p.item.shop.name} · ${market(p.item.shop.market_id).short}` }),
            h('b', { class: 'price', text: p.item.stock > 0 ? money(p.item.price) : 'Sold out' })))))) : null,
      h('section', { class: 'section' },
        h('div', { class: 'section-head reveal' }, h('div', {}, h('span', { class: 'eyebrow', text: 'Five locations' }), h('h2', {}, 'Shop by ', h('em', { text: 'clinic' }))), h('a', { href: '/market', text: 'All shops →' })),
        h('div', { class: 'clinic-row reveal d1' }, M.MARKETS.map(c => {
          const n = m.publicShops.filter(x => x.market_id === c.id).length;
          return h('a', { class: 'clinic-tile', href: `/market?clinic=${c.id}`, style: { '--market': c.color } }, h('b', { text: c.short }), h('small', { text: `${n} shop${n === 1 ? '' : 's'}` }));
        }))),
      fresh.length ? h('section', { class: 'section' },
        h('div', { class: 'section-head reveal' }, h('div', {}, h('span', { class: 'eyebrow', text: 'Just listed' }), h('h2', {}, 'New ', h('em', { text: 'arrivals' }))), h('a', { href: '/market?view=items', text: 'See all →' })),
        h('div', { class: 'item-grid' }, fresh.map((i, n) => { const c = itemCard(i); c.classList.add('reveal', `d${n % 4}`); return c; }))) : null,
      h('section', { class: 'section' },
        h('div', { class: 'section-head reveal' }, h('div', {}, h('span', { class: 'eyebrow', text: 'Unit shops' }), h('h2', {}, 'Take a ', h('em', { text: 'look around' }))), h('a', { href: '/market', text: 'Browse →' })),
        shops.length ? h('div', { class: 'shop-grid' }, shops.map(x => { const c = shopCard(x); c.classList.add('reveal'); return c; }))
          : M.empty('store', 'No shops are open yet', 'Units are setting up. Why not be the first?', h('a', { class: 'btn btn-primary', href: '/sell' }, 'Open a unit shop'))),
      guestMode ? guestJoin() : !s.seller ? h('section', { class: 'section reveal' }, h('div', { class: 'card', style: { background: 'var(--green-soft)', borderColor: '#cfe2d5' } },
        h('h2', {}, 'Got something to ', h('em', { text: 'sell?' })), h('p', { class: 'muted', text: 'Open a shop for your unit — food, crafts, printables or services. It takes about a minute.' }),
        h('a', { class: 'btn btn-primary', href: '/sell' }, 'Start selling', icon('arrow')))) : null));

    if (guestMode) return;
    // News highlights + upcoming events (best effort, after first paint)
    loadNews(newsBox);

    // Things that need attention (best effort, after first paint)
    try {
      const notes = [];
      const mine = await M.db.from('orders').select('id', { count: 'exact', head: true }).eq('buyer_id', s.user.id).in('status', ['pending', 'accepted', 'ready']);
      if (mine.count) notes.push(h('a', { class: 'notice notice-info', href: '/orders', style: { display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--ink)' } }, icon('receipt'), h('span', {}, h('b', { text: `${mine.count} order${mine.count > 1 ? 's' : ''} in progress` }), ' — tap to track')));
      if (m.myShops.length) {
        const ids = m.myShops.map(x => x.id);
        const sell = await M.db.from('orders').select('id', { count: 'exact', head: true }).in('shop_id', ids).or('status.eq.pending,payment_status.eq.awaiting_confirmation').neq('status', 'cancelled');
        if (sell.count) notes.push(h('a', { class: 'notice notice-warn', href: '/sell#orders', style: { display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--ink)' } }, icon('box'), h('span', {}, h('b', { text: `${sell.count} shop order${sell.count > 1 ? 's' : ''} need you` }), ' — new orders or receipts to check')));
      }
      fill(attention, notes);
    } catch { /* not essential */ }
  }, { market: true });

  async function loadNews(box) {
    if (!M.news) return;
    try {
      const posts = await M.news.load({ limit: 40 });
      if (!posts.length) {
        return fill(box, h('section', { class: 'section reveal in' }, h('a', { class: 'news-invite', href: '/news' },
          h('span', { class: 'empty-ico' }, M.icon('news')), h('span', {}, h('strong', { text: 'News & events is live' }), h('small', { text: 'Share PKD news, an event or global news — admins approve posts.' })), M.icon('arrow'))));
      }
      const hl = posts.filter(p => p.highlight);
      const top = (hl.length ? hl : posts).slice(0, 5);
      const events = posts.filter(M.news.upcoming).sort((a, b) => new Date(a.event_start) - new Date(b.event_start)).slice(0, 3);
      fill(box, h('section', { class: 'section' },
        h('div', { class: 'section-head' }, h('div', {}, h('span', { class: 'eyebrow', text: 'PKDPJ community' }), h('h2', {}, hl.length ? 'Highlights ' : 'Latest ', h('em', { text: 'news' }))), h('a', { href: '/news', text: 'All news →' })),
        M.news.carousel(top),
        events.length ? h('div', { class: 'event-list stagger', style: { marginTop: '12px' } }, events.map(M.news.eventRow)) : null));
    } catch { /* news not set up yet — skip quietly */ }
  }

  function guestHero() {
    return h('section', { class: 'wrap hero' }, h('div', { class: 'hero-card reveal' },
      h('img', { src: '/assets/img/clinic-facade.webp', alt: 'Klinik Kesihatan Putrajaya Presint 18', fetchpriority: 'high' }),
      h('div', { class: 'hero-copy' },
        h('span', { class: 'eyebrow', text: M.cfg.tagline || 'PKD Putrajaya' }),
        h('h1', {}, 'Good things start ', h('em', { text: 'right here.' })),
        h('p', { text: 'Food, crafts, printables and services — made and offered by the units and departments you work alongside. Have a look around; log in when you are ready to order.' }),
        h('div', { class: 'hero-actions' }, h('a', { class: 'btn btn-primary btn-lg', href: '/account?mode=register' }, 'Join the market', icon('arrow')), h('a', { class: 'btn btn-ghost btn-lg', href: '/account' }, 'Log in')))));
  }
  function guestJoin() {
    const steps = [['store', 'Browse', 'Look around freely — no account needed.'], ['bag', 'Join to order', 'Create a free account with your real name and phone.'], ['wallet', 'Pay your way', 'Cash on collection or scan the shop\'s QR (DuitNow / Touch \'n Go).']];
    return h('section', { class: 'section' },
      h('div', { class: 'section-head reveal' }, h('div', {}, h('span', { class: 'eyebrow', text: 'How it works' }), h('h2', {}, 'Three easy ', h('em', { text: 'steps' })))),
      h('div', { class: 'shop-grid' }, steps.map(([ic, t, d], n) => h('div', { class: `card reveal d${n}` }, h('span', { class: 'empty-ico', style: { width: '48px', height: '48px', marginBottom: '8px' } }, icon(ic)), h('h3', { text: `${n + 1}. ${t}` }), h('p', { class: 'muted', style: { margin: 0 }, text: d })))),
      h('div', { class: 'card reveal', style: { background: 'var(--green-soft)', borderColor: '#cfe2d5', marginTop: '16px' } },
        h('h2', {}, 'Ready to ', h('em', { text: 'order or sell?' })), h('p', { class: 'muted', text: 'Join free to buy from any shop, open your own unit shop, and read PKD news and events.' }),
        h('div', { class: 'action-row', style: { justifyContent: 'flex-start' } }, h('a', { class: 'btn btn-primary', href: '/account?mode=register' }, 'Create an account', icon('arrow')), h('a', { class: 'btn btn-ghost', href: '/account' }, 'Log in'))));
  }
  function guest(root) {
    const steps = [['store', 'Browse', 'Shops from PKD Putrajaya and KK Presint 9, 11, 14 & 18.'], ['bag', 'Add to bag', 'Order from several shops in one go.'], ['wallet', 'Pay your way', 'Cash on collection or scan the shop\'s QR.']];
    fill(root,
      h('section', { class: 'wrap hero' }, h('div', { class: 'hero-card reveal' },
        h('img', { src: '/assets/img/clinic-facade.webp', alt: 'Klinik Kesihatan Putrajaya Presint 18', fetchpriority: 'high' }),
        h('div', { class: 'hero-copy' },
          h('span', { class: 'eyebrow', text: M.cfg.tagline || 'PKD Putrajaya' }),
          h('h1', {}, 'Good things start ', h('em', { text: 'right here.' })),
          h('p', { text: 'Food, crafts, printables and services — made and offered by the units and departments you work alongside.' }),
          h('div', { class: 'hero-actions' }, h('a', { class: 'btn btn-primary btn-lg', href: '/account?mode=register' }, 'Join the market', icon('arrow')), h('a', { class: 'btn btn-ghost btn-lg', href: '/account' }, 'Log in'))))),
      h('section', { class: 'wrap section' },
        h('div', { class: 'section-head reveal' }, h('div', {}, h('span', { class: 'eyebrow', text: 'How it works' }), h('h2', {}, 'Three easy ', h('em', { text: 'steps' })))),
        h('div', { class: 'shop-grid' }, steps.map(([ic, t, d], n) => h('div', { class: `card reveal d${n}` }, h('span', { class: 'empty-ico', style: { width: '48px', height: '48px', marginBottom: '8px' } }, icon(ic)), h('h3', { text: `${n + 1}. ${t}` }), h('p', { class: 'muted', style: { margin: 0 }, text: d }))))),
      h('section', { class: 'wrap section' },
        h('div', { class: 'section-head reveal' }, h('div', {}, h('span', { class: 'eyebrow', text: 'Our community' }), h('h2', {}, 'Five ', h('em', { text: 'locations' })))),
        h('div', { class: 'clinic-row reveal d1' }, M.MARKETS.map(c => h('div', { class: 'clinic-tile', style: { '--market': c.color } }, h('b', { text: c.short }), h('small', { text: c.name }))))),
      h('section', { class: 'wrap section reveal' }, h('div', { class: 'card', style: { background: 'var(--green-soft)', borderColor: '#cfe2d5' } },
        h('h2', {}, 'Run a ', h('em', { text: 'unit shop' })), h('p', { class: 'muted', text: 'Sell kuih, crafts, printables or services to colleagues. Shops are approved by the market admin before going live.' }),
        h('a', { class: 'btn btn-primary', href: '/account?mode=register' }, 'Create an account'))));
  }
})();
