/* Admin, order-history, seller order and receipt workflows adapted to this project's schema. */
(() => {
  const $ = (s) => document.querySelector(s);
  const markets = [
    ['pejabat-kesihatan-putrajaya','Pejabat Kesihatan Putrajaya'],
    ['presint-9','Klinik Kesihatan Presint 9'],['presint-11','Klinik Kesihatan Presint 11'],
    ['presint-14','Klinik Kesihatan Presint 14'],['presint-18','Klinik Kesihatan Presint 18']
  ];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = (v) => `RM ${Number(v || 0).toFixed(2)}`;
  const db = () => window.PRESINT18_SUPABASE;
  let role = {admin:false,seller:false,user:null};

  const actions = $('.top-actions');
  if (!actions) return;
  actions.insertAdjacentHTML('beforeend', '<button class="seller-link workflow-button" id="myOrdersOpen" hidden>My orders</button><button class="seller-link workflow-button" id="sellerOrdersOpen" hidden>Shop orders</button><button class="seller-link workflow-button" id="adminOpen" hidden>Admin</button>');
  const formObserver = new MutationObserver(() => {
    const form=$('#listingForm');if(!form||form.dataset.conditionControl)return;
    form.dataset.conditionControl='ready';const category=form.elements.category,condition=form.elements.condition,field=condition?.closest('.field');
    if(!category||!condition||!field)return;
    const sync=()=>{field.hidden=category.value!=='Physical goods';condition.disabled=category.value!=='Physical goods';};
    category.addEventListener('change',sync);sync();
  });
  formObserver.observe($('#modalContent'),{childList:true,subtree:true});

  function message(text) {
    const toast = $('#toast'); if (!toast) return;
    toast.textContent = text; toast.classList.add('show'); clearTimeout(message.timer);
    message.timer = setTimeout(() => toast.classList.remove('show'), 3000);
  }
  function showPanel(title, eyebrow, content) {
    $('#modalTitle').textContent = title; $('#modalEyebrow').textContent = eyebrow;
    $('#modalContent').innerHTML = content; $('#modal').classList.add('open');
    $('#modal').setAttribute('aria-hidden','false'); $('#scrim').classList.add('open');
  }
  function setRole(profile, user) {
    role = {admin:!!profile?.is_admin,seller:profile?.account_type==='seller',user};
    $('#myOrdersOpen').hidden = !user;
    $('#sellerOrdersOpen').hidden = !user || !role.seller;
    $('#adminOpen').hidden = !user || !role.admin;
  }
  async function syncRole(user) {
    if (!user || !db()) { setRole(null,null); return; }
    const {data,error}=await db().from('profiles').select('account_type,is_admin').eq('id',user.id).maybeSingle();
    if(error){setRole(null,user);message(`Could not load account roles: ${error.message}`);return;}
    window.PRESINT18_PROFILE=data;setRole(data,user);
  }
  async function run(promise) { const {data,error}=await promise; if(error) throw error; return data; }
  const today = () => new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kuala_Lumpur'});

  async function adminPanel() {
    if(!role.admin) return message('Admin access is required.');
    showPanel('Marketplace control room','OWNER ADMIN', '<div class="workflow-loading">Loading admin tools…</div>');
    try {
      const [shops,orders,products,highlights]=await Promise.all([
        run(db().from('shops').select('id,name,unit_department,location,market_id,status,created_at,owner_id').order('created_at',{ascending:false})),
        run(db().from('orders').select('id,buyer_name,phone,delivery_location,fulfillment_method,payment_method,payment_status,status,total_rm,created_at,payment_receipt_path,order_items(id,shop_id,product_name,quantity,unit_price_rm)').order('created_at',{ascending:false}).limit(75)),
        run(db().from('products').select('id,name,unit_price_rm,shop_id,shops(name,market_id)').eq('active',true).order('created_at',{ascending:false}).limit(250)),
        run(db().from('daily_highlights').select('rank,product_id,sponsored').eq('feature_date',today()).order('rank'))
      ]);
      const pending=shops.filter(s=>s.status==='pending');
      const total=orders.reduce((n,o)=>n+Number(o.total_rm||0),0);
      $('#modalContent').innerHTML=`<div class="workflow-stats"><div><b>${shops.length}</b><span>shops</span></div><div><b>${pending.length}</b><span>awaiting approval</span></div><div><b>${orders.length}</b><span>recent orders</span></div><div><b>${money(total)}</b><span>recent order value</span></div></div>
        <section class="workflow-section"><h3>Seller shop approvals</h3>${pending.length?pending.map(s=>`<article class="workflow-row"><div><strong>${esc(s.name)}</strong><p>${esc(s.unit_department)} · ${esc(markets.find(m=>m[0]===s.market_id)?.[1]||s.market_id)}<br>${esc(s.location)}</p></div><div class="workflow-actions"><button class="primary-button" data-shop-review="${esc(s.id)}" data-status="active">Approve</button><button class="secondary-button" data-shop-review="${esc(s.id)}" data-status="suspended">Decline</button></div></article>`).join(''):'<p class="workflow-muted">No shops are waiting for approval.</p>'}</section>
        <section class="workflow-section"><h3>Today’s top three</h3><div class="form-grid"><label class="workflow-field">Rank<select id="highlightRank"><option value="1">1 · Top pick</option><option value="2">2 · Featured</option><option value="3">3 · Featured</option></select></label><label class="workflow-field">Item<select id="highlightProduct"><option value="">Choose a listing</option>${products.map(p=>`<option value="${esc(p.id)}">${esc(p.name)} · ${esc(p.shops?.name||'Shop')}</option>`).join('')}</select></label></div><label class="workflow-check"><input id="highlightSponsored" type="checkbox"> Mark as sponsored</label><button class="primary-button" id="saveHighlight">Save highlight</button><div class="workflow-muted">${highlights.map(h=>`Rank ${h.rank}: ${esc(products.find(p=>p.id===h.product_id)?.name||'Listing')} ${h.sponsored?'· Sponsored':''}`).join('<br>')||'No highlights set for today.'}</div></section>
        <section class="workflow-section"><h3>Recent orders</h3>${orders.length?orders.slice(0,30).map(o=>orderCard(o,'admin')).join(''):'<p class="workflow-muted">No orders yet.</p>'}</section>`;
      wireOrderControls();
    } catch(e) { $('#modalContent').innerHTML=`<p class="workflow-error">${esc(e.message||'Could not load admin tools.')}</p>`; }
  }
  function orderCard(o, view) {
    const lines=(o.order_items||[]).map(i=>`<li>${esc(i.product_name)} × ${i.quantity} · ${money(i.unit_price_rm* i.quantity)}</li>`).join('');
    const receipt=o.payment_receipt_path?`<button class="secondary-button" data-receipt="${esc(o.id)}" data-path="${esc(o.payment_receipt_path)}">View receipt</button>`:'';
    const controls=view==='buyer'?(o.payment_method==='qr'&&!o.payment_receipt_path&&o.status!=='cancelled'?`<form class="receipt-form" data-receipt-form="${esc(o.id)}"><label class="workflow-field">Payment receipt (image)<input name="receipt" type="file" accept="image/jpeg,image/png,image/webp" required></label><label class="workflow-field">Reference (optional)<input name="reference" maxlength="100"></label><button class="primary-button">Submit receipt</button></form>`:''):`<div class="form-grid order-controls"><label class="workflow-field">Order status<select data-order-status="${esc(o.id)}">${['pending','accepted','ready','completed','cancelled'].map(x=>`<option ${o.status===x?'selected':''}>${x}</option>`).join('')}</select></label><label class="workflow-field">Payment status<select data-payment-status="${esc(o.id)}">${['unpaid','awaiting_confirmation','confirmed'].map(x=>`<option ${o.payment_status===x?'selected':''}>${x}</option>`).join('')}</select></label></div><button class="secondary-button" data-update-order="${esc(o.id)}">Save order update</button>`;
    return `<article class="workflow-order"><div class="workflow-order-head"><strong>Order ${esc(o.id.slice(0,8).toUpperCase())}</strong><b>${money(o.total_rm)}</b></div><p>${esc(o.buyer_name)} · ${esc(o.phone)}<br>${esc(o.delivery_location)} · ${esc(o.fulfillment_method||'delivery')}<br><span>${esc(o.status)} · ${esc(o.payment_method)} / ${esc(o.payment_status)}</span></p><ul>${lines}</ul>${receipt}<div class="receipt-slot" id="receipt-${esc(o.id)}"></div>${controls}</article>`;
  }
  async function loadOrders(view) {
    if(!role.user)return;
    showPanel(view==='buyer'?'My orders':view==='seller'?'Shop orders':'Marketplace orders',view==='buyer'?'ORDER HISTORY':view==='seller'?'SELLER WORKSPACE':'ADMIN WORKSPACE','<div class="workflow-loading">Loading orders…</div>');
    try {
      let query=db().from('orders').select('id,buyer_id,buyer_name,phone,delivery_location,fulfillment_method,payment_method,payment_status,status,total_rm,created_at,payment_receipt_path,order_items(id,shop_id,product_name,quantity,unit_price_rm)').order('created_at',{ascending:false}).limit(100);
      if(view==='buyer') query=query.eq('buyer_id',role.user.id);
      let rows=await run(query);
      if(view==='seller'){
        const shops=await run(db().from('shops').select('id').eq('owner_id',role.user.id));const ids=new Set(shops.map(s=>s.id));
        rows=rows.map(o=>({...o,order_items:(o.order_items||[]).filter(i=>ids.has(i.shop_id))})).filter(o=>o.order_items.length);
      }
      const total=rows.reduce((sum,o)=>sum+Number(o.total_rm||0),0);
      $('#modalContent').innerHTML=(rows.length?`<div class="workflow-report"><strong>${money(total)}</strong><span>${view==='buyer'?'Total spent':'Order value'} across ${rows.length} order${rows.length===1?'':'s'}</span></div>`:'')+(rows.length?rows.map(o=>orderCard(o,view)).join(''):'<div class="empty-state">No orders to show yet.</div>');
      wireOrderControls();
    } catch(e) { $('#modalContent').innerHTML=`<p class="workflow-error">${esc(e.message||'Could not load orders.')}</p>`; }
  }
  function wireOrderControls(){
    $('#saveHighlight')?.addEventListener('click',async()=>{try{if(!role.admin)throw new Error('Admin access is required.');const product_id=$('#highlightProduct').value,rank=Number($('#highlightRank').value);if(!product_id)throw new Error('Choose an item first.');await run(db().from('daily_highlights').upsert({feature_date:today(),rank,product_id,sponsored:$('#highlightSponsored').checked},{onConflict:'feature_date,rank'}));message('Today’s highlight saved.');adminPanel();}catch(e){message(e.message)}});
  }
  async function saveOrder(id){
    const status=$(`[data-order-status="${CSS.escape(id)}"]`)?.value;
    const payment=$(`[data-payment-status="${CSS.escape(id)}"]`)?.value;
    if(!status||!payment)return;
    try{await run(db().rpc('manage_marketplace_order',{p_order_id:id,p_status:status,p_payment_status:payment}));message('Order updated.');await loadOrders(role.admin?'admin':role.seller?'seller':'buyer');}
    catch(e){message(e.message||'Could not update the order.');}
  }
  async function uploadReceipt(form){
    const id=form.dataset.receiptForm,file=form.elements.receipt.files[0];if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type))return message('Choose a JPG, PNG or WebP receipt image.');
    try{
      const path=`${role.user.id}/${id}/${crypto.randomUUID()}.${file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg'}`;
      const {error}=await db().storage.from('marketplace-receipts').upload(path,file,{contentType:file.type,upsert:false});if(error)throw error;
      await run(db().rpc('attach_marketplace_receipt',{p_order_id:id,p_receipt_path:path,p_reference:form.elements.reference.value}));
      message('Receipt submitted for seller review.');await loadOrders('buyer');
    }catch(e){message(e.message||'Could not submit the receipt.');}
  }
  async function viewReceipt(button){
    try{const {data,error}=await db().storage.from('marketplace-receipts').createSignedUrl(button.dataset.path,300);if(error)throw error;const slot=$(`#receipt-${CSS.escape(button.dataset.receipt)}`);slot.innerHTML=`<a href="${esc(data.signedUrl)}" target="_blank" rel="noopener">Open private receipt</a>`;}
    catch(e){message(e.message||'Could not open receipt.');}
  }

  document.addEventListener('click',async e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.id==='adminOpen')adminPanel();
    if(b.id==='myOrdersOpen')loadOrders('buyer');
    if(b.id==='sellerOrdersOpen')loadOrders('seller');
    if(b.dataset.shopReview){if(!role.admin)return message('Admin access is required.');try{const {error}=await db().from('shops').update({status:b.dataset.status}).eq('id',b.dataset.shopReview);if(error)throw error;message(b.dataset.status==='active'?'Shop approved.':'Shop declined.');adminPanel();window.dispatchEvent(new CustomEvent('p18:refresh-marketplace'));}catch(err){message(err.message||'Could not review shop.');}}
    if(b.dataset.updateOrder)saveOrder(b.dataset.updateOrder);
    if(b.dataset.receipt)viewReceipt(b);
  });
  document.addEventListener('submit',e=>{if(e.target.matches('[data-receipt-form]')){e.preventDefault();uploadReceipt(e.target);}});
  window.addEventListener('p18:auth',e=>syncRole(e.detail.user).catch(err=>message(err.message)));
  if(window.PRESINT18_USER)syncRole(window.PRESINT18_USER).catch(err=>message(err.message));
})();
