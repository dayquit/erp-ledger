/* ============================================================
   账房 ERP · 视图一：仪表盘 / 客户 / 供应商 / 产品
   ============================================================ */
'use strict';

var Views = {};

/* ================= 仪表盘 ================= */
Views.dash = {
  render: function(el){
    var u = currentUser();
    var pc = pendingCounts();
    var low = lowStockList();
    var kpi = [
      { label:'本月销售额', val:fmtMoney(monthSales()), sub:'今日 ' + fmtMoney(todaySales()), cls:'', icon:'sale' },
      { label:'本月采购额', val:fmtMoney(monthPurchase()), sub:'含待审核单据', cls:'teal', icon:'pur' },
      { label:'库存总额',   val:fmtMoney(stockValue()), sub:'按成本价核算', cls:'blue', icon:'inv' },
      { label:'应收未收',   val:fmtMoney(receivablesTotal()), sub:'客户应收账款', cls:'amber', icon:'coin' },
      { label:'应付未付',   val:fmtMoney(payablesTotal()), sub:'供应商应付账款', cls:'', icon:'bank' },
      { label:'低库存预警', val:low.length + ' 种', sub:'低于安全库存', cls:'amber', icon:'alert' }
    ];
    var html = '<div class="page-head">' +
      '<div><div class="page-title">账房经营仪表盘<span class="sep">/</span><span class="num" style="font-family:var(--serif);font-size:15px;color:var(--ink-2)">' + todayStr() + '</span></div>' +
      '<div class="page-sub">' + u.name + '（' + roleName(u.role) + '）· 一切经营都在账上</div></div></div>';
    html += '<div class="kpi-grid">' + kpi.map(function(k){
      return '<div class="kpi ' + k.cls + '"><div class="kpi-label">' + UI.icon(k.icon,13) + k.label + '</div>' +
        '<div class="kpi-num">' + k.val + '</div><div class="kpi-sub">' + k.sub + '</div></div>';
    }).join('') + '</div>';

    html += '<div class="chart-grid two">';
    html += '<div class="card"><div class="card-head"><div><div class="card-title">近 12 周销售 / 采购趋势</div><div class="card-sub">按订单日期汇总，单位：元</div></div></div><div id="chTrend" class="chart-box"></div></div>';
    html += '<div class="card"><div class="card-head"><div><div class="card-title">销售订单状态构成</div><div class="card-sub">全部销售订单按流转阶段</div></div></div><div id="chStatus" class="chart-box"></div></div>';
    html += '</div>';
    html += '<div class="chart-grid even">';
    html += '<div class="card"><div class="card-head"><div><div class="card-title">库存金额 · 按分类</div><div class="card-sub">各产品分类库存成本合计 TOP8</div></div></div><div id="chCat" class="chart-box" style="min-height:280px"></div></div>';
    html += '<div class="card"><div class="card-head"><div><div class="card-title">近 7 日资金收付</div><div class="card-sub">收款 / 付款金额对比</div></div></div><div id="chPay" class="chart-box" style="min-height:280px"></div></div>';
    html += '</div>';

    /* 待办 + 动态 */
    html += '<div class="chart-grid even">';
    html += '<div class="card"><div class="card-head"><div><div class="card-title">待办事项</div><div class="card-sub">需要当前角色跟进的事项</div></div></div><div class="feed">' + feedTodos(pc, low) + '</div></div>';
    html += '<div class="card"><div class="card-head"><div><div class="card-title">最近业务动态</div><div class="card-sub">最新库存流水与收付款记录</div></div></div><div class="feed">' + feedRecent() + '</div></div>';
    html += '</div>';

    el.innerHTML = html;

    /* 图表 */
    var weeks = lastWeeks(12);
    var ws = weekSeries(weeks);
    var t = UI.chartTheme;
    UI.chart('chTrend', Object.assign(UI.baseChartOpts(), {
      tooltip:{ trigger:'axis', confine:true, backgroundColor:'#212b3c', borderWidth:0, textStyle:{color:'#faf8f1', fontSize:12} },
      grid:{ left:'2%', right:'2%', bottom:'8%', top:20, containLabel:true },
      legend:{ data:['销售额','采购额'], type:'scroll', bottom:0, icon:'rect', itemWidth:10, itemHeight:10, textStyle:{color:t.subText, fontSize:12} },
      xAxis:{ type:'category', data:ws.labels, axisLine:{lineStyle:{color:t.axisLine}}, axisLabel:{color:t.subText, fontSize:11}, axisTick:{show:false} },
      yAxis:{ type:'value', splitLine:{lineStyle:{color:t.splitLine}}, axisLabel:{color:t.subText, fontSize:11, formatter:function(v){ return v>=10000 ? (v/10000)+'万' : v; }} },
      series:[
        { name:'销售额', type:'line', smooth:true, symbol:'circle', symbolSize:6, data:ws.sales, lineStyle:{width:2.5, color:t.verm}, itemStyle:{color:t.verm}, areaStyle:{color:'rgba(194,58,38,.08)'} },
        { name:'采购额', type:'line', smooth:true, symbol:'circle', symbolSize:6, data:ws.purchases, lineStyle:{width:2.5, color:t.teal}, itemStyle:{color:t.teal}, areaStyle:{color:'rgba(20,125,116,.08)'} }
      ]
    }));
    /* 订单状态构成 */
    var stCount = { pending:0, audited:0, partial:0, shipped:0, done:0, canceled:0 };
    S.salesOrders.forEach(function(o){ stCount[soStatus(o)]++; });
    var donutData = [
      { name:'待审核', value:stCount.pending },
      { name:'进行中', value:stCount.audited+stCount.partial+stCount.shipped },
      { name:'已完成', value:stCount.done },
      { name:'已取消', value:stCount.canceled }
    ].filter(function(d){ return d.value>0; });
    UI.chart('chStatus', Object.assign(UI.baseChartOpts(), {
      tooltip:{ confine:true, backgroundColor:'#212b3c', borderWidth:0, textStyle:{color:'#faf8f1', fontSize:12} },
      legend:{ type:'scroll', orient:'horizontal', bottom:0, icon:'circle', itemWidth:9, itemHeight:9, textStyle:{color:t.subText, fontSize:11} },
      series:[{
        type:'pie', radius:['46%','70%'], center:['50%','44%'], avoidLabelOverlap:false,
        label:{ show:true, position:'inside', formatter:function(p){ return p.name + '\n' + p.percent + '%'; }, color:'#faf8f1', fontSize:11, lineHeight:15 },
        labelLine:{ show:false },
        data: donutData,
        itemStyle:{ borderColor:'#faf8f1', borderWidth:2 }
      }],
      graphic:[{
        type:'text', left:'center', top:'31%', style:{ text:stCount.done + ' 单已完成', fill:t.subText, font:'12px Noto Sans SC' }
      }]
    }));
    /* 分类库存 */
    var catArr = catStockValue();
    UI.chart('chCat', Object.assign(UI.baseChartOpts(), {
      tooltip:{ confine:true, trigger:'axis', axisPointer:{type:'shadow'}, backgroundColor:'#212b3c', borderWidth:0, textStyle:{color:'#faf8f1', fontSize:12} },
      grid:{ left:'2%', right:'6%', bottom:'6%', top:10, containLabel:true },
      xAxis:{ type:'value', splitLine:{lineStyle:{color:t.splitLine}}, axisLabel:{color:t.subText, fontSize:11, formatter:function(v){ return v>=10000?(v/10000)+'万':v; }} },
      yAxis:{ type:'category', data:catArr.map(function(c){return c.name;}), axisLine:{lineStyle:{color:t.axisLine}}, axisTick:{show:false}, axisLabel:{color:t.inkText, fontSize:12} },
      series:[{ type:'bar', barWidth:14, data:catArr.map(function(c){ return c.value; }), itemStyle:{ color:t.verm, borderRadius:[0,2,2,0] }, label:{ show:true, position:'right', fontSize:11, color:t.subText, formatter:function(p){ return p.value>=10000?(p.value/10000)+'万':p.value; } } }]
    }));
    /* 近 7 日资金 */
    var p7 = pay7days();
    UI.chart('chPay', Object.assign(UI.baseChartOpts(), {
      tooltip:{ confine:true, trigger:'axis', axisPointer:{type:'shadow'}, backgroundColor:'#212b3c', borderWidth:0, textStyle:{color:'#faf8f1', fontSize:12} },
      legend:{ data:['收款','付款'], type:'scroll', bottom:0, icon:'rect', itemWidth:10, itemHeight:10, textStyle:{color:t.subText, fontSize:11} },
      grid:{ left:'2%', right:'2%', bottom:'10%', top:10, containLabel:true },
      xAxis:{ type:'category', data:p7.labels, axisLine:{lineStyle:{color:t.axisLine}}, axisTick:{show:false}, axisLabel:{color:t.subText, fontSize:11} },
      yAxis:{ type:'value', splitLine:{lineStyle:{color:t.splitLine}}, axisLabel:{color:t.subText, fontSize:11} },
      series:[
        { name:'收款', type:'bar', barWidth:12, data:p7['in'], itemStyle:{color:t.teal, borderRadius:[2,2,0,0]} },
        { name:'付款', type:'bar', barWidth:12, data:p7['out'], itemStyle:{color:t.amber, borderRadius:[2,2,0,0]} }
      ]
    }));
  }
};

