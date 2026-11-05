/* Admin & Manager: approvals, today's picks, all orders, members, delete requests, maintenance. */
(() => {
  'use strict';
  const M = window.M;
  const { $, h, fill, icon, money, check, run, toast, modal, confirmBox, badge, STATUS, PAY, SHOP_STATUS, market } = M;
  const OSEL = 'id,shop_id,buyer_id,buyer_name,phone,delivery_location,fulfillment_method,payment_method,payment_status,status,total_rm,note,created_at,payment_receipt_path,payment_reference,order_items(product_name,quantity,unit_price_rm,shop_id)';
  let s, root, shopFilter = 'pending', orderFilter = 'open';

  M.start(async st => {
    s = st; root = $('#admin-root');
    addEventListener('hashchange', () => run(route));
    await route();
  }, { auth: true, admin: true, market: true, fresh: true });

  const section = () => ['overview', 'shops', 'orders', 'members', 'requests', 'site'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview';
  async function route() {
    const sec = section();
    const pending = s.market.shops.filter(x => x.status === 'pending').length;
    const body = h('div', {});
    const newsLink = h('a', { href: '/news#review' }, icon('news'), 'News approvals');
    const reqLink = h('a', { href: '#requests', 'aria-current': sec === 'requests' ? 'page' : null }, icon('trash'), 'Delete requests');
    M.db.from('delete_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      .then(r => { if (r.count) reqLink.append(h('span', { class: 'count', text: String(r.count) })); }, () => {});
    M.db.from('news_posts').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      .then(r => { if (r.count) newsLink.append(h('span', { class: 'count', text: String(r.count) })); }, () => {});
    fill(root, h('section', { class: 'wrap page-pad' },
      h('div', {}, h('span', { class: 'eyebrow', text: s.superAdmin ? 'Market admin' : 'Market manager' }), h('h1', { style: { fontSize: 'clamp(28px,7vw,44px)' } }, 'Control ', h('em', { text: 'room' }))),
      h('nav', { class: 'sub-nav', 'aria-label': 'Admin sections' },
        h('a', { href: '#overview', 'aria-current': sec === 'overview' ? 'page' : null }, icon('chart'), 'Overview'),
        h('a', { href: '#shops', 'aria-current': sec === 'shops' ? 'page' : null }, icon('store'), 'Shops', pending ? h('span', { class: 'count', text: String(pending) }) : null),
        h('a', { href: '#orders', 'aria-current': sec === 'orders' ? 'page' : null }, icon('receipt'), 'Orders'),
        h('a', { href: '#members', 'aria-current': sec === 'members' ? 'page' : null }, icon('users'), 'Members'),
        newsLink, reqLink,
        h('a', { href: '#site', 'aria-current': sec === 'site' ? 'page' : null }, icon('settings'), 'Maintenance')),
      body));
    try { await ({ overview, shops, orders, members, requests, site })[sec](body); }
    catch (e) { if (/delete_requests|site_settings|is_manager/.test(String(e?.message))) fill(body, M.empty('shield', 'Almost ready', 'Run 10-manager-role.sql in the Supabase SQL Editor to switch this on.')); else throw e; }
  }
  async function refresh() { M.clearMarketCache(); s.market = await M.loadMarket(true); await route(); }

  // ---------------- overview ----------------
  async function overview(body) {
    const m = s.market;
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    const recent = check(await M.db.from('orders').select('id,total_rm,status,payment_status,created_at').gte('created_at', since).limit(2000));
    const live = recent.filter(o => o.status !== 'cancelled');
    const pendingShops = m.shops.filter(x => x.status === 'pending');
    const picks = m.picks;
    const pickable = m.publicItems.filter(i => i.stock > 0);
    const rank = h('select', {}, [1, 2, 3].map(r => h('option', { value: r, text: `#${r}${r === 1 ? ' Top pick' : ''}` })));
    const item = h('select', {}, h('option', { value: '', text: 'Choose an item…' }), pickable.map(i => h('option', { value: i.id, text: `${i.name} — ${i.shop.name} (${money(i.price)})` })));
    const sponsored = h('input', { type: 'checkbox' });
    const save = h('button', { class: 'btn btn-primary', type: 'button' }, 'Save pick');
    save.addEventListener('click', () => run(async () => {
      if (!item.value) throw new Error('Choose an item first.');
      check(await M.db.from('daily_highlights').upsert({ feature_date: M.todayKL(), rank: Number(rank.value), product_id: item.value, sponsored: sponsored.checked }, { onConflict: 'feature_date,rank' }));
      toast("Today's pick saved."); await refresh();
    }, save));
    fill(body,
      h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('small', { text: 'Open shops' }), h('strong', { text: String(m.shops.filter(x => x.status === 'active').length) })),
        h('div', { class: 'stat' + (pendingShops.length ? ' attention' : '') }, h('small', { text: 'Waiting approval' }), h('strong', { text: String(pendingShops.length) })),
        h('div', { class: 'stat' }, h('small', { text: 'Orders (30 days)' }), h('strong', { text: String(live.length) })),
        h('div', { class: 'stat' }, h('small', { text: 'Order value (30 days)' }), h('strong', { text: money(live.reduce((n, o) => n + Number(o.total_rm), 0)) }))),
      h('div', { class: 'two-col' },
        h('div', { class: 'card' }, h('h2', { text: 'Shops to approve' }),
          pendingShops.length ? pendingShops.map(shopRow) : h('p', { class: 'muted', text: 'All caught up — nothing to review.' })),
        h('div', { class: 'card' }, h('h2', {}, "Today's ", h('em', { text: 'picks' })),
          h('p', { class: 'muted small', text: 'Shown at the top of everyone’s home page today (Malaysia date). Empty positions show in-stock items automatically.' }),
          [1, 2, 3].map(r => { const p = picks.find(x => x.rank === r); const i = p && m.item(p.product_id); return h('div', { class: 'sum-row' }, h('b', { text: `#${r}` }), h('span', { text: i ? `${i.name} · ${i.shop.name}${p.sponsored ? ' · sponsored' : ''}` : 'Automatic' }),
            p ? h('button', { class: 'link-btn', type: 'button', onclick: () => run(async () => { check(await M.db.from('daily_highlights').delete().eq('feature_date', M.todayKL()).eq('rank', r)); toast('Pick removed.'); await refresh(); }) }, 'Clear') : h('span')); }),
          h('div', { class: 'form-grid', style: { marginTop: '12px' } }, h('div', { class: 'field' }, h('label', { text: 'Position' }), rank), h('div', { class: 'field' }, h('label', { text: 'Item' }), item)),
          h('label', { class: 'check' }, sponsored, 'Mark as sponsored'), save)));
  }

  function shopRow(x) {
    const c = market(x.market_id);
    const set = (status, msg) => run(async () => { check(await M.db.from('shops').update({ status }).eq('id', x.id)); toast(msg); await refresh(); });
    return h('div', { class: 'order-card', style: { '--market': c.color } },
      h('div', { class: 'order-head' }, h('div', {}, h('strong', { text: x.name }), h('small', {}, h('i', { class: 'dot' }), ` ${c.short} · ${x.unit_department}`)), badge(SHOP_STATUS, x.status)),
      h('p', { class: 'small muted', style: { margin: '8px 0' }, text: `${x.location}${x.bio ? ' — ' + x.bio : ''}` }),
      h('p', { class: 'small', style: { margin: '0 0 8px' }, text: `${x.products.length} item(s) · ${x.payment_qr_path ? 'QR set up' : 'No QR yet'}${x.whatsapp ? ' · WhatsApp ' + x.whatsapp : ''}` }),
      h('div', { class: 'order-actions' },
        x.status !== 'active' ? h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => set('active', 'Shop approved — it is now visible to everyone.') }, icon('check'), x.status === 'pending' ? 'Approve' : 'Reactivate') : null,
        x.status === 'pending' ? h('button', { class: 'btn btn-danger btn-sm', type: 'button', onclick: async () => { if (await confirmBox('Decline this shop?', 'The seller will see it as declined. You can reactivate it later.', 'Decline', true)) set('suspended', 'Shop declined.'); } }, 'Decline') : null,
        x.status === 'active' ? h('button', { class: 'btn btn-danger btn-sm', type: 'button', onclick: async () => { if (await confirmBox('Suspend this shop?', 'Buyers will no longer see it or be able to order.', 'Suspend', true)) set('suspended', 'Shop suspended.'); } }, 'Suspend') : null,
        h('a', { class: 'btn btn-ghost btn-sm', href: M.shopUrl(x) }, 'View shop')));
  }

  // ---------------- shops ----------------
  function shops(body) {
    const all = s.market.shops;
    const filters = [['pending', 'Waiting'], ['active', 'Open'], ['paused', 'Paused'], ['suspended', 'Declined / suspended'], ['all', 'All']];
    let q = '';
    const list = h('div', {});
    const draw = () => fill(list, (() => {
      const rows = all.filter(x => (shopFilter === 'all' || x.status === shopFilter) && `${x.name} ${x.unit_department} ${x.location}`.toLowerCase().includes(q.toLowerCase()));
      return rows.length ? rows.map(shopRow) : M.empty('store', 'No shops here', null);
    })());
    fill(body,
      h('div', { class: 'chips', style: { marginBottom: '10px' } }, filters.map(([k, l]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(shopFilter === k), onclick: () => { shopFilter = k; shops(body); } }, l, h('small', { text: String(k === 'all' ? all.length : all.filter(x => x.status === k).length) })))),
      h('label', { class: 'searchbar', style: { marginBottom: '14px' } }, icon('search'), h('input', { type: 'search', placeholder: 'Search shops', oninput: e => { q = e.target.value; draw(); } })),
      list);
    draw();
  }

  // ---------------- orders ----------------
  async function orders(body) {
    const rows = check(await M.db.from('orders').select(OSEL).order('created_at', { ascending: false }).limit(300));
    const groups = [['open', 'In progress', o => ['pending', 'accepted', 'ready'].includes(o.status)], ['checking', 'Checking payment', o => o.payment_status === 'awaiting_confirmation' && o.status !== 'cancelled'],
      ['completed', 'Completed', o => o.status === 'completed'], ['cancelled', 'Cancelled', o => o.status === 'cancelled'], ['all', 'All', () => true]];
    const g = groups.find(x => x[0] === orderFilter) || groups[0];
    let q = '';
    const list = h('div', {});
    const draw = () => {
      const r = rows.filter(g[2]).filter(o => `${o.id} ${o.buyer_name} ${o.phone} ${(o.order_items || []).map(i => i.product_name).join(' ')} ${s.market.shop(o.shop_id)?.name || ''}`.toLowerCase().includes(q.toLowerCase()));
      fill(list, r.length ? r.map(orderRow) : M.empty('receipt', 'No orders here', null));
    };
    fill(body,
      h('div', { class: 'chips', style: { marginBottom: '10px' } }, groups.map(([k, l, f]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(orderFilter === k), onclick: () => { orderFilter = k; run(() => orders(body)); } }, l, h('small', { text: String(rows.filter(f).length) })))),
      h('label', { class: 'searchbar', style: { marginBottom: '14px' } }, icon('search'), h('input', { type: 'search', placeholder: 'Search buyer, phone, item or order ID', oninput: e => { q = e.target.value; draw(); } })),
      h('p', { class: 'hint', text: 'Showing the latest 300 orders.' }), list);
    draw();
  }
  function orderRow(o) {
    const shop = s.market.shop(o.shop_id || o.order_items?.[0]?.shop_id);
    const status = h('select', {}, Object.keys(STATUS).map(k => h('option', { value: k, text: STATUS[k][0], selected: k === o.status })));
    const pay = h('select', {}, Object.keys(PAY).map(k => h('option', { value: k, text: PAY[k][0], selected: k === o.payment_status })));
    const btn = h('button', { class: 'btn btn-primary btn-sm', type: 'button' }, 'Save');
    const receipt = h('div', {});
    btn.addEventListener('click', () => run(async () => {
      if (pay.value === 'confirmed' && o.payment_status !== 'confirmed' && !(await confirmBox('Mark as paid?', 'Only confirm after the seller has received the money.', 'Confirm'))) return;
      check(await M.db.rpc('manage_marketplace_order', { p_order_id: o.id, p_status: status.value, p_payment_status: pay.value }));
      o.status = status.value; o.payment_status = pay.value; toast('Order updated.'); M.clearMarketCache();
    }, btn));
    if (o.payment_receipt_path) receipt.append(h('button', { class: 'btn btn-ghost btn-xs', type: 'button', onclick: () => run(async () => {
      const url = check(await M.db.storage.from('marketplace-receipts').createSignedUrl(o.payment_receipt_path, 300)).signedUrl;
      fill(receipt, h('img', { class: 'receipt-img', src: url, alt: 'Receipt' }), o.payment_reference ? h('p', { class: 'small muted', text: 'Ref: ' + o.payment_reference }) : null);
    }) }, icon('receipt'), 'View receipt'));
    return h('article', { class: 'order-card' },
      h('div', { class: 'order-head' }, h('div', {}, h('strong', { text: `${o.buyer_name} → ${shop?.name || 'Several shops'}` }), M.roleTag(o.buyer_id), h('small', { text: `${M.shortId(o.id)} · ${M.when(o.created_at)} · ${o.phone}` })), h('span', { class: 'order-total', text: money(o.total_rm) })),
      h('div', { class: 'pills' }, badge(STATUS, o.status), badge(PAY, o.payment_status), h('span', { class: 'badge badge-grey', text: `${o.payment_method === 'qr' ? 'QR' : 'Cash'} · ${o.fulfillment_method === 'collection' ? 'Collect' : 'Deliver'}` })),
      h('ul', { class: 'order-lines' }, (o.order_items || []).map(i => h('li', {}, h('span', { text: `${i.product_name} × ${i.quantity}` }), h('span', { text: money(i.unit_price_rm * i.quantity) })))),
      receipt,
      h('div', { class: 'form-grid', style: { marginTop: '10px' } }, h('div', { class: 'field' }, h('label', { text: 'Status' }), status), h('div', { class: 'field' }, h('label', { text: 'Payment' }), pay)),
      h('div', { class: 'row-end', style: { marginTop: 0 } }, btn));
  }

  // ---------------- members ----------------
  async function members(body) {
    const rows = check(await M.db.from('profiles').select('id,full_name,account_type,department,phone,is_admin,is_manager,created_at').order('created_at', { ascending: false }).limit(2000));
    let q = '';
    const tbody = h('div', {});
    const draw = () => fill(tbody, rows.filter(p => `${p.full_name} ${p.department} ${p.phone}`.toLowerCase().includes(q.toLowerCase())).slice(0, 200).map(p =>
      h('div', { class: 'list-row', style: { gridTemplateColumns: '44px 1fr auto' } },
        h('span', { class: 'avatar', style: { width: '40px', height: '40px', fontSize: '13px', background: p.is_admin ? 'var(--green)' : p.is_manager ? 'var(--amber)' : 'var(--ink)' }, text: (p.full_name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() }),
        h('div', {}, M.nameBlock(p.full_name || 'No name', p.id), h('small', { text: [p.account_type === 'seller' ? 'Seller' : 'Buyer', p.department, p.phone].filter(Boolean).join(' · ') })),
        p.id === s.user.id ? h('span', { class: 'badge badge-green', text: 'You' })
          : s.superAdmin ? roleSelect(p, draw)
          : h('span', { class: 'badge', text: p.is_admin ? 'Admin' : p.is_manager ? 'Manager' : 'Member' }))));
    fill(body,
      h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('small', { text: 'Members' }), h('strong', { text: String(rows.length) })),
        h('div', { class: 'stat' }, h('small', { text: 'Sellers' }), h('strong', { text: String(rows.filter(p => p.account_type === 'seller').length) })),
        h('div', { class: 'stat' }, h('small', { text: 'Admins / managers' }), h('strong', { text: `${rows.filter(p => p.is_admin).length} / ${rows.filter(p => p.is_manager && !p.is_admin).length}` })),
        h('div', { class: 'stat' }, h('small', { text: 'Joined this month' }), h('strong', { text: String(rows.filter(p => String(p.created_at).slice(0, 7) === M.todayKL().slice(0, 7)).length) }))),
      h('label', { class: 'searchbar', style: { marginBottom: '14px' } }, icon('search'), h('input', { type: 'search', placeholder: 'Search name, unit or phone', oninput: e => { q = e.target.value; draw(); } })),
      h('div', { class: 'card', style: { padding: 0, overflow: 'hidden' } }, tbody));
    draw();
  }

  const ROLE_TEXT = {
    member: 'A normal account: can buy, sell (own shop) and post news for approval.',
    manager: 'Can approve, pause or reject shops, edit any shop or item, approve and highlight news, manage Today\'s picks and orders, and turn on maintenance mode. Deleting other people\'s things needs your approval.',
    admin: 'Full control, including deleting anything, approving delete requests and changing roles. Only give this to people you fully trust.'
  };
  function roleSelect(p, redraw) {
    const cur = p.is_admin ? 'admin' : p.is_manager ? 'manager' : 'member';
    const sel = h('select', { class: 'role-select', 'aria-label': `Role for ${p.full_name}` },
      [['member', 'Member'], ['manager', 'Manager'], ['admin', 'Admin']].map(([v, l]) => h('option', { value: v, text: l, selected: v === cur })));
    sel.addEventListener('change', async () => {
      const role = sel.value;
      if (!(await confirmBox(`Make ${p.full_name || 'this member'} a ${role}?`, ROLE_TEXT[role], 'Change role', role === 'admin'))) { sel.value = cur; return; }
      run(async () => {
        check(await M.db.rpc('admin_set_marketplace_role', { p_user: p.id, p_role: role }));
        p.is_admin = role === 'admin'; p.is_manager = role === 'manager'; redraw(); toast('Role updated.');
      });
    });
    return sel;
  }

  // ---------------- delete requests ----------------
  async function requests(body) {
    const rows = check(await M.db.from('delete_requests').select('*').order('created_at', { ascending: false }).limit(200));
    const pending = rows.filter(r => r.status === 'pending'), done = rows.filter(r => r.status !== 'pending').slice(0, 30);
    const TYPE = { shop: ['Shop', 'store'], product: ['Item', 'box'], news: ['News post', 'news'] };
    const row = r => h('div', { class: 'list-row', style: { gridTemplateColumns: '44px 1fr auto' } },
      h('span', { class: 'empty-ico', style: { width: '40px', height: '40px', margin: 0 } }, icon(TYPE[r.target_type][1])),
      h('div', { class: 'req-info' }, h('strong', { text: r.target_label }),
        h('small', {}, `${TYPE[r.target_type][0]} · asked by ${r.requested_by_name}`, M.roleTag(r.requested_by, true), ` · ${M.dateOnly(r.created_at)}`),
        r.reason ? h('small', { style: { color: 'var(--ink)' }, text: 'Reason: ' + r.reason }) : null,
        r.status !== 'pending' ? h('small', { text: (r.status === 'approved' ? 'Deleted' : 'Declined') + (r.decision_note ? ' — ' + r.decision_note : '') }) : null),
      r.status !== 'pending' ? h('span', { class: 'badge ' + (r.status === 'approved' ? 'badge-red' : ''), text: r.status === 'approved' ? 'Deleted' : 'Declined' })
        : s.superAdmin ? h('div', { class: 'row-tools' },
            h('button', { class: 'btn btn-ghost btn-xs', type: 'button', onclick: () => decide(r, false) }, 'Decline'),
            h('button', { class: 'btn btn-danger btn-xs', type: 'button', onclick: () => decide(r, true) }, icon('trash'), 'Delete'))
          : h('span', { class: 'badge badge-amber', text: 'Waiting for Admin' }));
    fill(body,
      h('div', { class: 'notice notice-info', text: s.superAdmin ? 'Managers cannot delete other people\'s shops, items or news. They send a request here, and nothing is removed until you approve it.' : 'Deleting other people\'s shops, items or news needs an Admin\'s approval. Your requests are listed here.' }),
      h('h2', { style: { fontSize: '22px' } }, 'Waiting ', h('em', { text: `(${pending.length})` })),
      pending.length ? h('div', { class: 'card', style: { padding: 0, overflow: 'hidden' } }, pending.map(row)) : M.empty('check', 'No delete requests', 'Nothing is waiting for a decision.'),
      done.length ? [h('h2', { style: { fontSize: '22px', marginTop: '26px' } }, 'Recently ', h('em', { text: 'decided' })), h('div', { class: 'card', style: { padding: 0, overflow: 'hidden' } }, done.map(row))] : null);
  }
  async function decide(r, approve) {
    const note = h('input', { maxlength: '200', placeholder: approve ? 'Optional note' : 'Why not? (optional)' });
    const form = h('form', {}, h('p', { class: 'muted', text: approve ? `"${r.target_label}" will be permanently deleted. This cannot be undone.` : `"${r.target_label}" will stay.` }),
      h('div', { class: 'field' }, h('label', { text: 'Note to the manager' }), note),
      h('div', { class: 'row-end' }, h('button', { class: approve ? 'btn btn-danger' : 'btn btn-primary', type: 'submit' }, approve ? 'Delete permanently' : 'Decline request')));
    const m = modal(approve ? 'Approve deletion?' : 'Decline deletion?', form, { eyebrow: 'Delete request' });
    form.addEventListener('submit', e => { e.preventDefault(); run(async () => {
      check(await M.db.rpc('decide_marketplace_delete', { p_request: r.id, p_approve: approve, p_note: note.value.trim() || null }));
      m.close(); toast(approve ? 'Deleted.' : 'Request declined.'); M.clearMarketCache(); await route();
    }, form); });
  }

  // ---------------- maintenance & announcement ----------------
  async function site(body) {
    const cfg = check(await M.db.from('site_settings').select('*').eq('id', 1).maybeSingle()) || {};
    const on = h('input', { type: 'checkbox', checked: !!cfg.maintenance });
    const msg = h('textarea', { rows: '3', maxlength: '300' }); msg.value = cfg.maintenance_message || '';
    const ann = h('textarea', { rows: '2', maxlength: '240', placeholder: 'e.g. Orders close at 3pm today for the staff meeting.' }); ann.value = cfg.announcement || '';
    const form = h('form', { class: 'card' },
      h('h2', { style: { fontSize: '22px', marginTop: 0 } }, 'Maintenance ', h('em', { text: 'mode' })),
      h('label', { class: 'switch-row' }, on, h('span', {}, h('strong', { text: 'Close the market for maintenance' }), h('small', { text: 'Everyone except Admins and Managers sees the message below. You can keep working as normal.' }))),
      h('div', { class: 'field', style: { marginTop: '12px' } }, h('label', { text: 'Message visitors see' }), msg),
      h('h2', { style: { fontSize: '22px', marginTop: '22px' } }, 'Announcement ', h('em', { text: 'banner' })),
      h('div', { class: 'field' }, h('label', { text: 'Shown at the top of every page (leave empty to hide)' }), ann),
      cfg.updated_at ? h('p', { class: 'small muted', text: `Last changed ${M.dateOnly(cfg.updated_at)}` }) : null,
      h('div', { class: 'row-end' }, h('button', { class: 'btn btn-primary', type: 'submit' }, 'Save')));
    form.addEventListener('submit', e => { e.preventDefault(); run(async () => {
      if (on.checked && !cfg.maintenance && !(await confirmBox('Close the market?', 'Members and visitors will not be able to use the site until you switch this off.', 'Close for maintenance', true))) return;
      check(await M.db.from('site_settings').update({ maintenance: on.checked, maintenance_message: msg.value.trim() || 'We are doing some quick maintenance. Please check back soon.', announcement: ann.value.trim() }).eq('id', 1));
      try { sessionStorage.removeItem('pkdpj-site'); } catch { /* ignore */ }
      toast(on.checked ? 'Market closed for maintenance.' : 'Saved.'); await route();
    }, form); });
    fill(body, cfg.maintenance ? h('div', { class: 'notice notice-warn', text: 'Maintenance mode is ON. Only Admins and Managers can use the site right now.' }) : null, form);
  }
})();
