/* Orders, seller workspace, receipts and the owner-admin control room. */
(() => {
  "use strict";
  const $ = (s, root = document) => root.querySelector(s);
  const P = () => window.P18;
  const esc = (v) => P().esc(v);
  const money = (v) => P().money(v);
  const db = () => (window.PRESINT18_DEMO ? null : window.PRESINT18_SUPABASE);
  let role = { admin: false, seller: false, user: null };

  const STATUS_LABEL = { pending: "New", accepted: "Accepted", ready: "Ready", completed: "Completed", cancelled: "Cancelled" };
  const PAY_LABEL = { unpaid: "Not paid yet", awaiting_confirmation: "Checking payment", confirmed: "Paid" };
  const ORDER_SELECT = "id,buyer_id,buyer_name,phone,delivery_location,fulfillment_method,payment_method,payment_status,status,total_rm,created_at,payment_receipt_path,order_items(id,shop_id,product_name,quantity,unit_price_rm)";

  const run = async (promise) => {
    const { data, error } = await promise;
    if (error) throw error;
    return data;
  };
  const when = (iso) => {
    try {
      return new Date(iso).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  function setRole(profile, user) {
    role = { admin: !!profile?.is_admin, seller: profile?.account_type === "seller", user };
    $("#myOrdersOpen").hidden = !user;
    $("#sellerOrdersOpen").hidden = !user || !role.seller || !!window.PRESINT18_DEMO;
    $("#adminOpen").hidden = !user || !role.admin || !!window.PRESINT18_DEMO;
  }
  async function syncRole(user) {
    if (!user) return setRole(null, null);
    if (!db()) return setRole({ account_type: "seller" }, user);
    const { data, error } = await db().from("profiles").select("account_type,is_admin,department,full_name").eq("id", user.id).maybeSingle();
    if (error) {
      setRole(null, user);
      return;
    }
    window.PRESINT18_PROFILE = { ...(window.PRESINT18_PROFILE || {}), ...data };
    setRole(data, user);
  }

  // ---------- Order cards ----------
  function orderCard(o, view) {
    const lines = (o.order_items || []).map((i) => `<li><span>${esc(i.product_name)} × ${i.quantity}</span><span>${money(i.unit_price_rm * i.quantity)}</span></li>`).join("");
    const subtotal = (o.order_items || []).reduce((n, i) => n + i.unit_price_rm * i.quantity, 0);
    const receipt = o.payment_receipt_path
      ? `<button class="btn btn-small btn-ghost" data-receipt="${esc(o.id)}" data-path="${esc(o.payment_receipt_path)}">View receipt</button><span class="receipt-slot" id="receipt-${esc(o.id)}"></span>`
      : "";
    let controls = "";
    if (view === "buyer") {
      if (o.payment_method === "qr" && !o.payment_receipt_path && o.status !== "cancelled" && db()) {
        controls = `<form class="receipt-form" data-receipt-form="${esc(o.id)}">
          <p class="small"><b>Paid by QR?</b> Upload your receipt so the seller can confirm.</p>
          <label class="field"><span>Receipt image</span><input name="receipt" type="file" accept="image/jpeg,image/png,image/webp" required></label>
          <label class="field"><span>Reference number <small>(optional)</small></span><input name="reference" maxlength="100"></label>
          <button class="btn btn-primary btn-small">Submit receipt</button></form>`;
      }
    } else {
      controls = `<div class="order-controls">
        <label class="field"><span>Order status</span><select data-order-status="${esc(o.id)}">${Object.entries(STATUS_LABEL).map(([v, l]) => `<option value="${v}" ${o.status === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="field"><span>Payment</span><select data-payment-status="${esc(o.id)}">${Object.entries(PAY_LABEL).map(([v, l]) => `<option value="${v}" ${o.payment_status === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <button class="btn btn-small btn-primary" data-update-order="${esc(o.id)}">Save</button>
      </div>`;
    }
    const contact = view === "buyer" ? "" : `<p class="small">${esc(o.buyer_name)} · <a href="https://wa.me/${esc(String(o.phone).replace(/\D/g, "").replace(/^0/, "60"))}" target="_blank" rel="noopener">${esc(o.phone)}</a></p>`;
    return `<article class="order-card status-${esc(o.status)}">
      <div class="order-head"><div><strong>Order ${esc(String(o.id).slice(0, 8).toUpperCase())}</strong><span class="muted small">${when(o.created_at)}</span></div><b>${money(view === "seller" ? subtotal : o.total_rm)}</b></div>
      <div class="pills"><span class="pill status">${STATUS_LABEL[o.status] || esc(o.status)}</span><span class="pill pay-${esc(o.payment_status)}">${o.payment_method === "qr" ? "QR · " : "Cash · "}${PAY_LABEL[o.payment_status] || esc(o.payment_status)}</span><span class="pill">${o.fulfillment_method === "collection" ? "Self-collect" : "Deliver"} · ${esc(o.delivery_location)}</span></div>
      ${contact}
      <ul class="order-lines">${lines}</ul>
      ${receipt}${controls}
    </article>`;
  }

  async function loadOrders(view) {
    if (!role.user) return;
    const title = view === "buyer" ? "My orders" : view === "seller" ? "Orders for my shop" : "All orders";
    P().openModal(title, view === "buyer" ? "Order history" : "Seller workspace", '<div class="loading-row"><span class="spinner"></span> Loading orders…</div>', { wide: true });
    try {
      let rows;
      if (!db()) rows = P().read("p18-demo-orders", []);
      else {
        let query = db().from("orders").select(ORDER_SELECT).order("created_at", { ascending: false }).limit(100);
        if (view === "buyer") query = query.eq("buyer_id", role.user.id);
        rows = await run(query);
        if (view === "seller") {
          const shops = await run(db().from("shops").select("id").eq("owner_id", role.user.id));
          const ids = new Set(shops.map((s) => s.id));
          rows = rows.map((o) => ({ ...o, order_items: (o.order_items || []).filter((i) => ids.has(i.shop_id)) })).filter((o) => o.order_items.length);
        }
      }
      const open = rows.filter((o) => !["completed", "cancelled"].includes(o.status)).length;
      const total = rows.reduce((sum, o) => sum + (view === "seller" ? o.order_items.reduce((n, i) => n + i.unit_price_rm * i.quantity, 0) : Number(o.total_rm || 0)), 0);
      $("#modalContent").innerHTML = rows.length
        ? `<div class="stats"><div><b>${rows.length}</b><span>orders</span></div><div><b>${open}</b><span>in progress</span></div><div><b>${money(total)}</b><span>${view === "buyer" ? "spent" : "order value"}</span></div></div>${rows.map((o) => orderCard(o, view)).join("")}`
        : `<div class="empty-state"><span class="empty-icon" aria-hidden="true">🧾</span><h3>No orders yet</h3><p>${view === "buyer" ? "When you place an order it'll show up here." : "Orders for your shop will appear here."}</p><button class="btn btn-ghost" data-close>Back to the market</button></div>`;
    } catch (e) {
      $("#modalContent").innerHTML = `<div class="note warn">${esc(e.message || "Could not load orders.")}</div>`;
    }
  }

  async function adminPanel() {
    if (!role.admin) return P().toast("Admin access is required.");
    P().openModal("Control room", "Owner admin", '<div class="loading-row"><span class="spinner"></span> Loading admin tools…</div>', { wide: true });
    try {
      const [shops, orders, products, highlights] = await Promise.all([
        run(db().from("shops").select("id,name,unit_department,location,market_id,status,created_at,owner_id").order("created_at", { ascending: false })),
        run(db().from("orders").select(ORDER_SELECT).order("created_at", { ascending: false }).limit(75)),
        run(db().from("products").select("id,name,unit_price_rm,shop_id,shops(name,market_id,status)").eq("active", true).order("created_at", { ascending: false }).limit(250)),
        run(db().from("daily_highlights").select("rank,product_id,sponsored").eq("feature_date", P().todayKL()).order("rank")),
      ]);
      const pending = shops.filter((s) => s.status === "pending");
      const total = orders.reduce((n, o) => n + Number(o.total_rm || 0), 0);
      const marketName = (id) => P().marketById(id).name;
      const liveProducts = products.filter((p) => p.shops?.status === "active");
      $("#modalContent").innerHTML = `
        <div class="stats four"><div><b>${shops.length}</b><span>shops</span></div><div class="${pending.length ? "attention" : ""}"><b>${pending.length}</b><span>awaiting approval</span></div><div><b>${orders.length}</b><span>recent orders</span></div><div><b>${money(total)}</b><span>order value</span></div></div>
        <section class="panel-section"><h3>Shops waiting for approval</h3>${
          pending.length
            ? pending.map((s) => `<article class="row"><div><strong>${esc(s.name)}</strong><p class="small muted">${esc(s.unit_department)} · ${esc(marketName(s.market_id))}<br>${esc(s.location)}</p></div><div class="button-row"><button class="btn btn-small btn-primary" data-shop-review="${esc(s.id)}" data-status="active">Approve</button><button class="btn btn-small btn-ghost" data-shop-review="${esc(s.id)}" data-status="suspended">Decline</button></div></article>`).join("")
            : '<p class="muted small">Nothing to review — all caught up.</p>'
        }</section>
        <section class="panel-section"><h3>Today's top three</h3>
          <p class="small muted">${[1, 2, 3].map((r) => { const h = highlights.find((x) => x.rank === r); return `#${r}: ${h ? esc(products.find((p) => p.id === h.product_id)?.name || "Listing") + (h.sponsored ? " · sponsored" : "") : "<i>auto</i>"}`; }).join(" &nbsp;·&nbsp; ")}</p>
          <div class="form-grid three"><label class="field"><span>Position</span><select id="highlightRank"><option value="1">#1 Top pick</option><option value="2">#2</option><option value="3">#3</option></select></label>
          <label class="field span2"><span>Item</span><select id="highlightProduct"><option value="">Choose an item…</option>${liveProducts.map((p) => `<option value="${esc(p.id)}">${esc(p.name)} — ${esc(p.shops?.name || "Shop")}</option>`).join("")}</select></label></div>
          <div class="button-row"><label class="check"><input id="highlightSponsored" type="checkbox"> Mark as sponsored</label><button class="btn btn-small btn-primary" id="saveHighlight">Save pick</button></div>
        </section>
        <section class="panel-section"><h3>Recent orders</h3>${orders.length ? orders.slice(0, 30).map((o) => orderCard(o, "admin")).join("") : '<p class="muted small">No orders yet.</p>'}</section>`;
      $("#saveHighlight").addEventListener("click", saveHighlight);
    } catch (e) {
      $("#modalContent").innerHTML = `<div class="note warn">${esc(e.message || "Could not load admin tools.")}</div>`;
    }
  }

  async function saveHighlight() {
    try {
      const product_id = $("#highlightProduct").value;
      if (!product_id) throw new Error("Choose an item first.");
      await run(db().from("daily_highlights").upsert({ feature_date: P().todayKL(), rank: Number($("#highlightRank").value), product_id, sponsored: $("#highlightSponsored").checked }, { onConflict: "feature_date,rank" }));
      P().toast("Today's pick saved");
      window.dispatchEvent(new CustomEvent("p18:refresh-marketplace"));
      adminPanel();
    } catch (e) {
      P().toast(e.message);
    }
  }

  let lastView = "buyer";
  async function saveOrder(button) {
    const id = button.dataset.updateOrder;
    const status = $(`[data-order-status="${CSS.escape(id)}"]`)?.value;
    const payment = $(`[data-payment-status="${CSS.escape(id)}"]`)?.value;
    if (!status || !payment) return;
    P().busy(button, true);
    try {
      await run(db().rpc("manage_marketplace_order", { p_order_id: id, p_status: status, p_payment_status: payment }));
      P().toast("Order updated");
      P().busy(button, false);
      button.textContent = "Saved ✓";
    } catch (e) {
      P().busy(button, false);
      P().toast(e.message || "Could not update the order.", 5000);
    }
  }
  async function uploadReceipt(form) {
    const id = form.dataset.receiptForm;
    const file = form.elements.receipt.files[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return P().toast("Choose a JPG, PNG or WebP image.");
    if (file.size > 5 * 1024 * 1024) return P().toast("That image is over 5 MB — try a screenshot instead.");
    const button = form.querySelector("button");
    P().busy(button, true, "Uploading…");
    try {
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${role.user.id}/${id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await db().storage.from("marketplace-receipts").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      await run(db().rpc("attach_marketplace_receipt", { p_order_id: id, p_receipt_path: path, p_reference: form.elements.reference.value }));
      P().toast("Receipt sent to the seller");
      loadOrders("buyer");
    } catch (e) {
      P().busy(button, false);
      P().toast(e.message || "Could not submit the receipt.", 5000);
    }
  }
  async function viewReceipt(button) {
    try {
      const { data, error } = await db().storage.from("marketplace-receipts").createSignedUrl(button.dataset.path, 300);
      if (error) throw error;
      $(`#receipt-${CSS.escape(button.dataset.receipt)}`).innerHTML = `<a href="${esc(data.signedUrl)}" target="_blank" rel="noopener">Open receipt ↗</a>`;
    } catch (e) {
      P().toast(e.message || "Could not open receipt.");
    }
  }

  function open(view) {
    lastView = view;
    if (view === "admin") adminPanel();
    else loadOrders(view);
  }

  document.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.id === "adminOpen") open("admin");
    if (b.id === "myOrdersOpen") open("buyer");
    if (b.id === "sellerOrdersOpen") open("seller");
    if (b.dataset.shopReview) {
      if (!role.admin) return P().toast("Admin access is required.");
      P().busy(b, true, "…");
      try {
        await run(db().from("shops").update({ status: b.dataset.status }).eq("id", b.dataset.shopReview));
        P().toast(b.dataset.status === "active" ? "Shop approved — it's now visible to everyone" : "Shop declined");
        window.dispatchEvent(new CustomEvent("p18:refresh-marketplace"));
        adminPanel();
      } catch (err) {
        P().busy(b, false);
        P().toast(err.message || "Could not review shop.");
      }
    }
    if (b.dataset.updateOrder) saveOrder(b);
    if (b.dataset.receipt) viewReceipt(b);
  });
  document.addEventListener("submit", (e) => {
    if (e.target.matches("[data-receipt-form]")) {
      e.preventDefault();
      uploadReceipt(e.target);
    }
  });
  window.addEventListener("p18:open", (e) => open(e.detail));
  window.addEventListener("p18:auth", (e) => syncRole(e.detail.user).catch(() => {}));
  if (window.PRESINT18_USER) syncRole(window.PRESINT18_USER).catch(() => {});
})();