function feedTodos(pc, low){
  var rows = [];
  if (pc.so) rows.push({ ic:'amber', icon:'sale', title:'销售订单待审核', meta:'共 ' + pc.so + ' 单等待审核', act:'去处理', go:'#/sale?f=pending' });
  if (pc.po) rows.push({ ic:'amber', icon:'pur', title:'采购单待审核', meta:'共 ' + pc.po + ' 单等待审核', act:'去处理', go:'#/pur?f=pending' });
  low.slice(0,4).forEach(function(p){
    rows.push({ ic:'verm', icon:'alert', title:'库存告急：' + p.name, meta:'现存量 ' + fmtQty(p.stock) + p.unit.replace(/[（(].*[）)]/,'') + '，低于安全库存 ' + fmtQty(p.safety), act:'去补货', go:'#/inv' });
  });
  if (!rows.length) return UI.emptyState('check','今日账目清爽','暂无待办事项');
  return rows.map(function(r){
    return '<div class="feed-item"><span class="feed-ic ' + r.ic + '">' + UI.icon(r.icon,15) + '</span>' +
      '<div class="feed-main"><div class="feed-title">' + r.title + '</div><div class="feed-meta">' + r.meta + '</div></div>' +
      '<div class="feed-right"><a class="feed-act" href="' + r.go + '">' + r.act + ' →</a></div></div>';
  }).join('');
}
function feedRecent(){
  var items = [];
  S.stockLedger.slice(-5).reverse().forEach(function(l){
    items.push({ ic: l.qty>0 ? 'teal':'verm', icon:'box', title: prodName(l.pid) + ' · ' + l.docType, meta: l.date + ' · ' + l.docNo + (l.note? ' · ' + l.note : ''), right: (l.qty>0?'+':'') + fmtQty(l.qty) });
  });
  S.payments.slice(-3).reverse().forEach(function(p){
    items.push({ ic:'amber', icon:'coin', title:(p.type==='in'?'收到':'付出') + ' ' + partnerName(p.partnerType, p.partnerId) + ' ' + fmtMoney(p.amount), meta: p.date + ' · ' + p.method, right:'' });
  });
  return items.map(function(r){
    return '<div class="feed-item"><span class="feed-ic ' + r.ic + '">' + UI.icon(r.icon,15) + '</span>' +
      '<div class="feed-main"><div class="feed-title">' + r.title + '</div><div class="feed-meta">' + r.meta + '</div></div>' +
      (r.right ? '<div class="feed-right"><span class="feed-num num">' + r.right + '</span></div>' : '') +
      '</div>';
  }).join('');
}

