/* Marketplace: shops, listings, bag and checkout. Works with Supabase or the local sample preview. */
(function () {
  "use strict";

  // ---------- Reference data ----------
  const MARKETS = [
    { id: "all", name: "All clinics", short: "All", color: "#263f34" },
    { id: "pejabat-kesihatan-putrajaya", name: "Pejabat Kesihatan Putrajaya", short: "PKD Putrajaya", color: "#4f7699" },
    { id: "presint-9", name: "Klinik Kesihatan Presint 9", short: "Presint 9", color: "#a45f48" },
    { id: "presint-11", name: "Klinik Kesihatan Presint 11", short: "Presint 11", color: "#5f8255" },
    { id: "presint-14", name: "Klinik Kesihatan Presint 14", short: "Presint 14", color: "#7d62a3" },
    { id: "presint-18", name: "Klinik Kesihatan Presint 18", short: "Presint 18", color: "#b97a3a" },
  ];
  const CATEGORIES = ["Physical goods", "Digital goods", "Services"];
  const CONDITIONS = ["New", "Used - like new", "Used - good", "Used - fair"];
  const THEMES = ["#d9e4d6", "#ecd8c3", "#dcd9e8", "#d9e3e5", "#f1d9d4", "#e9e3cf"];
  const EMOJIS = ["🛍️", "🥐", "🍪", "🍱", "🧁", "🌿", "🪴", "📓", "🎨", "🕯️", "🎁", "🧴", "📄", "🛠️", "✂️", "☕"];
  const SYMBOLS = ["✨", "🌿", "🍊", "🧁", "🎨", "🧶", "🪴", "🛠️", "📚", "💊", "🦷", "☕"];

  const DEMO_ME = "demo-user";
  const DEMO_SHOPS = [
    { id: "demo-dapur", owner_id: DEMO_ME, status: "active", name: "Dapur Sihat", seller: "Unit Pemakanan", location: "Ground floor, beside the pharmacy", market_id: "presint-18", category: "Physical goods", bio: "Healthy kuih and lunch sets, made fresh each morning by the nutrition team.", theme: "#ecd8c3", symbol: "🥗", word: "fresh today",
      items: [
        { id: "demo-kuih", name: "Kuih lapis box", category: "Physical goods", price: 6, stock: 12, emoji: "🍰", condition: "New" },
        { id: "demo-nasi", name: "Nasi kerabu set", category: "Physical goods", price: 9.5, stock: 8, emoji: "🍱", condition: "New" },
        { id: "demo-fruit", name: "Fruit cup", category: "Physical goods", price: 4, stock: 2, emoji: "🍉", condition: "New" },
      ] },
    { id: "demo-plant", owner_id: "someone-else", status: "active", name: "The Plant Room", seller: "Unit Kesihatan Persekitaran", location: "Level 1, staff lounge", market_id: "presint-9", category: "Physical goods", bio: "A little green for your desk — locally propagated and lovingly potted.", theme: "#d9e4d6", symbol: "🪴", word: "grow slow",
      items: [
        { id: "demo-fern", name: "Desk fern", category: "Physical goods", price: 18, stock: 5, emoji: "🌿", condition: "New" },
        { id: "demo-pilea", name: "Baby pilea", category: "Physical goods", price: 14, stock: 0, emoji: "🪴", condition: "New" },
        { id: "demo-pot", name: "Clay pot duo", category: "Physical goods", price: 22, stock: 3, emoji: "🏺", condition: "Used - like new" },
      ] },
    { id: "demo-prints", owner_id: "someone-else", status: "active", name: "Senyum Prints", seller: "Unit Pergigian", location: "Level 2, dental clinic", market_id: "presint-11", category: "Digital goods", bio: "Printable oral-health posters and colouring sheets for kids and waiting rooms.", theme: "#dcd9e8", symbol: "🦷", word: "smile more",
      items: [
        { id: "demo-chart", name: "Brushing chart (PDF)", category: "Digital goods", price: 3, stock: 99, emoji: "📄", condition: "New" },
        { id: "demo-colour", name: "Colouring pack", category: "Digital goods", price: 5, stock: 99, emoji: "🎨", condition: "New" },
      ] },
    { id: "demo-fix", owner_id: "someone-else", status: "active", name: "Side Quest Repair", seller: "Unit Teknologi Maklumat", location: "Admin block, room 3", market_id: "pejabat-kesihatan-putrajaya", category: "Services", bio: "Quick fixes for small things. Book a 15-minute desk-side tune-up.", theme: "#d9e3e5", symbol: "🛠️", word: "fix it up",
      items: [
        { id: "demo-tune", name: "Laptop tune-up", category: "Services", price: 15, stock: 6, emoji: "💻", condition: "New" },
        { id: "demo-cable", name: "Cable tidy kit", category: "Physical goods", price: 7, stock: 10, emoji: "🔌", condition: "New" },
      ] },
    { id: "demo-craft", owner_id: "someone-else", status: "active", name: "Little Lines Studio", seller: "Unit Promosi Kesihatan", location: "Level 1, health promotion corner", market_id: "presint-14", category: "Physical goods", bio: "Paper goods for people who still love putting pen to paper.", theme: "#f1d9d4", symbol: "📚", word: "make a note",
      items: [
        { id: "demo-notebook", name: "Pocket notebook", category: "Physical goods", price: 12, stock: 9, emoji: "📓", condition: "New" },
        { id: "demo-cards", name: "Greeting cards (5)", category: "Physical goods", price: 8, stock: 15, emoji: "💌", condition: "New" },
      ] },
  ];
  const DEMO_HIGHLIGHTS = ["demo-nasi", "demo-fern", "demo-notebook"];

  // ---------- Helpers ----------
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const money = (n) => "RM " + Number(n || 0).toFixed(2);
  const marketById = (id) => MARKETS.find((m) => m.id === id) || MARKETS[5];
  const db = () => (window.PRESINT18_DEMO ? null : window.PRESINT18_SUPABASE || null);
  const me = () => window.PRESINT18_USER;
  const todayKL = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  };
  const cartKey = () => (window.PRESINT18_DEMO ? "p18-demo-cart" : `p18-cart:${me()?.id || "anon"}`);
  const isSeller = () => (window.PRESINT18_PROFILE?.account_type || me()?.user_metadata?.account_type) === "seller";
  const ownsShop = (s) => !!me() && s.owner_id === me().id;

  // ---------- State ----------
  let shops = [];
  let cart = [];
  let filter = "Everything";
  let query = "";
  let activeMarket = "all";
  let highlightIds = [];
  let loading = false;

  function persist() {
    if (loading) return; // never save the empty "loading" state
    if (window.PRESINT18_DEMO) write("p18-demo-shops", shops);
    if (me()) write(cartKey(), cart.map((x) => ({ id: x.id, qty: x.qty })));
  }

  function restoreCart() {
    const items = allItems();
    cart = read(cartKey(), [])
      .map((x) => {
        const item = items.find((i) => i.id === x.id);
        return item ? { ...item, qty: Math.max(1, Math.min(x.qty, item.stock ?? 999)) } : null;
      })
      .filter(Boolean);
  }

  // ---------- Supabase storage ----------
  async function signedImage(path) {
    if (!db() || !path) return "";
    const { data, error } = await db().storage.from("marketplace-images").createSignedUrl(path, 604800);
    if (error) return "";
    return data.signedUrl;
  }
  async function uploadPhoto(dataUrl, shopId) {
    if (!db() || !dataUrl) return "";
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${shopId}/${crypto.randomUUID()}.jpg`;
    const { error } = await db().storage.from("marketplace-images").upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (error) throw error;
    return path;
  }
  async function uploadPaymentQr(input, shopId) {
    const file = input?.files?.[0];
    if (!file) return "";
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Upload the payment QR as a PNG, JPEG or WebP image.");
    if (!db()) return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file); });
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${shopId}/qr-${crypto.randomUUID()}.${ext}`;
    const { error } = await db().storage.from("marketplace-images").upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return path;
  }
  function imageFromInput(input, maxSide = 1000) {
    return new Promise((resolve, reject) => {
      const file = input?.files?.[0];
      if (!file) return resolve("");
      if (!file.type.startsWith("image/")) return reject(new Error("Please choose an image file."));
      if (file.size > 15 * 1024 * 1024) return reject(new Error("That image is too large (max 15 MB)."));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read that image."));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error("Could not open that image."));
        image.onload = () => {
          const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(image.width * scale);
          canvas.height = Math.round(image.height * scale);
          canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // ---------- Loading data ----------
  let loadToken = 0;
  async function loadMarketplace(user) {
    if (!user) return;
    const token = ++loadToken;
    loading = true;
    render();

    if (window.PRESINT18_DEMO) {
      window.PRESINT18_PROFILE = { account_type: "seller", is_admin: false, department: "Demo unit" };
      const saved = read("p18-demo-shops", null);
      shops = Array.isArray(saved) && saved.length ? saved : structuredClone(DEMO_SHOPS);
      highlightIds = DEMO_HIGHLIGHTS;
      loading = false;
      restoreCart();
      setSellerControls();
      render();
      return;
    }

    try {
      const { data: profile } = await db().from("profiles").select("account_type,department,full_name,is_admin").eq("id", user.id).maybeSingle();
      window.PRESINT18_PROFILE = profile || null;
      setSellerControls();

      const { data, error } = await db()
        .from("shops")
        .select("id,owner_id,name,unit_department,location,market_id,category,bio,theme,symbol,word,cover_image_path,payment_qr_path,status,created_at,products(id,shop_id,name,category,unit_price_rm,stock_qty,emoji,condition,image_path,active)")
        .or(`status.eq.active,owner_id.eq.${user.id}`)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const rows = (data || []).filter((s) => s.status === "active" || s.owner_id === user.id);
      const loaded = await Promise.all(
        rows.map(async (s) => ({
          id: s.id,
          owner_id: s.owner_id,
          status: s.status,
          name: s.name,
          seller: s.unit_department,
          location: s.location,
          market_id: s.market_id || "presint-18",
          category: s.category,
          bio: s.bio,
          theme: s.theme,
          symbol: s.symbol,
          word: s.word,
          photo: await signedImage(s.cover_image_path),
          paymentQr: await signedImage(s.payment_qr_path),
          items: await Promise.all(
            (s.products || [])
              .filter((p) => p.active)
              .map(async (p) => ({
                id: p.id,
                name: p.name,
                category: p.category,
                price: Number(p.unit_price_rm),
                stock: Number(p.stock_qty),
                emoji: p.emoji,
                condition: p.condition,
                photo: await signedImage(p.image_path),
              })),
          ),
        })),
      );
      if (token !== loadToken) return;
      shops = loaded;

      const { data: featured } = await db().from("daily_highlights").select("product_id,rank").eq("feature_date", todayKL()).order("rank");
      highlightIds = (featured || []).map((x) => x.product_id);
      if (!highlightIds.length) {
        // No picks set today: show a few in-stock items so the section isn't empty.
        highlightIds = allItems().filter((i) => i.stock > 0 && i.status === "active").slice(0, 3).map((x) => x.id);
      }
      restoreCart();
    } catch (error) {
      if (token !== loadToken) return;
      shops = [];
      highlightIds = [];
      toast(`Couldn't load the market: ${error.message || "unknown error"}. Try refreshing the page.`, 6000);
    } finally {
      if (token === loadToken) {
        loading = false;
        render();
      }
    }
  }

  function setSellerControls() {
    const seller = !!me() && isSeller();
    ["#sellerOpen", "#shopOpen", "#shopOpenHero"].forEach((id) => ($(id).hidden = !seller));
  }

  function allItems() {
    return shops.flatMap((shop) =>
      shop.items.map((item) => ({ ...item, shopId: shop.id, shopName: shop.name, status: shop.status, market_id: shop.market_id })),
    );
  }

  // ---------- Rendering ----------
  function renderMarketPicker() {
    $("#regionPicker").innerHTML = MARKETS.map((m) => {
      const count = m.id === "all" ? visibleShops().length : visibleShops().filter((s) => s.market_id === m.id).length;
      const active = activeMarket === m.id;
      return `<button class="chip market-chip ${active ? "active" : ""}" data-market="${esc(m.id)}" style="--chip:${esc(m.color)}" aria-pressed="${active}" title="${esc(m.name)}"><span class="dot"></span>${esc(m.short)}<small>${count}</small></button>`;
    }).join("");
  }
  function renderFilters() {
    $("#filters").innerHTML = ["Everything", ...CATEGORIES]
      .map((c) => `<button class="chip ${filter === c ? "active" : ""}" data-filter="${esc(c)}" aria-pressed="${filter === c}">${esc(c)}</button>`)
      .join("");
  }

  function visibleShops() {
    return shops.filter((s) => s.status === "active" || ownsShop(s));
  }

  function itemTile(i, { owner = false } = {}) {
    const out = i.stock !== undefined && i.stock <= 0;
    const low = !out && i.stock !== undefined && i.stock <= 3;
    const thumb = i.photo ? `<img src="${esc(i.photo)}" alt="" loading="lazy">` : `<span aria-hidden="true">${esc(i.emoji || "🛍️")}</span>`;
    const note = out ? `<em class="stock out">Sold out</em>` : low ? `<em class="stock low">Only ${i.stock} left</em>` : i.condition && i.condition !== "New" ? `<em class="stock">${esc(i.condition)}</em>` : "";
    return `<button class="product" data-add="${esc(i.id)}" ${out || owner ? 'aria-disabled="true"' : ""} aria-label="${out ? "Sold out: " : owner ? "" : "Add to bag: "}${esc(i.name)}, ${money(i.price)}">
      <span class="product-thumb">${thumb}</span>
      <span class="product-meta"><strong>${esc(i.name)}</strong><span class="price">${money(i.price)}</span>${note}</span>
      ${out || owner ? "" : '<span class="add-dot" aria-hidden="true">+</span>'}
    </button>`;
  }

  function renderHighlights() {
    const items = highlightIds.map((id) => allItems().find((i) => i.id === id)).filter((i) => i && i.status === "active").slice(0, 3);
    $("#highlights").hidden = loading || !items.length;
    $("#highlightGrid").dataset.count = items.length;
    $("#highlightGrid").innerHTML = items
      .map(
        (i, n) => `<button class="highlight-card" data-add="${esc(i.id)}" style="--market:${esc(marketById(i.market_id).color)}" ${i.stock <= 0 ? 'aria-disabled="true"' : ""}>
          <span class="rank">#${n + 1} today</span>
          <span class="highlight-art">${i.photo ? `<img src="${esc(i.photo)}" alt="">` : `<span class="art-emoji" aria-hidden="true">${esc(i.emoji || "🛍️")}</span>`}</span>
          <span class="highlight-info"><span><strong>${esc(i.name)}</strong><small>${esc(i.shopName)} · ${esc(marketById(i.market_id).short)}</small></span><span class="highlight-price">${i.stock <= 0 ? "Sold out" : `${money(i.price)} <b aria-hidden="true">+</b>`}</span></span>
        </button>`,
      )
      .join("");
  }

  function renderShops() {
    const feed = $("#shopFeed");
    if (loading) {
      $("#resultCount").textContent = "Loading the market…";
      feed.innerHTML = Array.from({ length: 4 }, () => '<div class="shop-card skeleton"><div class="shop-banner"></div><div class="shop-details"><i></i><i></i><i></i></div></div>').join("");
      return;
    }
    const q = query.trim().toLowerCase();
    const list = visibleShops()
      .filter((s) => activeMarket === "all" || s.market_id === activeMarket)
      .map((s) => {
        const shopText = `${s.name} ${s.seller} ${s.location || ""} ${s.bio}`.toLowerCase();
        const shopMatch = !q || shopText.includes(q);
        const items = s.items.filter(
          (i) => (filter === "Everything" || (i.category || s.category) === filter) && (shopMatch || i.name.toLowerCase().includes(q)),
        );
        const typeMatch = filter === "Everything" || s.category === filter || items.length;
        const visible = typeMatch && (shopMatch || items.length);
        return visible ? { shop: s, items: filter === "Everything" && shopMatch ? s.items : items } : null;
      })
      .filter(Boolean);

    const itemCount = list.reduce((n, x) => n + x.items.length, 0);
    $("#resultCount").textContent = list.length
      ? `${list.length} shop${list.length === 1 ? "" : "s"} · ${itemCount} item${itemCount === 1 ? "" : "s"}${activeMarket !== "all" ? ` at ${marketById(activeMarket).name}` : ""}`
      : "";

    if (!list.length) {
      const nothingYet = !visibleShops().length;
      feed.innerHTML = `<div class="empty-state wide">
        <span class="empty-icon" aria-hidden="true">${nothingYet ? "🏪" : "🔍"}</span>
        <h3>${nothingYet ? "No shops are open yet" : "Nothing matches that"}</h3>
        <p>${nothingYet ? (isSeller() ? "Be the first — open a shop for your unit and add a few items." : "Check back soon. Units and departments are setting up their shops.") : "Try a different clinic, type or search word."}</p>
        ${nothingYet && isSeller() ? '<button class="btn btn-primary" data-action="open-shop">Open a unit shop</button>' : !nothingYet ? '<button class="btn btn-ghost" data-action="clear-filters">Clear filters</button>' : ""}
      </div>`;
      return;
    }

    feed.innerHTML = list
      .map(({ shop: s, items }) => {
        const market = marketById(s.market_id);
        const owner = ownsShop(s);
        const pending = s.status !== "active";
        return `<article class="shop-card" style="--market:${esc(market.color)}">
          <div class="shop-banner" style="--banner:${esc(s.theme || "#e5dfd1")}">
            ${s.photo ? `<img class="shop-photo" src="${esc(s.photo)}" alt="">` : `<span class="banner-word">${esc(s.word || "made with care")}</span><span class="banner-shape" aria-hidden="true">${esc(s.symbol || "✨")}</span>`}
            <span class="market-tag"><span class="dot"></span>${esc(market.short)}</span>
          </div>
          <div class="shop-details">
            ${pending ? `<div class="status-note"><b>${s.status === "pending" ? "Waiting for admin approval" : `Shop is ${esc(s.status)}`}</b> — only you can see this shop for now. You can already add items.</div>` : ""}
            <div class="shop-title-row">
              <div><h3>${esc(s.name)}</h3><p class="shop-meta">${esc(s.seller)}${s.location ? ` · ${esc(s.location)}` : ""}</p></div>
              ${owner ? '<span class="owner-badge">Your shop</span>' : ""}
            </div>
            ${s.bio ? `<p class="shop-bio">${esc(s.bio)}</p>` : ""}
            <div class="product-row">${items.length ? items.map((i) => itemTile(i, { owner })).join("") : `<p class="muted small">${owner ? "No items yet — add your first one." : "No items listed yet."}</p>`}</div>
            ${owner ? `<div class="owner-tools"><button class="btn btn-small btn-ghost" data-add-listing="${esc(s.id)}">＋ Add item</button><button class="btn btn-small btn-ghost" data-customize="${esc(s.id)}">Edit shop</button>${s.items.length ? `<button class="btn btn-small btn-ghost" data-manage="${esc(s.id)}">Stock &amp; prices</button>` : ""}</div>` : ""}
          </div>
        </article>`;
      })
      .join("");
  }

  function renderCart() {
    const count = cart.reduce((s, x) => s + x.qty, 0);
    const sum = cart.reduce((s, x) => s + x.price * x.qty, 0);
    $("#cartCount").textContent = count;
    $("#cartCount").classList.toggle("empty", !count);
    $("#drawerCount").textContent = `(${count})`;
    $("#subtotal").textContent = money(sum);
    $("#checkoutOpen").disabled = !cart.length;
    $("#cartItems").innerHTML = cart.length
      ? cart
          .map(
            (i) => `<div class="cart-line">
              <div class="cart-line-art">${i.photo ? `<img src="${esc(i.photo)}" alt="">` : esc(i.emoji || "🛍️")}</div>
              <div><h3>${esc(i.name)}</h3><p>${esc(i.shopName)} · ${money(i.price)} each</p>
                <div class="qty"><button data-qty="${esc(i.id)}" data-step="-1" aria-label="One less ${esc(i.name)}">−</button><span aria-live="polite">${i.qty}</span><button data-qty="${esc(i.id)}" data-step="1" aria-label="One more ${esc(i.name)}">+</button></div>
              </div>
              <strong>${money(i.price * i.qty)}</strong>
            </div>`,
          )
          .join("")
      : '<div class="empty-state"><span class="empty-icon" aria-hidden="true">🛍️</span><h3>Your bag is empty</h3><p>Tap any item in the market to add it here.</p><button class="btn btn-ghost" data-close>Keep browsing</button></div>';
    persist();
  }

  function render() {
    renderMarketPicker();
    renderFilters();
    renderHighlights();
    renderShops();
    renderCart();
  }

  // ---------- Overlays ----------
  function toast(msg, ms = 2600) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove("show"), ms);
  }
  let lastFocus = null;
  function openCart() {
    closeModal();
    lastFocus = document.activeElement;
    $("#cartDrawer").classList.add("open");
    $("#cartDrawer").setAttribute("aria-hidden", "false");
    $("#scrim").classList.add("open");
    document.body.classList.add("locked");
    setTimeout(() => $("#cartDrawer .icon-button").focus(), 50);
  }
  function closeCart() {
    if (!$("#cartDrawer").classList.contains("open")) return;
    $("#cartDrawer").classList.remove("open");
    $("#cartDrawer").setAttribute("aria-hidden", "true");
    if (!$("#modal").classList.contains("open")) {
      $("#scrim").classList.remove("open");
      document.body.classList.remove("locked");
    }
  }
  function openModal(title, eyebrow, html, { wide = false } = {}) {
    if (!$("#modal").classList.contains("open")) lastFocus = document.activeElement;
    closeCart();
    $("#modalTitle").textContent = title;
    $("#modalEyebrow").textContent = eyebrow;
    $("#modalContent").innerHTML = html;
    $("#modal").classList.toggle("wide", wide);
    $("#modal").classList.add("open");
    $("#modal").setAttribute("aria-hidden", "false");
    $("#modal").scrollTop = 0;
    $("#scrim").classList.add("open");
    document.body.classList.add("locked");
    setTimeout(() => ($("#modalContent input:not([type=hidden]):not([type=radio]), #modalContent select, #modalContent textarea") || $("#modal .icon-button"))?.focus({ preventScroll: true }), 60);
  }
  function closeModal() {
    if (!$("#modal").classList.contains("open")) return;
    $("#modal").classList.remove("open");
    $("#modal").setAttribute("aria-hidden", "true");
    if (!$("#cartDrawer").classList.contains("open")) {
      $("#scrim").classList.remove("open");
      document.body.classList.remove("locked");
    }
    lastFocus?.focus?.({ preventScroll: true });
  }
  function busy(button, on, text) {
    if (!button) return;
    if (on) {
      button.dataset.label = button.textContent;
      button.textContent = text || "Saving…";
      button.disabled = true;
    } else {
      button.textContent = button.dataset.label || button.textContent;
      button.disabled = false;
    }
  }

  // ---------- Bag ----------
  function addToCart(id) {
    const i = allItems().find((x) => x.id === id);
    if (!i) return;
    const s = shops.find((x) => x.id === i.shopId);
    if (s && ownsShop(s)) return toast("This is your own shop — use “Stock & prices” to manage it.");
    if (i.status !== "active") return toast("This shop isn't open yet.");
    const line = cart.find((x) => x.id === id);
    if (i.stock !== undefined && i.stock <= (line?.qty || 0)) return toast(i.stock <= 0 ? `${i.name} is sold out` : `Only ${i.stock} of ${i.name} available`);
    line ? line.qty++ : cart.push({ ...i, qty: 1 });
    renderCart();
    const btn = $("#cartOpen");
    btn.classList.remove("bump");
    void btn.offsetWidth;
    btn.classList.add("bump");
    toast(`Added ${i.name} to your bag`);
  }

  // ---------- Forms ----------
  const opts = (list, selected) => list.map((v) => `<option ${v === selected ? "selected" : ""}>${esc(v)}</option>`).join("");

  function listingForm(shopId) {
    const owned = shops.filter(ownsShop);
    if (!owned.length) {
      openModal("Open your shop first", "Sell something", `<p class="lead-text">Items live inside a unit shop. Create your shop (takes a minute), then add your first item.</p><button class="btn btn-primary btn-block" data-action="open-shop">Open a unit shop</button>`);
      return;
    }
    const preset = owned.find((s) => s.id === shopId) || owned[0];
    openModal(
      "Add an item",
      "Sell something",
      `<form id="listingForm" class="form">
        <label class="field"><span>Which shop?</span><select name="shop" required>${owned.map((s) => `<option value="${esc(s.id)}" ${s.id === preset.id ? "selected" : ""}>${esc(s.name)}${s.status !== "active" ? " (awaiting approval)" : ""}</option>`).join("")}</select></label>
        <label class="field"><span>Item or service name</span><input name="name" required minlength="2" maxlength="100" placeholder="e.g. Handmade cards"></label>
        <div class="form-grid">
          <label class="field"><span>Price (RM)</span><input name="price" type="number" inputmode="decimal" min="0.01" step="0.01" required placeholder="8.00"></label>
          <label class="field"><span>How many available?</span><input name="stock" type="number" inputmode="numeric" min="0" step="1" value="10" required></label>
        </div>
        <div class="form-grid">
          <label class="field"><span>Type</span><select name="category">${opts(CATEGORIES, preset.category)}</select></label>
          <label class="field" data-condition><span>Condition</span><select name="condition">${opts(CONDITIONS, "New")}</select></label>
        </div>
        <label class="field"><span>Photo <small>(optional)</small></span><input name="photo" type="file" accept="image/*"><small class="hint">No photo? We'll show the icon below instead.</small></label>
        <fieldset class="field"><legend>Icon</legend><div class="emoji-picker">${EMOJIS.map((e, n) => `<label><input type="radio" name="emoji" value="${e}" ${n === 0 ? "checked" : ""}><span>${e}</span></label>`).join("")}</div></fieldset>
        <button class="btn btn-primary btn-block">Add to my shop</button>
      </form>`,
    );
    const form = $("#listingForm");
    const syncCondition = () => {
      const physical = form.elements.category.value === "Physical goods";
      $("[data-condition]", form).hidden = !physical;
    };
    form.elements.category.addEventListener("change", syncCondition);
    syncCondition();
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const d = new FormData(form);
      const shop = shops.find((s) => s.id === d.get("shop"));
      const button = form.querySelector("button.btn-primary");
      busy(button, true);
      try {
        const dataUrl = await imageFromInput(form.elements.photo, 800);
        const fields = {
          name: String(d.get("name")).trim(),
          category: d.get("category"),
          price: Number(d.get("price")),
          stock: Number(d.get("stock")),
          emoji: d.get("emoji") || "🛍️",
          condition: d.get("category") === "Physical goods" ? d.get("condition") : "New",
        };
        let item;
        if (db()) {
          const { data, error } = await db()
            .from("products")
            .insert({ shop_id: shop.id, name: fields.name, category: fields.category, unit_price_rm: fields.price, stock_qty: fields.stock, emoji: fields.emoji, condition: fields.condition, active: true })
            .select("id")
            .single();
          if (error) throw error;
          const image_path = await uploadPhoto(dataUrl, shop.id);
          if (image_path) {
            const { error: updateError } = await db().from("products").update({ image_path }).eq("id", data.id);
            if (updateError) throw updateError;
          }
          item = { id: data.id, ...fields, photo: await signedImage(image_path) };
        } else {
          item = { id: "item-" + crypto.randomUUID(), ...fields, photo: dataUrl };
        }
        shop.items.push(item);
        persist();
        render();
        closeModal();
        toast(`${fields.name} is now listed in ${shop.name}`);
      } catch (err) {
        busy(button, false);
        toast(err.message || "Could not add that item");
      }
    });
  }

  function shopForm() {
    const profile = window.PRESINT18_PROFILE || {};
    openModal(
      "Open a unit shop",
      "For units & departments",
      `<form id="shopForm" class="form">
        <p class="lead-text">Tell buyers who you are and where to find you. ${db() ? "An admin reviews new shops before they appear to everyone — you can add items while you wait." : ""}</p>
        <label class="field"><span>Shop name</span><input name="name" required minlength="2" maxlength="80" placeholder="e.g. Dapur Sihat"></label>
        <div class="form-grid">
          <label class="field"><span>Your unit / department</span><input name="seller" required minlength="2" maxlength="120" value="${esc(profile.department || me()?.user_metadata?.department || "")}" placeholder="e.g. Unit Pemakanan"></label>
          <label class="field"><span>Which clinic?</span><select name="market_id" required>${MARKETS.slice(1).map((m) => `<option value="${m.id}" ${m.id === "presint-18" ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select></label>
        </div>
        <label class="field"><span>Where can buyers find you?</span><input name="location" required minlength="2" maxlength="160" placeholder="e.g. Ground floor, beside the pharmacy"></label>
        <label class="field"><span>Main type of thing you offer</span><select name="category">${opts(CATEGORIES)}</select></label>
        <label class="field"><span>A short description <small>(optional)</small></span><textarea name="bio" maxlength="150" placeholder="What does your unit offer?"></textarea></label>
        <details class="more">
          <summary>Shopfront look, photo &amp; payment QR</summary>
          <div class="form-grid">
            <label class="field"><span>Icon</span><select name="symbol">${opts(SYMBOLS)}</select></label>
            <label class="field"><span>Short phrase</span><input name="word" maxlength="40" placeholder="made with care"></label>
          </div>
          <label class="field"><span>Shopfront photo</span><input name="photo" type="file" accept="image/*"></label>
          <label class="field"><span>Payment QR (DuitNow etc.)</span><input name="paymentQr" type="file" accept="image/png,image/jpeg,image/webp"><small class="hint">Uploaded at full quality so it scans properly. Needed if you want to accept QR payment.</small></label>
        </details>
        <button class="btn btn-primary btn-block">${db() ? "Submit shop for approval" : "Open my shop"}</button>
      </form>`,
    );
    const form = $("#shopForm");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const d = new FormData(form);
      const button = form.querySelector("button.btn-primary");
      busy(button, true, "Creating…");
      const fields = {
        name: String(d.get("name")).trim(),
        market_id: d.get("market_id"),
        seller: String(d.get("seller")).trim(),
        location: String(d.get("location")).trim(),
        category: d.get("category"),
        bio: String(d.get("bio") || "").trim(),
        theme: THEMES[Math.floor(Math.random() * THEMES.length)],
        symbol: d.get("symbol") || "✨",
        word: String(d.get("word") || "").trim() || "made with care",
      };
      try {
        const dataUrl = await imageFromInput(form.elements.photo, 1200);
        if (db()) {
          // New shops start as "pending"; the database blocks anything else for non-admins.
          const { data: shop, error } = await db()
            .from("shops")
            .insert({ owner_id: me().id, name: fields.name, market_id: fields.market_id, unit_department: fields.seller, location: fields.location, category: fields.category, bio: fields.bio, theme: fields.theme, symbol: fields.symbol, word: fields.word })
            .select("id,status")
            .single();
          if (error) throw error;
          const cover_image_path = await uploadPhoto(dataUrl, shop.id);
          const payment_qr_path = await uploadPaymentQr(form.elements.paymentQr, shop.id);
          const updates = {};
          if (cover_image_path) updates.cover_image_path = cover_image_path;
          if (payment_qr_path) updates.payment_qr_path = payment_qr_path;
          if (Object.keys(updates).length) {
            const { error: updateError } = await db().from("shops").update(updates).eq("id", shop.id);
            if (updateError) throw updateError;
          }
          shops.unshift({ id: shop.id, owner_id: me().id, status: shop.status || "pending", ...fields, photo: await signedImage(cover_image_path), paymentQr: await signedImage(payment_qr_path), items: [] });
        } else {
          const paymentQr = await uploadPaymentQr(form.elements.paymentQr, "demo");
          shops.unshift({ id: "shop-" + crypto.randomUUID(), owner_id: me().id, status: "active", ...fields, photo: dataUrl, paymentQr, items: [] });
        }
        persist();
        filter = "Everything";
        activeMarket = "all";
        query = "";
        $("#searchInput").value = "";
        render();
        const created = shops[0];
        openModal(
          created.status === "active" ? "Your shop is open!" : "Shop submitted",
          "Next step",
          `<p class="lead-text">${created.status === "active" ? `<b>${esc(created.name)}</b> is live.` : `<b>${esc(created.name)}</b> is waiting for an admin to approve it. Only you can see it until then.`} Add your first item so buyers have something to pick.</p>
           <button class="btn btn-primary btn-block" data-add-listing="${esc(created.id)}">Add my first item</button>
           <button class="btn btn-ghost btn-block" data-close>Later</button>`,
        );
      } catch (err) {
        busy(button, false);
        toast(err.message || "Could not create your shop");
      }
    });
  }

  function customizeForm(id) {
    const s = shops.find((x) => x.id === id);
    if (!s || !ownsShop(s)) return;
    openModal(
      "Edit your shop",
      s.name,
      `<form id="customForm" class="form">
        <div class="form-grid">
          <label class="field"><span>Shop name</span><input name="name" required minlength="2" maxlength="80" value="${esc(s.name)}"></label>
          <label class="field"><span>Short phrase</span><input name="word" maxlength="40" value="${esc(s.word || "")}"></label>
        </div>
        <label class="field"><span>Where can buyers find you?</span><input name="location" required minlength="2" value="${esc(s.location || "")}"></label>
        <label class="field"><span>Description</span><textarea name="bio" maxlength="150">${esc(s.bio || "")}</textarea></label>
        <fieldset class="field"><legend>Banner colour</legend><div class="swatches">${THEMES.map((c) => `<label><input type="radio" name="theme" value="${c}" ${s.theme === c ? "checked" : ""}><span style="background:${c}"></span></label>`).join("")}</div></fieldset>
        <label class="field"><span>Replace shopfront photo</span><input name="photo" type="file" accept="image/*"><small class="hint">Leave empty to keep the current one.</small></label>
        <label class="field"><span>${s.paymentQr ? "Replace payment QR" : "Add a payment QR"}</span><input name="paymentQr" type="file" accept="image/png,image/jpeg,image/webp">${s.paymentQr ? `<small class="hint">A QR is already set. Leave empty to keep it.</small>` : `<small class="hint">Without a QR, buyers can only pay cash.</small>`}</label>
        <button class="btn btn-primary btn-block">Save changes</button>
      </form>`,
    );
    const form = $("#customForm");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const d = new FormData(form);
      const button = form.querySelector("button.btn-primary");
      busy(button, true);
      try {
        const dataUrl = await imageFromInput(form.elements.photo, 1200);
        const updates = {
          name: String(d.get("name")).trim(),
          word: String(d.get("word")).trim(),
          location: String(d.get("location")).trim(),
          bio: String(d.get("bio")).trim(),
          theme: d.get("theme") || s.theme,
        };
        if (db()) {
          const cover_image_path = await uploadPhoto(dataUrl, s.id);
          const payment_qr_path = await uploadPaymentQr(form.elements.paymentQr, s.id);
          const row = { ...updates };
          if (cover_image_path) row.cover_image_path = cover_image_path;
          if (payment_qr_path) row.payment_qr_path = payment_qr_path;
          const { error } = await db().from("shops").update(row).eq("id", s.id);
          if (error) throw error;
          Object.assign(s, updates);
          if (cover_image_path) s.photo = await signedImage(cover_image_path);
          if (payment_qr_path) s.paymentQr = await signedImage(payment_qr_path);
        } else {
          Object.assign(s, updates);
          if (dataUrl) s.photo = dataUrl;
          const qr = await uploadPaymentQr(form.elements.paymentQr, s.id);
          if (qr) s.paymentQr = qr;
        }
        persist();
        render();
        closeModal();
        toast("Shop updated");
      } catch (err) {
        busy(button, false);
        toast(err.message || "Could not update your shop");
      }
    });
  }

  function manageItems(id) {
    const s = shops.find((x) => x.id === id);
    if (!s || !ownsShop(s)) return;
    openModal(
      "Stock & prices",
      s.name,
      `<form id="manageForm" class="form">
        <p class="lead-text">Update prices and how many are left. Set stock to 0 to show an item as sold out, or remove it from the shop.</p>
        <div class="manage-list">${s.items
          .map(
            (i) => `<div class="manage-row" data-row="${esc(i.id)}">
              <span class="manage-name"><span aria-hidden="true">${esc(i.emoji || "🛍️")}</span>${esc(i.name)}</span>
              <label><span>Price (RM)</span><input name="price" type="number" min="0.01" step="0.01" value="${Number(i.price).toFixed(2)}" required></label>
              <label><span>Stock</span><input name="stock" type="number" min="0" step="1" value="${i.stock ?? 0}" required></label>
              <label class="remove-toggle"><input type="checkbox" name="remove"><span>Remove</span></label>
            </div>`,
          )
          .join("")}</div>
        <button class="btn btn-primary btn-block">Save changes</button>
      </form>`,
      { wide: true },
    );
    const form = $("#manageForm");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const button = form.querySelector("button.btn-primary");
      busy(button, true);
      try {
        for (const row of $$("[data-row]", form)) {
          const item = s.items.find((i) => i.id === row.dataset.row);
          const price = Number($("[name=price]", row).value);
          const stock = Number($("[name=stock]", row).value);
          const remove = $("[name=remove]", row).checked;
          if (!remove && price === item.price && stock === item.stock) continue;
          if (db()) {
            const { error } = await db()
              .from("products")
              .update(remove ? { active: false } : { unit_price_rm: price, stock_qty: stock })
              .eq("id", item.id);
            if (error) throw error;
          }
          if (remove) s.items = s.items.filter((i) => i !== item);
          else Object.assign(item, { price, stock });
        }
        persist();
        render();
        closeModal();
        toast("Stock and prices saved");
      } catch (err) {
        busy(button, false);
        toast(err.message || "Could not save changes");
      }
    });
  }

  function showQrPayment(items, orderId) {
    const groups = new Map();
    items.forEach((i) => {
      const group = groups.get(i.shopId) || { shop: shops.find((s) => s.id === i.shopId), total: 0 };
      group.total += i.price * i.qty;
      groups.set(i.shopId, group);
    });
    const html = [...groups.values()]
      .map(
        (g) => `<div class="qr-shop"><h3>${esc(g.shop?.name || "Shop")} <span>${money(g.total)}</span></h3>${
          g.shop?.paymentQr
            ? `<img src="${esc(g.shop.paymentQr)}" alt="Payment QR for ${esc(g.shop.name)}">`
            : '<div class="note warn">This shop hasn\'t added a payment QR yet. Please contact them before paying.</div>'
        }</div>`,
      )
      .join("");
    openModal(
      "Order placed — now pay by QR",
      `Order ${String(orderId || "").slice(0, 8).toUpperCase()}`,
      `<ol class="pay-steps"><li>Scan each shop's QR below and pay the exact amount shown.</li><li>Screenshot your payment receipt.</li><li>Open <b>My orders</b> and upload the receipt so the seller can confirm.</li></ol>
       ${html}
       <div class="note">Payments aren't verified automatically — the seller checks their account and confirms your order.</div>
       <div class="button-row">${db() ? '<button class="btn btn-primary" data-action="my-orders">Go to My orders</button>' : ""}<button class="btn btn-ghost" data-close>Done</button></div>`,
    );
  }

  function checkout() {
    if (!cart.length) return toast("Your bag is empty");
    const saved = read("p18-checkout-details", {});
    const profile = window.PRESINT18_PROFILE || {};
    const name = saved.buyer || profile.full_name || me()?.user_metadata?.full_name || "";
    const shopIds = [...new Set(cart.map((i) => i.shopId))];
    const qrMissing = shopIds.filter((id) => !shops.find((s) => s.id === id)?.paymentQr);
    openModal(
      "Checkout",
      `${cart.reduce((n, i) => n + i.qty, 0)} item(s) from ${shopIds.length} shop${shopIds.length > 1 ? "s" : ""}`,
      `<form id="checkoutForm" class="form">
        <div class="checkout-lines">${cart
          .map(
            (i) => `<div class="checkout-line">
              <div><strong>${esc(i.name)}</strong><span>${money(i.price)} each · ${esc(i.shopName)}</span></div>
              <label><span class="sr-only">Quantity</span><input name="quantity" data-line-id="${esc(i.id)}" type="number" inputmode="numeric" min="1" max="${i.stock ?? 999}" step="1" value="${i.qty}" required></label>
              <b data-line-total="${esc(i.id)}">${money(i.price * i.qty)}</b>
              <button class="remove-line" type="button" data-remove="${esc(i.id)}" aria-label="Remove ${esc(i.name)}">×</button>
            </div>`,
          )
          .join("")}</div>
        <div class="checkout-total"><span>Total</span><strong id="checkoutTotal">${money(cart.reduce((a, x) => a + x.price * x.qty, 0))}</strong></div>

        <h3 class="form-step">Your details</h3>
        <div class="form-grid">
          <label class="field"><span>Name</span><input name="buyer" required minlength="2" autocomplete="name" value="${esc(name)}"></label>
          <label class="field"><span>Phone / WhatsApp</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="e.g. 012-345 6789" pattern="[0-9+\\-\\s]{7,20}" required value="${esc(saved.phone || "")}"></label>
        </div>
        <label class="field"><span>Your unit / department</span><input name="unit" required minlength="2" placeholder="e.g. Unit Farmasi, ground floor" value="${esc(saved.unit || profile.department || "")}"></label>

        <h3 class="form-step">How do you want it?</h3>
        <div class="choice-cards">
          <label><input type="radio" name="fulfillment" value="delivery" ${saved.fulfillment !== "collection" ? "checked" : ""}><span><strong>Deliver to my unit</strong><small>The seller brings it to you</small></span></label>
          <label><input type="radio" name="fulfillment" value="collection" ${saved.fulfillment === "collection" ? "checked" : ""}><span><strong>I'll collect it</strong><small>Pick up from the shop</small></span></label>
        </div>

        <h3 class="form-step">How will you pay?</h3>
        <div class="choice-cards">
          <label><input type="radio" name="payment" value="cash" checked><span><strong>Cash</strong><small>Pay when you receive it</small></span></label>
          <label><input type="radio" name="payment" value="qr"><span><strong>QR transfer</strong><small>Scan after placing order</small></span></label>
        </div>
        <div class="note warn" id="qrWarning" hidden>${qrMissing.length ? `${qrMissing.length === shopIds.length ? "These shops haven't" : "Some shops haven't"} added a payment QR yet — you may need to contact them.` : ""}</div>

        <button class="btn btn-primary btn-block checkout-submit">Place order</button>
        <p class="fine">${db() ? "Your name, phone and location are shared with the shops in this order so they can reach you." : "Sample preview — no real order is sent."}</p>
      </form>`,
    );
    const form = $("#checkoutForm");
    const updateTotal = () => {
      let sum = 0;
      $$("[data-line-id]", form).forEach((input) => {
        const item = cart.find((x) => x.id === input.dataset.lineId);
        if (!item) return;
        const qty = Math.max(1, Number(input.value) || 1);
        sum += item.price * qty;
        $(`[data-line-total="${CSS.escape(item.id)}"]`, form).textContent = money(item.price * qty);
      });
      $("#checkoutTotal").textContent = money(sum);
    };
    $$("[data-line-id]", form).forEach((input) => input.addEventListener("input", updateTotal));
    $$("[data-remove]", form).forEach((button) =>
      button.addEventListener("click", () => {
        cart = cart.filter((i) => i.id !== button.dataset.remove);
        renderCart();
        if (cart.length) checkout();
        else {
          closeModal();
          toast("Your bag is now empty");
        }
      }),
    );
    $$("[name=payment]", form).forEach((r) => r.addEventListener("change", () => ($("#qrWarning").hidden = !(r.value === "qr" && r.checked && qrMissing.length))));

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const d = new FormData(form);
      const button = $(".checkout-submit", form);
      busy(button, true, "Placing order…");
      const finalItems = cart.map((i) => ({ ...i, qty: Math.max(1, Number($(`[data-line-id="${CSS.escape(i.id)}"]`, form).value) || 1) }));
      const details = { buyer: String(d.get("buyer")).trim(), phone: String(d.get("phone")).trim(), unit: String(d.get("unit")).trim(), fulfillment: d.get("fulfillment") };
      write("p18-checkout-details", details);
      const payment = d.get("payment");
      try {
        let orderId;
        if (db()) {
          const { data, error } = await db().rpc("place_marketplace_order", {
            p_buyer_name: details.buyer,
            p_phone: details.phone,
            p_delivery_location: details.unit,
            p_payment_method: payment,
            p_items: finalItems.map((i) => ({ product_id: i.id, quantity: i.qty })),
          });
          if (error) throw error;
          orderId = data;
          if (details.fulfillment === "collection") {
            // Needs the workflow migration; ignore if it isn't installed.
            await db().rpc("set_marketplace_order_fulfillment", { p_order_id: orderId, p_fulfillment_method: "collection" });
          }
        } else {
          orderId = "demo-" + Date.now().toString(36);
          const orders = read("p18-demo-orders", []);
          orders.unshift({
            id: orderId,
            buyer_name: details.buyer,
            phone: details.phone,
            delivery_location: details.unit,
            fulfillment_method: details.fulfillment,
            payment_method: payment,
            payment_status: payment === "qr" ? "awaiting_confirmation" : "unpaid",
            status: "pending",
            total_rm: finalItems.reduce((n, i) => n + i.price * i.qty, 0),
            created_at: new Date().toISOString(),
            order_items: finalItems.map((i) => ({ product_name: i.name, quantity: i.qty, unit_price_rm: i.price, shop_id: i.shopId })),
          });
          write("p18-demo-orders", orders);
          finalItems.forEach((fi) => {
            const it = shops.flatMap((s) => s.items).find((x) => x.id === fi.id);
            if (it && it.stock !== undefined) it.stock = Math.max(0, it.stock - fi.qty);
          });
        }
        cart = [];
        renderCart();
        if (db()) await loadMarketplace(me());
        else render();
        if (payment === "qr") showQrPayment(finalItems, orderId);
        else
          openModal(
            "Order placed!",
            `Order ${String(orderId).slice(0, 8).toUpperCase()}`,
            `<p class="lead-text">The shop${new Set(finalItems.map((i) => i.shopId)).size > 1 ? "s have" : " has"} your order. ${details.fulfillment === "collection" ? "They'll let you know when it's ready to collect." : "They'll bring it to your unit."} Have cash ready — <b>${money(finalItems.reduce((n, i) => n + i.price * i.qty, 0))}</b>.</p>
             <div class="button-row"><button class="btn btn-primary" data-action="my-orders">View my orders</button><button class="btn btn-ghost" data-close>Keep browsing</button></div>`,
          );
      } catch (err) {
        busy(button, false);
        toast(err.message || "Could not place that order", 5000);
      }
    });
  }

  function profilePanel() {
    const user = me();
    const profile = window.PRESINT18_PROFILE || {};
    const name = profile.full_name || user?.user_metadata?.full_name || user?.email || "Marketplace member";
    const role = profile.is_admin ? "Admin" : isSeller() ? "Buyer & seller" : "Buyer";
    const myShops = shops.filter(ownsShop);
    const link = (action, label, show = true) => (show ? `<button class="menu-item" data-action="${action}">${label}<span aria-hidden="true">›</span></button>` : "");
    openModal(
      "Your account",
      window.PRESINT18_DEMO ? "Sample preview" : "Signed in",
      `<div class="profile-card"><span class="avatar big">${esc(name.charAt(0).toUpperCase())}</span><div><strong>${esc(name)}</strong><p>${esc(user?.email || "")}</p><span class="pill">${role}${profile.department ? ` · ${esc(profile.department)}` : ""}</span></div></div>
       <div class="menu">
         ${link("my-orders", "My orders")}
         ${link("add-listing", "Add an item to my shop", isSeller() && myShops.length)}
         ${link("open-shop", myShops.length ? "Open another shop" : "Open a unit shop", isSeller())}
         ${link("shop-orders", "Orders for my shop", isSeller() && !window.PRESINT18_DEMO)}
         ${link("admin", "Admin control room", !!profile.is_admin && !window.PRESINT18_DEMO)}
       </div>
       ${window.PRESINT18_DEMO ? '<button class="btn btn-ghost btn-block" data-action="reset-demo">Reset sample data</button>' : ""}
       <button class="btn btn-ghost btn-block" id="signOutButton">${window.PRESINT18_DEMO ? "Exit preview" : "Sign out"}</button>`,
    );
    $("#signOutButton").addEventListener("click", async () => {
      try {
        await window.PRESINT18_SIGN_OUT?.();
        closeModal();
      } catch (err) {
        toast(err.message || "Could not sign out");
      }
    });
  }

  function passwordRecoveryForm() {
    openModal(
      "Choose a new password",
      "Password reset",
      `<form id="newPasswordForm" class="form"><label class="field"><span>New password</span><input name="password" type="password" minlength="8" autocomplete="new-password" required></label><button class="btn btn-primary btn-block">Save new password</button></form>`,
    );
    $("#newPasswordForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      if (!form.reportValidity()) return;
      const { error } = await window.PRESINT18_SUPABASE.auth.updateUser({ password: form.elements.password.value });
      if (error) return toast(error.message);
      closeModal();
      toast("Password updated");
    });
  }

  // ---------- Events ----------
  document.addEventListener("click", (e) => {
    const t = e.target.closest("button,[data-add]");
    if (!t || t.closest(".auth-gate")) return;
    const a = t.dataset;
    if (t.id === "cartOpen") openCart();
    else if (t.id === "sellerOpen" || a.action === "add-listing") listingForm();
    else if (a.addListing) listingForm(a.addListing);
    else if (t.id === "shopOpen" || t.id === "shopOpenHero" || a.action === "open-shop") shopForm();
    else if (a.close !== undefined) { closeModal(); closeCart(); }
    else if (a.market) { activeMarket = a.market; render(); }
    else if (a.filter) { filter = a.filter; render(); }
    else if (a.add) { if (t.getAttribute("aria-disabled") !== "true") addToCart(a.add); else if (!shops.find((s) => s.items.some((i) => i.id === a.add) && ownsShop(s))) toast("Sorry, that one is sold out"); }
    else if (a.customize) customizeForm(a.customize);
    else if (a.manage) manageItems(a.manage);
    else if (a.qty) {
      const line = cart.find((x) => x.id === a.qty);
      if (line) {
        const next = line.qty + Number(a.step);
        if (line.stock !== undefined && next > line.stock) return toast(`Only ${line.stock} available`);
        line.qty = next;
        if (line.qty < 1) cart = cart.filter((x) => x.id !== line.id);
        renderCart();
      }
    } else if (t.id === "checkoutOpen") checkout();
    else if (t.id === "profileOpen") profilePanel();
    else if (a.action === "clear-filters") {
      filter = "Everything"; activeMarket = "all"; query = ""; $("#searchInput").value = ""; render();
    } else if (a.action === "reset-demo") {
      ["p18-demo-shops", "p18-demo-cart", "p18-demo-orders"].forEach((k) => { try { localStorage.removeItem(k); } catch {} });
      closeModal();
      loadMarketplace(me());
      toast("Sample data reset");
    } else if (a.action === "my-orders") window.dispatchEvent(new CustomEvent("p18:open", { detail: "buyer" }));
    else if (a.action === "shop-orders") window.dispatchEvent(new CustomEvent("p18:open", { detail: "seller" }));
    else if (a.action === "admin") window.dispatchEvent(new CustomEvent("p18:open", { detail: "admin" }));
  });

  window.addEventListener("p18:auth", (e) => {
    if (e.detail.user) loadMarketplace(e.detail.user);
    else {
      loadToken++;
      shops = [];
      cart = [];
      highlightIds = [];
      window.PRESINT18_PROFILE = null;
      setSellerControls();
      closeModal();
      closeCart();
      render();
    }
  });
  window.addEventListener("p18:refresh-marketplace", () => me() && loadMarketplace(me()));
  window.addEventListener("p18:password-recovery", passwordRecoveryForm);

  let searchTimer;
  $("#searchInput").addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      query = e.target.value;
      renderShops();
    }, 120);
  });
  $("#scrim").addEventListener("click", () => { closeModal(); closeCart(); });
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  $("#searchKey").textContent = isMac ? "⌘ K" : "Ctrl K";
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeModal(); closeCart(); }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && document.body.classList.contains("authenticated")) {
      e.preventDefault();
      $("#searchInput").focus();
      $("#market").scrollIntoView({ behavior: "smooth" });
    }
  });

  // Shared with workflows.js
  window.P18 = { openModal, closeModal, toast, esc, money, busy, read, marketById, todayKL, MARKETS, shops: () => shops };

  render();
  if (me()) loadMarketplace(me());
})();
