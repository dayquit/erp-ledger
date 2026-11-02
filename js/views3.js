/* ============================================================
   账房 ERP · 视图三：库存 / 财务 / 账号 / 设置
   ============================================================ */
'use strict';

/* ---------- 收付款登记（客户 / 供应商 / 订单级） ---------- */
function payModal(scope, id){
  if (!canOp('fin')) { UI.toast('当前账号无此操作权限','err'); return; }
  var type='in', partnerType='crm', partnerId='', refType='', refId='', maxUnpaid=0, title='';
  if (scope==='crm'){
    partnerId = id; title='登记收款 · ' + partnerName('crm', id);
    maxUnpaid = crmFin(id).unpaid;
  } else if (scope==='sup'){
    type='out'; partnerType='sup'; partnerId=id; title='登记付款 · ' + partnerName('sup', id);
    maxUnpaid = supFin(id).unpaid;
  } else if (scope==='so'){
    var so = byId(S.salesOrders, id); if (!so) return;
    partnerId = so.custId; refType='so'; refId=id; title='登记收款 · ' + so.no;
    maxUnpaid = Math.round((so.total - paidOf('so', id))*100)/100;
  } else if (scope==='po'){
    var po = byId(S.purchaseOrders, id); if (!po) return;
    type='out'; partnerType='sup'; partnerId=po.supId; refType='po'; refId=id; title='登记付款 · ' + po.no;
    maxUnpaid = Math.round((po.total - paidOutOf('po', id))*100)/100;
  }
  if (maxUnpaid <= 0.005) { UI.toast('该往来暂无未结余额','warn'); return; }
  var schema = [
    { name:'amount', label:'金额（元）', req:true, type:'number', min:0.01, step:'0.01', help:'本笔可登记上限 ' + fmtMoney(maxUnpaid) },
    { name:'method', label:'结算方式', req:true, type:'select', options:PAY_METHODS, value:PAY_METHODS[0] },
    { name:'date', label:'日期', req:true, type:'date', value:todayStr() },
    { name:'note', label:'备注', type:'text', placeholder:'摘要说明' }
  ];
  var m = UI.modal({
    title: title, wide:false,
    body: '<div class="tipbar teal" style="margin-bottom:14px">' + UI.icon('coin',15) + (type==='in'?'本次收款':'本次付款') + '最多 ' + fmtMoney(maxUnpaid) + '，保存后资金流水自动更新</div>' + UI.form(schema, {}),
    footer: '<button class="btn btn-ghost" data-act="cancel" type="button">取消</button><button class="btn btn-verm" data-act="save" type="button">确认登记</button>'
  });
  UI.setFormSchema(schema);
  m.el.querySelector('[data-act="cancel"]').addEventListener('click', function(){ m.close(); });
  m.el.querySelector('[data-act="save"]').addEventListener('click', function(){
    var r = UI.readForm(m.el);
    if (!r.ok) { UI.toast('请检查必填项','warn'); return; }
    var amount = Number(r.values.amount);
    if (!(amount>0) || amount > maxUnpaid + 1e-6) { UI.toast('金额需在 0 ~ ' + fmtMoney(maxUnpaid) + ' 之间','warn'); return; }
    var err = registerPayment({ type:type, partnerType:partnerType, partnerId:partnerId, refType:refType, refId:refId, amount:amount, method:r.values.method, date:r.values.date||todayStr(), note:r.values.note });
    if (err) { UI.toast(err,'err'); return; }
    pushNote('fin', (type==='in'?'收款到账':'付款登记'), partnerName(partnerType, partnerId) + ' · ' + fmtMoney(amount), type==='in' ? '#/fin?t=ar' : '#/fin?t=ap');
    pushOpLog((type==='in'?'登记收款':'登记付款'), partnerName(partnerType, partnerId) + ' · ' + fmtMoney(amount) + '（' + r.values.method + '）');
    m.close(); UI.toast((type==='in'?'收款':'付款') + '已登记','ok');
    renderRoute();
  });
}