/* ================= 客户管理 ================= */
function escA(s){
  return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
/* 行政区简称：广西壮族自治区→广西、北京市→北京、玉州区→玉州 */
function alName(x){
  return String(x).replace(/壮族自治区|维吾尔自治区|回族自治区|特别行政区|自治区|自治州|自治县|省|市|地区|盟|区|县|旗/g, '');
}
/* 按全称或简称匹配地址前缀 */
function matchSeg(addr, keys){
  for (var i=0;i<keys.length;i++){
    var k = keys[i];
    if (addr.indexOf(k) === 0) return { v:k, rest:addr.slice(k.length) };
    var a = alName(k);
    if (a && a.length >= 2 && a !== k && addr.indexOf(a) === 0) return { v:k, rest:addr.slice(a.length) };
  }
  return null;
}
function cleanSeg(rest){
  rest = String(rest||'').replace(/^\s+/, '');
  return rest.replace(/^(省|市|自治区|特别行政区|自治州|地区|盟|区|县|旗)/, '');
}
/* 把完整地址串拆分回 省 / 市 / 区县 / 具体地址 */
function splitAddress(addr){
  var out = { prov:'', city:'', dist:'', detail: addr || '' };
  if (!addr) return out;
  var m1 = matchSeg(addr, Object.keys(REGION_DATA));
  if (!m1) return out;
  out.prov = m1.v;
  var m2 = matchSeg(cleanSeg(m1.rest), REGION_DATA[m1.v] ? Object.keys(REGION_DATA[m1.v]) : []);
  if (!m2){ out.detail = m1.rest; return out; }
  out.city = m2.v;
  var m3 = matchSeg(cleanSeg(m2.rest), REGION_DATA[m1.v][m2.v] || []);
  if (m3){ out.dist = m3.v; out.detail = cleanSeg(m3.rest); }
  else out.detail = m2.rest;
  return out;
}
/* 客户档案表单：名称全行 / 联系人+电话 / 省市县三级联动 / 具体地址+税号 / 备注 */
function crmFormBody(c){
  c = c || {};
  var split = splitAddress(c.address);
  var provs = Object.keys(REGION_DATA);
  var pOpts = provs.map(function(p){ return '<option value="' + escA(p) + '"' + (split.prov===p?' selected':'') + '>' + escA(p) + '</option>'; }).join('');
  var cityOpts = '', distOpts = '';
  if (split.prov && REGION_DATA[split.prov]){
    cityOpts = Object.keys(REGION_DATA[split.prov]).map(function(city){ return '<option value="' + escA(city) + '"' + (split.city===city?' selected':'') + '>' + escA(city) + '</option>'; }).join('');
  }
  if (split.city && REGION_DATA[split.prov] && REGION_DATA[split.prov][split.city]){
    distOpts = REGION_DATA[split.prov][split.city].map(function(d){ return '<option value="' + escA(d) + '"' + (split.dist===d?' selected':'') + '>' + escA(d) + '</option>'; }).join('');
  }
  return '<div class="form two">' +
    '<div class="field full"><label><span class="req">*</span>客户名称</label><input data-f="name" type="text" value="' + escA(c.name||'') + '" placeholder="公司 / 店铺全称"><span class="err"></span></div>' +
    '<div class="field"><label><span class="req">*</span>联系人</label><input data-f="contact" type="text" value="' + escA(c.contact||'') + '" placeholder="如 林经理"><span class="err"></span></div>' +
    '<div class="field"><label>联系电话</label><input data-f="phone" type="text" value="' + escA(c.phone||'') + '" placeholder="手机或座机"></div>' +
    '<div class="field full"><label>所在地区</label><div class="addr-casc">' +
      '<select data-f="prov"><option value="">请选择省份</option>' + pOpts + '</select>' +
      '<select data-f="city"><option value="">请选择城市</option>' + cityOpts + '</select>' +
      '<select data-f="dist"><option value="">请选择区 / 县</option>' + distOpts + '</select>' +
    '</div><span class="help">按 省 / 市 / 区县 逐级选择</span></div>' +
    '<div class="field"><label>具体地址</label><input data-f="address" type="text" value="' + escA(split.detail||'') + '" placeholder="街道 / 门牌 / 楼层"></div>' +
    '<div class="field"><label>税号</label><input data-f="taxNo" type="text" value="' + escA(c.taxNo||'') + '" placeholder="纳税人识别号（可空）"></div>' +
    '<div class="field full"><label>备注</label><textarea data-f="note" placeholder="账期、偏好等">' + escA(c.note||'') + '</textarea></div>' +
  '</div>';
}
function bindCrmCascades(el, split){
  split = split || {};
  var provSel = el.querySelector('[data-f="prov"]');
  var citySel = el.querySelector('[data-f="city"]');
  var distSel = el.querySelector('[data-f="dist"]');
  function fillCities(keep){
    var prov = provSel.value;
    var cities = prov && REGION_DATA[prov] ? Object.keys(REGION_DATA[prov]) : [];
    citySel.innerHTML = '<option value="">请选择城市</option>' + cities.map(function(city){ return '<option value="' + escA(city) + '">' + escA(city) + '</option>'; }).join('');
    distSel.innerHTML = '<option value="">请选择区 / 县</option>';
  }
  function fillDists(){
    var prov = provSel.value, city = citySel.value;
    var dists = prov && city && REGION_DATA[prov] && REGION_DATA[prov][city] ? REGION_DATA[prov][city] : [];
    distSel.innerHTML = '<option value="">请选择区 / 县</option>' + dists.map(function(d){ return '<option value="' + escA(d) + '">' + escA(d) + '</option>'; }).join('');
  }
  provSel.addEventListener('change', fillCities);
  citySel.addEventListener('change', fillDists);
  if (split.city){ fillCities(); citySel.value = split.city; fillDists(); distSel.value = split.dist || ''; }
}
function readCrmForm(el){
  var ok = true, v = {};
  el.querySelectorAll('[data-f]').forEach(function(inp){ v[inp.getAttribute('data-f')] = inp.value.trim(); });
  ['name','contact'].forEach(function(k){
    var inp = el.querySelector('[data-f="' + k + '"]');
    var f = inp ? inp.closest('.field') : null;
    if (!v[k]){ if (f){ f.classList.add('invalid'); var e = f.querySelector('.err'); if (e) e.textContent = '此项必填'; } ok = false; }
    else if (f) f.classList.remove('invalid');
  });
  v.addressFull = [v.prov, v.city, v.dist, v.address].filter(Boolean).join(' ');
  return { ok: ok, v: v };
}
Views.crm = {
  render: function(el, ctx){
    if (ctx.sub === 'view') return this.detail(el, ctx.params.id);
    if (!canView('crm')) { el.innerHTML = UI.deny(); return; }
    var q = ctx.params.q || '';
    var list = S.customers.filter(function(c){
      if (!q) return true;
      q = q.toLowerCase();
      return (c.name+c.contact+c.phone+c.taxNo).toLowerCase().indexOf(q) > -1;
    });
    var html = '<div class="page-head"><div><div class="page-title">客户管理<span class="sep">/</span><span class="num" style="font-family:var(--serif);font-size:15px;color:var(--ink-2)">' + S.customers.length + ' 户</span></div><div class="page-sub">客户档案 · 应收账款 · 交易往来</div></div>' +
      '<div class="page-actions">' +
      '<button class="btn btn-ghost" data-act="export" type="button">' + UI.icon('download',15) + '导出</button>' +
      (canOp('crm') ? '<button class="btn btn-verm" data-act="add" type="button">' + UI.icon('plus',15) + '新增客户</button>' : '') +
      '</div></div>';
    html += '<div class="card"><div class="toolbar">' +
      '<input type="search" placeholder="搜索 名称 / 联系人 / 电话" value="' + q + '" data-role="q">' +
      '<div class="spacer"></div></div>';
    html += UI.table({
      cols:[
        { k:'id', label:'编号', w:'80px', cls:'t-num muted' },
        { k:'name', label:'客户名称', render:function(r){ return '<span class="t-strong">' + r.name + '</span>'; } },
        { k:'contact', label:'联系人', w:'90px' },
        { k:'phone', label:'电话', w:'130px', cls:'t-num' },
        { k:'fin', label:'应收未收', w:'110px', cls:'t-money', render:function(r){ var f=crmFin(r.id); return '<span style="color:' + (f.unpaid>0.005?'var(--verm-2)':'var(--teal-2)') + '">' + fmtMoney(f.unpaid) + '</span>'; } },
        { k:'note', label:'备注', render:function(r){ return '<span class="muted">' + (r.note||'—') + '</span>'; } },
        { k:'ops', label:'操作', w:'150px', render:function(r){ return rowOps([
          { t:'查看', act:'view', id:r.id, cls:'' },
          { t:'编辑', act:'edit', id:r.id, cls:'', need:crmCanOp() },
          { t:'删除', act:'del', id:r.id, cls:'danger', need:crmCanOp() }
        ]); } }
      ],
      rows: list,
      rowGo: '#/crm/view?id=',
      empty: UI.emptyState('crm','还没有客户档案','点击右上角「新增客户」建立第一份档案')
    });
    html += '</div>';
    el.innerHTML = html;

    el.querySelector('[data-role="q"]').addEventListener('input', function(ev){
      location.hash = '#/crm?q=' + encodeURIComponent(ev.target.value);
    });
    bindOps(el, { add: addCrm, edit: editCrm, del: delCrm, view: function(id){ location.hash = '#/crm/view?id=' + id; }, export: function(){ exportCsvCustomers(); } });
  },
  detail: function(el, id){
    var c = byId(S.customers, id);
    if (!c) { el.innerHTML = UI.emptyState('box','客户不存在','该客户可能已被删除'); return; }
    var f = crmFin(id);
    var html = '<div class="page-head"><div><div class="page-title">客户档案<span class="sep">/</span>' + c.name + '</div><div class="page-sub">' + (c.address||'未填写地址') + '</div></div>' +
      '<div class="page-actions"><button class="btn btn-ghost" data-act="back" type="button">' + UI.icon('back',15) + '返回列表</button>' +
      '<button class="btn btn-ghost" data-act="csv" type="button">' + UI.icon('download',15) + '导出对账单</button>' +
      (canOp('fin') ? '<button class="btn btn-verm" data-act="pay" type="button">' + UI.icon('coin',15) + '登记收款</button>' : '') +
      (canOp('crm') ? '<button class="btn btn-ink" data-act="edit" type="button">' + UI.icon('edit',15) + '编辑档案</button>' : '') + '</div></div>';
    html += '<div class="detail-grid"><div class="card"><div class="card-head"><div><div class="card-title">账款概览</div><div class="card-sub">应收合计 · 已收 · 未收</div></div></div><div class="sum-rows">' +
      '<div class="sum-row"><span class="k">应收合计</span><span class="v num">' + fmtMoney(f.total) + '</span></div>' +
      '<div class="sum-row"><span class="k">已收金额</span><span class="v num" style="color:var(--teal-2)">' + fmtMoney(f.paid) + '</span></div>' +
      '<div class="sum-row total"><span class="k">未收余额</span><span class="v num">' + fmtMoney(f.unpaid) + '</span></div></div></div>';
    html += '<div class="card"><div class="card-head"><div><div class="card-title">联系方式</div></div></div><div class="sum-rows">' +
      '<div class="sum-row"><span class="k">联系人</span><span class="v">' + (c.contact||'—') + '</span></div>' +
      '<div class="sum-row"><span class="k">电话</span><span class="v num">' + (c.phone||'—') + '</span></div>' +
      '<div class="sum-row"><span class="k">税号</span><span class="v num" style="font-size:12px">' + (c.taxNo||'—') + '</span></div>' +
      '<div class="sum-row"><span class="k">备注</span><span class="v">' + (c.note||'—') + '</span></div></div></div></div>';
    /* 订单 */
    html += '<div class="card"><div class="card-head"><div><div class="card-title">销售订单</div><div class="card-sub">' + f.orders.length + ' 单（已取消不纳入对账）</div></div></div>';
    if (f.orders.length){
      html += UI.table({
        cols:[
          { k:'no', label:'单号', w:'150px', cls:'t-num muted' },
          { k:'date', label:'日期', w:'100px', cls:'t-num muted' },
          { k:'status', label:'状态', w:'90px', render:function(r){ return UI.stamp(r.status); } },
          { k:'total', label:'金额', w:'110px', cls:'t-money', render:function(r){ return fmtMoney(r.ref.total); } },
          { k:'paid', label:'已收', w:'110px', cls:'t-money', render:function(r){ return '<span style="color:var(--teal-2)">' + fmtMoney(r.paid) + '</span>'; } },
          { k:'unpaid', label:'未收', w:'110px', cls:'t-money', render:function(r){ return '<span style="color:var(--verm-2)">' + fmtMoney(r.unpaid) + '</span>'; } },
          { k:'ops', label:'操作', w:'110px', render:function(r){ return rowOps([{ t:'单据', act:'so', id:r.ref.id, cls:'' }]); } }
        ],
        rows: f.orders,
        empty: '暂无订单'
      });
    } else { html += '<div class="card-body">' + UI.emptyState('sale','暂无销售订单','完成销售出库后应收将在此体现') + '</div>'; }
    html += '</div>';
    /* 收款记录 */
    var pays = S.payments.filter(function(p){ return p.type==='in' && p.partnerType==='crm' && p.partnerId===id; }).slice().reverse();
    html += '<div class="card" style="margin-top:12px"><div class="card-head"><div><div class="card-title">收款记录</div><div class="card-sub">' + pays.length + ' 笔</div></div></div>';
    if (pays.length){
      html += UI.table({
        cols:[
          { k:'date', label:'日期', w:'100px', cls:'t-num muted' },
          { k:'amount', label:'金额', w:'120px', cls:'t-money', render:function(r){ return '<span style="color:var(--teal-2)">' + fmtMoney(r.amount) + '</span>'; } },
          { k:'method', label:'方式', w:'90px' },
          { k:'ref', label:'关联', w:'120px', render:function(r){ return r.refId ? refNo('so', r.refId) : '客户往来'; } },
          { k:'note', label:'备注', render:function(r){ return '<span class="muted">' + (r.note||'—') + '</span>'; } }
        ],
        rows: pays, empty: '暂无收款记录'
      });
    } else { html += '<div class="card-body">' + UI.emptyState('coin','暂无收款','登记收款后资金流水自动更新') + '</div>'; }
    html += '</div>';
    el.innerHTML = html;
    el.querySelectorAll('[data-act]').forEach(function(b){
      b.addEventListener('click', function(){
        var act = b.getAttribute('data-act');
        if (act==='back') location.hash = '#/crm';
        else if (act==='edit') editCrm(id);
        else if (act==='pay') payModal('crm', id);
        else if (act==='csv') exportCrmCsv(c);
        else if (act==='so') location.hash = '#/sale/view?id=' + b.getAttribute('data-id');
      });
    });
  }
};
function crmCanOp(){ return canOp('crm'); }
function rowOps(list){
  var html = '<div class="row-ops">';
  list.forEach(function(o){
    if (o.need === false) return;
    html += '<button class="mini-btn' + (o.cls ? ' ' + o.cls : '') + '" data-act="' + o.act + '" data-id="' + o.id + '" type="button">' + UI.icon(actIcon(o.act),13) + o.t + '</button>';
  });
  return html + '</div>';
}
function actIcon(a){
  return a==='edit' ? 'edit' : a==='del' ? 'trash' : a==='view' ? 'eye' : a==='so'||a==='po' ? 'file' : 'check';
}
function bindOps(el, map){
  el.querySelectorAll('[data-act]').forEach(function(b){
    var act = b.getAttribute('data-act');
    var id = b.getAttribute('data-id');
    if (map[act]) b.addEventListener('click', function(){ map[act](id); });
  });
}
function exportCsvCustomers(){
  exportCSV('客户档案-' + todayStr(), [
    ['编号','客户名称','联系人','电话','地址','税号','应收未收','备注']
  ].concat(S.customers.map(function(c){ var f=crmFin(c.id); return [c.id,c.name,c.contact,c.phone,c.address||'',c.taxNo||'',f.unpaid.toFixed(2),c.note||'']; })));
}
function exportCrmCsv(c){
  var f = crmFin(c.id);
  var rows = [['客户对账单',''],['客户',c.name],['联系人',c.contact||''],['电话',c.phone||''],['地址',c.address||''],[''],
    ['单号','日期','状态','金额','已收','未收']];
  f.orders.forEach(function(o){ rows.push([o.ref.no,o.ref.date,STATUS_META[o.status].label,o.ref.total.toFixed(2),o.paid.toFixed(2),o.unpaid.toFixed(2)]); });
  rows.push([''],['应收合计',f.total.toFixed(2)],['已收',f.paid.toFixed(2)],['未收余额',f.unpaid.toFixed(2)]);
  exportCSV('客户对账单-' + c.name + '-' + todayStr(), rows);
}
function addCrm(){
  if (!canOp('crm')) { UI.toast('当前账号无此操作权限','err'); return; }
  var m = UI.modal({
    title:'新增客户', wide:false,
    body: crmFormBody(null),
    footer:'<button class="btn btn-ghost" data-act="cancel" type="button">取消</button><button class="btn btn-verm" data-act="save" type="button">保存档案</button>'
  });
  bindCrmCascades(m.el);
  m.el.querySelector('[data-act="cancel"]').addEventListener('click', function(){ m.close(); });
  m.el.querySelector('[data-act="save"]').addEventListener('click', function(){
    var r = readCrmForm(m.el);
    if (!r.ok) { UI.toast('请检查必填项','warn'); return; }
    var id = 'KH' + pad2(S.customers.length + 1);
    while (byId(S.customers, id)) id = 'KH' + pad2(parseInt(id.slice(2))+1);
    addItem(S.customers, { id:id, name:r.v.name, contact:r.v.contact, phone:r.v.phone, address:r.v.addressFull, taxNo:r.v.taxNo, note:r.v.note });
    pushOpLog('新增客户', r.v.name + '（' + id + '）');
    m.close(); UI.toast('客户档案已建立','ok');
    renderRoute();
  });
}
function editCrm(id){
  if (!canOp('crm')) { UI.toast('当前账号无此操作权限','err'); return; }
  var c = byId(S.customers, id); if (!c) return;
  var m = UI.modal({
    title:'编辑客户 · ' + c.name,
    body: crmFormBody(c),
    footer:'<button class="btn btn-ghost" data-act="cancel" type="button">取消</button><button class="btn btn-verm" data-act="save" type="button">保存修改</button>'
  });
  bindCrmCascades(m.el, splitAddress(c.address));
  m.el.querySelector('[data-act="cancel"]').addEventListener('click', function(){ m.close(); });
  m.el.querySelector('[data-act="save"]').addEventListener('click', function(){
    var r = readCrmForm(m.el);
    if (!r.ok) { UI.toast('请检查必填项','warn'); return; }
    updateItem(S.customers, id, { name:r.v.name, contact:r.v.contact, phone:r.v.phone, address:r.v.addressFull, taxNo:r.v.taxNo, note:r.v.note });
    pushOpLog('编辑客户', r.v.name + '（' + id + '）');
    m.close(); UI.toast('客户档案已更新','ok');
    renderRoute();
  });
}
function delCrm(id){
  if (!canOp('crm')) { UI.toast('当前账号无此操作权限','err'); return; }
  var c = byId(S.customers, id); if (!c) return;
  var used = S.salesOrders.some(function(o){ return o.custId===id; });
  UI.confirm('删除客户', '确定删除客户「' + c.name + '」？' + (used ? ' 该客户名下已有销售订单，删除后历史单据将显示为「已删除客户」。' : ''), true).then(function(yes){
    if (!yes) return;
    removeItem(S.customers, id);
    pushOpLog('删除客户', c.name + '（' + id + '）');
    UI.toast('客户已删除','ok');
    renderRoute();
  });
}

/* ================= 供应商管理 ================= */
var SUP_SCHEMA = [
  { name:'name', label:'供应商名称', req:true, type:'text', placeholder:'公司全称' },
  { name:'contact', label:'联系人', req:true, type:'text' },
  { name:'phone', label:'联系电话', type:'text' },
  { name:'address', label:'地址', type:'text' },
  { name:'taxNo', label:'税号', type:'text' },
  { name:'note', label:'备注', type:'textarea', placeholder:'主营品类、账期等', full:true }
];
Views.sup = {
  render: function(el, ctx){
    if (ctx.sub === 'view') return this.detail(el, ctx.params.id);
    if (!canView('sup')) { el.innerHTML = UI.deny(); return; }
    var q = ctx.params.q || '';
    var list = S.suppliers.filter(function(s){
      if (!q) return true;
      q = q.toLowerCase();
      return (s.name+s.contact+s.phone).toLowerCase().indexOf(q) > -1;
    });
    var html = '<div class="page-head"><div><div class="page-title">供应商管理<span class="sep">/</span><span class="num" style="font-family:var(--serif);font-size:15px;color:var(--ink-2)">' + S.suppliers.length + ' 家</span></div><div class="page-sub">供应商档案 · 应付账款 · 采购往来</div></div>' +
      '<div class="page-actions">' +
      '<button class="btn btn-ghost" data-act="export" type="button">' + UI.icon('download',15) + '导出</button>' +
      (canOp('sup') ? '<button class="btn btn-verm" data-act="add" type="button">' + UI.icon('plus',15) + '新增供应商</button>' : '') +
      '</div></div>';
    html += '<div class="card"><div class="toolbar"><input type="search" placeholder="搜索 名称 / 联系人 / 电话" value="' + q + '" data-role="q"><div class="spacer"></div></div>';
    html += UI.table({
      cols:[
        { k:'id', label:'编号', w:'80px', cls:'t-num muted' },
        { k:'name', label:'供应商名称', render:function(r){ return '<span class="t-strong">' + r.name + '</span>'; } },
        { k:'contact', label:'联系人', w:'90px' },
        { k:'phone', label:'电话', w:'130px', cls:'t-num' },
        { k:'fin', label:'应付未付', w:'110px', cls:'t-money', render:function(r){ var f=supFin(r.id); return '<span style="color:' + (f.unpaid>0.005?'var(--verm-2)':'var(--teal-2)') + '">' + fmtMoney(f.unpaid) + '</span>'; } },
        { k:'note', label:'备注', render:function(r){ return '<span class="muted">' + (r.note||'—') + '</span>'; } },
        { k:'ops', label:'操作', w:'150px', render:function(r){ return rowOps([
          { t:'查看', act:'view', id:r.id, cls:'' },
          { t:'编辑', act:'edit', id:r.id, cls:'', need:canOp('sup') },
          { t:'删除', act:'del', id:r.id, cls:'danger', need:canOp('sup') }
        ]); } }
      ],
      rows: list,
      rowGo: '#/sup/view?id=',
      empty: UI.emptyState('truck','还没有供应商','点击右上角「新增供应商」建立供应档案')
    });
    html += '</div>';
    el.innerHTML = html;
    el.querySelector('[data-role="q"]').addEventListener('input', function(ev){
      location.hash = '#/sup?q=' + encodeURIComponent(ev.target.value);
    });
    bindOps(el, { add: addSup, edit: editSup, del: delSup, view: function(id){ location.hash = '#/sup/view?id=' + id; }, export: function(){
      exportCSV('供应商档案-' + todayStr(), [['编号','供应商','联系人','电话','地址','税号','应付未付','备注']]
        .concat(S.suppliers.map(function(s){ var f=supFin(s.id); return [s.id,s.name,s.contact,s.phone,s.address||'',s.taxNo||'',f.unpaid.toFixed(2),s.note||'']; })));
    } });
  },
  detail: function(el, id){
    var s = byId(S.suppliers, id);
    if (!s) { el.innerHTML = UI.emptyState('box','供应商不存在','该供应商可能已被删除'); return; }
    var f = supFin(id);
    var html = '<div class="page-head"><div><div class="page-title">供应商档案<span class="sep">/</span>' + s.name + '</div><div class="page-sub">' + (s.address||'未填写地址') + '</div></div>' +
      '<div class="page-actions"><button class="btn btn-ghost" data-act="back" type="button">' + UI.icon('back',15) + '返回列表</button>' +
      '<button class="btn btn-ghost" data-act="csv" type="button">' + UI.icon('download',15) + '导出对账单</button>' +
      (canOp('fin') ? '<button class="btn btn-verm" data-act="pay" type="button">' + UI.icon('coin',15) + '登记付款</button>' : '') +
      (canOp('sup') ? '<button class="btn btn-ink" data-act="edit" type="button">' + UI.icon('edit',15) + '编辑档案</button>' : '') + '</div></div>';
    html += '<div class="detail-grid"><div class="card"><div class="card-head"><div><div class="card-title">账款概览</div><div class="card-sub">应付合计 · 已付 · 未付</div></div></div><div class="sum-rows">' +
      '<div class="sum-row"><span class="k">应付合计</span><span class="v num">' + fmtMoney(f.total) + '</span></div>' +
      '<div class="sum-row"><span class="k">已付金额</span><span class="v num" style="color:var(--teal-2)">' + fmtMoney(f.paid) + '</span></div>' +
      '<div class="sum-row total"><span class="k">未付余额</span><span class="v num">' + fmtMoney(f.unpaid) + '</span></div></div></div>';
    html += '<div class="card"><div class="card-head"><div><div class="card-title">联系方式</div></div></div><div class="sum-rows">' +
      '<div class="sum-row"><span class="k">联系人</span><span class="v">' + (s.contact||'—') + '</span></div>' +
      '<div class="sum-row"><span class="k">电话</span><span class="v num">' + (s.phone||'—') + '</span></div>' +
      '<div class="sum-row"><span class="k">税号</span><span class="v num" style="font-size:12px">' + (s.taxNo||'—') + '</span></div>' +
      '<div class="sum-row"><span class="k">备注</span><span class="v">' + (s.note||'—') + '</span></div></div></div></div>';
    html += '<div class="card"><div class="card-head"><div><div class="card-title">采购订单</div><div class="card-sub">' + f.orders.length + ' 单（已取消不纳入对账）</div></div></div>';
    if (f.orders.length){
      html += UI.table({
        cols:[
          { k:'no', label:'单号', w:'150px', cls:'t-num muted' },
          { k:'date', label:'日期', w:'100px', cls:'t-num muted' },
          { k:'status', label:'状态', w:'90px', render:function(r){ return stampPo(r.status); } },
          { k:'total', label:'金额', w:'110px', cls:'t-money', render:function(r){ return fmtMoney(r.ref.total); } },
          { k:'paid', label:'已付', w:'110px', cls:'t-money', render:function(r){ return '<span style="color:var(--teal-2)">' + fmtMoney(r.paid) + '</span>'; } },
          { k:'unpaid', label:'未付', w:'110px', cls:'t-money', render:function(r){ return '<span style="color:var(--verm-2)">' + fmtMoney(r.unpaid) + '</span>'; } },
          { k:'ops', label:'操作', w:'110px', render:function(r){ return rowOps([{ t:'单据', act:'po', id:r.ref.id, cls:'' }]); } }
        ],
        rows: f.orders, empty: '暂无订单'
      });
    } else { html += '<div class="card-body">' + UI.emptyState('pur','暂无采购订单','完成采购入库后应付将在此体现') + '</div>'; }
    html += '</div>';
    var pays = S.payments.filter(function(p){ return p.type==='out' && p.partnerType==='sup' && p.partnerId===id; }).slice().reverse();
    html += '<div class="card" style="margin-top:12px"><div class="card-head"><div><div class="card-title">付款记录</div><div class="card-sub">' + pays.length + ' 笔</div></div></div>';
    if (pays.length){
      html += UI.table({
        cols:[
          { k:'date', label:'日期', w:'100px', cls:'t-num muted' },
          { k:'amount', label:'金额', w:'120px', cls:'t-money', render:function(r){ return '<span style="color:var(--verm-2)">' + fmtMoney(r.amount) + '</span>'; } },
          { k:'method', label:'方式', w:'90px' },
          { k:'ref', label:'关联', w:'120px', render:function(r){ return r.refId ? refNo('po', r.refId) : '供应商往来'; } },
          { k:'note', label:'备注', render:function(r){ return '<span class="muted">' + (r.note||'—') + '</span>'; } }
        ],
        rows: pays, empty: '暂无付款记录'
      });
    } else { html += '<div class="card-body">' + UI.emptyState('coin','暂无付款','登记付款后资金流水自动更新') + '</div>'; }
    html += '</div>';
    el.innerHTML = html;
    el.querySelectorAll('[data-act]').forEach(function(b){
      b.addEventListener('click', function(){
        var act = b.getAttribute('data-act');
        if (act==='back') location.hash = '#/sup';
        else if (act==='edit') editSup(id);
        else if (act==='pay') payModal('sup', id);
        else if (act==='csv') exportSupCsv(s);
        else if (act==='po') location.hash = '#/pur/view?id=' + b.getAttribute('data-id');
      });
    });
  }
};
function exportSupCsv(s){
  var f = supFin(s.id);
  var rows = [['供应商对账单',''],['供应商',s.name],['联系人',s.contact||''],['电话',s.phone||''],['地址',s.address||''],[''],
    ['单号','日期','状态','金额','已付','未付']];
  f.orders.forEach(function(o){ rows.push([o.ref.no,o.ref.date,STATUS_META[o.status].label,o.ref.total.toFixed(2),o.paid.toFixed(2),o.unpaid.toFixed(2)]); });
  rows.push([''],['应付合计',f.total.toFixed(2)],['已付',f.paid.toFixed(2)],['未付余额',f.unpaid.toFixed(2)]);
  exportCSV('供应商对账单-' + s.name + '-' + todayStr(), rows);
}
function addSup(){
  if (!canOp('sup')) { UI.toast('当前账号无此操作权限','err'); return; }
  var m = UI.modal({
    title:'新增供应商',
    body: UI.form(SUP_SCHEMA, {}),
    footer:'<button class="btn btn-ghost" data-act="cancel" type="button">取消</button><button class="btn btn-verm" data-act="save" type="button">保存档案</button>'
  });
  UI.setFormSchema(SUP_SCHEMA);
  m.el.querySelector('[data-act="cancel"]').addEventListener('click', function(){ m.close(); });
  m.el.querySelector('[data-act="save"]').addEventListener('click', function(){
    var r = UI.readForm(m.el);
    if (!r.ok) { UI.toast('请检查必填项','warn'); return; }
    var id = 'GY' + pad2(S.suppliers.length + 1);
    while (byId(S.suppliers, id)) id = 'GY' + pad2(parseInt(id.slice(2))+1);
    addItem(S.suppliers, { id:id, name:r.values.name, contact:r.values.contact, phone:r.values.phone, address:r.values.address, taxNo:r.values.taxNo, note:r.values.note });
    pushOpLog('新增供应商', r.values.name + '（' + id + '）');
    m.close(); UI.toast('供应商档案已建立','ok');
    renderRoute();
  });
}
function editSup(id){
  if (!canOp('sup')) { UI.toast('当前账号无此操作权限','err'); return; }
  var s = byId(S.suppliers, id); if (!s) return;
  var m = UI.modal({
    title:'编辑供应商 · ' + s.name,
    body: UI.form(SUP_SCHEMA, s),
    footer:'<button class="btn btn-ghost" data-act="cancel" type="button">取消</button><button class="btn btn-verm" data-act="save" type="button">保存修改</button>'
  });
  UI.setFormSchema(SUP_SCHEMA);
  m.el.querySelector('[data-act="cancel"]').addEventListener('click', function(){ m.close(); });
  m.el.querySelector('[data-act="save"]').addEventListener('click', function(){
    var r = UI.readForm(m.el);
    if (!r.ok) { UI.toast('请检查必填项','warn'); return; }
    updateItem(S.suppliers, id, r.values);
    pushOpLog('编辑供应商', r.values.name + '（' + id + '）');
    m.close(); UI.toast('供应商档案已更新','ok');
    renderRoute();
  });
}
function delSup(id){
  if (!canOp('sup')) { UI.toast('当前账号无此操作权限','err'); return; }
  var s = byId(S.suppliers, id); if (!s) return;
  var used = S.purchaseOrders.some(function(o){ return o.supId===id; });
  UI.confirm('删除供应商', '确定删除供应商「' + s.name + '」？' + (used ? ' 该供应商名下已有采购单，删除后历史单据将显示为「已删除供应商」。' : ''), true).then(function(yes){
    if (!yes) return;
    removeItem(S.suppliers, id);
    pushOpLog('删除供应商', s.name + '（' + id + '）');
    UI.toast('供应商已删除','ok');
    renderRoute();
  });
}

/* ================= 产品管理 ================= */
var PRD_SCHEMA = [
  { name:'name', label:'产品名称', req:true, type:'text' },
  { name:'sku', label:'SKU 编码', req:true, type:'text' },
  { name:'cat', label:'分类', req:true, type:'select', options:[] },
  { name:'unit', label:'单位', req:true, type:'text', placeholder:'个 / 盒 / 卷 / 箱' },
  { name:'spec', label:'规格型号', type:'text' },
  { name:'price', label:'销售价（元）', type:'number', min:0, step:'0.01' },
  { name:'cost', label:'成本价（元）', type:'number', min:0, step:'0.01' },
  { name:'safety', label:'安全库存', type:'number', min:0, step:'1', help:'低于此值触发低库存预警' },
  { name:'status', label:'状态', type:'select', options:[{value:'1',label:'启用'},{value:'0',label:'停用'}] }
];
Views.prd = {
  render: function(el, ctx){
    if (ctx.sub === 'view') return this.detail(el, ctx.params.id);
    if (!canView('prd')) { el.innerHTML = UI.deny(); return; }
    var q = ctx.params.q || '';
    var fcat = ctx.params.cat || '';
    var list = S.products.filter(function(p){
      if (fcat && p.cat !== fcat) return false;
      if (!q) return true;
      q = q.toLowerCase();
      return (p.name+p.sku+p.spec).toLowerCase().indexOf(q) > -1;
    });
    var html = '<div class="page-head"><div><div class="page-title">产品管理<span class="sep">/</span><span class="num" style="font-family:var(--serif);font-size:15px;color:var(--ink-2)">' + S.products.length + ' 个品类条目</span></div><div class="page-sub">产品档案 · 价格 · 库存与安全库存</div></div>' +
      '<div class="page-actions">' +
      '<button class="btn btn-ghost" data-act="cat" type="button">' + UI.icon('tag',15) + '分类管理</button>' +
      '<button class="btn btn-ghost" data-act="export" type="button">' + UI.icon('download',15) + '导出</button>' +
      (canOp('prd') ? '<button class="btn btn-verm" data-act="add" type="button">' + UI.icon('plus',15) + '新增产品</button>' : '') +
      '</div></div>';
    html += '<div class="card"><div class="toolbar">' +
      '<input type="search" placeholder="搜索 名称 / SKU / 规格" value="' + q + '" data-role="q">' +
      '<select data-role="cat"><option value="">全部分类</option>' + S.categories.map(function(c){ return '<option value="' + c.id + '"' + (c.id===fcat?' selected':'') + '>' + c.name + '</option>'; }).join('') + '</select>' +
      '<div class="spacer"></div></div>';
    html += UI.table({
      cols:[
        { k:'id', label:'编号', w:'70px', cls:'t-num muted' },
        { k:'name', label:'产品名称', render:function(r){ return '<span class="t-strong">' + r.name + '</span>' + (r.status===0?' <span class="tag">停用</span>':''); } },
        { k:'cat', label:'分类', w:'90px', render:function(r){ return '<span class="tag">' + catName(r.cat) + '</span>'; } },
        { k:'spec', label:'规格', w:'130px', cls:'muted' },
        { k:'unit', label:'单位', w:'80px', cls:'muted' },
        { k:'price', label:'售价', w:'90px', cls:'t-money', render:function(r){ return fmtMoney(r.price); } },
        { k:'cost', label:'成本', w:'90px', cls:'t-money', render:function(r){ return fmtMoney(r.cost); } },
        { k:'stock', label:'库存', w:'80px', cls:'t-num', render:function(r){
          var low = r.stock < r.safety;
          return '<span style="color:' + (low?'var(--verm-2)':'var(--ink)') + ';font-weight:600">' + fmtQty(r.stock) + '</span>';
        } },
        { k:'safety', label:'安全库存', w:'80px', cls:'t-num muted' },
        { k:'ops', label:'操作', w:'150px', render:function(r){ return rowOps([
          { t:'查看', act:'view', id:r.id, cls:'' },
          { t:'编辑', act:'edit', id:r.id, cls:'', need:canOp('prd') },
          { t:'删除', act:'del', id:r.id, cls:'danger', need:canOp('prd') }
        ]); } }
      ],
      rows: list,
      rowGo: '#/prd/view?id=',
      empty: UI.emptyState('box','还没有产品档案','点击右上角「新增产品」建立商品档案')
    });
    html += '</div>';
    el.innerHTML = html;
    el.querySelector('[data-role="q"]').addEventListener('input', function(ev){
      location.hash = '#/prd?q=' + encodeURIComponent(ev.target.value) + (fcat ? '&cat=' + fcat : '');
    });
    el.querySelector('[data-role="cat"]').addEventListener('change', function(ev){
      location.hash = '#/prd?cat=' + ev.target.value + (q ? '&q=' + encodeURIComponent(q) : '');
    });
    bindOps(el, { add: addPrd, edit: editPrd, del: delPrd, view: function(id){ location.hash = '#/prd/view?id=' + id; }, cat: catManager, export: function(){
      exportCSV('产品档案-' + todayStr(), [['编号','名称','SKU','分类','规格','单位','售价','成本','库存','安全库存','状态']]
        .concat(S.products.map(function(p){ return [p.id,p.name,p.sku,catName(p.cat),p.spec||'',p.unit,p.price,p.cost,fmtQty(p.stock),p.safety,p.status===1?'启用':'停用']; })));
    } });
  },
  detail: function(el, id){
    var p = byId(S.products, id);
    if (!p) { el.innerHTML = UI.emptyState('box','产品不存在','该产品可能已被删除'); return; }
    var val = p.stock * p.cost;
    var led = S.stockLedger.filter(function(l){ return l.pid===id; }).slice().reverse();
    var low = p.stock < p.safety;
    var html = '<div class="page-head"><div><div class="page-title">产品档案<span class="sep">/</span>' + p.name + '</div><div class="page-sub">' + (p.sku||'') + ' · ' + catName(p.cat) + ' · ' + (p.spec||'') + '</div></div>' +
      '<div class="page-actions"><button class="btn btn-ghost" data-act="back" type="button">' + UI.icon('back',15) + '返回列表</button>' +
      (canOp('prd') ? '<button class="btn btn-ink" data-act="edit" type="button">' + UI.icon('edit',15) + '编辑档案</button>' : '') + '</div></div>';
    html += '<div class="detail-grid"><div class="card"><div class="card-head"><div><div class="card-title">库存与价值</div><div class="card-sub">' + (low ? '当前低于安全库存' : '库存处于正常水位') + '</div></div>' + (low ? '<div class="card-actions">' + UI.stamp('pending') + '</div>' : '') + '</div><div class="sum-rows">' +
      '<div class="sum-row"><span class="k">当前库存</span><span class="v num" style="' + (low?'color:var(--verm-2)':'') + '">' + fmtQty(p.stock) + ' ' + p.unit + '</span></div>' +
      '<div class="sum-row"><span class="k">安全库存</span><span class="v num">' + fmtQty(p.safety) + '</span></div>' +
      '<div class="sum-row"><span class="k">库存成本</span><span class="v num">' + fmtMoney(val) + '</span></div>' +
      '<div class="sum-row total"><span class="k">缺货差额</span><span class="v num">' + fmtQty(Math.max(0, p.safety - p.stock)) + '</span></div></div></div>';
    html += '<div class="card"><div class="card-head"><div><div class="card-title">定价</div></div></div><div class="sum-rows">' +
      '<div class="sum-row"><span class="k">销售价</span><span class="v num">' + fmtMoney(p.price) + '</span></div>' +
      '<div class="sum-row"><span class="k">成本价</span><span class="v num">' + fmtMoney(p.cost) + '</span></div>' +
      '<div class="sum-row"><span class="k">毛利</span><span class="v num" style="color:var(--teal-2)">' + fmtMoney(p.price-p.cost) + '（' + (p.cost?Math.round((p.price-p.cost)/p.cost*100):0) + '%）</span></div>' +
      '<div class="sum-row"><span class="k">状态</span><span class="v">' + (p.status===1?'启用':'停用') + '</span></div></div></div></div>';
    html += '<div class="card"><div class="card-head"><div><div class="card-title">库存流水</div><div class="card-sub">自期初起的全部变动记录</div></div>' +
      (canOp('inv') ? '<div class="card-actions"><button class="btn btn-verm btn-sm" data-act="adj" type="button">' + UI.icon('refresh',13) + '盘点调整</button></div>' : '') + '</div>';
    if (led.length){
      html += UI.table({
        cols:[
          { k:'date', label:'日期', w:'100px', cls:'t-num muted' },
          { k:'type', label:'类型', w:'100px', render:function(r){ return UI.ledgerTag(r.docType); } },
          { k:'doc', label:'单据', w:'120px', cls:'t-num muted' },
          { k:'qty', label:'变动', w:'90px', cls:'t-num', render:function(r){ return '<span style="color:' + (r.qty>=0?'var(--teal-2)':'var(--verm-2)') + ';font-weight:600">' + (r.qty>=0?'+':'') + fmtQty(r.qty) + '</span>'; } },
          { k:'bal', label:'结存', w:'90px', cls:'t-num' },
          { k:'note', label:'备注', render:function(r){ return '<span class="muted">' + (r.note||'—') + '</span>'; } }
        ],
        rows: led, empty: '暂无流水'
      });
    } else { html += '<div class="card-body">' + UI.emptyState('box','暂无库存流水','') + '</div>'; }
    html += '</div>';
    el.innerHTML = html;
    el.querySelectorAll('[data-act]').forEach(function(b){
      b.addEventListener('click', function(){
        var act = b.getAttribute('data-act');
        if (act==='back') location.hash = '#/prd';
        else if (act==='edit') editPrd(id);
        else if (act==='adj') adjModal(id);
      });
    });
  }
};
function catOptions(sel){
  return S.categories.map(function(c){ return { value:c.id, label:c.name }; });
}
function addPrd(){
  if (!canOp('prd')) { UI.toast('当前账号无此操作权限','err'); return; }
  var schema = PRD_SCHEMA.map(function(f){ return Object.assign({}, f); });
  schema[2].options = catOptions();
  var m = UI.modal({
    title:'新增产品', wide:true,
    body: UI.form(schema, {}),
    footer:'<button class="btn btn-ghost" data-act="cancel" type="button">取消</button><button class="btn btn-verm" data-act="save" type="button">保存档案</button>'
  });
  UI.setFormSchema(schema);
  m.el.querySelector('[data-act="cancel"]').addEventListener('click', function(){ m.close(); });
  m.el.querySelector('[data-act="save"]').addEventListener('click', function(){
    var r = UI.readForm(m.el);
    if (!r.ok) { UI.toast('请检查必填项','warn'); return; }
    var used = {};
    S.products.forEach(function(p){ used[p.id] = true; });
    var n = 1;
    while (used['SP' + pad2(n)]) n++;
    var id = 'SP' + pad2(n);
    if (S.seq.prd < n) S.seq.prd = n;
    addItem(S.products, { id:id, name:r.values.name, sku:r.values.sku, cat:r.values.cat, unit:r.values.unit, spec:r.values.spec, price:Number(r.values.price)||0, cost:Number(r.values.cost)||0, safety:Number(r.values.safety)||0, stock:0, status:Number(r.values.status)||1 });
    pushOpLog('新增产品', r.values.name + '（' + id + '）');
    m.close(); UI.toast('产品档案已建立','ok');
    renderRoute();
  });
}
function editPrd(id){
  if (!canOp('prd')) { UI.toast('当前账号无此操作权限','err'); return; }
  var p = byId(S.products, id); if (!p) return;
  var schema = PRD_SCHEMA.map(function(f){ return Object.assign({}, f); });
  schema[2].options = catOptions();
  schema[7].value = p.status;
  var m = UI.modal({
    title:'编辑产品 · ' + p.name, wide:true,
    body: UI.form(schema, p),
    footer:'<button class="btn btn-ghost" data-act="cancel" type="button">取消</button><button class="btn btn-verm" data-act="save" type="button">保存修改</button>'
  });
  UI.setFormSchema(schema);
  m.el.querySelector('[data-act="cancel"]').addEventListener('click', function(){ m.close(); });
  m.el.querySelector('[data-act="save"]').addEventListener('click', function(){
    var r = UI.readForm(m.el);
    if (!r.ok) { UI.toast('请检查必填项','warn'); return; }
    updateItem(S.products, id, { name:r.values.name, sku:r.values.sku, cat:r.values.cat, unit:r.values.unit, spec:r.values.spec, price:Number(r.values.price)||0, cost:Number(r.values.cost)||0, safety:Number(r.values.safety)||0, status:Number(r.values.status)||1 });
    pushOpLog('编辑产品', r.values.name + '（' + id + '）');
    m.close(); UI.toast('产品档案已更新','ok');
    renderRoute();
  });
}
function delPrd(id){
  if (!canOp('prd')) { UI.toast('当前账号无此操作权限','err'); return; }
  var p = byId(S.products, id); if (!p) return;
  var used = S.salesOrders.some(function(o){ return o.lines.some(function(l){ return l.pid===id; }); }) ||
             S.purchaseOrders.some(function(o){ return o.lines.some(function(l){ return l.pid===id; }); }) ||
             S.stockLedger.some(function(l){ return l.pid===id; });
  UI.confirm('删除产品', '确定删除产品「' + p.name + '」？' + (used ? ' 该产品已有出入库及单据记录，建议改为「停用」而非删除。' : ''), true).then(function(yes){
    if (!yes) return;
    removeItem(S.products, id);
    pushOpLog('删除产品', p.name + '（' + id + '）');
    UI.toast('产品已删除','ok');
    renderRoute();
  });
}
function catManager(){
  var html = '<div class="form" style="margin-bottom:14px"><div class="field"><label>新增分类</label><input id="newCat" type="text" placeholder="分类名称，如 电子元件"></div></div>';
  html += '<div style="display:flex;flex-direction:column;gap:6px">' + S.categories.map(function(c){
    var n = S.products.filter(function(p){ return p.cat===c.id; }).length;
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--line);border-radius:2px;background:var(--surface-2)">' +
      '<span class="tag" style="margin-right:2px">' + c.name + '</span>' +
      '<span class="muted" style="font-size:12px">' + n + ' 个产品</span>' +
      '<span style="margin-left:auto;display:flex;gap:6px">' +
      (n===0 ? '<button class="mini-btn danger" data-act="delcat" data-id="' + c.id + '" type="button">' + UI.icon('trash',13) + '删除</button>' : '') +
      '</span></div>';
  }).join('') + '</div>';
  var m = UI.modal({
    title:'产品分类管理', wide:false,
    body: html,
    footer:'<button class="btn btn-ghost" data-act="done" type="button">完成</button>'
  });
  m.el.querySelector('[data-act="done"]').addEventListener('click', function(){ m.close(); renderRoute(); });
  m.el.querySelector('#newCat').addEventListener('keydown', function(ev){
    if (ev.key !== 'Enter') return;
    var name = ev.target.value.trim();
    if (!name) return;
    if (S.categories.some(function(c){ return c.name===name; })) { UI.toast('分类已存在','warn'); return; }
    addItem(S.categories, { id:'c' + (S.categories.length+1), name:name });
    UI.toast('分类已添加','ok');
    m.close(); renderRoute();
  });
  m.el.querySelectorAll('[data-act="delcat"]').forEach(function(b){
    b.addEventListener('click', function(){
      var id = b.getAttribute('data-id');
      UI.confirm('删除分类', '确定删除该分类？').then(function(yes){
        if (!yes) return;
        removeItem(S.categories, id);
        UI.toast('分类已删除','ok');
        m.close(); renderRoute();
      });
    });
  });
}
function adjModal(pid){
  if (!canOp('inv')) { UI.toast('当前账号无此操作权限','err'); return; }
  var p = byId(S.products, pid); if (!p) return;
  var schema = [
    { name:'qty', label:'调整数量', req:true, type:'number', step:'1', help:'正数 = 盘盈/增加，负数 = 盘亏/减少' },
    { name:'note', label:'调整原因', type:'text', placeholder:'如：盘点差异 / 报损 / 赠品入库' }
  ];
  var m = UI.modal({
    title:'库存盘点调整 · ' + p.name,
    body: '<div class="tipbar amber">' + UI.icon('alert',15) + '当前库存 ' + fmtQty(p.stock) + ' ' + p.unit + '，调整后实时更新</div>' + UI.form(schema, {}),
    footer:'<button class="btn btn-ghost" data-act="cancel" type="button">取消</button><button class="btn btn-verm" data-act="save" type="button">确认调整</button>'
  });
  UI.setFormSchema(schema);
  m.el.querySelector('[data-act="cancel"]').addEventListener('click', function(){ m.close(); });
  m.el.querySelector('[data-act="save"]').addEventListener('click', function(){
    var r = UI.readForm(m.el);
    if (!r.ok) { UI.toast('请填写调整数量','warn'); return; }
    var qty = Number(r.values.qty);
    if (!qty) { UI.toast('调整数量不能为 0','warn'); return; }
    if (p.stock + qty < 0) { UI.toast('调整后库存不能为负数','err'); return; }
    var err = adjustStock(pid, qty, r.values.note);
    if (err) { UI.toast(err,'err'); return; }
    pushOpLog('库存盘点调整', p.name + ' ' + (qty>0?'+':'') + fmtQty(qty) + (r.values.note ? '（' + r.values.note + '）' : ''));
    m.close(); UI.toast('库存已调整：' + (qty>0?'+':'') + fmtQty(qty),'ok');
    renderRoute();
  });
}
function refNo(type, id){
  if (type==='so'){ var o=byId(S.salesOrders,id); return o?o.no:'—'; }
  if (type==='po'){ var p=byId(S.purchaseOrders,id); return p?p.no:'—'; }
  return '—';
}
