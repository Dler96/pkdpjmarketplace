/* Shared News & Events helpers (used by the home page and /news). */
(() => {
  'use strict';
  const M = window.M;
  const { h, icon } = M;
  const BUCKET = 'news-images';
  const COLS = 'id,author_id,author_name,category,title,summary,body,image_path,link_url,source_name,event_start,event_end,event_location,status,reject_reason,highlight,approved_at,created_at,updated_at';

  const CATS = {
    pkd:    { label: 'PKD news',    short: 'PKD',    emoji: '🏥', color: '#2f6b52', tint: 'linear-gradient(135deg,#d9eadf,#b9d7c4)' },
    event:  { label: 'Events',      short: 'Event',  emoji: '🎉', color: '#b97a3a', tint: 'linear-gradient(135deg,#f6e3c8,#ecc996)' },
    global: { label: 'Global news', short: 'Global', emoji: '🌏', color: '#4f7699', tint: 'linear-gradient(135deg,#dbe6f1,#b8cde2)' }
  };
  const STATUS = { pending: ['Waiting for approval', 'amber'], approved: ['Published', 'green'], rejected: ['Not approved', 'red'] };

  const TZ = M.TZ;
  const fmt = (ts, o) => new Date(ts).toLocaleString('en-MY', { timeZone: TZ, ...o });
  const ago = ts => {
    const s = (Date.now() - new Date(ts)) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`;
    return M.dateOnly(ts);
  };
  const eventWhen = p => {
    if (!p.event_start) return '';
    const sameDay = p.event_end && fmt(p.event_start, { dateStyle: 'medium' }) === fmt(p.event_end, { dateStyle: 'medium' });
    const a = fmt(p.event_start, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    if (!p.event_end) return a;
    return a + ' – ' + (sameDay ? fmt(p.event_end, { hour: 'numeric', minute: '2-digit' }) : fmt(p.event_end, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }));
  };
  const upcoming = p => p.category === 'event' && new Date(p.event_end || p.event_start) >= new Date();

  async function load({ status = 'approved', limit = 200, mine = false, id = null, category = null } = {}) {
    let q = M.db.from('news_posts').select(COLS).order('created_at', { ascending: false }).limit(limit);
    if (id) q = q.eq('id', id);
    if (category) q = q.eq('category', category);
    if (id) { /* single post: RLS decides who may see it */ }
    else if (mine) q = q.eq('author_id', M.state.user.id);
    else if (status) q = q.eq('status', status);
    const res = await q;
    if (res.error) throw res.error;
    const rows = res.data || [];
    await M.signImages(rows.map(r => r.image_path), BUCKET);
    rows.forEach(r => { r.img = M.imageUrl(r.image_path, BUCKET); r.cat = CATS[r.category] || CATS.pkd; });
    return rows;
  }

  // Missing table (08-news.sql not run yet) → quiet empty state instead of an error
  const notReady = e => /news_posts|relation .* does not exist|schema cache/i.test(String(e?.message || e));

  function art(p, cls = 'news-art') {
    return h('span', { class: cls, style: { background: p.cat.tint } },
      p.img ? h('img', { src: p.img, alt: '', loading: 'lazy' }) : h('span', { class: 'news-emoji', 'aria-hidden': 'true', text: p.cat.emoji }),
      p.category === 'event' && p.event_start ? dateChip(p.event_start) : null);
  }
  function dateChip(ts) {
    return h('span', { class: 'date-chip' }, h('b', { text: fmt(ts, { day: 'numeric' }) }), h('small', { text: fmt(ts, { month: 'short' }) }));
  }
  function catBadge(p) { return h('span', { class: 'news-cat', style: { '--c': p.cat.color } }, p.cat.short); }

  function card(p) {
    return h('a', { class: 'news-card', href: `/news?id=${p.id}` },
      art(p),
      h('span', { class: 'news-body' },
        h('span', { class: 'news-meta' }, catBadge(p), p.highlight ? h('span', { class: 'news-hl' }, icon('star'), 'Highlight') : null),
        h('strong', { class: 'news-title', text: p.title }),
        p.category === 'event' && p.event_start ? h('span', { class: 'news-when' }, icon('clock'), eventWhen(p)) : null,
        p.summary ? h('span', { class: 'news-sum', text: p.summary }) : null,
        h('small', { class: 'news-by' }, p.author_name || 'Member', M.roleTag(p.author_id, true), ` · ${ago(p.approved_at || p.created_at)}`)));
  }

  function slide(p) {
    return h('a', { class: 'hl-slide', href: `/news?id=${p.id}`, style: { background: p.cat.tint } },
      p.img ? h('img', { src: p.img, alt: '' }) : h('span', { class: 'hl-emoji', 'aria-hidden': 'true', text: p.cat.emoji }),
      h('span', { class: 'hl-copy' },
        h('span', { class: 'news-meta' }, catBadge(p), p.highlight ? h('span', { class: 'news-hl' }, icon('star'), 'Highlight') : null),
        h('strong', { text: p.title }),
        p.category === 'event' && p.event_start ? h('small', { text: eventWhen(p) + (p.event_location ? ' · ' + p.event_location : '') }) : p.summary ? h('small', { text: p.summary }) : null));
  }

  // Auto-advancing, swipeable highlight carousel
  function carousel(posts) {
    const track = h('div', { class: 'hl-track' }, posts.map(slide));
    const dots = h('div', { class: 'hl-dots' }, posts.map((_, i) => h('button', { type: 'button', 'aria-label': `Highlight ${i + 1}`, onclick: () => go(i) })));
    const wrap = h('div', { class: 'hl-carousel' }, track, posts.length > 1 ? dots : null);
    let i = 0, timer;
    const go = n => { i = (n + posts.length) % posts.length; track.scrollTo({ left: track.children[i].offsetLeft - track.offsetLeft, behavior: 'smooth' }); mark(); restart(); };
    const mark = () => [...dots.children].forEach((d, k) => d.setAttribute('aria-current', String(k === i)));
    const restart = () => { clearInterval(timer); if (posts.length > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) timer = setInterval(() => { if (!document.hidden && wrap.isConnected) go(i + 1); }, 6000); };
    track.addEventListener('scroll', () => { const w = track.clientWidth; if (w) { const n = Math.round(track.scrollLeft / (track.children[0]?.offsetWidth || w)); if (n !== i) { i = Math.min(n, posts.length - 1); mark(); } } }, { passive: true });
    track.addEventListener('pointerdown', restart, { passive: true });
    mark(); restart();
    return wrap;
  }

  function eventRow(p) {
    return h('a', { class: 'event-row', href: `/news?id=${p.id}` }, dateChip(p.event_start),
      h('span', {}, h('strong', { text: p.title }), h('small', { text: [fmt(p.event_start, { weekday: 'short', hour: 'numeric', minute: '2-digit' }), p.event_location].filter(Boolean).join(' · ') })),
      icon('arrow'));
  }

  // .ics file so people can add an event to their phone calendar
  function ics(p) {
    const z = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const esc = t => String(t || '').replace(/[\\,;]/g, m => '\\' + m).replace(/\n/g, '\\n');
    const end = p.event_end || new Date(new Date(p.event_start).getTime() + 3600e3).toISOString();
    const text = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PKDPJ Market//News//EN', 'BEGIN:VEVENT', `UID:${p.id}@pkdpj`, `DTSTAMP:${z(new Date())}`,
      `DTSTART:${z(p.event_start)}`, `DTEND:${z(end)}`, `SUMMARY:${esc(p.title)}`, `LOCATION:${esc(p.event_location)}`, `DESCRIPTION:${esc(p.summary || p.body)}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'text/calendar' })), download: 'event.ics' });
    document.body.append(a); a.click(); a.remove();
  }

  M.news = { CATS, STATUS, BUCKET, load, notReady, card, carousel, eventRow, eventWhen, upcoming, ago, art, catBadge, ics, fmt };
})();
