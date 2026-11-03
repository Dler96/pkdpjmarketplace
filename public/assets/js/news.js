/* /news — PKD news, events and global news. Anyone can write; admins approve. */
(() => {
  'use strict';
  const M = window.M;
  const { $, h, fill, icon, check, run, toast, modal, confirmBox, badge } = M;
  let s, root, N;

  const TABS = [['all', 'All', 'home'], ['pkd', 'PKD news', 'shield'], ['event', 'Events', 'clock'], ['global', 'Global', 'pin'], ['mine', 'My posts', 'user']];
  const tab = () => { const t = location.hash.slice(1); return [...TABS.map(x => x[0]), 'review'].includes(t) ? t : 'all'; };

  M.start(async st => {
    s = st; N = M.news; root = $('#news-root');
    addEventListener('hashchange', () => run(render));
    addEventListener('popstate', () => run(render));
    await render();
  }, { auth: true });

  async function render() {
    const id = new URLSearchParams(location.search).get('id');
    try {
      if (id) return await article(id);
      await feed();
    } catch (e) {
      if (!N.notReady(e)) throw e;
      fill(root, h('section', { class: 'wrap page-pad' }, M.empty('receipt', 'News is almost ready', s.admin ? 'Run 08-news.sql in the Supabase SQL Editor to switch on News & Events.' : 'The admin is still setting this up. Check back soon.')));
    }
  }

  // ---------------- feed ----------------
  async function feed() {
    const t = tab();
    const [posts, mine, pending] = await Promise.all([
      N.load(),
      t === 'mine' ? N.load({ mine: true }) : Promise.resolve([]),
      s.admin ? N.load({ status: 'pending' }) : Promise.resolve([])
    ]);
    const highlights = posts.filter(p => p.highlight).slice(0, 6);
    const events = posts.filter(N.upcoming).sort((a, b) => new Date(a.event_start) - new Date(b.event_start));

    const tabs = h('nav', { class: 'sub-nav', 'aria-label': 'News sections' },
      TABS.map(([k, l, ic]) => h('a', { href: '#' + k, 'aria-current': t === k ? 'page' : null }, icon(ic), l)),
      s.admin ? h('a', { href: '#review', 'aria-current': t === 'review' ? 'page' : null }, icon('shield'), 'Review', pending.length ? h('span', { class: 'count', text: String(pending.length) }) : null) : null);

    let content;
    if (t === 'review') content = review(pending);
    else if (t === 'mine') content = myPosts(mine);
    else {
      const list = t === 'all' ? posts : posts.filter(p => p.category === t);
      const shown = t === 'event' ? [...list.filter(N.upcoming).sort((a, b) => new Date(a.event_start) - new Date(b.event_start)), ...list.filter(p => !N.upcoming(p))] : list;
      content = h('div', {},
        t === 'all' && events.length ? h('section', { class: 'section', style: { paddingTop: '6px' } },
          h('div', { class: 'section-head' }, h('div', {}, h('span', { class: 'eyebrow', text: 'Coming up' }), h('h2', {}, 'Upcoming ', h('em', { text: 'events' }))), h('a', { href: '#event', text: 'All events →' })),
          h('div', { class: 'event-list stagger' }, events.slice(0, 4).map(N.eventRow))) : null,
        h('section', { class: 'section', style: { paddingTop: t === 'all' && events.length ? '6px' : '0' } },
          t === 'all' ? h('div', { class: 'section-head' }, h('div', {}, h('span', { class: 'eyebrow', text: 'Latest' }), h('h2', {}, 'Fresh ', h('em', { text: 'stories' })))) : null,
          shown.length ? h('div', { class: 'news-grid stagger' }, shown.map(N.card))
            : M.empty('receipt', 'Nothing here yet', 'Be the first to share something with everyone.', writeBtn())));
    }

    fill(root, h('section', { class: 'wrap page-pad' },
      h('div', { class: 'news-head reveal' },
        h('div', {}, h('span', { class: 'eyebrow', text: 'PKDPJ community' }), h('h1', {}, 'News & ', h('em', { text: 'events' })),
          h('p', { class: 'muted', style: { margin: 0 }, text: 'What is happening at PKD Putrajaya, the clinics and around the world.' })),
        writeBtn()),
      highlights.length && !['mine', 'review'].includes(t) ? N.carousel(highlights) : null,
      tabs, content));
  }

  const writeBtn = () => h('button', { class: 'btn btn-primary', type: 'button', onclick: () => editor(null) }, icon('edit'), 'Write a post');

  function myPosts(list) {
    if (!list.length) return M.empty('edit', 'You have not posted yet', 'Share PKD news, an event or something from around the world. An admin checks it before it goes live.', writeBtn());
    return h('div', { class: 'card', style: { padding: 0, overflow: 'hidden' } }, list.map(p => h('div', { class: 'list-row news-row' },
      N.art(p, 'news-thumb'),
      h('div', {}, h('strong', { text: p.title }),
        h('small', {}, N.catBadge(p), ' ', badge(N.STATUS, p.status), ' · ', N.ago(p.created_at)),
        p.status === 'rejected' && p.reject_reason ? h('small', { class: 'reject-note', text: 'Admin note: ' + p.reject_reason }) : null),
      h('div', { class: 'row-tools' },
        p.status === 'approved' ? h('a', { class: 'icon-btn', href: `/news?id=${p.id}`, 'aria-label': 'Open' }, icon('arrow')) : null,
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Edit', onclick: () => editor(p) }, icon('edit')),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Delete', onclick: () => remove(p) }, icon('trash'))))));
  }

  // ---------------- admin review ----------------
  function review(list) {
    if (!list.length) return M.empty('check', 'All caught up', 'No posts are waiting for approval.');
    return h('div', { class: 'review-list' }, list.map(p => {
      const hl = h('input', { type: 'checkbox' });
      return h('article', { class: 'card review-card' },
        h('div', { class: 'review-top' }, N.art(p, 'news-thumb'),
          h('div', {}, h('span', { class: 'news-meta' }, N.catBadge(p), h('small', { class: 'muted', text: `by ${p.author_name} · ${N.ago(p.created_at)}` })),
            h('h3', { style: { margin: '6px 0 4px' }, text: p.title }),
            p.category === 'event' ? h('p', { class: 'small', style: { margin: 0 } }, icon('clock'), ' ', N.eventWhen(p), p.event_location ? ' · ' + p.event_location : '') : null)),
        p.summary ? h('p', { class: 'muted', text: p.summary }) : null,
        p.body ? h('details', {}, h('summary', { text: 'Read full post' }), h('p', { class: 'pre', text: p.body })) : null,
        p.link_url ? h('p', { class: 'small' }, 'Source: ', h('a', { href: p.link_url, target: '_blank', rel: 'noopener noreferrer', text: p.source_name || p.link_url })) : null,
        h('label', { class: 'check' }, hl, 'Also show as a Highlight'),
        h('div', { class: 'row-end' },
          h('button', { class: 'btn btn-danger btn-sm', type: 'button', onclick: () => reject(p) }, icon('x'), 'Reject'),
          h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => editor(p) }, icon('edit'), 'Edit'),
          h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: e => run(async () => {
            check(await M.db.from('news_posts').update({ status: 'approved', highlight: hl.checked }).eq('id', p.id));
            toast('Published.'); await render();
          }, e.currentTarget) }, icon('check'), 'Approve')));
    }));
  }

  function reject(p) {
    const why = h('textarea', { rows: '3', maxlength: '300', placeholder: 'e.g. Please add the event time and place.' });
    const form = h('form', {}, h('div', { class: 'field' }, h('label', { text: 'Note to the writer (optional)' }), why),
      h('div', { class: 'row-end' }, h('button', { class: 'btn btn-danger', type: 'submit' }, 'Reject post')));
    const m = modal('Reject this post?', form, { eyebrow: p.title });
    form.addEventListener('submit', e => { e.preventDefault(); run(async () => {
      check(await M.db.from('news_posts').update({ status: 'rejected', reject_reason: why.value.trim() || null }).eq('id', p.id));
      m.close(); toast('Post rejected.'); await render();
    }, form); });
  }

  async function remove(p) {
    if (!(await confirmBox('Delete this post?', `"${p.title}" will be removed for everyone.`, 'Delete', true))) return;
    await run(async () => {
      check(await M.db.from('news_posts').delete().eq('id', p.id));
      if (p.image_path) await M.db.storage.from(N.BUCKET).remove([p.image_path]);
      toast('Post deleted.');
      if (new URLSearchParams(location.search).get('id')) { history.pushState(null, '', '/news'); }
      await render();
    });
  }

  // ---------------- article ----------------
  async function article(id) {
    const [p] = await N.load({ id, limit: 1 });
    if (!p) return fill(root, h('section', { class: 'wrap page-pad' }, M.empty('receipt', 'Post not found', 'It may have been removed or is still waiting for approval.', h('a', { class: 'btn btn-primary', href: '/news' }, 'Back to news'))));
    document.title = `${p.title} · ${M.BRAND}`;
    const canEdit = p.author_id === s.user.id || s.admin;
    const more = (await N.load({ category: p.category, limit: 4 })).filter(x => x.id !== p.id).slice(0, 3);
    const share = async () => {
      const url = location.origin + `/news?id=${p.id}`;
      if (navigator.share) return navigator.share({ title: p.title, url }).catch(() => {});
      try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { toast(url); }
    };
    fill(root, h('article', { class: 'wrap page-pad news-article' },
      h('a', { class: 'back-link', href: '/news' }, icon('back'), 'All news'),
      p.status !== 'approved' ? h('div', { class: 'notice notice-warn' }, h('b', { text: N.STATUS[p.status][0] + '. ' }), p.status === 'rejected' && p.reject_reason ? 'Admin note: ' + p.reject_reason : 'Only you and the admins can see this post for now.') : null,
      h('div', { class: 'article-hero reveal', style: { background: p.cat.tint } }, p.img ? h('img', { src: p.img, alt: '' }) : h('span', { class: 'hl-emoji', text: p.cat.emoji })),
      h('div', { class: 'article-body reveal d1' },
        h('span', { class: 'news-meta' }, N.catBadge(p), p.highlight ? h('span', { class: 'news-hl' }, icon('star'), 'Highlight') : null),
        h('h1', { text: p.title }),
        h('p', { class: 'muted small', text: `By ${p.author_name || 'Member'} · ${M.dateOnly(p.approved_at || p.created_at)}` }),
        p.category === 'event' && p.event_start ? h('div', { class: 'event-box' },
          h('div', {}, icon('clock'), h('span', { text: N.eventWhen(p) })),
          p.event_location ? h('div', {}, icon('pin'), h('span', { text: p.event_location })) : null,
          h('button', { class: 'btn btn-soft btn-sm', type: 'button', onclick: () => N.ics(p) }, icon('plus'), 'Add to my calendar')) : null,
        p.summary ? h('p', { class: 'article-lead', text: p.summary }) : null,
        p.body ? h('div', { class: 'article-text pre', text: p.body }) : null,
        p.link_url ? h('p', {}, h('a', { class: 'btn btn-ghost btn-sm', href: p.link_url, target: '_blank', rel: 'noopener noreferrer' }, icon('link'), p.source_name ? `Read on ${p.source_name}` : 'Open source link')) : null,
        h('div', { class: 'action-row', style: { justifyContent: 'flex-start', marginTop: '18px' } },
          p.status === 'approved' ? h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: share }, icon('share'), 'Share') : null,
          canEdit ? h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => editor(p) }, icon('edit'), 'Edit') : null,
          canEdit ? h('button', { class: 'btn btn-danger btn-sm', type: 'button', onclick: () => remove(p) }, icon('trash'), 'Delete') : null,
          s.admin && p.status === 'approved' ? h('button', { class: 'btn btn-soft btn-sm', type: 'button', onclick: e => run(async () => {
            check(await M.db.from('news_posts').update({ highlight: !p.highlight }).eq('id', p.id)); toast(p.highlight ? 'Removed from highlights.' : 'Added to highlights.'); await render();
          }, e.currentTarget) }, icon('star'), p.highlight ? 'Remove highlight' : 'Make highlight') : null)),
      more.length ? h('section', { class: 'section' }, h('div', { class: 'section-head' }, h('h2', {}, 'More ', h('em', { text: p.cat.label.toLowerCase() }))),
        h('div', { class: 'news-grid stagger' }, more.map(N.card))) : null));
  }

  // ---------------- write / edit ----------------
  function editor(p) {
    const local = ts => ts ? new Date(new Date(ts).getTime() + 8 * 3600e3).toISOString().slice(0, 16) : '';   // Malaysia time for <input type=datetime-local>
    const toIso = v => v ? new Date(v + ':00+08:00').toISOString() : null;
    const cat = h('div', { class: 'seg cat-seg', role: 'radiogroup' }, Object.entries(N.CATS).map(([k, c]) =>
      h('label', {}, h('input', { type: 'radio', name: 'cat', value: k, checked: (p?.category || 'pkd') === k, onchange: sync }), h('span', {}, c.emoji + ' ' + c.short))));
    const title = h('input', { maxlength: '140', value: p?.title || '', placeholder: 'A clear, short headline' });
    const summary = h('textarea', { rows: '2', maxlength: '300', placeholder: 'One or two sentences shown on the card' }); summary.value = p?.summary || '';
    const body = h('textarea', { rows: '7', maxlength: '8000', placeholder: 'The full story or event details' }); body.value = p?.body || '';
    const img = h('input', { type: 'file', accept: 'image/*' });
    const link = h('input', { type: 'url', inputmode: 'url', value: p?.link_url || '', placeholder: 'https://…' });
    const source = h('input', { maxlength: '80', value: p?.source_name || '', placeholder: 'e.g. Berita Harian, KKM, BBC' });
    const start = h('input', { type: 'datetime-local', value: local(p?.event_start) });
    const end = h('input', { type: 'datetime-local', value: local(p?.event_end) });
    const where = h('input', { maxlength: '160', value: p?.event_location || '', placeholder: 'e.g. Dewan Utama PKD Putrajaya' });
    let removeImg = false;
    const eventBox = h('div', { class: 'event-fields' },
      h('div', { class: 'form-grid' }, h('div', { class: 'field' }, h('label', { text: 'Starts' }), start), h('div', { class: 'field' }, h('label', { text: 'Ends (optional)' }), end)),
      h('div', { class: 'field' }, h('label', { text: 'Where' }), where));
    const sourceBox = h('div', { class: 'form-grid' },
      h('div', { class: 'field' }, h('label', { text: 'Link (optional)' }), link),
      h('div', { class: 'field' }, h('label', { text: 'Source name (optional)' }), source));
    function sync() {
      const c = form?.elements?.cat?.value || p?.category || 'pkd';
      eventBox.hidden = c !== 'event';
      sourceBox.querySelector('small')?.remove();
      if (c === 'global') sourceBox.firstChild.append(h('small', { text: 'Please link to where you read it.' }));
    }
    const form = h('form', { novalidate: true },
      h('span', { class: 'label', text: 'What kind of post?' }), cat,
      h('div', { class: 'field', style: { marginTop: '14px' } }, h('label', { text: 'Headline' }), title),
      eventBox,
      h('div', { class: 'field' }, h('label', { text: 'Short summary' }), summary),
      h('div', { class: 'field' }, h('label', { text: 'Full story (optional)' }), body),
      h('div', { class: 'field' }, h('label', { text: p?.image_path ? 'Replace photo' : 'Photo (optional)' }), img, h('small', { text: 'Landscape photos look best. No patient information or faces without permission, please.' }),
        p?.image_path ? h('label', { class: 'check', style: { marginTop: '8px' } }, h('input', { type: 'checkbox', onchange: e => { removeImg = e.target.checked; } }), 'Remove current photo') : null),
      sourceBox,
      !s.admin ? h('div', { class: 'notice notice-info', text: p ? 'Saving changes sends the post back to an admin for approval.' : 'An admin checks every post before it goes live.' }) : null,
      h('div', { class: 'row-end' }, h('button', { class: 'btn btn-primary', type: 'submit' }, s.admin ? (p ? 'Save' : 'Publish') : 'Send for approval')));
    const m = modal(p ? 'Edit post' : 'Write a post', form, { wide: true, eyebrow: 'News & events' });
    sync();
    form.addEventListener('submit', e => { e.preventDefault(); run(async () => {
      const c = form.elements.cat.value;
      const row = { category: c, title: title.value.trim(), summary: summary.value.trim(), body: body.value.trim(),
        link_url: link.value.trim() || null, source_name: source.value.trim(),
        event_start: c === 'event' ? toIso(start.value) : null, event_end: c === 'event' ? toIso(end.value) : null, event_location: c === 'event' ? where.value.trim() : '' };
      if (row.title.length < 4) { title.focus(); throw new Error('Write a headline (at least 4 characters).'); }
      if (!row.summary && !row.body) { summary.focus(); throw new Error('Add a short summary or the full story.'); }
      if (c === 'event' && !row.event_start) { start.focus(); throw new Error('When does the event start?'); }
      if (row.event_end && row.event_end < row.event_start) { end.focus(); throw new Error('The end time is before the start time.'); }
      if (row.link_url && !/^https?:\/\//i.test(row.link_url)) { link.focus(); throw new Error('Links must start with https://'); }
      if (img.files[0]) {
        const blob = await M.shrinkImage(img.files[0], 1600);
        const path = `${s.user.id}/${crypto.randomUUID()}.jpg`;
        const up = await M.db.storage.from(N.BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
        if (up.error) throw new Error('Photo upload: ' + up.error.message);
        row.image_path = path;
      } else if (removeImg) row.image_path = null;
      if (s.admin && !p) row.status = 'approved';
      if (p) check(await M.db.from('news_posts').update(row).eq('id', p.id));
      else check(await M.db.from('news_posts').insert(row));
      m.close();
      toast(s.admin ? 'Saved.' : 'Thanks! An admin will review your post soon.');
      if (!s.admin && !p) location.hash = '#mine'; else await render();
    }, form); });
  }
})();
