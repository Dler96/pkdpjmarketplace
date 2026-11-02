/* PKDPJ Market — shared core for every page.
   Draws the header, bottom tab bar and footer, restores the login,
   loads the market (shops + items + images) and keeps the bag.
   Security lives in Supabase (row-level security + database functions). */
(() => {
  'use strict';
  const cfg = window.MARKET_CONFIG || {};
  const TZ = 'Asia/Kuala_Lumpur';
  const BRAND = cfg.brandName || 'PKDPJ Market';
  const SHORT = cfg.brandShort || 'PKDPJ';

  // ---------------- reference data ----------------
  const MARKETS = [
    { id: 'pejabat-kesihatan-putrajaya', name: 'Pejabat Kesihatan Putrajaya', short: 'PKD Putrajaya', color: '#4f7699' },
    { id: 'presint-9', name: 'Klinik Kesihatan Presint 9', short: 'Presint 9', color: '#a45f48' },
    { id: 'presint-11', name: 'Klinik Kesihatan Presint 11', short: 'Presint 11', color: '#5f8255' },
    { id: 'presint-14', name: 'Klinik Kesihatan Presint 14', short: 'Presint 14', color: '#7d62a3' },
    { id: 'presint-18', name: 'Klinik Kesihatan Presint 18', short: 'Presint 18', color: '#b97a3a' }
  ];
  const market = id => MARKETS.find(m => m.id === id) || MARKETS[4];
  const CATEGORIES = ['Physical goods', 'Digital goods', 'Services'];
  const CATEGORY_LABEL = { 'Physical goods': 'Food & goods', 'Digital goods': 'Digital', 'Services': 'Services' };
  const CONDITIONS = ['New', 'Used - like new', 'Used - good', 'Used - fair'];
  const EMOJIS = ['🛍️', '🥐', '🍪', '🍱', '🧁', '🍰', '🥤', '☕', '🍉', '🌿', '🪴', '📓', '🎨', '🕯️', '🎁', '🧴', '👕', '💍', '📄', '🛠️', '✂️', '💻', '📚', '🧸'];
  const SYMBOLS = ['✨', '🌿', '🍊', '🧁', '🎨', '🧶', '🪴', '🛠️', '📚', '💊', '🦷', '☕', '🍱', '🎁', '💐', '🩺'];
  const THEMES = ['#d9e4d6', '#ecd8c3', '#dcd9e8', '#d9e3e5', '#f1d9d4', '#e9e3cf', '#d6e4ee', '#efe0b8'];
  const STATUS = { pending: ['New', 'amber'], accepted: ['Accepted', 'blue'], ready: ['Ready', 'green'], completed: ['Completed', 'grey'], cancelled: ['Cancelled', 'red'] };
  const PAY = { unpaid: ['Not paid yet', 'grey'], awaiting_confirmation: ['Checking payment', 'amber'], confirmed: ['Paid', 'green'] };
  const SHOP_STATUS = { pending: ['Waiting for approval', 'amber'], active: ['Open', 'green'], paused: ['Paused', 'grey'], suspended: ['Declined / suspended', 'red'] };

  // ---------------- DOM helpers ----------------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const PROPS = new Set(['value', 'checked', 'disabled', 'selected', 'hidden', 'required', 'multiple']);
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v; // trusted static markup only
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'style' && typeof v === 'object') for (const [sk, sv] of Object.entries(v)) sk.startsWith('--') ? el.style.setProperty(sk, sv) : (el.style[sk] = sv);
      else if (PROPS.has(k)) el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
    return el;
  }
  const fill = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter(k => k != null && k !== false));
  const ICONS = {
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    store: '<path d="M3 9l1.5-5h15L21 9"/><path d="M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 13v7h14v-7"/>',
    bag: '<path d="M6 7h12l1 13H5z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    sell: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>', check: '<path d="M5 12l5 5 9-10"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    whatsapp: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-1.8-1.8l.8-1-1-2z"/>',
    wallet: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 15h2"/>',
    truck: '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.5"/><circle cx="17" cy="17.5" r="1.5"/>',
    hand: '<path d="M7 11V6a1.5 1.5 0 0 1 3 0v4M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V12M16 9.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-3l-2.5-4.5a1.5 1.5 0 0 1 2.6-1.5L7 13"/>',
    star: '<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.3L12 17.5 6.5 20.4l1-6.3L3 9.7l6.2-.9z"/>',
    edit: '<path d="M4 20h4L20 8l-4-4L4 16z"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/>',
    box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>', logout: '<path d="M9 4H4v16h5M9 12h12M16 7l5 5-5 5"/>',
    pause: '<path d="M9 5v14M15 5v14"/>', play: '<path d="M7 5l12 7-12 7z"/>', image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', sparkle: '<path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z"/>',
    share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    qr: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z"/><path d="M14 14h2v2h-2zM18 14h2M14 18v2h2M18 18h2v2"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    snow: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5"/>',
    sort: '<path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/>',
  };
  function icon(name, cls = '') {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'ico ' + cls); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = ICONS[name] || ''; return s;
  }

  // ---------------- formatting ----------------
  const money = n => 'RM ' + Number(n || 0).toFixed(2);
  const todayKL = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  const when = ts => { try { return new Date(ts).toLocaleString('en-MY', { timeZone: TZ, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); } catch { return ''; } };
  const dateOnly = ts => new Date(ts).toLocaleDateString('en-MY', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });
  const shortId = id => String(id || '').slice(0, 8).toUpperCase();
  const badge = (map, key) => h('span', { class: `badge badge-${(map[key] || [key, 'grey'])[1]}`, text: (map[key] || [key])[0] });
  const waNumber = phone => { const d = String(phone || '').replace(/\D/g, ''); const n = d.startsWith('0') ? '60' + d.slice(1) : d; return /^[1-9]\d{7,14}$/.test(n) ? n : null; };
  const waLink = (phone, text) => { const n = waNumber(phone); return n ? `https://wa.me/${n}?text=${encodeURIComponent(text || '')}` : null; };
  const PHONE = /^\+?[0-9][0-9 ()-]{6,23}$/;

  // ---------------- feedback ----------------
  function toast(msg, type = 'ok', ms = 3800) {
    let host = $('#toasts');
    if (!host) { host = h('div', { id: 'toasts', 'aria-live': 'polite' }); document.body.append(host); }
    const t = h('div', { class: `toast toast-${type}`, role: type === 'error' ? 'alert' : 'status' }, icon(type === 'error' ? 'x' : 'check'), h('span', { text: msg }));
    host.append(t); requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, ms);
  }
  function friendly(e) {
    const t = String(e?.message || e?.error_description || e || '');
    if (/invalid login credentials/i.test(t)) return "That email and password don't match. Check for typos, or use Forgot password.";
    if (/email not confirmed/i.test(t)) return 'Please confirm your email first — check your inbox (and spam folder) for the link.';
    if (/already registered|already been registered/i.test(t)) return 'There is already an account with this email. Try logging in.';
    if (/failed to fetch|network|load failed/i.test(t)) return 'Could not connect. Check your internet and try again.';
    if (/rate limit|too many/i.test(t)) return 'Too many attempts. Please wait a minute and try again.';
    if (/row-level security|permission denied|unauthorized/i.test(t)) return 'You do not have permission to do that.' + (/photo upload/i.test(t) ? ' (photo upload — run 07-fix-shop-uploads.sql)' : '');
    if (/JWT|jwt expired/i.test(t)) return 'Your session expired. Please log in again.';
    return t || 'Something went wrong. Please try again.';
  }
  let loadingCount = 0;
  const loading = on => { loadingCount = Math.max(0, loadingCount + (on ? 1 : -1)); document.documentElement.classList.toggle('is-loading', loadingCount > 0); };
  async function run(fn, scope) {
    const btns = scope ? (scope instanceof HTMLFormElement ? $$('button', scope) : [scope]) : [];
    const prev = btns.map(b => b.disabled);
    btns.forEach(b => { b.disabled = true; });
    const main = scope instanceof HTMLFormElement ? $('button[type=submit],button:not([type])', scope) : scope;
    main && main.classList.add('is-busy');
    loading(true);
    try { return await fn(); }
    catch (e) { console.error(e); toast(friendly(e), 'error', 6500); }
    finally { loading(false); btns.forEach((b, i) => { b.disabled = prev[i]; b.classList.remove('is-busy'); }); }
  }
  const check = res => { if (res.error) throw res.error; return res.data; };
  function modal(title, body, { wide = false, onClose, eyebrow } = {}) {
    const dlg = h('dialog', { class: 'modal' + (wide ? ' modal-wide' : '') },
      h('div', { class: 'modal-head' }, h('div', {}, eyebrow ? h('span', { class: 'eyebrow', text: eyebrow }) : null, h('h3', { text: title })),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: () => dlg.close() }, icon('x'))),
      h('div', { class: 'modal-body' }, body));
    dlg.addEventListener('close', () => { dlg.remove(); onClose && onClose(); });
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    document.body.append(dlg); dlg.showModal();
    return { dialog: dlg, close: () => dlg.close() };
  }
  function confirmBox(title, text, ok = 'Confirm', danger = false) {
    return new Promise(resolve => {
      let done = false;
      const m = modal(title, h('div', {}, h('p', { class: 'muted', text }),
        h('div', { class: 'row-end' }, h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => m.close() }, 'Go back'),
          h('button', { class: 'btn ' + (danger ? 'btn-danger' : 'btn-primary'), type: 'button', onclick: () => { done = true; m.close(); resolve(true); } }, ok))),
        { onClose: () => { if (!done) resolve(false); } });
    });
  }

  // ---------------- Supabase session ----------------
  const configured = cfg.supabaseUrl && !/YOUR_PROJECT/.test(cfg.supabaseUrl) && cfg.supabaseKey && !/YOUR_PUBLIC/.test(cfg.supabaseKey);
  let db = null;
  const state = { user: null, profile: null, admin: false, seller: false, market: null };
  async function initAuth() {
    const { data } = await db.auth.getSession();
    state.user = data.session?.user || null;
    if (!state.user) return;
    const p = await db.from('profiles').select('*').eq('id', state.user.id).maybeSingle();
    state.profile = p.data || { full_name: state.user.user_metadata?.full_name || '', account_type: 'buyer', is_admin: false, department: '', phone: '' };
    state.admin = !!state.profile.is_admin;
    state.seller = state.profile.account_type === 'seller';
  }
  // Phone number is mandatory for every buyer and seller. Accounts without one are asked once, before anything else.
  const realName = n => /\s/.test(n.trim()) && !/\d/.test(n);
  function phoneGate() {
    return new Promise(resolve => {
      const p = state.profile;
      const name = h('input', { maxlength: '100', value: p.full_name || '', autocomplete: 'name', placeholder: 'e.g. Nur Aisyah binti Ahmad' });
      const phone = h('input', { type: 'tel', maxlength: '24', value: p.phone || '', autocomplete: 'tel', inputmode: 'tel', placeholder: '0123456789' });
      const form = h('form', { novalidate: true },
        h('p', { class: 'muted', text: 'Sellers and buyers contact each other by phone or WhatsApp about orders, so every account needs a phone number.' }),
        h('div', { class: 'field' }, h('label', { text: 'Full name' }), name, h('small', { text: 'Recommended: your real name, so sellers and buyers know who they are dealing with.' })),
        h('div', { class: 'field' }, h('label', { text: 'Phone / WhatsApp (required)' }), phone),
        h('button', { class: 'btn btn-primary btn-lg btn-block', type: 'submit' }, 'Save and continue'),
        h('p', { style: { textAlign: 'center', marginTop: '14px' } }, h('button', { class: 'link-btn', type: 'button', onclick: () => signOut() }, 'Log out instead')));
      const dlg = modal('Add your phone number', form, { eyebrow: 'One quick step' });
      dlg.querySelector('.modal-head .icon-btn')?.remove();
      dlg.addEventListener('cancel', e => e.preventDefault());           // Esc cannot skip it
      const realClose = dlg.close.bind(dlg); dlg.close = () => {};      // backdrop tap cannot skip it either
      form.addEventListener('submit', e => { e.preventDefault(); run(async () => {
        const n = name.value.trim(), ph = phone.value.trim();
        if (n.length < 2) { name.focus(); throw new Error('Enter your name.'); }
        if (!PHONE.test(ph) || !waNumber(ph)) { phone.focus(); throw new Error('Enter a valid phone number, e.g. 0123456789.'); }
        if (!realName(n) && !(await confirmBox('Use this name?', `"${n}" looks like a nickname. We recommend your real full name so people can trust your orders.`, 'Keep it'))) return;
        check(await db.from('profiles').update({ full_name: n, phone: ph }).eq('id', state.user.id));
        state.profile = { ...p, full_name: n, phone: ph };
        resolve(); realClose(); toast('Thanks! Your details are saved.');
      }, form); });
    });
  }
  const displayName = () => state.profile?.full_name || state.user?.user_metadata?.full_name || state.user?.email || 'Account';
  const initials = () => displayName().trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'U';

  // ---------------- images (private bucket → signed URLs, batched) ----------------
  const urlCache = new Map();
  async function signImages(paths, bucket = 'marketplace-images') {
    const need = [...new Set(paths.filter(p => p && !urlCache.has(bucket + p)))];
    for (let i = 0; i < need.length; i += 100) {
      const chunk = need.slice(i, i + 100);
      const { data } = await db.storage.from(bucket).createSignedUrls(chunk, 3600);
      (data || []).forEach(r => { if (r.signedUrl) urlCache.set(bucket + r.path, r.signedUrl); });
    }
  }
  const imageUrl = (path, bucket = 'marketplace-images') => path ? urlCache.get(bucket + path) || '' : '';
  // Resize photos in the browser so uploads are fast on mobile data.
  function shrinkImage(file, maxSide = 1200, square = false) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve(null);
      if (!/^image\//.test(file.type)) return reject(new Error('Please choose an image file.'));
      if (file.size > 15 * 1024 * 1024) return reject(new Error('That image is too large (max 15 MB).'));
      const img = new Image(), url = URL.createObjectURL(file);
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not open that image.')); };
      img.onload = () => {
        const side = Math.min(img.width, img.height);                       // square = centre crop (profile pictures)
        const sw = square ? side : img.width, sh = square ? side : img.height, sx = (img.width - sw) / 2, sy = (img.height - sh) / 2;
        const scale = Math.min(1, maxSide / Math.max(sw, sh));
        const c = document.createElement('canvas'); c.width = Math.round(sw * scale); c.height = Math.round(sh * scale);
        c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob(b => b ? resolve(b) : reject(new Error('Could not process that image.')), 'image/jpeg', 0.82);
      };
      img.src = url;
    });
  }
  async function uploadShopImage(file, shopId, prefix = '', keepOriginal = false, { maxSide = 1200, square = false } = {}) {
    let blob = file, type = file.type, ext = { 'image/png': 'png', 'image/webp': 'webp' }[file.type] || 'jpg';
    if (keepOriginal) { if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Use a PNG, JPG or WebP image up to 5 MB.'); }
    else { blob = await shrinkImage(file, maxSide, square); type = 'image/jpeg'; ext = 'jpg'; }
    const path = `${shopId}/${prefix}${crypto.randomUUID()}.${ext}`;
    const up = await db.storage.from('marketplace-images').upload(path, blob, { contentType: type, upsert: false });
    if (up.error) throw new Error('Photo upload: ' + (up.error.message || 'failed'));
    return path;
  }

  // ---------------- market data (cached ~30s between pages) ----------------
  const CACHE = 'pkdpj-market-v2';
  async function loadMarket(fresh = false) {
    if (!fresh) {
      try {
        const c = JSON.parse(sessionStorage.getItem(CACHE) || 'null');
        if (c && c.user === state.user.id && Date.now() - c.at < 30000) { c.urls.forEach(([k, v]) => urlCache.set(k, v)); return hydrate(c.data); }
      } catch { /* ignore */ }
    }
    const SHOP_COLS = 'id,owner_id,name,unit_department,location,market_id,category,bio,theme,symbol,word,cover_image_path,payment_qr_path,whatsapp,status,created_at,products(id,shop_id,name,description,category,unit_price_rm,stock_qty,emoji,condition,image_path,active,sort_order,created_at)';
    const shopsQuery = async () => {
      // Works before and after 06-shop-pages.sql (the slug column) has been run.
      const r = await db.from('shops').select('slug,logo_image_path,' + SHOP_COLS).order('created_at', { ascending: false });
      return r.error && /slug|logo_image_path/.test(r.error.message || '') ? db.from('shops').select(SHOP_COLS).order('created_at', { ascending: false }) : r;
    };
    const [shopsRes, picksRes] = await Promise.all([
      shopsQuery(),
      db.from('daily_highlights').select('product_id,rank,sponsored').eq('feature_date', todayKL()).order('rank')
    ]);
    const data = { shops: check(shopsRes) || [], picks: picksRes.error ? [] : picksRes.data || [] };
    await signImages(data.shops.flatMap(s => [s.cover_image_path, s.logo_image_path, s.payment_qr_path, ...(s.products || []).map(p => p.image_path)]));
    try { sessionStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), user: state.user.id, data, urls: [...urlCache] })); } catch { /* full */ }
    return hydrate(data);
  }
  const clearMarketCache = () => { try { sessionStorage.removeItem(CACHE); } catch { /* ignore */ } };
  function hydrate(data) {
    const uid = state.user?.id;
    const shops = data.shops.filter(s => s.status === 'active' || s.owner_id === uid || state.admin).map(s => ({
      ...s, mine: s.owner_id === uid, open: s.status === 'active',
      cover: imageUrl(s.cover_image_path), logo: imageUrl(s.logo_image_path), qr: imageUrl(s.payment_qr_path),
      products: (s.products || []).filter(p => p.active || s.owner_id === uid)
        .sort((a, b) => (a.sort_order - b.sort_order) || String(b.created_at).localeCompare(String(a.created_at)))
        .map(p => ({ ...p, price: Number(p.unit_price_rm), stock: Number(p.stock_qty), photo: imageUrl(p.image_path), shop: null }))
    }));
    shops.forEach(s => s.products.forEach(p => { p.shop = s; }));
    const items = shops.flatMap(s => s.products);
    const m = {
      shops, items, picks: data.picks,
      shop: key => key ? shops.find(s => s.id === key || (s.slug && s.slug === String(key).toLowerCase())) : null, item: id => items.find(i => i.id === id),
      publicShops: shops.filter(s => s.open), publicItems: items.filter(i => i.shop.open && i.active),
      myShops: shops.filter(s => s.mine)
    };
    state.market = m;
    return m;
  }

  // ---------------- bag ----------------
  const bagKey = () => 'pkdpj-bag:' + (state.user?.id || 'anon');
  const bag = {
    read() { try { const v = JSON.parse(localStorage.getItem(bagKey()) || '[]'); return Array.isArray(v) ? v.filter(x => x && typeof x.id === 'string' && Number.isInteger(x.qty) && x.qty > 0) : []; } catch { return []; } },
    write(list) { try { localStorage.setItem(bagKey(), JSON.stringify(list)); } catch { /* ignore */ } updateBagBadges(); },
    count() { return bag.read().reduce((n, x) => n + x.qty, 0); },
    qty(id) { return bag.read().find(x => x.id === id)?.qty || 0; },
    set(id, qty) { const list = bag.read().filter(x => x.id !== id); if (qty > 0) list.push({ id, qty: Math.min(99, qty) }); bag.write(list); },
    add(item, qty = 1) {
      if (!item) return false;
      if (item.shop?.mine) { toast('This is your own shop — manage it in Sell.', 'error'); return false; }
      if (!item.shop?.open || !item.active) { toast('This item is not available right now.', 'error'); return false; }
      const next = bag.qty(item.id) + qty;
      if (item.stock <= 0) { toast(`${item.name} is sold out.`, 'error'); return false; }
      if (next > item.stock) { toast(`Only ${item.stock} of ${item.name} available.`, 'error'); return false; }
      bag.set(item.id, next);
      toast(`Added ${item.name} to your bag`);
      $$('.bag-badge').forEach(b => { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); });
      return true;
    },
    clear() { bag.write([]); }
  };
  function updateBagBadges() {
    const n = state.user ? bag.count() : 0;
    $$('.bag-badge').forEach(b => { b.textContent = String(n); b.hidden = !n; });
  }

  // ---------------- shared UI pieces ----------------
  function itemArt(i, cls = '') {
    return h('span', { class: 'art ' + cls, style: { '--tint': i.shop?.theme || '#ece6d8' } },
      i.photo ? h('img', { src: i.photo, alt: '', loading: 'lazy' }) : h('span', { class: 'art-emoji', 'aria-hidden': 'true', text: i.emoji || '🛍️' }));
  }
  function stockNote(i) {
    if (i.stock <= 0) return h('span', { class: 'stock out', text: 'Sold out' });
    if (i.stock <= 3) return h('span', { class: 'stock low', text: `Only ${i.stock} left` });
    if (i.category === 'Physical goods' && i.condition && i.condition !== 'New') return h('span', { class: 'stock', text: i.condition });
    return null;
  }
  function itemCard(i, { showShop = true } = {}) {
    const m = market(i.shop?.market_id);
    const canAdd = i.shop?.open && i.active && i.stock > 0 && !i.shop?.mine;
    return h('article', { class: 'item-card', style: { '--market': m.color } },
      h('a', { class: 'item-link', href: `/item?id=${i.id}`, 'aria-label': `${i.name}, ${money(i.price)}` },
        itemArt(i, 'item-art'),
        h('span', { class: 'item-body' },
          h('strong', { class: 'item-name', text: i.name }),
          showShop ? h('span', { class: 'item-shop' }, h('i', { class: 'dot' }), `${i.shop?.name || ''}`) : null,
          h('span', { class: 'item-foot' }, h('b', { class: 'price', text: money(i.price) }), stockNote(i)))),
      canAdd ? h('button', { class: 'add-btn', type: 'button', 'aria-label': `Add ${i.name} to bag`, onclick: e => { e.preventDefault(); bag.add(i); } }, icon('plus')) : null);
  }
  // Shop profile picture: uploaded logo, else the chosen symbol on the shop colour
  const shopLogo = (s, cls = 'shop-avatar') => h('span', { class: cls, style: { '--banner': s.theme || '#e5dfd1' }, 'aria-hidden': 'true' }, s.logo ? h('img', { src: s.logo, alt: '', loading: 'lazy' }) : (s.symbol || '✨'));
  const shopUrl = s => `/s/${encodeURIComponent(s.slug || s.id)}`;
  const shopLink = s => location.origin + shopUrl(s);
  function shopCard(s) {
    const m = market(s.market_id);
    const preview = s.products.filter(p => p.active).slice(0, 4);
    return h('a', { class: 'shop-card', href: shopUrl(s), style: { '--market': m.color, '--banner': s.theme || '#e5dfd1' } },
      h('span', { class: 'shop-banner' },
        s.cover ? h('img', { src: s.cover, alt: '', loading: 'lazy' }) : [h('span', { class: 'banner-word', text: s.word || 'made with care' }), h('span', { class: 'banner-symbol', 'aria-hidden': 'true', text: s.symbol || '✨' })],
        h('span', { class: 'market-tag' }, h('i', { class: 'dot' }), m.short),
        !s.open ? h('span', { class: 'status-tag', text: (SHOP_STATUS[s.status] || [s.status])[0] }) : null),
      h('span', { class: 'shop-body' },
        s.logo ? shopLogo(s) : null,
        h('strong', { class: 'shop-name', text: s.name }),
        h('span', { class: 'shop-meta', text: `${s.unit_department} · ${s.location}` }),
        preview.length ? h('span', { class: 'shop-preview' }, preview.map(p => itemArt(p, 'mini')), h('span', { class: 'shop-count', text: `${s.products.filter(p => p.active).length} item${s.products.filter(p => p.active).length === 1 ? '' : 's'}` }))
          : h('span', { class: 'shop-count', text: 'No items yet' })));
  }
  const empty = (ic, title, text, ...actions) => h('div', { class: 'empty' }, h('span', { class: 'empty-ico' }, icon(ic)), h('h3', { text: title }), text ? h('p', { class: 'muted', text }) : null, actions.length ? h('div', { class: 'action-row' }, actions) : null);

  // QR payment + receipt upload for one order (used by Bag and My orders).
  function receiptBox(o, shop, onDone) {
    const file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp' });
    const ref = h('input', { maxlength: '120', placeholder: 'Optional' });
    const btn = h('button', { class: 'btn btn-primary btn-block', type: 'button' }, 'Submit receipt');
    const box = h('div', { class: 'qr-pay' },
      h('strong', { text: `Pay ${money(o.total_rm)} to ${shop.name}` }),
      shop.qr ? h('img', { src: shop.qr, alt: `${shop.name} payment QR` }) : h('p', { class: 'muted', text: 'QR image could not be loaded — ask the seller.' }),
      shop.qr ? h('a', { class: 'btn btn-ghost btn-sm', href: shop.qr, target: '_blank', rel: 'noopener', download: '' }, 'Open / save QR') : null,
      h('div', {}, h('label', { text: 'Receipt screenshot' }), file, h('small', { class: 'hint', text: 'JPG, PNG or WebP, up to 5 MB.' })),
      h('div', {}, h('label', { text: 'Reference number' }), ref),
      btn);
    btn.addEventListener('click', () => run(async () => {
      const f = file.files[0];
      if (!f) throw new Error('Choose your receipt screenshot first.');
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type) || f.size > 5 * 1024 * 1024) throw new Error('Use a JPG, PNG or WebP image up to 5 MB.');
      const ext = { 'image/png': 'png', 'image/webp': 'webp' }[f.type] || 'jpg';
      const path = `${state.user.id}/${o.id}/${crypto.randomUUID()}.${ext}`;
      check(await db.storage.from('marketplace-receipts').upload(path, f, { contentType: f.type, upsert: false }));
      check(await db.rpc('attach_marketplace_receipt', { p_order_id: o.id, p_receipt_path: path, p_reference: ref.value.trim() }));
      fill(box, h('div', { class: 'notice notice-ok', style: { margin: 0 }, text: 'Receipt sent. The seller will confirm once they have checked their account.' }));
      toast('Receipt submitted'); onDone && onDone();
    }, btn));
    return box;
  }

  // ---------------- chrome ----------------
  const page = () => document.body.dataset.page || '';
  function navLinks() {
    const L = [['/', 'Home', 'home'], ['/market', 'Market', 'market']];
    if (state.user) L.push(['/orders', 'My orders', 'orders'], ['/sell', state.seller ? 'Sell' : 'Start selling', 'sell']);
    if (state.admin) L.push(['/admin', 'Admin', 'admin']);
    return L.map(([href, label, key]) => h('a', { href, class: 'nav-link', 'aria-current': page() === key ? 'page' : null }, label));
  }
  function renderHeader() {
    const host = $('#site-header'); if (!host) return;
    const brand = h('a', { class: 'brand', href: '/', 'aria-label': BRAND + ' home' }, h('span', { class: 'brand-mark', text: SHORT }), h('span', { class: 'brand-name' }, h('b', { text: 'Market' }), h('small', { text: cfg.tagline || '' })));
    const right = h('div', { class: 'header-actions' });
    if (state.user) {
      right.append(
        h('a', { class: 'bag-btn', href: '/bag', 'aria-label': 'Your bag', 'aria-current': page() === 'bag' ? 'page' : null }, icon('bag'), h('span', { class: 'hide-sm', text: 'Bag' }), h('b', { class: 'bag-badge', hidden: true, text: '0' })),
        h('a', { class: 'avatar', href: '/account', 'aria-label': 'My account', title: displayName(), text: initials() }));
    } else {
      right.append(h('a', { class: 'btn btn-ghost btn-sm hide-sm', href: '/account' }, 'Log in'), h('a', { class: 'btn btn-primary btn-sm', href: '/account?mode=register' }, 'Join'));
    }
    host.replaceChildren(h('header', { class: 'site-header' }, h('div', { class: 'wrap header-inner' }, brand, h('nav', { class: 'nav', 'aria-label': 'Main' }, navLinks()), right)));
    renderTabbar(); updateBagBadges();
    const hd = $('.site-header'); const onScroll = () => hd.classList.toggle('scrolled', scrollY > 6);
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }
  function renderTabbar() {
    let bar = $('#tabbar');
    if (!state.user) { bar && bar.remove(); return; }
    if (!bar) { bar = h('nav', { id: 'tabbar', class: 'tabbar', 'aria-label': 'Quick navigation' }); document.body.append(bar); }
    const p = page();
    const tab = (href, label, ic, key) => h('a', { href, 'aria-current': p === key ? 'page' : null }, icon(ic), h('span', { text: label }));
    fill(bar,
      tab('/', 'Home', 'home', 'home'),
      tab('/market', 'Market', 'store', 'market'),
      h('a', { href: '/bag', class: 'tab-bag', 'aria-current': p === 'bag' ? 'page' : null }, h('span', { class: 'bubble' }, icon('bag'), h('b', { class: 'bag-badge', hidden: true, text: '0' })), h('span', { text: 'Bag' })),
      tab('/orders', 'Orders', 'receipt', 'orders'),
      state.seller ? tab('/sell', 'Sell', 'sell', 'sell') : tab('/account', 'Me', 'user', 'account'));
  }
  function renderFooter() {
    const host = $('#site-footer'); if (!host) return;
    const help = cfg.supportWhatsapp ? waLink(cfg.supportWhatsapp, `Hi, I need help with ${BRAND}.`) : null;
    fill(host, h('footer', { class: 'site-footer' }, h('div', { class: 'wrap footer-inner' },
      h('div', {}, h('a', { class: 'brand', href: '/' }, h('span', { class: 'brand-mark', text: SHORT }), h('span', { class: 'brand-name' }, h('b', { text: 'Market' }), h('small', { text: cfg.tagline || '' }))),
        h('p', { class: 'muted', text: 'A marketplace for the units and departments of PKD Putrajaya and Klinik Kesihatan Presint 9, 11, 14 & 18.' })),
      h('div', { class: 'footer-links' }, h('a', { href: '/market', text: 'Browse the market' }), h('a', { href: '/sell', text: 'Sell with us' }), h('a', { href: '/orders', text: 'My orders' }), help ? h('a', { href: help, target: '_blank', rel: 'noopener', text: 'Get help on WhatsApp' }) : null),
      h('p', { class: 'fine', text: 'Pay each shop directly — cash or QR. QR receipts are checked by the seller. Please do not share patient information here.' }))));
  }

  // Reveal on scroll + prefetch on hover
  let ro;
  function reveal(root = document) {
    const els = $$('.reveal:not(.in)', root);
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) { els.forEach(e => e.classList.add('in')); return; }
    ro = ro || new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); ro.unobserve(en.target); } }), { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    els.forEach(e => ro.observe(e));
  }
  const pre = new Set();
  document.addEventListener('pointerover', e => {
    const a = e.target.closest && e.target.closest('a[href^="/"]'); if (!a) return;
    const u = a.getAttribute('href').split('?')[0].split('#')[0];
    if (!u || pre.has(u) || u === location.pathname) return; pre.add(u);
    document.head.append(h('link', { rel: 'prefetch', href: u }));
  }, { passive: true });

  // ---------------- boot ----------------
  function start(pageFn, opts = {}) {
    const go = async () => {
      renderHeader(); renderFooter(); reveal();
      if (!configured) {
        fill($('#main'), h('section', { class: 'wrap page-pad' }, h('div', { class: 'notice notice-warn' }, h('strong', { text: 'Setup needed. ' }), 'Add your Supabase URL and publishable key in config.js. See README.md.')));
        document.body.classList.add('ready'); return;
      }
      if (!window.supabase) { toast('Could not load. Check your internet and refresh.', 'error', 10000); return; }
      db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
      api.db = db;
      loading(true);
      try {
        await initAuth();
        renderHeader();
        if (state.user && !String(state.profile?.phone || '').trim() && !opts.noPhoneGate) { loading(false); await phoneGate(); loading(true); renderHeader(); }
        if (opts.auth && !state.user) { location.replace('/account?next=' + encodeURIComponent(location.pathname + location.search)); return; }
        if (opts.admin && !state.admin) { fill($('#main'), h('section', { class: 'wrap page-pad' }, empty('shield', 'Admins only', 'This account does not have admin access.', h('a', { class: 'btn btn-primary', href: '/' }, 'Back to home')))); return; }
        if (opts.market && state.user) await loadMarket(opts.fresh);
        await pageFn(state);
        reveal();
      } catch (e) { console.error(e); toast(friendly(e), 'error', 8000); }
      finally { loading(false); document.body.classList.add('ready'); updateBagBadges(); }
      db.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT' && state.user && !api.signingOut) location.href = '/'; });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  }
  async function signOut() {
    api.signingOut = true; clearMarketCache();
    await db.auth.signOut(); location.href = '/';
  }

  const api = {
    cfg, BRAND, SHORT, TZ, state, db, MARKETS, market, CATEGORIES, CATEGORY_LABEL, CONDITIONS, EMOJIS, SYMBOLS, THEMES, STATUS, PAY, SHOP_STATUS, PHONE,
    $, $$, h, fill, icon, money, todayKL, when, dateOnly, shortId, badge, waNumber, waLink,
    toast, friendly, loading, run, check, modal, confirmBox,
    signImages, imageUrl, shrinkImage, uploadShopImage, loadMarket, clearMarketCache,
    bag, updateBagBadges, itemArt, itemCard, shopCard, shopUrl, shopLink, shopLogo, stockNote, empty, receiptBox,
    displayName, renderHeader, reveal, start, signOut, realName
  };
  window.M = api;
})();