/* ================= 库存管理 ================= */
Views.inv = {
  render: function(el, ctx){
    if (!canView('inv')) { el.innerHTML = UI.deny(); return; }
    var tab = ctx.params.t || 'overview';
    var tabs = [
      { key:'overview', label:'库存总览', count:S.products.length },
      { key:'ledger', label:'库存流水', count:S.stockLedger.length },
      { key:'adjust', label:'盘点调整' }
    ];
    var html = '<div class="page-head"><div><div class="page-title">库存管理<span class="sep">/</span><span class="num" style="font-family:var(--serif);font-size:15px;color:var(--ink-2)">' + fmtMoney(stockValue()) + '</span></div><div class="page-sub">现存量 · 流水 · 盘点调整（按成本核算库存价值）</div></div>' +
      '<div class="page-actions">' + (canOp('inv') ? '<button class="btn btn-verm" data-act="adj" type="button">' + UI.icon('refresh',15) + '库存盘点</button>' : '') + '</div></div>';
    html += '<div class="card" style="padding-top:10px">' + UI.tabs(tabs, tab, '#/inv?t={k}');
    if (tab==='overview') html += invOverview();
    else if (tab==='ledger') html += invLedger();
    else html += invAdjust();
    html += '</div>';
    el.innerHTML = html;
    bindOps(el, { adj: function(){ location.hash = '#/inv?t=adjust'; } });
  }
};
function invOverview(){
  var q = location.hash.match(/q=([^&]*)/); q = q ? decodeURIComponent(q[1]) : '';
  var fcat = location.hash.match(/cat=([^&]*)/); fcat = fcat ? fcat[1] : '';
  var lowOnly = location.hash.indexOf('low=1') > -1;
  var list = S.products.filter(function(p){
    if (fcat && p.cat!==fcat) return false;
    if (lowOnly && !(p.stock < p.safety)) return false;
    if (!q) return true;
    q = q.toLowerCase();
    return (p.name+p.sku).toLowerCase().indexOf(q) > -1;
  });
  return '<div class="toolbar"><input type="search" placeholder="搜索 产品 / SKU" value="' + q + '" data-role="q">' +
    '<select data-role="cat"><option value="">全部分类</option>' + S.categories.map(function(c){ return '<option value="' + c.id + '"' + (c.id===fcat?' selected':'') + '>' + c.name + '</option>'; }).join('') + '</select>' +
    '<label class="seg" style="cursor:pointer"><button class="' + (lowOnly?'on':'') + '" data-role="low" type="button">仅看低库存</button></label>' +
    '<div class="spacer"></div><button class="btn btn-ghost btn-sm" data-act="export" type="button">' + UI.icon('download',13) + '导出</button></div>' +
    UI.table({
      cols:[
        { k:'name', label:'产品', render:function(r){ return '<span class="t-strong">' + r.name + '</span><span class="muted" style="font-size:11.5px"> ' + (r.sku||'') + '</span>'; } },
        { k:'cat', label:'分类', w:'90px', render:function(r){ return '<span class="tag">' + catName(r.cat) + '</span>'; } },
        { k:'unit', label:'单位', w:'80px', cls:'muted' },
        { k:'stock', label:'现存量', w:'90px', cls:'t-num', render:function(r){ return '<span style="font-weight:600;color:' + (r.stock<r.safety?'var(--verm-2)':'var(--ink)') + '">' + fmtQty(r.stock) + '</span>'; } },
        { k:'safety', label:'安全库存', w:'90px', cls:'t-num muted' },
        { k:'diff', label:'水位', w:'120px', render:function(r){
          var d = r.stock - r.safety;
          var cls = d<0 ? 'st-verm' : d<10 ? 'st-amber' : 'st-teal';
          return '<span class="stamp ' + cls + '">' + (d<0 ? '告急' : d<10 ? '偏低' : '充足') + '</span>';
        } },
        { k:'val', label:'库存成本', w:'120px', cls:'t-money', render:function(r){ return fmtMoney(r.stock*r.cost); } },
        { k:'ops', label:'操作', w:'130px', render:function(r){ return rowOps([
          { t:'档案', act:'view', id:r.id, cls:'' },
          { t:'盘点', act:'adj', id:r.id, cls:'', need:canOp('inv') }
        ]); } }
      ],
      rows: list,
      rowGo: '#/prd/view?id=',
      empty: UI.emptyState('inv','没有符合条件的库存记录','')
    });
}
function invLedger(){
  var q = location.hash.match(/q=([^&]*)/); q = q ? decodeURIComponent(q[1]) : '';
  var list = S.stockLedger.slice().reverse().filter(function(l){
    if (!q) return true;
    q = q.toLowerCase();
    return (prodName(l.pid) + l.docNo + l.docType).toLowerCase().indexOf(q) > -1;
  });
  return '<div class="toolbar"><input type="search" placeholder="搜索 产品 / 单据 / 类型" value="' + q + '" data-role="q"><div class="spacer"></div></div>' +
    UI.table({
      cols:[
        { k:'date', label:'日期', w:'100px', cls:'t-num muted' },
        { k:'type', label:'类型', w:'100px', render:function(r){ return UI.ledgerTag(r.docType); } },
        { k:'doc', label:'单据号', w:'130px', cls:'t-num muted' },
        { k:'name', label:'产品', render:function(r){ return '<span class="t-strong">' + prodName(r.pid) + '</span>'; } },
        { k:'qty', label:'变动', w:'90px', cls:'t-num', render:function(r){ return '<span style="color:' + (r.qty>=0?'var(--teal-2)':'var(--verm-2)') + ';font-weight:600">' + (r.qty>=0?'+':'') + fmtQty(r.qty) + '</span>'; } },
        { k:'bal', label:'结存', w:'90px', cls:'t-num' },
        { k:'note', label:'备注', render:function(r){ return '<span class="muted">' + (r.note||'—') + '</span>'; } }
      ],
      rows: list, empty: '暂无库存流水'
    });
}
function invAdjust(){
  var recent = S.stockLedger.filter(function(l){ return l.docType==='盘点调整'; }).slice().reverse();
  return '<div class="chart-grid even"><div class="card" style="box-shadow:none">' +
    '<div class="card-head"><div><div class="card-title">发起盘点调整</div><div class="card-sub">正数盘盈 / 负数盘亏，实时改库存并留痕</div></div></div>' +
    '<div class="form">' +
    '<div class="field"><label><span class="req">*</span>产品</label><select id="adjPid"><option value="">选择产品</option>' + S.products.map(function(p){ return '<option value="' + p.id + '">' + p.name + '（现 ' + fmtQty(p.stock) + '）</option>'; }).join('') + '</select></div>' +
    '<div class="field"><label><span class="req">*</span>调整数量</label><input id="adjQty" type="number" step="any" placeholder="如 10 或 -5"></div>' +
    '<div class="field full"><label>调整原因</label><input id="adjNote" type="text" placeholder="盘点差异 / 报损 / 其他"></div>' +
    '</div><div class="card-actions" style="margin-top:14px">' + (canOp('inv') ? '<button class="btn btn-verm" data-act="adjok" type="button">' + UI.icon('check',15) + '确认调整</button>' : '') + '</div></div>' +
    '<div class="card" style="box-shadow:none"><div class="card-head"><div><div class="card-title">最近调整记录</div><div class="card-sub">' + recent.length + ' 笔</div></div></div>' +
    (recent.length ? UI.table({
      cols:[
        { k:'date', label:'日期', w:'100px', cls:'t-num muted' },
        { k:'name', label:'产品', render:function(r){ return '<span class="t-strong">' + prodName(r.pid) + '</span>'; } },
        { k:'qty', label:'调整', w:'80px', cls:'t-num', render:function(r){ return '<span style="color:' + (r.qty>=0?'var(--teal-2)':'var(--verm-2)') + ';font-weight:600">' + (r.qty>=0?'+':'') + fmtQty(r.qty) + '</span>'; } },
        { k:'note', label:'原因', render:function(r){ return '<span class="muted">' + (r.note||'—') + '</span>'; } }
      ],
      rows: recent, empty: '暂无调整记录'
    }) : UI.emptyState('refresh','暂无盘点记录','调整后在此留痕')) + '</div></div>';
}

