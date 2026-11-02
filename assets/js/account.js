(() => {
  'use strict';
  const M = window.M;
  const { $, h, fill, icon, check, run, toast } = M;
  const params = new URLSearchParams(location.search);
  const nextUrl = () => { const n = params.get('next'); return n && n.startsWith('/') && !n.startsWith('//') ? n : '/'; };
  const pwOk = v => v.length >= 8;

  M.start(async s => {
    if (s.user) return profile(s);
    auth(params.get('mode') === 'register' ? 'register' : 'login');
  });

  function pw(id, auto, ph) {
    const input = h('input', { id, type: 'password', autocomplete: auto, placeholder: ph, required: true, minlength: '8' });
    const t = h('button', { type: 'button', 'aria-label': 'Show password', onclick: () => { const show = input.type === 'password'; input.type = show ? 'text' : 'password'; t.textContent = show ? 'Hide' : 'Show'; } }, 'Show');
    return { input, el: h('div', { class: 'pw-wrap' }, input, t) };
  }

  function auth(mode) {
    const box = h('div', { class: 'auth-box' });
    fill($('#account-root'), h('div', { class: 'auth' },
      h('div', { class: 'auth-visual' }, h('img', { src: '/assets/img/clinic-wide.webp', alt: '' }),
        h('div', {}, h('span', { class: 'eyebrow', style: { color: '#cfe6d7' }, text: M.cfg.tagline || '' }), h('h2', {}, 'Good things start ', h('em', { text: 'right here.' })),
          h('ul', {}, ['Shops from five clinics', 'Order from several shops at once', 'Pay cash or by QR', 'Run a shop for your unit'].map(t => h('li', {}, icon('check'), t))))),
      h('div', { class: 'auth-form' }, box)));
    const seg = h('div', { class: 'seg', role: 'tablist' },
      h('button', { type: 'button', role: 'tab', 'aria-selected': String(mode === 'login'), onclick: () => switchTo('login') }, 'Log in'),
      h('button', { type: 'button', role: 'tab', 'aria-selected': String(mode === 'register'), onclick: () => switchTo('register') }, 'Create account'));
    const switchTo = m => { const q = new URLSearchParams(location.search); m === 'register' ? q.set('mode', 'register') : q.delete('mode'); history.replaceState(null, '', '/account' + (q.toString() ? '?' + q : '')); auth(m); };
    if (mode === 'login') fill(box, h('h1', {}, 'Welcome ', h('em', { text: 'back' })), h('p', { class: 'muted', text: 'Log in with your market account.' }), seg, loginForm());
    else if (mode === 'register') fill(box, h('h1', {}, 'Join the ', h('em', { text: 'market' })), h('p', { class: 'muted', text: 'For staff of PKD Putrajaya and its clinics.' }), seg, registerForm());
    else fill(box, h('h1', {}, 'Reset ', h('em', { text: 'password' })), h('p', { class: 'muted', text: 'We will email you a link to choose a new password.' }), resetForm(), h('p', { style: { textAlign: 'center', marginTop: '16px' } }, h('button', { class: 'link-btn', type: 'button', onclick: () => auth('login') }, '← Back to log in')));
  }

  function loginForm() {
    const email = h('input', { id: 'email', type: 'email', autocomplete: 'email', inputmode: 'email', placeholder: 'name@example.com', required: true });
    const p = pw('pass', 'current-password', 'Your password');
    const form = h('form', { novalidate: true },
      h('div', { class: 'field' }, h('label', { for: 'email', text: 'Email' }), email),
      h('div', { class: 'field' }, h('label', { for: 'pass', text: 'Password' }), p.el),
      h('button', { class: 'btn btn-primary btn-lg btn-block', type: 'submit' }, 'Log in', icon('arrow')),
      h('p', { style: { textAlign: 'center', marginTop: '16px' } }, h('button', { class: 'link-btn', type: 'button', onclick: () => auth('reset') }, 'Forgot password?')));
    form.addEventListener('submit', e => { e.preventDefault(); run(async () => {
      if (!email.value.includes('@')) throw new Error('Enter your email address.');
      check(await M.db.auth.signInWithPassword({ email: email.value.trim(), password: p.input.value }));
      M.clearMarketCache(); location.href = nextUrl();
    }, form); });
    return form;
  }

  function registerForm() {
    const name = h('input', { id: 'name', autocomplete: 'name', maxlength: '100', required: true, placeholder: 'Your full name' });
    const email = h('input', { id: 'remail', type: 'email', autocomplete: 'email', inputmode: 'email', required: true, placeholder: 'name@example.com' });
    const phone = h('input', { id: 'phone', type: 'tel', autocomplete: 'tel', maxlength: '24', placeholder: '0123456789' });
    const p = pw('rpass', 'new-password', 'At least 8 characters');
    const sell = h('input', { type: 'checkbox' });
    const dept = h('input', { id: 'dept', maxlength: '120', placeholder: 'e.g. Unit Pemakanan, KK Presint 18' });
    const deptField = h('div', { class: 'field', hidden: true }, h('label', { for: 'dept', text: 'Your unit / department' }), dept);
    sell.addEventListener('change', () => { deptField.hidden = !sell.checked; });
    const form = h('form', { novalidate: true },
      h('div', { class: 'field' }, h('label', { for: 'name', text: 'Full name' }), name),
      h('div', { class: 'field' }, h('label', { for: 'remail', text: 'Email' }), email),
      h('div', { class: 'field' }, h('label', { for: 'phone', text: 'Phone / WhatsApp (optional)' }), phone, h('small', { text: 'Sellers use this to contact you about orders.' })),
      h('div', { class: 'field' }, h('label', { for: 'rpass', text: 'Password' }), p.el),
      h('label', { class: 'choice', style: { marginBottom: '14px' } }, sell, h('span', { class: 'tick' }, icon('check')),
        h('span', {}, h('strong', { text: 'I also want to sell' }), h('small', { text: 'Open a shop for your unit. You can also turn this on later.' }))),
      deptField,
      h('button', { class: 'btn btn-primary btn-lg btn-block', type: 'submit' }, 'Create account', icon('arrow')),
      h('p', { class: 'hint', style: { textAlign: 'center', marginTop: '12px' }, text: 'Please do not use this market for patient information.' }));
    form.addEventListener('submit', e => { e.preventDefault(); run(async () => {
      if (name.value.trim().length < 2) throw new Error('Enter your full name.');
      if (!email.value.includes('@')) throw new Error('Enter a valid email address.');
      if (phone.value.trim() && !M.PHONE.test(phone.value.trim())) throw new Error('Enter a valid phone number, or leave it empty.');
      if (!pwOk(p.input.value)) throw new Error('Password needs at least 8 characters.');
      if (sell.checked && dept.value.trim().length < 2) throw new Error('Enter your unit or department.');
      const res = check(await M.db.auth.signUp({ email: email.value.trim(), password: p.input.value, options: {
        emailRedirectTo: location.origin + '/account',
        data: { full_name: name.value.trim(), phone: phone.value.trim(), account_type: sell.checked ? 'seller' : 'buyer', department: dept.value.trim() } } }));
      if (res.user && res.user.identities && res.user.identities.length === 0) throw new Error('There is already an account with this email. Try logging in.');
      if (res.session) { toast('Welcome to the market!'); location.href = sell.checked ? '/sell' : nextUrl(); return; }
      fill(form, h('div', { class: 'notice notice-ok' }, h('strong', { text: 'Check your email. ' }), `We sent a confirmation link to ${email.value.trim()}. Open it on this phone, then log in.`),
        h('button', { class: 'btn btn-ghost btn-block', type: 'button', onclick: () => auth('login') }, 'Go to log in'));
    }, form); });
    return form;
  }

  function resetForm() {
    const email = h('input', { type: 'email', autocomplete: 'email', inputmode: 'email', placeholder: 'name@example.com', required: true });
    const form = h('form', { novalidate: true }, h('div', { class: 'field' }, h('label', { text: 'Email' }), email), h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Send reset link'));
    form.addEventListener('submit', e => { e.preventDefault(); run(async () => {
      if (!email.value.includes('@')) throw new Error('Enter your email address.');
      check(await M.db.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: location.origin + '/account?reset=1' }));
      fill(form, h('div', { class: 'notice notice-ok', text: 'If that email has an account, a reset link is on its way. Check your spam folder too.' }));
    }, form); });
    return form;
  }

  function profile(s) {
    const p = s.profile || {};
    const name = h('input', { maxlength: '100', value: p.full_name || '', required: true });
    const phone = h('input', { type: 'tel', maxlength: '24', value: p.phone || '', placeholder: '0123456789' });
    const dept = h('input', { maxlength: '120', value: p.department || '', placeholder: 'Your unit / department' });
    const form = h('form', { class: 'card' }, h('h2', { text: 'My details' }), h('p', { class: 'muted small', text: s.user.email }),
      h('div', { class: 'field' }, h('label', { text: 'Full name' }), name),
      h('div', { class: 'field' }, h('label', { text: 'Phone / WhatsApp' }), phone, h('small', { text: 'Filled in for you at checkout.' })),
      h('div', { class: 'field' }, h('label', { text: 'Unit / department' }), dept),
      h('button', { class: 'btn btn-primary', type: 'submit' }, 'Save details'));
    form.addEventListener('submit', e => { e.preventDefault(); run(async () => {
      if (name.value.trim().length < 2) throw new Error('Enter your full name.');
      if (phone.value.trim() && !M.PHONE.test(phone.value.trim())) throw new Error('Enter a valid phone number.');
      const upd = { full_name: name.value.trim(), phone: phone.value.trim(), department: dept.value.trim() };
      check(await M.db.from('profiles').update(upd).eq('id', s.user.id));
      s.profile = { ...p, ...upd }; M.renderHeader(); toast('Details saved.');
    }, form); });
    const npw = pw('npw', 'new-password', 'At least 8 characters');
    const pwForm = h('form', { class: 'card' }, h('h2', { text: params.get('reset') ? 'Choose a new password' : 'Change password' }),
      h('div', { class: 'field' }, h('label', { for: 'npw', text: 'New password' }), npw.el), h('button', { class: 'btn btn-ghost', type: 'submit' }, 'Update password'));
    pwForm.addEventListener('submit', e => { e.preventDefault(); run(async () => {
      if (!pwOk(npw.input.value)) throw new Error('Password needs at least 8 characters.');
      check(await M.db.auth.updateUser({ password: npw.input.value })); pwForm.reset(); toast('Password updated.');
    }, pwForm); });
    const links = [['/orders', 'receipt', 'My orders', 'Track orders and payments'], ['/sell', 'sell', s.seller ? 'My shop' : 'Start selling', s.seller ? 'Items, stock, orders and sales' : 'Open a shop for your unit'], ['/bag', 'bag', 'My bag', 'Items waiting for checkout']];
    if (s.admin) links.push(['/admin', 'shield', 'Admin control room', 'Approve shops, picks, orders, members']);
    fill($('#account-root'), h('section', { class: 'wrap page-pad', style: { maxWidth: '900px' } },
      h('div', { class: 'reveal' }, h('span', { class: 'eyebrow', text: 'My account' }), h('h1', { style: { fontSize: 'clamp(28px,7vw,44px)' } }, 'Hi, ', h('em', { text: (p.full_name || 'there').split(' ')[0] }))),
      h('div', { class: 'card', style: { padding: 0, overflow: 'hidden', marginBottom: '16px' } }, links.map(([href, ic, t, d]) =>
        h('a', { href, class: 'list-row', style: { gridTemplateColumns: '44px 1fr auto', color: 'var(--ink)' } }, h('span', { class: 'empty-ico', style: { width: '40px', height: '40px', margin: 0 } }, icon(ic)), h('div', {}, h('strong', { text: t }), h('small', { text: d })), icon('arrow')))),
      h('div', { class: 'two-col' }, form, pwForm),
      h('div', { class: 'card', style: { marginTop: '16px' } }, h('h2', { text: 'Use it like an app' }), h('p', { class: 'muted small', style: { margin: 0 }, text: 'On iPhone: tap Share → Add to Home Screen. On Android: tap ⋮ → Add to Home screen / Install app.' })),
      h('div', { class: 'row-end' }, h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => M.signOut() }, icon('logout'), 'Log out'))));
    if (params.get('reset')) pwForm.scrollIntoView({ behavior: 'smooth' });
  }
})();
