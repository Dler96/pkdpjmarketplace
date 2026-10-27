/* Sign-in, registration, password reset and the local "sample data" preview. */
(function () {
  const $ = (s) => document.querySelector(s);
  const form = $("#authForm");
  const message = $("#authMessage");
  const submit = $("#authSubmit");
  const DEMO_KEY = "p18-demo-mode";
  let mode = "signin"; // signin | signup | reset
  let client = null;

  const friendly = (error) => {
    const text = String(error?.message || error || "");
    if (/invalid login credentials/i.test(text)) return "That email and password don't match. Check for typos, or use “Forgot password?”.";
    if (/email not confirmed/i.test(text)) return "Please confirm your email first — look for the link in your inbox (and spam folder).";
    if (/already registered|already been registered/i.test(text)) return "There's already an account with this email. Try signing in instead.";
    if (/failed to fetch|network|load failed/i.test(text)) return "Couldn't reach the sign-in service. Check your internet connection and try again.";
    if (/rate limit|too many/i.test(text)) return "Too many attempts. Please wait a minute and try again.";
    if (/password should be|at least 8|weak/i.test(text)) return "Please choose a longer password (at least 8 characters).";
    return text || "Something went wrong. Please try again.";
  };

  function showMessage(text, success = false) {
    message.textContent = text;
    message.classList.toggle("success", success);
  }

  function setMode(next) {
    mode = next;
    const signup = mode === "signup";
    const reset = mode === "reset";
    $("#authRegisterFields").hidden = !signup;
    $("#passwordField").hidden = reset;
    $("#forgotRow").hidden = mode !== "signin";
    form.elements.password.required = !reset;
    form.elements.fullName.required = signup;
    $("#authHeading").textContent = signup ? "Join the marketplace" : reset ? "Reset your password" : "Welcome back";
    $("#authIntro").textContent = signup
      ? "Create an account for the Klinik Kesihatan Presint 18 community."
      : reset
        ? "Enter your email and we'll send you a link to choose a new password."
        : "Sign in with your marketplace account.";
    submit.textContent = signup ? "Create account" : reset ? "Send reset link" : "Sign in";
    form.elements.password.autocomplete = signup ? "new-password" : "current-password";
    document.querySelectorAll("[data-auth-mode]").forEach((tab) => {
      const active = tab.dataset.authMode === mode;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    updateAccountType();
    showMessage("");
  }

  function updateAccountType() {
    const seller = form.elements.accountType.value === "seller" && mode === "signup";
    $("#departmentField").hidden = !seller;
    form.elements.department.required = seller;
  }

  function setSession(session, { demo = false } = {}) {
    const user = session?.user || null;
    window.PRESINT18_DEMO = demo;
    window.PRESINT18_USER = user;
    document.body.classList.toggle("authenticated", Boolean(user));
    document.body.classList.toggle("demo", demo);
    $("#demoBanner").hidden = !demo;
    const avatar = $("#profileOpen");
    if (user) {
      const name = user.user_metadata?.full_name || user.email || "User";
      avatar.textContent = name.trim().charAt(0).toUpperCase();
      avatar.setAttribute("aria-label", `Your account (${name})`);
    }
    window.dispatchEvent(new CustomEvent("p18:auth", { detail: { user, demo } }));
  }

  function startDemo() {
    try { sessionStorage.setItem(DEMO_KEY, "1"); } catch {}
    setSession(
      { user: { id: "demo-user", email: "you@sample.preview", user_metadata: { full_name: "Sample visitor", account_type: "seller", department: "Demo unit" } } },
      { demo: true },
    );
    window.scrollTo(0, 0);
  }

  // ---- wire up the form ----
  document.querySelectorAll("[data-auth-mode]").forEach((tab) => tab.addEventListener("click", () => setMode(tab.dataset.authMode)));
  form.querySelectorAll("[name=accountType]").forEach((r) => r.addEventListener("change", updateAccountType));
  $("#forgotPassword").addEventListener("click", () => setMode("reset"));
  $("#togglePassword").addEventListener("click", (e) => {
    const input = form.elements.password;
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    e.currentTarget.textContent = show ? "Hide" : "Show";
    e.currentTarget.setAttribute("aria-label", show ? "Hide password" : "Show password");
  });
  $("#demoButton").addEventListener("click", startDemo);

  // ---- connect to Supabase ----
  const config = window.PRESINT18_CONFIG || {};
  const key = config.supabaseAnonKey || "";
  const hasKey = key && !/PASTE_|YOUR_/.test(key);
  const warning = $("#authConfigWarning");
  if (window.supabase?.createClient && config.supabaseUrl && hasKey) {
    client = window.supabase.createClient(config.supabaseUrl, key);
    window.PRESINT18_SUPABASE = client;
  } else {
    warning.hidden = false;
    warning.innerHTML = !window.supabase?.createClient
      ? "<b>Couldn't load the sign-in service.</b> You may be offline, or a browser extension is blocking <code>cdn.jsdelivr.net</code>. You can still look around with sample data."
      : "<b>Sign-in isn't set up yet.</b> Add the Supabase publishable key in <code>config.js</code>. Meanwhile you can look around with sample data.";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!client) {
      showMessage("Sign-in is unavailable right now — try the sample preview below.");
      return;
    }
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const email = String(data.get("email")).trim();
    const password = String(data.get("password") || "");
    const redirect = ["http:", "https:"].includes(location.protocol) ? `${location.origin}${location.pathname}` : undefined;
    submit.disabled = true;
    showMessage(mode === "signup" ? "Creating your account…" : mode === "reset" ? "Sending…" : "Signing you in…", true);
    try {
      if (mode === "reset") {
        const { error } = await client.auth.resetPasswordForEmail(email, redirect ? { redirectTo: redirect } : undefined);
        if (error) throw error;
        setMode("signin");
        form.elements.email.value = email;
        showMessage("If that email has an account, a reset link is on its way. Check your inbox.", true);
      } else if (mode === "signup") {
        const options = {
          data: {
            full_name: String(data.get("fullName")).trim(),
            account_type: data.get("accountType"),
            department: String(data.get("department") || "").trim(),
          },
        };
        if (redirect) options.emailRedirectTo = redirect;
        const { data: result, error } = await client.auth.signUp({ email, password, options });
        if (error) throw error;
        if (result.session) setSession(result.session);
        else {
          setMode("signin");
          form.elements.email.value = email;
          showMessage("Account created! Check your email for a confirmation link, then sign in here.", true);
        }
      } else {
        const { data: result, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setSession(result.session);
      }
    } catch (error) {
      showMessage(friendly(error));
    } finally {
      submit.disabled = false;
    }
  });

  window.PRESINT18_SIGN_OUT = async function () {
    const wasDemo = window.PRESINT18_DEMO;
    try { sessionStorage.removeItem(DEMO_KEY); } catch {}
    if (client && !wasDemo) {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    }
    setSession(null);
    setMode("signin");
  };
  $("#demoExit").addEventListener("click", () => window.PRESINT18_SIGN_OUT());

  setMode("signin");

  let demoResume = false;
  try { demoResume = sessionStorage.getItem(DEMO_KEY) === "1"; } catch {}
  if (demoResume) startDemo();

  if (client) {
    // Hide the sign-in form until we know whether there's a saved session (avoids a flash).
    if (!demoResume) document.body.classList.add("booting");
    const done = () => document.body.classList.remove("booting");
    setTimeout(done, 4000);
    client.auth.onAuthStateChange((event, session) => {
      done();
      if (window.PRESINT18_DEMO) return;
      if (event === "PASSWORD_RECOVERY") {
        setSession(session);
        window.dispatchEvent(new CustomEvent("p18:password-recovery"));
        return;
      }
      if ((session?.user?.id || null) !== (window.PRESINT18_USER?.id || null) || event === "SIGNED_OUT") setSession(session);
    });
  }
})();
