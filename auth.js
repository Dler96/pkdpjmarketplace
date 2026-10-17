(function () {
  const $ = (selector) => document.querySelector(selector);
  const form = $('#authForm');
  const message = $('#authMessage');
  const submit = $('#authSubmit');
  const registerFields = $('#authRegisterFields');
  const departmentField = $('#departmentField');
  const accountType = form.elements.accountType;
  let mode = 'signin';
  let client = null;

  function showMessage(text, success = false) {
    message.textContent = text;
    message.classList.toggle('success', success);
  }

  function setMode(nextMode) {
    mode = nextMode;
    const signup = mode === 'signup';
    registerFields.hidden = !signup;
    form.elements.fullName.required = signup;
    $('#authHeading').textContent = signup ? 'Join the marketplace.' : 'Welcome back.';
    $('#authIntro').textContent = signup
      ? 'Create an account for the Klinik Kesihatan Presint 18 community.'
      : 'Sign in with your clinic marketplace account.';
    submit.innerHTML = `${signup ? 'Create account' : 'Sign in'} <span>→</span>`;
    form.elements.password.autocomplete = signup ? 'new-password' : 'current-password';
    document.querySelectorAll('[data-auth-mode]').forEach((tab) => {
      const active = tab.dataset.authMode === mode;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    updateAccountType();
    showMessage('');
  }

  function updateAccountType() {
    const seller = accountType.value === 'seller';
    departmentField.hidden = !seller || mode !== 'signup';
    form.elements.department.required = seller && mode === 'signup';
  }

  function setSession(session) {
    document.body.classList.toggle('authenticated', Boolean(session?.user));
    window.PRESINT18_USER = session?.user || null;
    const avatar = $('#profileOpen');
    if (session?.user) {
      const name = session.user.user_metadata?.full_name || session.user.email || 'User';
      avatar.textContent = name.trim().charAt(0).toUpperCase();
      avatar.setAttribute('aria-label', `Account for ${name}`);
    }
    window.dispatchEvent(new CustomEvent('p18:auth', { detail: { user: session?.user || null } }));
  }

  document.querySelectorAll('[data-auth-mode]').forEach((tab) => {
    tab.addEventListener('click', () => setMode(tab.dataset.authMode));
  });
  accountType.addEventListener('change', updateAccountType);

  const config = window.PRESINT18_CONFIG || {};
  const key = config.supabaseAnonKey || '';
  const hasKey = key && !key.includes('PASTE_YOUR_') && !key.includes('YOUR_');
  if (window.supabase?.createClient && config.supabaseUrl && hasKey) {
    client = window.supabase.createClient(config.supabaseUrl, key);
    window.PRESINT18_SUPABASE = client;
  } else {
    $('#authConfigWarning').hidden = false;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!client) {
      showMessage('Connect Supabase Auth first, then sign-in and registration will work.');
      $('#authConfigWarning').hidden = false;
      return;
    }
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const email = String(data.get('email')).trim();
    const password = String(data.get('password'));
    submit.disabled = true;
    showMessage(mode === 'signup' ? 'Creating your account…' : 'Signing you in…');
    try {
      if (mode === 'signup') {
        const redirect = ['http:', 'https:'].includes(location.protocol)
          ? `${location.origin}${location.pathname}`
          : undefined;
        const options = {
          data: {
            full_name: String(data.get('fullName')).trim(),
            account_type: data.get('accountType'),
            department: String(data.get('department') || '').trim()
          }
        };
        if (redirect) options.emailRedirectTo = redirect;
        const { data: result, error } = await client.auth.signUp({ email, password, options });
        if (error) throw error;
        if (result.session) {
          setSession(result.session);
        } else {
          setMode('signin');
          form.elements.email.value = email;
          showMessage('Account created. Check your email to confirm it, then sign in.', true);
        }
      } else {
        const { data: result, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setSession(result.session);
      }
    } catch (error) {
      showMessage(error.message || 'Could not complete that request. Please try again.');
    } finally {
      submit.disabled = false;
    }
  });

  if (client) {
    client.auth.onAuthStateChange((_event, session) => setSession(session));
    client.auth.getSession().then(({ data, error }) => {
      if (error) showMessage(error.message);
      setSession(data?.session || null);
    });
  }

  window.PRESINT18_SIGN_OUT = async function () {
    if (client) {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    }
    setSession(null);
    setMode('signin');
  };
  setMode('signin');
})();