/* ================= 财务对账 ================= */
Views.fin = {
  render: function(el, ctx){
    if (!canView('fin')) { el.innerHTML = UI.deny(); return; }
    var tab = ctx.params.t || 'ar';
    var tabs = [
      { key:'ar', label:'应收账款' }, { key:'ap', label:'应付账款' },
      { key:'flow', label:'资金流水', count:S.payments.length },
      { key:'stmt', label:'对账报表' }
    ];
    var html = '<div class="page-head"><div><div class="page-title">财务对账<span class="sep">/</span><span class="num" style="font-family:var(--serif);font-size:15px;color:var(--ink-2)">应收 ' + fmtMoney(receivablesTotal()) + ' · 应付 ' + fmtMoney(payablesTotal()) + '</span></div><div class="page-sub">客户应收 · 供应商应付 · 资金流水 · 往来对账</div></div></div>';
    html += '<div class="card" style="padding-top:10px">' + UI.tabs(tabs, tab, '#/fin?t={k}');
    if (tab==='ar') html += finAR();
    else if (tab==='ap') html += finAP();
    else if (tab==='flow') html += finFlow();
    else html += finStmt();
    html += '</div>';
    el.innerHTML = html;
  }
};
function finAR(){
  return '<div class="tipbar verm" style="margin-top:12px">' + UI.icon('coin',15) + '应收合计 ' + fmtMoney(receivablesTotal()) + ' · 未收部分请尽快对账催收</div>' +
    UI.table({
      cols:[
        { k:'name', label:'客户', render:function(r){ return '<span class="t-strong">' + r.name + '</span>'; } },
        { k:'total', label:'应收合计', w:'130px', cls:'t-money', render:function(r){ return fmtMoney(r.f.total); } },
        { k:'paid', label:'已收', w:'130px', cls:'t-money', render:function(r){ return '<span style="color:var(--teal-2)">' + fmtMoney(r.f.paid) + '</span>'; } },
        { k:'unpaid', label:'未收余额', w:'130px', cls:'t-money', render:function(r){ return '<span style="color:var(--verm-2);font-weight:700">' + fmtMoney(r.f.unpaid) + '</span>'; } },
        { k:'ops', label:'操作', w:'190px', render:function(r){ return rowOps([
          { t:'对账单', act:'stmt', id:r.id, cls:'teal' },
          { t:'登记收款', act:'pay', id:r.id, cls:'verm', need:canOp('fin') }
        ]); } }
      ],
      rows: S.customers.map(function(c){ return { id:c.id, name:c.name, f:crmFin(c.id) }; }),
      rowGo: '#/fin?t=stmt&type=crm&id=',
      empty: '暂无客户'
    });
}
function finAP(){
  return '<div class="tipbar blue" style="margin-top:12px">' + UI.icon('coin',15) + '应付合计 ' + fmtMoney(payablesTotal()) + ' · 按时付款维护供应商信用</div>' +
    UI.table({
      cols:[
        { k:'name', label:'供应商', render:function(r){ return '<span class="t-strong">' + r.name + '</span>'; } },
        { k:'total', label:'应付合计', w:'130px', cls:'t-money', render:function(r){ return fmtMoney(r.f.total); } },
        { k:'paid', label:'已付', w:'130px', cls:'t-money', render:function(r){ return '<span style="color:var(--teal-2)">' + fmtMoney(r.f.paid) + '</span>'; } },
        { k:'unpaid', label:'未付余额', w:'130px', cls:'t-money', render:function(r){ return '<span style="color:var(--verm-2);font-weight:700">' + fmtMoney(r.f.unpaid) + '</span>'; } },
        { k:'ops', label:'操作', w:'190px', render:function(r){ return rowOps([
          { t:'对账单', act:'stmt', id:r.id, cls:'teal' },
          { t:'登记付款', act:'pay', id:r.id, cls:'verm', need:canOp('fin') }
        ]); } }
      ],
      rows: S.suppliers.map(function(s){ return { id:s.id, name:s.name, f:supFin(s.id) }; }),
      rowGo: '#/fin?t=stmt&type=sup&id=',
      empty: '暂无供应商'
    });
}
function finFlow(){
  var pays = S.payments.slice().reverse();
  return UI.table({
    cols:[
      { k:'date', label:'日期', w:'100px', cls:'t-num muted' },
      { k:'dir', label:'方向', w:'80px', render:function(r){ return r.type==='in' ? '<span class="stamp st-teal">收款</span>' : '<span class="stamp st-verm">付款</span>'; } },
      { k:'partner', label:'往来单位', render:function(r){ return '<span class="t-strong">' + partnerName(r.partnerType, r.partnerId) + '</span>'; } },
      { k:'ref', label:'关联单据', w:'160px', cls:'t-num muted', render:function(r){ return r.refId ? refNo(r.refType, r.refId) : '<span class="muted">往来结算</span>'; } },
      { k:'method', label:'方式', w:'90px' },
      { k:'amount', label:'金额', w:'130px', cls:'t-money', render:function(r){ return '<span style="color:' + (r.type==='in'?'var(--teal-2)':'var(--verm-2)') + ';font-weight:700">' + fmtMoney(r.amount) + '</span>'; } },
      { k:'note', label:'备注', render:function(r){ return '<span class="muted">' + (r.note||'—') + '</span>'; } }
    ],
    rows: pays,
    empty: UI.emptyState('bank','暂无资金流水','登记收付款后在此汇总')
  });
}
function finStmt(){
  var type = location.hash.match(/type=([^&]*)/); type = type ? type[1] : 'crm';
  var id = location.hash.match(/id=([^&]*)/); id = id ? id[1] : '';
  var html = '<div class="toolbar" style="margin-top:12px">' +
    '<span class="tag" style="margin-right:2px">往来类型</span>' +
    '<div class="seg"><button class="' + (type==='crm'?'on':'') + '" data-role="crm" type="button">客户应收</button><button class="' + (type==='sup'?'on':'') + '" data-role="sup" type="button">供应商应付</button></div>' +
    '<select data-role="sel">' + (type==='crm'
      ? '<option value="">选择客户</option>' + S.customers.map(function(c){ return '<option value="' + c.id + '"' + (c.id===id?' selected':'') + '>' + c.name + '</option>'; }).join('')
      : '<option value="">选择供应商</option>' + S.suppliers.map(function(s){ return '<option value="' + s.id + '"' + (s.id===id?' selected':'') + '>' + s.name + '</option>'; }).join('')) + '</select>' +
    '<div class="spacer"></div></div>';
  if (id){
    var partner = type==='crm' ? byId(S.customers, id) : byId(S.suppliers, id);
    if (partner){
      var f = type==='crm' ? crmFin(id) : supFin(id);
      var pays = S.payments.filter(function(p){ return p.type===(type==='crm'?'in':'out') && p.partnerType===type && p.partnerId===id; }).slice().reverse();
      html += '<div class="card" style="box-shadow:none;margin-top:4px">' +
        '<div class="card-head"><div><div class="card-title">对账单 · ' + partner.name + '</div><div class="card-sub">' + partner.contact + ' · ' + (partner.phone||'') + (partner.address?' · ' + partner.address:'') + '</div></div>' +
        '<div class="card-actions"><button class="btn btn-ghost btn-sm" data-act="csv" type="button">' + UI.icon('download',13) + '导出对账单</button>' +
        '<button class="btn btn-ghost btn-sm" data-act="print" type="button">' + UI.icon('print',13) + '打印</button></div></div>' +
        '<div class="sum-rows" style="margin-bottom:14px"><div class="sum-row"><span class="k">' + (type==='crm'?'应收':'应付') + '合计</span><span class="v num">' + fmtMoney(f.total) + '</span></div>' +
        '<div class="sum-row"><span class="k">已' + (type==='crm'?'收':'付') + '</span><span class="v num" style="color:var(--teal-2)">' + fmtMoney(f.paid) + '</span></div>' +
        '<div class="sum-row total"><span class="k">未' + (type==='crm'?'收':'付') + '余额</span><span class="v num">' + fmtMoney(f.unpaid) + '</span></div></div>';
      html += '<div class="card-title" style="font-size:14px;margin-bottom:8px">往来单据</div>' + UI.table({
        cols:[
          { k:'no', label:'单号', w:'160px', cls:'t-num muted' },
          { k:'date', label:'日期', w:'100px', cls:'t-num muted' },
          { k:'status', label:'状态', w:'96px', render:function(r){ return type==='crm' ? stampSo(r.status) : stampPo(r.status); } },
          { k:'total', label:'金额', w:'120px', cls:'t-money', render:function(r){ return fmtMoney(r.ref.total); } },
          { k:'paid', label:'已' + (type==='crm'?'收':'付'), w:'110px', cls:'t-money', render:function(r){ return '<span style="color:var(--teal-2)">' + fmtMoney(r.paid) + '</span>'; } },
          { k:'unpaid', label:'未' + (type==='crm'?'收':'付'), w:'110px', cls:'t-money', render:function(r){ return '<span style="color:var(--verm-2)">' + fmtMoney(r.unpaid) + '</span>'; } }
        ],
        rows: f.orders, empty: '暂无往来单据'
      });
      html += '<div class="card-title" style="font-size:14px;margin:14px 0 8px">资金记录</div>' + UI.table({
        cols:[
          { k:'date', label:'日期', w:'100px', cls:'t-num muted' },
          { k:'amount', label:'金额', w:'120px', cls:'t-money', render:function(r){ return '<span style="color:' + (r.type==='in'?'var(--teal-2)':'var(--verm-2)') + ';font-weight:700">' + fmtMoney(r.amount) + '</span>'; } },
          { k:'method', label:'方式', w:'90px' },
          { k:'note', label:'备注', render:function(r){ return '<span class="muted">' + (r.note||'—') + '</span>'; } }
        ],
        rows: pays, empty: '暂无资金记录'
      });
      html += '</div>';
    }
  } else {
    html += UI.emptyState('file','选择往来单位','选择客户或供应商生成对账单');
  }
  html += '<input type="file" id="stmtCsv" accept=".csv" class="hidden">';
  return html;
}

