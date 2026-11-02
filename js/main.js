/* ============================================================
   账房 ERP · 主入口：路由 / 外壳 / 搜索 / 待办 / 锁屏
   ============================================================ */
'use strict';

var MOD_TITLES = {};
MODULES.forEach(function(m){ MOD_TITLES[m.key] = m.label; });

/* ---------- 路由 ---------- */
function parseHash(){
  var h = location.hash || '#/dash';
  if (h === '#/') h = '#/dash';
  var m = h.match(/^#\/([\w-]+)(?:\/([\w-]+))?(?:\?(.*))?$/);
  var mod = m ? m[1] : 'dash';
  var sub = m && m[2] ? m[2] : '';
  var params = {};
  if (m && m[3]) m[3].split('&').forEach(function(p){
    if (!p) return;
    var i = p.indexOf('=');
    var k = i>-1 ? p.slice(0,i) : p, v = i>-1 ? p.slice(i+1) : '';
    try { params[decodeURIComponent(k)] = decodeURIComponent(v); }
    catch(e){ params[k] = v; }
  });
  return { mod:mod, sub:sub, params:params };
}
function renderRoute(){
  route();
}
function route(){
  var ctx = parseHash();
  if (!Views[ctx.mod]) { location.hash = '#/dash'; return; }
  UI.disposeCharts();
  var el = document.getElementById('view');
  window.scrollTo(0, 0);
  Views[ctx.mod].render(el, ctx);
  bindViewActions();
  setActiveNav(ctx.mod);
  setCrumb(ctx.mod, ctx.sub);
  refreshBell();
  closeSidebar();
}

/* ---------- 侧边栏 ---------- */
function renderSidebar(){
  var u = currentUser();
  var inner = document.getElementById('sideInner');
  var nav = visibleModules();
  var isDesktop = window.innerWidth >= 768;
  var collapsed = sideCollapsed();
  var html = '<div class="brand' + (isDesktop ? ' brand-fold' : '') + '"' + (isDesktop ? ' data-act="fold" title="' + (collapsed ? '展开菜单' : '收起菜单') + '"' : '') + '>' +
    '<span class="brand-mark"></span>' +
    '<div class="brand-txt"><div class="brand-name">' + S.company.short + '</div><div class="brand-sub">进销存 · 财务一体化</div></div>' +
    (isDesktop ? '<span class="fold-ind">' + UI.icon(collapsed ? 'chevronR' : 'chevronL', 14) + '</span>' : '') +
    '</div>';
  html += '<div class="nav"><div class="nav-label">业务卷宗</div>' +
    nav.map(function(m){
      return '<div class="nav-item" data-nav="' + m.key + '" title="' + escHtml(m.label) + '">' +
        '<span class="nav-ic">' + UI.icon(m.icon,18) + '</span><span>' + m.label + '</span></div>';
    }).join('') + '</div>';
  html += '<div class="side-user"><span class="user-av">' + escHtml(u.name.slice(0,1)) + '</span>' +
    '<span class="user-meta"><span class="user-name">' + escHtml(u.name) + '</span><span class="user-role">' + escHtml(roleName(u.role)) + '</span></span>' +
    '<button class="icon-btn" data-act="lock" style="margin-left:auto" aria-label="锁屏" type="button">' + UI.icon('lock',16) + '</button></div>';
  inner.innerHTML = html;
  inner.querySelectorAll('.nav-item').forEach(function(it){
    it.addEventListener('click', function(){
      location.hash = '#/' + it.getAttribute('data-nav');
      if (window.innerWidth < 768) closeSidebar();
    });
  });
  var foldBtn = inner.querySelector('[data-act="fold"]');
  if (foldBtn) foldBtn.addEventListener('click', toggleSideCollapse);
  var lockBtn = inner.querySelector('[data-act="lock"]');
  if (lockBtn) lockBtn.addEventListener('click', showLock);
  renderUserChip(u);
}
function escHtml(s){
  return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function setActiveNav(mod){
  document.querySelectorAll('.nav-item').forEach(function(it){
    it.classList.toggle('active', it.getAttribute('data-nav')===mod);
  });
}
function openSidebar(){
  document.getElementById('sidebar').classList.add('on');
  document.getElementById('mask').classList.add('on');
}
function closeSidebar(){
  document.getElementById('sidebar').classList.remove('on');
  document.getElementById('mask').classList.remove('on');
}

/* ---------- 顶栏 ---------- */
function renderUserChip(u){
  document.getElementById('userAv').textContent = u.name.slice(0,1);
  document.getElementById('userName').textContent = u.name;
  document.getElementById('userRole').textContent = roleName(u.role);
}
function setCrumb(mod, sub){
  var el = document.getElementById('crumb');
  var subLabel = '';
  if (sub==='view'){
    var ctx = parseHash();
    var id = ctx.params.id || '';
    var name = '';
    if (mod==='crm'){ var c=byId(S.customers,id); name=c?c.name:''; }
    else if (mod==='sup'){ var s=byId(S.suppliers,id); name=s?s.name:''; }
    else if (mod==='prd'){ var p=byId(S.products,id); name=p?p.name:''; }
    else if (mod==='sale'){ var so=byId(S.salesOrders,id); name=so?so.no:''; }
    else if (mod==='pur'){ var po=byId(S.purchaseOrders,id); name=po?po.no:''; }
    subLabel = name || '详情';
  }
  var dateStr = fmtDate(new Date());
  el.innerHTML = '<span class="crumb-home">' + escHtml(S.company.short) + '</span>' +
    '<span class="crumb-sep">/</span><span>' + escHtml(MOD_TITLES[mod]||'') + '</span>' +
    (subLabel ? '<span class="crumb-sep">/</span><span class="crumb-cur">' + escHtml(subLabel) + '</span>' : '') +
    '<span style="margin-left:auto;font-size:12px;color:var(--ink-3);letter-spacing:.05em">' + dateStr + '</span>';
}
function refreshBell(){
  /* 角标 = 待办总数（待审核销售单 + 待审核采购单 + 库存告急产品），随业务数据实时计算 */
  var n = todoTotal();
  var b = document.getElementById('bellBadge');
  if (n > 0){ b.textContent = n > 99 ? '99+' : n; b.classList.remove('hidden'); }
  else b.classList.add('hidden');
  /* 库存告急同时写入通知历史（供追溯，不影响角标）：每个产品只提醒一次 */
  lowStockList().forEach(function(p){
    if (LOW_NOTIFIED[p.id]) return;
    for (var i = 0; i < NOTES.length; i++){
      if (NOTES[i].type === 'alert' && NOTES[i].title.indexOf(p.name) > -1) return;
    }
    LOW_NOTIFIED[p.id] = true;
    pushNote('alert', '库存告急 · ' + p.name, '现 ' + fmtQty(p.stock) + ' / 安全 ' + fmtQty(p.safety), '#/inv?t=overview&low=1');
  });
}

/* ---------- 全局搜索 ---------- */
function buildSearchIndex(){
  var out = [];
  S.customers.forEach(function(c){ out.push({ icon:'crm', title:c.name, sub:'客户 · ' + (c.contact||'') + ' · ' + (c.phone||''), go:'#/crm/view?id=' + c.id, keys:(c.name+c.contact+c.phone).toLowerCase() }); });
  S.suppliers.forEach(function(s){ out.push({ icon:'sup', title:s.name, sub:'供应商 · ' + (s.contact||''), go:'#/sup/view?id=' + s.id, keys:(s.name+s.contact).toLowerCase() }); });
  S.products.forEach(function(p){ out.push({ icon:'prd', title:p.name, sub:'产品 · ' + (p.sku||'') + ' · ' + catName(p.cat), go:'#/prd/view?id=' + p.id, keys:(p.name+p.sku+p.spec).toLowerCase() }); });
  S.salesOrders.forEach(function(o){ out.push({ icon:'sale', title:o.no, sub:'销售订单 · ' + partnerName('crm',o.custId) + ' · ' + fmtMoney(o.total), go:'#/sale/view?id=' + o.id, keys:(o.no+partnerName('crm',o.custId)).toLowerCase() }); });
  S.purchaseOrders.forEach(function(o){ out.push({ icon:'pur', title:o.no, sub:'采购单 · ' + partnerName('sup',o.supId) + ' · ' + fmtMoney(o.total), go:'#/pur/view?id=' + o.id, keys:(o.no+partnerName('sup',o.supId)).toLowerCase() }); });
  S.inboundDocs.forEach(function(d){ out.push({ icon:'ib', title:d.no, sub:'入库单 · ' + (d.type==='purchase'?'采购入库':'其他入库'), go:'#/ib', keys:d.no.toLowerCase() }); });
  S.outboundDocs.forEach(function(d){ out.push({ icon:'ob', title:d.no, sub:'出库单 · ' + (d.type==='sales'?'销售出库':'其他出库'), go:'#/ob', keys:d.no.toLowerCase() }); });
  return out;
}
function bindSearch(){
  var box = document.getElementById('searchBox');
  var input = document.getElementById('searchInput');
  var res = document.getElementById('searchRes');
  var timer = null;
  input.addEventListener('input', function(){
    clearTimeout(timer);
    timer = setTimeout(function(){
      var q = input.value.trim().toLowerCase();
      if (!q){ res.classList.add('hidden'); return; }
      var idx = buildSearchIndex();
      var hits = idx.filter(function(it){ return it.keys.indexOf(q) > -1; }).slice(0,8);
      var items = hits.map(function(h){
        return { icon:h.icon, title:h.title, sub:h.sub, onClick:function(){ input.value=''; res.classList.add('hidden'); location.hash = h.go; } };
      });
      UI.dropdown(input, items, { empty:'未找到与「' + input.value + '」相关的内容' });
      res.classList.add('hidden');
    }, 180);
  });
  input.addEventListener('keydown', function(ev){
    if (ev.key === 'Enter'){
      var q = input.value.trim().toLowerCase();
      if (!q) return;
      var hits = buildSearchIndex().filter(function(it){ return it.keys.indexOf(q) > -1; });
      if (hits.length){ location.hash = hits[0].go; input.value=''; }
    }
    if (ev.key === 'Escape'){ input.blur(); }
  });
  box.querySelector('#searchIc').innerHTML = UI.icon('search',16);
}

/* ---------- 通知铃铛：通知中心面板 ---------- */
var bellPanelOpen = false;
var bellOutsideBound = false;
var bellRoot = null;
function closeBellPanel(){
  bellPanelOpen = false;
  if (bellRoot) bellRoot.innerHTML = '';
  if (bellOutsideBound){
    document.removeEventListener('click', bellOutsideHandler, true);
    bellOutsideBound = false;
  }
}
function bellOutsideHandler(ev){
  var btn = document.getElementById('btnBell');
  if (!bellRoot || !bellRoot.firstChild) return;
  if (!bellRoot.firstChild.contains(ev.target) && !btn.contains(ev.target)) closeBellPanel();
}
function renderBellPanel(){
  if (!bellRoot || !bellRoot.tagName) bellRoot = document.getElementById('bellRoot');
  if (!bellRoot) return;
  var todos = [];
  try { todos = todoList(); }
  catch(err){ todos = []; UI.toast('待办数据异常，已显示空面板','warn'); }
  var html = '<div class="bell-panel"><div class="bp-head">' +
    '<span class="bp-title">待办事项</span>' +
    (todos.length ? '<span class="bp-cnt">' + todos.length + ' 项待办</span>' : '') + '</div>' +
    '<div class="bp-list">';
  if (!todos.length){
    html += '<div class="bp-empty">暂无待办事项，一切清爽</div>';
  } else {
    var grps = [
      { key:'sale',  label:'销售订单待审核', icon:'sale'  },
      { key:'pur',   label:'采购单待审核',   icon:'pur'   },
      { key:'alert', label:'库存告急',       icon:'alert' }
    ];
    grps.forEach(function(g){
      var items = todos.filter(function(t){ return t.grp === g.key; });
      if (!items.length) return;
      html += '<div class="bp-grp">' + UI.icon(g.icon, 13) + g.label + '<span class="bp-grp-n">' + items.length + '</span></div>';
      items.forEach(function(t, idx){
        html += '<div class="bp-item" data-g="' + g.key + '" data-i="' + idx + '">' +
          '<span class="bp-ic">' + UI.icon(t.icon, 14) + '</span>' +
          '<span class="bp-main"><span class="bp-t">' + escHtml(t.title) + '</span>' + (t.meta ? '<span class="bp-s">' + escHtml(t.meta) + '</span>' : '') + '</span>' +
          '<span class="bp-go">前往处理 →</span></div>';
      });
    });
  }
  html += '</div></div>';
  bellRoot.innerHTML = html;
  var panel = bellRoot.firstChild;
  /* 面板固定显示在页面右上角（顶栏下方内容区右上角），不再随铃铛按钮浮动 */
  panel.style.left = 'auto';
  panel.style.right = '24px';
  panel.style.top = '88px';
  bellRoot.querySelectorAll('.bp-item').forEach(function(di){
    di.addEventListener('click', function(){
      var key = di.getAttribute('data-g');
      var idx = Number(di.getAttribute('data-i'));
      var hit = todoList().filter(function(t){ return t.grp === key; })[idx];
      if (!hit) return;
      closeBellPanel();
      if (hit.go) location.hash = hit.go.replace(/^#/, '');
    });
  });
  if (!bellOutsideBound){
    document.addEventListener('click', bellOutsideHandler, true);
    bellOutsideBound = true;
  }
}
var bellSyncing = false;
function openBellPanel(){
  /* 同步防重入：同一事件循环内的重复调用（如多监听叠加）只生效一次 */
  if (bellSyncing) return;
  bellSyncing = true;
  try {
    if (bellPanelOpen){ closeBellPanel(); return; }
    bellPanelOpen = true;
    try { renderBellPanel(); }
    catch(err){
      /* 渲染异常兜底：复位状态并清空面板，保证下次点击仍可重试展开 */
      console.warn('待办面板渲染异常', err);
      bellPanelOpen = false;
      if (bellRoot) bellRoot.innerHTML = '';
    }
  } finally { bellSyncing = false; }
}
function bindBell(){
  /* 铃铛按钮通过 HTML inline onclick 直绑 openBellPanel（btnBell 为静态顶栏元素，无需事件委托，避免同一点击重复触发） */
  var ic = document.getElementById('bellIc');
  if (ic) ic.innerHTML = UI.icon('bell',19);
}

/* ---------- 用户菜单 ---------- */
function bindUser(){
  var btn = document.getElementById('btnUser');
  btn.addEventListener('click', function(){
    var items = [];
    if (canView('logs')) items.push({ icon:'log', title:'操作日志', sub:'登录与操作记录', onClick:function(){ location.hash = '#/logs'; } });
    items.push({ icon:'lock', title:'锁屏 / 切换账号', sub:'输入账号密码登录', onClick:showLock });
    UI.dropdown(btn, items, { empty:'暂无其他操作' });
  });
}

/* ---------- 登录（账号 + 密码） ---------- */
function showLock(){
  document.getElementById('lockUser').value = '';
  document.getElementById('lockPwd').value = '';
  document.getElementById('lockScreen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}
function enterLock(){
  var uname = document.getElementById('lockUser').value.trim();
  var pwd = document.getElementById('lockPwd').value;
  if (!uname) { UI.toast('请输入账号','warn'); return; }
  var u = null;
  S.users.forEach(function(x){ if (x.username === uname) u = x; });
  if (!u) { UI.toast('账号不存在','err'); return; }
  if (u.status !== 1) { UI.toast('该账号已停用','err'); return; }
  if (!pwd || pwd !== u.password) { UI.toast('密码不正确','err'); return; }
  setSession(u.id);
  u.lastLogin = todayStr();
  saveState();
  pushLoginLog('登录系统', u.name + '(' + u.username + ') 登录成功');
  document.getElementById('lockScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  UI.toast('欢迎，' + u.name,'ok');
  renderSidebar();
  route();
}

/* ---------- 视图按钮绑定补齐（按模块作用域） ---------- */
function bindViewActions(){
  var el = document.getElementById('view');
  var mod = parseHash().mod;

  /* 页签点击（data-go 导航）——渲染后统一委托绑定 */
  el.querySelectorAll('.tabs[data-go]').forEach(function(tb){
    if (tb.getAttribute('data-bound')) return;
    tb.setAttribute('data-bound', '1');
    tb.addEventListener('click', function(ev){
      var b = ev.target.closest('.tab');
      if (!b) return;
      var k = b.getAttribute('data-k') || '';
      location.hash = tb.getAttribute('data-go').replace('{k}', encodeURIComponent(k));
    });
  });

  /* 表格行点击（rowGo）——渲染后统一委托绑定 */
  el.querySelectorAll('.tbl[data-rowgo] tbody tr[data-id]').forEach(function(tr){
    if (tr.getAttribute('data-bound')) return;
    tr.setAttribute('data-bound', '1');
    tr.addEventListener('click', function(ev){
      if (ev.target.closest('.row-ops') || ev.target.closest('button') || ev.target.closest('a')) return;
      location.hash = tr.closest('.tbl').getAttribute('data-rowgo') + tr.getAttribute('data-id');
    });
  });

  if (mod === 'inv'){
    /* 库存页：工具栏筛选 + 盘点 + 导出 */
    var qInp = el.querySelector('[data-role="q"]');
    if (qInp) qInp.addEventListener('input', invReload);
    var catInp = el.querySelector('[data-role="cat"]');
    if (catInp) catInp.addEventListener('change', invReload);
    var lowBtn = el.querySelector('[data-role="low"]');
    if (lowBtn) lowBtn.addEventListener('click', function(){
      var ctx = parseHash();
      var low = ctx.params.low === '1' ? '' : '1';
      location.hash = '#/inv?t=overview&low=' + low + (ctx.params.q ? '&q=' + ctx.params.q : '') + (ctx.params.cat ? '&cat=' + ctx.params.cat : '');
    });
    var adjOk = el.querySelector('[data-act="adjok"]');
    if (adjOk) adjOk.addEventListener('click', function(){
      var pid = el.querySelector('#adjPid').value;
      var qty = Number(el.querySelector('#adjQty').value);
      var note = el.querySelector('#adjNote').value.trim();
      if (!pid) { UI.toast('请选择产品','warn'); return; }
      if (!qty) { UI.toast('调整数量不能为 0','warn'); return; }
      var p = byId(S.products, pid);
      if (p.stock + qty < 0) { UI.toast('调整后库存不能为负数','err'); return; }
      var err = adjustStock(pid, qty, note);
      if (err) { UI.toast(err,'err'); return; }
      pushOpLog('库存盘点调整', prodName(pid) + ' ' + (qty>0?'+':'') + fmtQty(qty) + (note ? '（' + note + '）' : ''));
      UI.toast('库存已调整：' + (qty>0?'+':'') + fmtQty(qty),'ok');
      route();
    });
    var invExport = el.querySelector('[data-act="export"]');
    if (invExport) invExport.addEventListener('click', function(){
      exportCSV('库存总览-' + todayStr(), [['编号','产品','SKU','分类','单位','现存量','安全库存','库存成本']]
        .concat(S.products.map(function(p){ return [p.id,p.name,p.sku,catName(p.cat),p.unit,fmtQty(p.stock),p.safety,(p.stock*p.cost).toFixed(2)]; })));
    });
    el.querySelectorAll('[data-act="adj"][data-id]').forEach(function(b){
      b.addEventListener('click', function(){ location.hash = '#/inv?t=adjust'; });
    });
  }

  if (mod === 'fin'){
    /* 财务页：应收/应付行操作 + 对账报表 */
    var tab = parseHash().params.t;
    el.querySelectorAll('[data-act="stmt"]').forEach(function(b){
      b.addEventListener('click', function(){
        var type = tab === 'ap' ? 'sup' : 'crm';
        location.hash = '#/fin?t=stmt&type=' + type + '&id=' + b.getAttribute('data-id');
      });
    });
    el.querySelectorAll('[data-act="pay"]').forEach(function(b){
      b.addEventListener('click', function(){
        var type = tab === 'ap' ? 'sup' : 'crm';
        payModal(type, b.getAttribute('data-id'));
      });
    });
    el.querySelectorAll('[data-role="crm"], [data-role="sup"]').forEach(function(b){
      b.addEventListener('click', function(){
        location.hash = '#/fin?t=stmt&type=' + b.getAttribute('data-role');
      });
    });
    var sel = el.querySelector('[data-role="sel"]');
    if (sel) sel.addEventListener('change', function(){
      location.hash = '#/fin?t=stmt&type=' + (parseHash().params.type || 'crm') + '&id=' + sel.value;
    });
    var csvBtn = el.querySelector('[data-act="csv"]');
    if (csvBtn) csvBtn.addEventListener('click', function(){
      var ctx = parseHash();
      var type = ctx.params.type || 'crm';
      var id = ctx.params.id;
      if (!id) return;
      if (type==='crm'){ var c=byId(S.customers,id); if (c) exportCrmCsv(c); }
      else { var s=byId(S.suppliers,id); if (s) exportSupCsv(s); }
    });
    var printBtn = el.querySelector('[data-act="print"]');
    if (printBtn) printBtn.addEventListener('click', function(){ window.print(); });
  }

  if (mod === 'acct'){
    /* 账号页：行操作 + 角色保存 */
    el.querySelectorAll('[data-act="edit"]').forEach(function(b){
      b.addEventListener('click', function(){ editUser(b.getAttribute('data-id')); });
    });
    el.querySelectorAll('[data-act="toggle"]').forEach(function(b){
      b.addEventListener('click', function(){ toggleUser(b.getAttribute('data-id')); });
    });
    el.querySelectorAll('[data-act="del"]').forEach(function(b){
      b.addEventListener('click', function(){ delUser(b.getAttribute('data-id')); });
    });
    el.querySelectorAll('[data-act="rolesave"]').forEach(function(b){
      b.addEventListener('click', function(){
        var rk = b.getAttribute('data-r');
        el.querySelectorAll('[data-r="' + rk + '"]').forEach(function(cb){
          var m = cb.getAttribute('data-m');
          var k = cb.getAttribute('data-k');
          S.roles[rk].perms[m][k] = cb.checked ? 1 : 0;
        });
        saveState();
        pushOpLog('保存角色权限', '「' + S.roles[rk].name + '」权限矩阵已更新');
        UI.toast('「' + S.roles[rk].name + '」权限已保存','ok');
        route();
      });
    });
  }
}
function invReload(){
  var ctx = parseHash();
  var qInp = document.querySelector('#view [data-role="q"]');
  var q = qInp ? qInp.value : '';
  var cat = '';
  var c = document.querySelector('#view [data-role="cat"]');
  if (c) cat = c.value;
  location.hash = '#/inv?t=' + (ctx.params.t || 'overview') + '&q=' + encodeURIComponent(q) + '&cat=' + cat + (ctx.params.low ? '&low=1' : '');
}

/* ---------- 账号行操作 ---------- */
function editUser(id){
  if (!canOp('acct')) { UI.toast('当前账号无此操作权限','err'); return; }
  var u = byId(S.users, id); if (!u) return;
  var m = UI.modal({
    title:'编辑账号 · ' + u.name,
    body: '<div class="form two">' +
      '<div class="field"><label>用户名</label><input type="text" value="' + escHtml(u.username) + '" disabled></div>' +
      '<div class="field"><label>姓名</label><input id="eName" type="text" value="' + escHtml(u.name) + '"></div>' +
      '<div class="field"><label>角色</label><select id="eRole">' + ROLE_DEFS.map(function(r){ return '<option value="' + r.key + '"' + (r.key===u.role?' selected':'') + '>' + r.name + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label>登录密码</label><input id="ePwd" type="password" placeholder="留空保持原密码"></div>' +
      '<div class="field full"><label>状态</label><select id="eStatus"><option value="1"' + (u.status===1?' selected':'') + '>启用</option><option value="0"' + (u.status===0?' selected':'') + '>停用</option></select></div></div>',
    footer:'<button class="btn btn-ghost" data-act="cancel" type="button">取消</button><button class="btn btn-verm" data-act="save" type="button">保存修改</button>'
  });
  m.el.querySelector('[data-act="cancel"]').addEventListener('click', function(){ m.close(); });
  m.el.querySelector('[data-act="save"]').addEventListener('click', function(){
    var name = m.el.querySelector('#eName').value.trim();
    var role = m.el.querySelector('#eRole').value;
    var pwd = m.el.querySelector('#ePwd').value;
    var status = Number(m.el.querySelector('#eStatus').value);
    if (!name) { UI.toast('姓名不能为空','warn'); return; }
    updateItem(S.users, id, { name:name, role:role, password: pwd || u.password, status:status });
    pushOpLog('编辑账号', u.username + '（' + name + '）');
    m.close(); UI.toast('账号已更新','ok');
    renderSidebar();
    route();
  });
}
function toggleUser(id){
  if (!canOp('acct')) { UI.toast('当前账号无此操作权限','err'); return; }
  var u = byId(S.users, id); if (!u || u.id==='u-admin') return;
  var next = u.status===1 ? 0 : 1;
  UI.confirm(next ? '启用账号' : '停用账号', next ? '确定启用账号「' + u.name + '」？' : '确定停用账号「' + u.name + '」？停用后无法登录。', !next).then(function(yes){
    if (!yes) return;
    updateItem(S.users, id, { status:next });
    pushOpLog(next?'启用账号':'停用账号', u.username + '（' + u.name + '）');
    UI.toast(next?'账号已启用':'账号已停用','ok');
    route();
  });
}
function delUser(id){
  if (!canOp('acct')) { UI.toast('当前账号无此操作权限','err'); return; }
  var u = byId(S.users, id); if (!u || u.id==='u-admin') return;
  if (u.id === currentUser().id) { UI.toast('不能删除当前登录账号','warn'); return; }
  UI.confirm('删除账号', '确定删除账号「' + u.name + '」？删除后不可恢复。', true).then(function(yes){
    if (!yes) return;
    removeItem(S.users, id);
    pushOpLog('删除账号', u.username + '（' + u.name + '）');
    UI.toast('账号已删除','ok');
    route();
  });
}

/* ---------- 初始化 ---------- */
var LOW_NOTIFIED = {};
function seedNotesFromState(){
  if (NOTES.length) return;
  var pc = pendingCounts();
  if (pc.so) pushNote('sale', '销售订单待审核', pc.so + ' 单等待审核', '#/sale?f=pending');
  if (pc.po) pushNote('pur', '采购单待审核', pc.po + ' 单等待审核', '#/pur?f=pending');
  /* 库存告急通知由 refreshBell 的 LOW_NOTIFIED 机制统一生成，避免重复 */
}
function init(){
  initStore();
  try { if (localStorage.getItem(FOLD_KEY) === '1') document.getElementById('app').classList.add('side-collapsed'); } catch(e){}
  loadNotes();
  loadLogs();
  ensureSession();
  bellRoot = document.getElementById('bellRoot');
  bindMenu();
  bindSearch();
  bindBell();
  bindUser();
  renderSidebar();
  seedNotesFromState();
  document.getElementById('lockEnter').addEventListener('click', enterLock);
  document.getElementById('lockUser').addEventListener('keydown', function(ev){ if (ev.key==='Enter') enterLock(); });
  document.getElementById('lockPwd').addEventListener('keydown', function(ev){ if (ev.key==='Enter') enterLock(); });
  window.addEventListener('hashchange', route);
  showApp();
  route();
  if (window.__erpAutoReset) {
    setTimeout(function(){ UI.toast('已按您的要求清空原有数据，系统以空白状态开始','ok'); }, 700);
  }
}
function showApp(){
  document.getElementById('lockScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
}
/* 桌面端侧边栏折叠：点击左上角品牌 logo 切换（收为图标窄栏） */
var FOLD_KEY = 'zf_erp_side_collapsed';
function sideCollapsed(){
  return document.getElementById('app').classList.contains('side-collapsed');
}
function toggleSideCollapse(){
  var app = document.getElementById('app');
  app.classList.toggle('side-collapsed');
  try { localStorage.setItem(FOLD_KEY, sideCollapsed() ? '1' : '0'); } catch(e){}
  syncFoldUI();
}
function syncFoldUI(){
  var ind = document.querySelector('.fold-ind');
  if (ind) ind.innerHTML = UI.icon(sideCollapsed() ? 'chevronR' : 'chevronL', 14);
  var foldBtn = document.querySelector('[data-act="fold"]');
  if (foldBtn) foldBtn.title = sideCollapsed() ? '展开菜单' : '收起菜单';
}
function bindMenu(){
  document.getElementById('btnMenu').innerHTML = UI.icon('menu', 20);
  document.getElementById('btnMenu').addEventListener('click', openSidebar);
  document.getElementById('mask').addEventListener('click', closeSidebar);
}
document.addEventListener('DOMContentLoaded', init);
