/* PKDPJ Market — living background + motion.
   Falling snow (season), drifting colour glow, staggered card entrances,
   card tilt + shine, button ripples, hero parallax and count-up stats.
   Set window.SITE_CONFIG.snow = true / false / "auto" (default auto: 1 Nov – 15 Jan). */
(() => {
  'use strict';
  const doc = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const cfg = window.SITE_CONFIG || {};

  const season = () => { const d = new Date(), m = d.getMonth(), day = d.getDate(); return m === 10 || m === 11 || (m === 0 && day <= 15); };
  const festive = cfg.snow === true || (cfg.snow !== false && season());
  const pref = (() => { try { return localStorage.getItem('pkdpj-snow'); } catch { return null; } })();
  let snowOn = festive && (pref ? pref === 'on' : !reduce);

  if (festive) doc.classList.add('festive');

  // ---------- drifting colour glow (always on, very soft) ----------
  const glow = document.createElement('div');
  glow.className = 'fx-glow'; glow.setAttribute('aria-hidden', 'true');
  glow.innerHTML = '<i></i><i></i><i></i>';

  // ---------- snow ----------
  const cv = document.createElement('canvas');
  cv.className = 'fx-snow'; cv.setAttribute('aria-hidden', 'true');
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1, flakes = [], raf = 0, last = 0, wind = 0, windTarget = 0, scrollV = 0, lastY = scrollY;
  const sprites = [];

  function makeSprites() {
    sprites.length = 0;
    [3, 5, 8, 12, 18].forEach(r => {
      const s = document.createElement('canvas'), R = Math.ceil(r * 2.2 * dpr);
      s.width = s.height = R * 2;
      const g = s.getContext('2d');
      const halo = g.createRadialGradient(R, R, 0, R, R, R);
      halo.addColorStop(0, 'rgba(255,255,255,1)');
      halo.addColorStop(0.38, 'rgba(255,255,255,.95)');
      halo.addColorStop(0.5, 'rgba(160,186,206,.55)');
      halo.addColorStop(1, 'rgba(160,186,206,0)');
      g.fillStyle = halo; g.beginPath(); g.arc(R, R, R, 0, Math.PI * 2); g.fill();
      sprites.push({ c: s, r: R / dpr });
    });
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    makeSprites();
    const want = Math.round(Math.min(140, Math.max(40, W * H / 9000)));
    while (flakes.length < want) flakes.push(flake(true));
    flakes.length = want;
  }

  function flake(anywhere) {
    const depth = Math.random();                       // 0 far … 1 near
    const si = depth < .45 ? 0 : depth < .75 ? 1 : depth < .92 ? 2 : depth < .985 ? 3 : 4;
    return {
      x: Math.random() * W, y: anywhere ? Math.random() * H : -20 - Math.random() * 60,
      vy: 18 + depth * 46 + Math.random() * 10,        // px / second
      sway: 10 + Math.random() * 26, phase: Math.random() * 6.28, freq: .4 + Math.random() * .9,
      s: si, a: si === 4 ? .35 : .55 + depth * .45, depth
    };
  }

  function tick(t) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(.05, (t - (last || t)) / 1000); last = t;
    wind += (windTarget - wind) * .02; windTarget *= .985;
    scrollV *= .9;
    ctx.clearRect(0, 0, W, H);
    for (const f of flakes) {
      f.phase += f.freq * dt;
      f.y += (f.vy - scrollV * f.depth * .6) * dt;
      f.x += (Math.sin(f.phase) * f.sway * .6 + wind * (40 + f.depth * 80)) * dt;
      if (f.y > H + 30) Object.assign(f, flake(false));
      if (f.y < -40) f.y = H + 20;
      if (f.x > W + 30) f.x = -30; else if (f.x < -30) f.x = W + 30;
      const sp = sprites[f.s];
      ctx.globalAlpha = f.a;
      ctx.drawImage(sp.c, f.x - sp.r, f.y - sp.r, sp.r * 2, sp.r * 2);
    }
    ctx.globalAlpha = 1;
  }

  function startSnow() {
    if (raf || !snowOn) return;
    if (!cv.isConnected) document.body.prepend(cv);
    resize(); cv.classList.add('on'); last = 0; raf = requestAnimationFrame(tick);
  }
  function stopSnow() { cancelAnimationFrame(raf); raf = 0; cv.classList.remove('on'); }

  addEventListener('resize', () => { if (raf) resize(); }, { passive: true });
  document.addEventListener('visibilitychange', () => { document.hidden ? (cancelAnimationFrame(raf), raf = 0) : startSnow(); });
  addEventListener('scroll', () => { const y = scrollY; scrollV += (y - lastY) * 2; lastY = y; }, { passive: true });
  addEventListener('pointermove', e => { if (e.pointerType === 'mouse') windTarget = (e.clientX / W - .5) * 1.2; }, { passive: true });
  addEventListener('deviceorientation', e => { if (e.gamma != null) windTarget = Math.max(-1, Math.min(1, e.gamma / 30)); }, { passive: true });

  function toggleButton() {
    if (!festive) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'fx-toggle';
    const label = () => { b.setAttribute('aria-pressed', String(snowOn)); b.title = b.ariaLabel = snowOn ? 'Turn snow off' : 'Let it snow'; };
    b.innerHTML = '<svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5"/></svg>';
    label();
    b.onclick = () => {
      snowOn = !snowOn; label();
      try { localStorage.setItem('pkdpj-snow', snowOn ? 'on' : 'off'); } catch { /* private mode */ }
      snowOn ? startSnow() : stopSnow();
    };
    document.body.append(b);
  }

  // ---------- staggered entrances for anything rendered into a grid ----------
  const GRIDS = '.item-grid, .shop-grid, .picks, .clinic-row, .stagger, .sf-stats, .stats';
  function stagger(root) {
    root.querySelectorAll(GRIDS).forEach(g => {
      [...g.children].forEach((el, i) => { if (!el.dataset.fx) { el.dataset.fx = '1'; el.style.setProperty('--i', Math.min(i, 14)); el.classList.add('fx-in'); } });
    });
  }

  // ---------- tilt + shine on cards (mouse only) ----------
  function tilt() {
    if (!fine || reduce) return;
    let cur = null;
    document.addEventListener('pointermove', e => {
      const card = e.target.closest && e.target.closest('.item-card, .shop-card, .pick, .clinic-tile');
      if (cur && cur !== card) { cur.style.transform = ''; cur.style.removeProperty('--mx'); cur = null; }
      if (!card) return;
      cur = card;
      const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.style.transform = `perspective(700px) rotateX(${(.5 - y) * 6}deg) rotateY(${(x - .5) * 8}deg) translateY(-3px)`;
      card.style.setProperty('--mx', (x * 100) + '%'); card.style.setProperty('--my', (y * 100) + '%');
    }, { passive: true });
  }

  // ---------- ripple on buttons ----------
  document.addEventListener('pointerdown', e => {
    if (reduce) return;
    const b = e.target.closest && e.target.closest('.btn, .chip, .add-btn');
    if (!b) return;
    const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2;
    const dot = document.createElement('span');
    dot.className = 'fx-ripple';
    dot.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
    if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
    b.style.overflow = 'hidden';
    b.append(dot); setTimeout(() => dot.remove(), 650);
  }, { passive: true });

  // ---------- hero parallax ----------
  function parallax() {
    if (reduce) return;
    let ticking = false;
    addEventListener('scroll', () => {
      if (ticking) return; ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const y = Math.min(scrollY, 700);
        document.querySelectorAll('.hero-card > img, .sf-cover > img, .sf-pattern').forEach(el => { el.style.translate = `0 ${y * .18}px`; });
      });
    }, { passive: true });
  }

  // ---------- count-up numbers ----------
  function countUp(root) {
    root.querySelectorAll('.sf-stat b, .stat b, .count-up').forEach(el => {
      if (el.dataset.counted) return;
      const n = Number(el.textContent);
      if (!Number.isFinite(n) || n <= 0 || n > 100000) return;
      el.dataset.counted = '1';
      if (reduce) return;
      const t0 = performance.now(), dur = 900;
      const step = t => { const p = Math.min(1, (t - t0) / dur); el.textContent = String(Math.round(n * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(step); };
      el.textContent = '0'; requestAnimationFrame(step);
    });
  }

  function boot() {
    document.body.prepend(glow);
    toggleButton(); tilt(); parallax();
    if (snowOn) startSnow();
    const main = document.getElementById('main') || document.body;
    stagger(main); countUp(main);
    new MutationObserver(() => { stagger(main); countUp(main); }).observe(main, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