/* ================= 账号管控 ================= */
Views.acct = {
  render: function(el, ctx){
    if (!canView('acct')) { el.innerHTML = UI.deny(); return; }
    var tab = ctx.params.t || 'users';
    var tabs = [
      { key:'users', label:'账号列表', count:S.users.length },
      { key:'roles', label:'角色权限', count:Object.keys(S.roles).length }
    ];
    var html = '<div class="page-head"><div><div class="page-title">账号管控<span class="sep">/</span><span class="num" style="font-family:var(--serif);font-size:15px;color:var(--ink-2)">' + S.users.length + ' 个账号</span></div><div class="page-sub">账号 · 角色 · 模块权限矩阵</div></div>' +
      '<div class="page-actions">' + (canOp('acct') ? '<button class="btn btn-verm" data-act="add" type="button">' + UI.icon('plus',15) + '新增账号</button>' : '') + '</div></div>';
    html += '<div class="card" style="padding-top:10px">' + UI.tabs(tabs, tab, '#/acct?t={k}');
    if (tab==='users') html += acctUsers();
    else html += acctRoles();
    html += '</div>';
    el.innerHTML = html;
    bindOps(el, { add: addUser });
  }
};
function acctUsers(){
  var me = currentUser();
  return UI.table({
    cols:[
      { k:'username', label:'用户名', w:'120px', cls:'t-num muted', render:function(r){ return '<span style="font-family:var(--mono);font-size:12.5px">' + r.username + '</span>'; } },
      { k:'name', label:'姓名', w:'110px', render:function(r){ return '<span class="t-strong">' + r.name + '</span>' + (r.id===me.id?' <span class="tag verm">当前</span>':''); } },
      { k:'role', label:'角色', w:'110px', render:function(r){ return '<span class="tag">' + roleName(r.role) + '</span>'; } },
      { k:'status', label:'状态', w:'90px', render:function(r){ return r.status===1 ? '<span class="stamp st-teal">启用</span>' : '<span class="stamp st-gray">停用</span>'; } },
      { k:'last', label:'最近登录', w:'150px', cls:'t-num muted', render:function(r){ return r.lastLogin || '—'; } },
      { k:'ops', label:'操作', w:'170px', render:function(r){ return rowOps([
        { t:'编辑', act:'edit', id:r.id, cls:'', need:canOp('acct') },
        { t: r.status===1?'停用':'启用', act:'toggle', id:r.id, cls: r.status===1?'danger':'teal', need:canOp('acct') && r.id!=='u-admin' },
        { t:'删除', act:'del', id:r.id, cls:'danger', need:canOp('acct') && r.id!=='u-admin' && r.id!==me.id }
      ]); } }
    ],
    rows: S.users,
    empty: '暂无账号'
  });
}
var USER_SCHEMA = [
  { name:'username', label:'用户名', req:true, type:'text', help:'登录用，不可重复' },
  { name:'name', label:'姓名', req:true, type:'text' },
  { name:'role', label:'角色', req:true, type:'select', options:ROLE_DEFS.map(function(r){ return { value:r.key, label:r.name }; }) },
  { name:'password', label:'登录密码', req:true, type:'password', placeholder:'默认 123456' },
  { name:'status', label:'状态', type:'select', options:[{value:'1',label:'启用'},{value:'0',label:'停用'}] }
];
function addUser(){
  if (!canOp('acct')) { UI.toast('当前账号无此操作权限','err'); return; }
  var schema = USER_SCHEMA.map(function(f){ return Object.assign({}, f); });
  schema[3].value = '123456';
  var m = UI.modal({
    title:'新增账号',
    body: UI.form(schema, {}),
    footer:'<button class="btn btn-ghost" data-act="cancel" type="button">取消</button><button class="btn btn-verm" data-act="save" type="button">创建账号</button>'
  });
  UI.setFormSchema(schema);
  m.el.querySelector('[data-act="cancel"]').addEventListener('click', function(){ m.close(); });
  m.el.querySelector('[data-act="save"]').addEventListener('click', function(){
    var r = UI.readForm(m.el);
    if (!r.ok) { UI.toast('请检查必填项','warn'); return; }
    if (S.users.some(function(u){ return u.username.toLowerCase()===r.values.username.toLowerCase(); })) { UI.toast('用户名已存在','err'); return; }
    var id = 'u-' + r.values.username.toLowerCase().replace(/[^a-z0-9]/g,'') + '-' + Math.random().toString(36).slice(2,5);
    addItem(S.users, { id:id, username:r.values.username, name:r.values.name, role:r.values.role, password:r.values.password||'123456', status:Number(r.values.status)||1, lastLogin:'' });
    pushOpLog('新增账号', r.values.username + '（' + r.values.name + '）');
    m.close(); UI.toast('账号已创建','ok');
    renderRoute();
  });
}
function acctRoles(){
  var html = '<div class="tipbar blue" style="margin-top:12px">' + UI.icon('shield',15) + '每个角色可独立配置 13 个模块的「查看 / 操作」权限；管理员为内置角色，不可修改</div>';
  html += '<div class="chart-grid even">';
  Object.keys(S.roles).forEach(function(rk){
    var r = S.roles[rk];
    var locked = rk==='admin';
    html += '<div class="card" style="box-shadow:none"><div class="card-head"><div><div class="card-title">' + r.name + '</div><div class="card-sub">' + (r.desc||'') + '</div></div>' +
      (locked ? '<div class="card-actions"><span class="tag verm">内置</span></div>' : '') + '</div>';
    html += '<div class="tbl-wrap"><table class="tbl" style="min-width:0"><thead><tr><th style="width:40%">模块</th><th style="width:30%">查看</th><th style="width:30%">操作</th></tr></thead><tbody>' +
      MODULES.map(function(m){
        var p = r.perms[m.key];
        var dis = locked ? ' disabled' : '';
        return '<tr><td>' + m.label + '</td>' +
          '<td><input type="checkbox" data-r="' + rk + '" data-m="' + m.key + '" data-k="v"' + (p.v?' checked':'') + dis + '></td>' +
          '<td><input type="checkbox" data-r="' + rk + '" data-m="' + m.key + '" data-k="o"' + (p.o?' checked':'') + dis + '></td></tr>';
      }).join('') + '</tbody></table></div>';
    if (!locked) html += '<div class="card-actions" style="margin-top:10px"><button class="btn btn-verm btn-sm" data-act="rolesave" data-r="' + rk + '" type="button">' + UI.icon('save',13) + '保存 ' + r.name + ' 权限</button></div>';
    html += '</div>';
  });
  html += '</div>';
  return html;
}

/* ================= 系统设置 ================= */
Views.set = {
  render: function(el, ctx){
    if (!canView('set')) { el.innerHTML = UI.deny(); return; }
    var c = S.company;
    var html = '<div class="page-head"><div><div class="page-title">系统设置</div><div class="page-sub">公司资料 · 业务参数 · 数据管理</div></div></div>';
    html += '<div class="chart-grid even">';
    html += '<div class="card"><div class="card-head"><div><div class="card-title">公司信息</div><div class="card-sub">用于单据抬头与打印</div></div></div>' +
      '<div class="form two">' +
      '<div class="field"><label>公司名称</label><input id="setName" type="text" value="' + c.name + '"></div>' +
      '<div class="field"><label>系统简称</label><input id="setShort" type="text" value="' + c.short + '"></div>' +
      '<div class="field"><label>联系人</label><input id="setContact" type="text" value="' + c.contact + '"></div>' +
      '<div class="field"><label>联系电话</label><input id="setPhone" type="text" value="' + c.phone + '"></div>' +
      '<div class="field full"><label>地址</label><input id="setAddr" type="text" value="' + c.address + '"></div>' +
      '<div class="field full"><label>税号</label><input id="setTax" type="text" value="' + c.taxNo + '"></div></div>' +
      '<div class="card-actions" style="margin-top:12px"><button class="btn btn-verm" data-act="comp" type="button">' + UI.icon('save',15) + '保存公司信息</button></div></div>';
    html += '<div class="card"><div class="card-head"><div><div class="card-title">业务参数</div><div class="card-sub">预警与计税偏好</div></div></div>' +
      '<div class="form two">' +
      '<div class="field"><label>低库存预警阈值（家数提示）</label><input id="setLow" type="number" min="0" value="' + S.settings.lowStock + '"></div>' +
      '<div class="field"><label>默认税率（%）</label><input id="setTaxRate" type="number" min="0" max="100" step="0.1" value="' + S.settings.taxRate + '"></div></div>' +
      '<div class="form-note" style="margin-top:12px">库存「告急 / 偏低」按产品安全库存判定；税率用于财务核算口径。</div>' +
      '<div class="card-actions" style="margin-top:12px"><button class="btn btn-verm" data-act="biz" type="button">' + UI.icon('save',15) + '保存业务参数</button></div></div>';
    html += '</div>';
    html += '<div class="card"><div class="card-head"><div><div class="card-title">数据管理</div><div class="card-sub">本系统数据保存在当前浏览器本地（localStorage），换设备 / 清缓存前请先备份</div></div></div>' +
      '<div class="card-actions" style="margin:0 0 14px">' +
      '<button class="btn btn-ghost" data-act="backup" type="button">' + UI.icon('download',15) + '导出备份</button>' +
      '<button class="btn btn-ghost" data-act="restore" type="button">' + UI.icon('refresh',15) + '导入恢复</button>' +
      '<button class="btn btn-danger" data-act="wipe" type="button">' + UI.icon('trash',15) + '清空全部数据</button>' +
      '<button class="btn btn-ghost" data-act="reset" type="button">' + UI.icon('alert',15) + '恢复出厂数据</button></div>' +
      '<input type="file" id="restoreFile" accept=".json,.txt" class="hidden">' +
      '<div class="form-note">导出备份为 JSON 文件；恢复会覆盖当前全部数据；清空全部数据将删除客户 / 供应商 / 产品 / 单据 / 库存 / 财务流水（保留账号与系统设置）；恢复出厂将重置为初始演示数据。</div></div>';
    html += '<div class="card"><div class="card-head"><div><div class="card-title">关于账房 ERP</div></div></div>' +
      '<div class="sum-rows"><div class="sum-row"><span class="k">版本</span><span class="v num">v1.5.2（2026-10-25）</span></div>' +
      '<div class="sum-row"><span class="k">模块</span><span class="v">仪表盘 · 客户 · 产品 · 销售 · 供应商 · 采购 · 入库 · 出库 · 库存 · 财务 · 账号 · 操作日志 · 设置</span></div>' +
      '<div class="sum-row"><span class="k">数据存储</span><span class="v">浏览器本地存储，无需服务器</span></div></div></div>';
    el.innerHTML = html;
    el.querySelectorAll('[data-act]').forEach(function(b){
      b.addEventListener('click', function(){
        var act = b.getAttribute('data-act');
        if (act==='comp') saveCompany();
        else if (act==='biz') saveBiz();
        else if (act==='backup') { backupData(); pushOpLog('导出备份', '导出全部业务数据为 JSON 备份文件'); UI.toast('备份文件已导出','ok'); }
        else if (act==='restore') el.querySelector('#restoreFile').click();
        else if (act==='wipe') wipeAll();
        else if (act==='reset') resetAll();
      });
    });
    el.querySelector('#restoreFile').addEventListener('change', function(ev){
      var file = ev.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(){
        var err = restoreData(String(reader.result));
        if (err) { UI.toast(err,'err'); return; }
        pushOpLog('导入恢复', '从备份文件恢复全部数据');
        UI.toast('数据已恢复','ok');
        renderRoute();
      };
      reader.readAsText(file);
    });
  }
};
Views.logs = {
  render: function(el, ctx){
    if (!canView('logs')) { el.innerHTML = UI.deny(); return; }
    var sid = ctx.params.s || '';
    if (sid) return renderSessionDetail(el, sid);
    var tab = ctx.params.t || 'login';
    var tabs = [
      { key:'login', label:'登录日志', count:LOGIN_LOGS.length },
      { key:'op',    label:'操作日志', count:OP_LOGS.length }
    ];
    var html = '<div class="page-head"><div><div class="page-title">操作日志<span class="sep">/</span><span class="num" style="font-family:var(--serif);font-size:15px;color:var(--ink-2)">' + (LOGIN_LOGS.length + OP_LOGS.length) + ' 条记录</span></div><div class="page-sub">按登录会话聚合 · 每次登录一条，点击进入查看该次登录后的操作</div></div>' +
      '<div class="page-actions">' + (canOp('logs') ? '<button class="btn btn-danger" data-act="clear" type="button">' + UI.icon('trash',15) + '清空日志</button>' : '') + '</div></div>';
    html += '<div class="card" style="padding-top:10px">' + UI.tabs(tabs, tab, '#/logs?t={k}');
    html += '<div class="tipbar blue" style="margin-top:12px">' + UI.icon('shield',15) + '仅管理员可见；每次登录（含账号切换）生成一条登录日志，点击进入显示该次登录后的全部操作记录；同一账号再次登录时追加一条新登录日志</div>';
    if (tab==='login') html += renderLoginSessions();
    else html += logTable(OP_LOGS, '操作日志');
    html += '</div>';
    el.innerHTML = html;
    el.querySelectorAll('[data-act]').forEach(function(b){
      b.addEventListener('click', function(){
        var act = b.getAttribute('data-act');
        if (act==='clear'){
          UI.confirm('确认清空全部日志？此操作不可恢复。', function(){
            clearLogs();
            UI.toast('日志已清空','ok');
            renderRoute();
          }, true);
        }
      });
    });
    el.querySelectorAll('.ls-item').forEach(function(row){
      row.addEventListener('click', function(){
        var sid = row.getAttribute('data-sid');
        if (!sid) return;
        location.hash = '#/logs?t=login&s=' + encodeURIComponent(sid);
      });
    });
  }
};
/* 登录会话列表：每次登录一条，点击进入该次登录的操作记录页 */
function renderLoginSessions(){
  if (!LOGIN_LOGS.length) return '<div class="empty"><div style="opacity:.35">' + UI.icon('log',40) + '</div><div>暂无登录日志，登录系统或切换账号后自动生成</div></div>';
  var html = '<div class="ls-list">';
  LOGIN_LOGS.forEach(function(item, idx){
    var ops = sessionOps(item, idx);
    var sid = item.session || ('L' + idx);
    html += '<div class="ls-item" data-sid="' + sid + '">' +
      '<div class="ls-row">' +
      '<span class="ls-ic">' + UI.icon('login', 16) + '</span>' +
      '<span class="ls-main"><span class="ls-t">' + escHtml(item.name) + '<span class="ls-acc">' + escHtml(item.account) + '</span></span>' +
      '<span class="ls-s">' + escHtml(item.action || '登录系统') + ' · ' + logTime(item.ts) + '</span></span>' +
      '<span class="ls-cnt">' + ops.length + ' 项操作</span>' +
      '<span class="ls-arrow">' + UI.icon('chevronR', 14) + '</span></div>' +
      '</div>';
  });
  return html + '</div>';
}
/* 会话详情页：某账号某次登录后的操作记录 */
function renderSessionDetail(el, sid){
  var item = null, idx = -1;
  LOGIN_LOGS.forEach(function(x, i){
    if (x.session === sid){ item = x; idx = i; }
  });
  if (!item && sid.indexOf('L') === 0){
    idx = Number(sid.slice(1));
    if (idx >= 0 && idx < LOGIN_LOGS.length) item = LOGIN_LOGS[idx];
  }
  var html = '<div class="page-head"><div><div class="page-title">操作日志<span class="sep">/</span><span class="num" style="font-family:var(--serif);font-size:15px;color:var(--ink-2)">登录记录</span></div>' +
    '<div class="page-sub">该账号本次登录后的操作明细</div></div></div>';
  if (!item){
    html += '<div class="card"><div class="empty"><div style="opacity:.35">' + UI.icon('log',40) + '</div><div>未找到该条登录记录</div></div></div>';
    el.innerHTML = html;
    el.querySelector('[data-back]').addEventListener('click', function(){ location.hash = '#/logs?t=login'; });
    return;
  }
  var ops = sessionOps(item, idx);
  html += '<div class="card" style="padding-top:12px">' +
    '<button class="ls-detail-back" data-back type="button">' + UI.icon('back', 15) + '返回登录日志列表</button>' +
    '<div class="ls-detail-meta">' +
    '<span><b>账号：</b>' + escHtml(item.name) + '（' + escHtml(item.account) + '）</span>' +
    '<span><b>登录时间：</b><span style="font-family:var(--mono);font-size:12.5px">' + logTime(item.ts) + '</span></span>' +
    '<span><b>本次登录后操作：</b>' + ops.length + ' 项</span></div>' +
    (ops.length ? opRows(ops) : '<div class="ls-empty">该次登录后没有操作记录</div>') +
    '</div>';
  el.innerHTML = html;
  el.querySelector('[data-back]').addEventListener('click', function(){ location.hash = '#/logs?t=login'; });
}
function opRows(ops){
  return '<div class="ls-table"><div class="ls-th"><span>时间</span><span>动作</span><span>详情</span></div>' +
    ops.map(function(o){
      return '<div class="ls-tr"><span style="font-family:var(--mono);font-size:12px;color:var(--ink-2)">' + logTime(o.ts) + '</span>' +
        '<span><span class="tag">' + escHtml(o.action) + '</span></span><span class="ls-d">' + escHtml(o.detail) + '</span></div>';
    }).join('') + '</div>';
}
function logTable(rows, title){
  if (!rows.length) return '<div class="empty"><div style="opacity:.35">' + UI.icon('log',40) + '</div><div>暂无' + title + '记录，执行相应操作后自动生成</div></div>';
  return UI.table({
    cols:[
      { k:'ts', label:'时间', w:'170px', cls:'t-num muted', render:function(r){ return '<span style="font-family:var(--mono);font-size:12px">' + logTime(r.ts) + '</span>'; } },
      { k:'name', label:'操作人', w:'110px', render:function(r){ return '<span class="t-strong">' + escHtml(r.name) + '</span>'; } },
      { k:'account', label:'账号', w:'120px', cls:'t-num muted', render:function(r){ return '<span style="font-family:var(--mono);font-size:12.5px">' + escHtml(r.account) + '</span>'; } },
      { k:'action', label:'动作', w:'160px', render:function(r){ return '<span class="tag">' + escHtml(r.action) + '</span>'; } },
      { k:'detail', label:'详情', render:function(r){ return escHtml(r.detail); } }
    ],
    rows: rows,
    empty: '暂无记录'
  });
}
function saveCompany(){
  var g = function(id){ return document.getElementById(id).value.trim(); };
  var before = S.company.name + ' / ' + S.company.short;
  S.company = { name:g('setName')||'未命名公司', short:g('setShort')||'账房 ERP', contact:g('setContact'), phone:g('setPhone'), address:g('setAddr'), taxNo:g('setTax') };
  saveState();
  pushOpLog('保存公司信息', before + ' → ' + S.company.name + ' / ' + S.company.short);
  UI.toast('公司信息已保存','ok');
  renderSidebar();
}
function saveBiz(){
  var low = Number(document.getElementById('setLow').value);
  var tax = Number(document.getElementById('setTaxRate').value);
  S.settings.lowStock = isNaN(low)?10:low;
  S.settings.taxRate = isNaN(tax)?13:tax;
  saveState();
  pushOpLog('保存业务参数', '低库存阈值 ' + S.settings.lowStock + '，默认税率 ' + S.settings.taxRate + '%');
  UI.toast('业务参数已保存','ok');
}
function resetAll(){
  UI.confirm('恢复出厂数据', '将清空当前全部业务数据并恢复为初始演示数据，此操作不可撤销。', true).then(function(yes){
    if (!yes) return;
    resetData();
    pushOpLog('恢复出厂数据', '系统重置为初始演示数据');
    UI.toast('已恢复出厂数据','ok');
    renderRoute();
  });
}
function wipeAll(){
  UI.confirm('清空全部数据', '将删除当前全部业务数据（客户 / 供应商 / 产品 / 单据 / 库存 / 财务流水），账号与系统设置保留，此操作不可撤销。', true).then(function(yes){
    if (!yes) return;
    resetToBlank();
    pushOpLog('清空全部数据', '删除全部业务数据，账号与系统设置保留');
    UI.toast('已清空全部业务数据','ok');
    renderRoute();
  });
}
