/* ============================================================
   账房 ERP · 视图二：销售订单 / 采购单 / 入库单 / 出库单
   ============================================================ */
'use strict';

/* ---------- 公共：单据行编辑 ---------- */
function stampSo(st){ return st==='partial' ? '<span class="stamp st-blue">' + UI.icon('check',11) + '部分出库</span>' : UI.stamp(st); }
function stampPo(st){ return st==='partial' ? '<span class="stamp st-blue">' + UI.icon('check',11) + '部分入库</span>' : UI.stamp(st); }
function lineEditor(container, rows, opts){
  /* rows: [{pid, qty, price}]；opts.lockPrice=true 时单价只读、始终同步产品档案售价 */
  opts = opts || {};
  var lockPrice = !!opts.lockPrice;
  function render(){
    if (!rows.length) { container.innerHTML = '<div class="form-note" style="margin-bottom:8px">尚未添加明细行</div>'; }
    else {
      container.innerHTML = '<div class="line-editor"><div class="line-row" style="font-size:12px;color:var(--ink-3);letter-spacing:.08em"><span>产品</span><span>数量</span><span>单价</span><span>金额</span><span></span></div>' +
        rows.map(function(r, i){
          return '<div class="line-row" data-i="' + i + '">' +
            '<select data-k="pid" aria-label="产品">' + '<option value="">选择产品</option>' + S.products.map(function(p){
              return '<option value="' + p.id + '"' + (r.pid===p.id?' selected':'') + '>' + p.name + '（' + p.unit + '）</option>';
            }).join('') + '</select>' +
            '<input data-k="qty" type="number" min="0" step="any" value="' + r.qty + '" aria-label="数量">' +
            '<input data-k="price" type="number" min="0" step="0.01" value="' + r.price + '" aria-label="单价"' + (lockPrice ? ' readonly title="按产品档案售价自动带出"' : '') + '>' +
            '<span data-k="amt" class="t-num" style="text-align:right;color:var(--ink)">' + fmtMoney(calcAmt(r.qty, r.price)) + '</span>' +
            '<button class="line-del" data-act="rm" type="button" aria-label="删除行"></button></div>';
        }).join('') +
        '<div class="line-sum"><span class="ls">共 ' + rows.length + ' 行 · 合计 <b>' + fmtMoney(total()) + '</b></span></div></div>';
      container.querySelectorAll('.line-row[data-i]').forEach(function(rowEl){
        var i = Number(rowEl.getAttribute('data-i'));
        ['pid','qty','price'].forEach(function(k){
          var inp = rowEl.querySelector('[data-k="' + k + '"]');
          inp.addEventListener('input', function(){
            if (k==='pid' && inp.value){
              var p = byId(S.products, inp.value);
              if (p){ var q = rowEl.querySelector('[data-k="qty"]'); var pr = rowEl.querySelector('[data-k="price"]');
                if (!q.value || Number(q.value)<=0) q.value = 1;
                if (lockPrice) pr.value = p.price;
                else if (!pr.value || Number(pr.value)<=0) pr.value = p.price;
              }
            }
            sync(i);
          });
        });
        rowEl.querySelector('[data-act="rm"]').addEventListener('click', function(){
          rows.splice(i, 1); render(); if (opts.onChange) opts.onChange(total());
        });
        rowEl.querySelector('[data-act="rm"]').innerHTML = UI.icon('x',15);
      });
    }
    if (opts.onChange) opts.onChange(total());
  }
  function sync(i){
    var rowEl = container.querySelector('.line-row[data-i="' + i + '"]');
    if (!rowEl) return;
    var pid = rowEl.querySelector('[data-k="pid"]').value;
    var qty = Number(rowEl.querySelector('[data-k="qty"]').value) || 0;
    var price = Number(rowEl.querySelector('[data-k="price"]').value) || 0;
    rows[i].pid = pid; rows[i].qty = qty; rows[i].price = price;
    rowEl.querySelector('[data-k="amt"]').textContent = fmtMoney(calcAmt(qty, price));
    var sumEl = container.querySelector('.line-sum b');
    if (sumEl) sumEl.textContent = fmtMoney(total());
    if (opts.onChange) opts.onChange(total());
  }
  function total(){
    return rows.reduce(function(s, r){ return s + calcAmt(r.qty, r.price); }, 0);
  }
  render();
  return { add: function(){ rows.push({ pid:'', qty:1, price:0 }); render(); }, redraw: render, rows: rows, total: total };
}
function orderLinesValid(rows){
  if (!rows.length) return '请至少添加一行明细';
  for (var i=0;i<rows.length;i++){
    if (!rows[i].pid) return '第 ' + (i+1) + ' 行未选择产品';
    if (!(rows[i].qty > 0)) return '第 ' + (i+1) + ' 行数量必须大于 0';
    if (rows[i].price < 0) return '第 ' + (i+1) + ' 行单价不能为负数';
  }
  return '';
}

/* ---------- 公共：单据明细弹层 ---------- */
function docDetailModal(title, headRows, lines, footerLines){
  var body = '<div class="form-note" style="margin-bottom:12px">' + headRows.map(function(h){
    return '<span style="display:inline-block;margin-right:14px">' + h.k + '：<b>' + h.v + '</b></span>';
  }).join('') + '</div>';
  body += '<div class="tbl-wrap"><table class="tbl"><thead><tr><th style="width:44%">产品</th><th style="width:14%">数量</th>' +
    (lines[0] && lines[0].price != null ? '<th style="width:16%">单价</th><th style="width:18%">金额</th>' : '<th style="width:20%">类型</th><th style="width:22%">备注</th>') +
    '</tr></thead><tbody>' + lines.map(function(l){
      var p = byId(S.products, l.pid);
      var amt = l.price != null ? '<td class="t-money">' + fmtMoney(calcAmt(l.qty, l.price)) + '</td>' : '<td class="muted">' + (l.note||'—') + '</td>';
      var mid = l.price != null ? '<td class="t-num">' + fmtQty(l.qty) + '</td><td class="t-num">' + fmtMoney(l.price) + '</td>' : '<td class="t-num">' + fmtQty(l.qty) + '</td>';
      return '<tr><td>' + (p ? p.name : '已删除产品') + '<span class="muted" style="font-size:11.5px"> ' + (p?p.unit:'') + '</span></td>' + mid + amt + '</tr>';
    }).join('') + '</tbody></table></div>';
  if (footerLines && footerLines.length){
    body += '<div class="sum-rows" style="margin-top:10px">' + footerLines.map(function(f){
      return '<div class="sum-row"><span class="k">' + f.k + '</span><span class="v num">' + f.v + '</span></div>';
    }).join('') + '</div>';
  }
  var m = UI.modal({ title: title, wide:true, body: body, footer:'<button class="btn btn-ghost" data-act="done" type="button">关闭</button>' });
  m.el.querySelector('[data-act="done"]').addEventListener('click', function(){ m.close(); });
}

/* ================= 销售订单 ================= */
Views.sale = {
  render: function(el, ctx){
    if (ctx.sub === 'view') return this.detail(el, ctx.params.id);
    if (!canView('sale')) { el.innerHTML = UI.deny(); return; }
    var f = ctx.params.f || '';
    var q = ctx.params.q || '';
    var list = S.salesOrders.filter(function(o){
      var st = soStatus(o);
      if (f && st !== f) return false;
      if (!q) return true;
      q = q.toLowerCase();
      var c = byId(S.customers, o.custId);
      return (o.no + (c?c.name:'')).toLowerCase().indexOf(q) > -1;
    });
    var counts = { pending:0, audited:0, partial:0, shipped:0, done:0, canceled:0 };
    S.salesOrders.forEach(function(o){ counts[soStatus(o)]++; });
    var tabs = [
      { key:'', label:'全部' },
      { key:'pending', label:'待审核', count:counts.pending },
      { key:'audited', label:'已审核', count:counts.audited },
      { key:'partial', label:'部分出库', count:counts.partial },
      { key:'shipped', label:'已出库', count:counts.shipped },
      { key:'done', label:'已完成', count:counts.done },
      { key:'canceled', label:'已取消', count:counts.canceled }
    ];
    var html = '<div class="page-head"><div><div class="page-title">销售订单<span class="sep">/</span><span class="num" style="font-family:var(--serif);font-size:15px;color:var(--ink-2)">' + S.salesOrders.length + ' 单</span></div><div class="page-sub">客户下单 · 审核 · 出库 · 收款闭环</div></div>' +
      '<div class="page-actions"><button class="btn btn-ghost" data-act="export" type="button">' + UI.icon('download',15) + '导出</button>' +
      (canOp('sale') ? '<button class="btn btn-verm" data-act="add" type="button">' + UI.icon('plus',15) + '新建销售订单</button>' : '') + '</div></div>';
    html += '<div class="card"><div class="toolbar"><input type="search" placeholder="搜索 单号 / 客户" value="' + q + '" data-role="q"><div class="spacer"></div></div>';
    html += UI.tabs(tabs, f, '#/sale?f={k}' + (q ? '&q=' + encodeURIComponent(q) : ''));
    html += UI.table({
      cols:[
        { k:'no', label:'单号', w:'160px', cls:'t-num muted', render:function(r){ return '<span style="font-family:var(--serif)">' + r.no + '</span>'; } },
        { k:'date', label:'日期', w:'100px', cls:'t-num muted' },
        { k:'cust', label:'客户', render:function(r){ var c=byId(S.customers,r.custId); return '<span class="t-strong">' + (c?c.name:'已删除客户') + '</span>'; } },
        { k:'total', label:'金额', w:'120px', cls:'t-money', render:function(r){ return fmtMoney(r.total); } },
        { k:'paid', label:'已收', w:'110px', cls:'t-money', render:function(r){ return '<span style="color:var(--teal-2)">' + fmtMoney(paidOf('so', r.id)) + '</span>'; } },
        { k:'status', label:'状态', w:'96px', render:function(r){ return UI.stamp(soStatus(r)); } },
        { k:'ops', label:'操作', w:'90px', render:function(r){ return rowOps([{ t:'单据', act:'view', id:r.id, cls:'' }]); } }
      ],
      rows: list,
      rowGo: '#/sale/view?id=',
      empty: UI.emptyState('sale','没有符合条件的销售订单','新建订单或切换筛选条件')
    });
    html += '</div>';
    el.innerHTML = html;
    el.querySelector('[data-role="q"]').addEventListener('input', function(ev){
      location.hash = '#/sale?q=' + encodeURIComponent(ev.target.value) + (f ? '&f=' + f : '');
    });
    bindOps(el, { add: createSO, view: function(id){ location.hash = '#/sale/view?id=' + id; }, export: function(){
      exportCSV('销售订单-' + todayStr(), [['单号','日期','客户','金额','已收','未收','状态']]
        .concat(list.map(function(o){ var st=soStatus(o); return [o.no,o.date,partnerName('crm',o.custId),o.total.toFixed(2),paidOf('so',o.id).toFixed(2),(o.total-paidOf('so',o.id)).toFixed(2),STATUS_META[st].label]; })));
    } });
  },
  detail: function(el, id){
    var so = byId(S.salesOrders, id);
    if (!so) { el.innerHTML = UI.emptyState('sale','销售订单不存在','该订单可能已被删除'); return; }
    var st = soStatus(so);
    var c = byId(S.customers, so.custId);
    var paid = paidOf('so', so.id), unpaid = Math.round((so.total - paid)*100)/100;
    var html = '<div class="page-head"><div><div class="page-title">销售订单<span class="sep">/</span>' + so.no + '</div><div class="page-sub">' + (c?c.name:'已删除客户') + ' · ' + so.date + ' · ' + UI.stamp(st) + '</div></div>' +
      '<div class="page-actions"><button class="btn btn-ghost" data-act="back" type="button">' + UI.icon('back',15) + '返回列表</button>' +
      (canOp('fin') && st!=='pending' && st!=='canceled' && unpaid>0.005 ? '<button class="btn btn-teal" data-act="pay" type="button">' + UI.icon('coin',15) + '登记收款</button>' : '') +
      (canOp('ob') && (st==='audited'||st==='partial') ? '<button class="btn btn-verm" data-act="ship" type="button">' + UI.icon('ob',15) + '销售出库</button>' : '') +
      (canOp('sale') && st==='shipped' ? '<button class="btn btn-ink" data-act="done" type="button">' + UI.icon('check',15) + '完成订单</button>' : '') +
      (canOp('sale') && (st==='pending'||st==='audited') ? '<button class="btn btn-ink" data-act="audit" type="button">' + UI.icon('check',15) + '审核</button>' : '') +
      (canOp('sale') && (st==='pending'||st==='audited') ? '<button class="btn btn-ghost" data-act="cancel" type="button">' + UI.icon('x',15) + '取消</button>' : '') +
      (st==='canceled' && canOp('sale') ? '<button class="btn btn-danger" data-act="del" type="button">' + UI.icon('trash',15) + '删除</button>' : '') +
      '</div></div>';
    html += '<div class="detail-grid"><div class="card"><div class="card-head"><div><div class="card-title">账款</div></div></div><div class="sum-rows">' +
      '<div class="sum-row"><span class="k">订单金额</span><span class="v num">' + fmtMoney(so.total) + '</span></div>' +
      '<div class="sum-row"><span class="k">已收</span><span class="v num" style="color:var(--teal-2)">' + fmtMoney(paid) + '</span></div>' +
      '<div class="sum-row total"><span class="k">未收</span><span class="v num">' + fmtMoney(unpaid) + '</span></div></div></div>';
    html += '<div class="card"><div class="card-head"><div><div class="card-title">出库进度</div><div class="card-sub">已出库 / 应出库</div></div></div><div class="sum-rows">' +
      so.lines.map(function(l){
        var s = shippedQtyOf(so.id, l.pid);
        return '<div class="sum-row"><span class="k">' + prodName(l.pid) + '</span><span class="v num" style="color:' + (s>=l.qty?'var(--teal-2)':'var(--verm-2)') + '">' + fmtQty(s) + ' / ' + fmtQty(l.qty) + '</span></div>';
      }).join('') + '</div></div></div>';
    html += '<div class="card"><div class="card-head"><div><div class="card-title">明细</div><div class="card-sub">' + so.lines.length + ' 行</div></div></div>';
    html += UI.table({
      cols:[
        { k:'name', label:'产品', render:function(r){ return '<span class="t-strong">' + prodName(r.pid) + '</span>'; } },
        { k:'qty', label:'数量', w:'90px', cls:'t-num', render:function(r){ return fmtQty(r.qty) + ' ' + (function(){ var p=byId(S.products,r.pid); return p?p.unit:''; })(); } },
        { k:'price', label:'单价', w:'110px', cls:'t-money', render:function(r){ return fmtMoney(r.price); } },
        { k:'amt', label:'金额', w:'120px', cls:'t-money', render:function(r){ return fmtMoney(r.amt); } }
      ],
      rows: so.lines, empty: '无明细'
    });
    html += '</div>';
    var pays = S.payments.filter(function(p){ return p.type==='in' && p.refType==='so' && p.refId===so.id; }).slice().reverse();
    html += '<div class="card" style="margin-top:12px"><div class="card-head"><div><div class="card-title">收款记录</div><div class="card-sub">' + pays.length + ' 笔</div></div></div>';
    if (pays.length){
      html += UI.table({
        cols:[
          { k:'date', label:'日期', w:'100px', cls:'t-num muted' },
          { k:'amount', label:'金额', w:'120px', cls:'t-money', render:function(r){ return '<span style="color:var(--teal-2)">' + fmtMoney(r.amount) + '</span>'; } },
          { k:'method', label:'方式', w:'100px' },
          { k:'note', label:'备注', render:function(r){ return '<span class="muted">' + (r.note||'—') + '</span>'; } }
        ],
        rows: pays, empty: '暂无收款'
      });
    } else { html += '<div class="card-body">' + UI.emptyState('coin','暂无收款记录','订单审核后可通过「登记收款」收取货款') + '</div>'; }
    html += '</div>';
    el.innerHTML = html;
    el.querySelectorAll('[data-act]').forEach(function(b){
      b.addEventListener('click', function(){
        var act = b.getAttribute('data-act');
        if (act==='back') location.hash = '#/sale';
        else if (act==='audit') soAction(so, soAudit, '审核通过', '订单已审核，可安排出库');
        else if (act==='cancel') soCancelAction(so);
        else if (act==='ship') shipFromSO(so);
        else if (act==='done') soAction(so, soDone, '订单完成', '订单已完成归档');
        else if (act==='pay') payModal('so', so.id);
        else if (act==='del') delOrder('so', so);
      });
    });
  }
};
function soAction(so, fn, okTitle, okMsg){
  UI.confirm(okTitle, '确定对订单 ' + so.no + ' 执行此操作？').then(function(yes){
    if (!yes) return;
    var err = fn(so);
    if (err) { UI.toast(err, 'err'); return; }
    if (okTitle === '审核通过') pushNote('sale', '销售订单已审核', so.no + ' 审核通过，可安排出库', '#/sale/view?id=' + so.id);
    else if (okTitle === '订单完成') pushNote('sale', '订单已完成', so.no + ' 已归档完成', '#/sale/view?id=' + so.id);
    pushOpLog(okTitle, '销售订单 ' + so.no + ' ' + okMsg);
    UI.toast(okMsg, 'ok');
    renderRoute();
  });
}
function soCancelAction(so){
  UI.confirm('取消订单', '确定取消订单 ' + so.no + '？取消后不可恢复。', true).then(function(yes){
    if (!yes) return;
    var err = soCancel(so);
    if (err) { UI.toast(err, 'err'); return; }
    pushNote('sale', '销售订单已取消', so.no + ' 已取消', '#/sale?f=canceled');
    pushOpLog('取消订单', '销售订单 ' + so.no + ' 已取消');
    UI.toast('订单已取消', 'ok');
    renderRoute();
  });
}
function delOrder(type, doc){
  UI.confirm('删除单据', '确定删除单据 ' + doc.no + '？删除后不可恢复。', true).then(function(yes){
    if (!yes) return;
    if (type==='so') removeItem(S.salesOrders, doc.id);
    else removeItem(S.purchaseOrders, doc.id);
    pushOpLog('删除单据', (type==='so'?'销售订单':'采购单') + ' ' + doc.no + ' 已删除');
    UI.toast('单据已删除', 'ok');
    renderRoute();
  });
}
function createSO(){
  if (!canOp('sale')) { UI.toast('当前账号无此操作权限','err'); return; }
  var rows = [{ pid:'', qty:1, price:0 }];
  var m = UI.modal({
    title:'新建销售订单', wide:true,
    body: '<div class="form two" style="margin-bottom:14px">' +
      '<div class="field"><label><span class="req">*</span>客户</label><select id="soCust"><option value="">选择客户</option>' + S.customers.map(function(c){ return '<option value="' + c.id + '">' + c.name + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label>订单日期</label><input id="soDate" type="date" value="' + todayStr() + '"></div>' +
      '<div class="field full"><label>备注</label><input id="soNote" type="text" placeholder="客户要求、交期等"></div></div>' +
      '<div class="card-title" style="font-size:14px;margin-bottom:8px">明细行</div><div id="soLines"></div>',
    footer: '<span class="left"><button class="btn btn-ghost" data-act="addline" type="button">' + UI.icon('plus',13) + '添加一行</button></span>' +
      '<button class="btn btn-ghost" data-act="cancel" type="button">取消</button><button class="btn btn-verm" data-act="save" type="button">保存订单</button>'
  });
  var ed = lineEditor(m.el.querySelector('#soLines'), rows, { lockPrice:true });
  m.el.querySelector('[data-act="addline"]').addEventListener('click', function(){ ed.add(); });
  m.el.querySelector('[data-act="cancel"]').addEventListener('click', function(){ m.close(); });
  m.el.querySelector('[data-act="save"]').addEventListener('click', function(){
    var cust = m.el.querySelector('#soCust').value;
    var date = m.el.querySelector('#soDate').value || todayStr();
    var note = m.el.querySelector('#soNote').value.trim();
    if (!cust) { UI.toast('请选择客户', 'warn'); return; }
    var err = orderLinesValid(ed.rows);
    if (err) { UI.toast(err, 'warn'); return; }
    var lines = ed.rows.map(function(r){ return { pid:r.pid, qty:Number(r.qty), price:Number(r.price), amt:calcAmt(r.qty, r.price) }; });
    var seq = nextSeq('so');
    var id = 'SO' + pad2(seq);
    var no = 'XS' + date.replace(/-/g,'') + String(seq);
    var total = lines.reduce(function(s,l){ return s+l.amt; }, 0);
    addItem(S.salesOrders, { id:id, no:no, date:date, custId:cust, note:note, audited:false, closed:false, done:false, total:Math.round(total*100)/100, lines:lines });
    pushNote('sale', '销售订单待审核', partnerName('crm', cust) + ' · ' + no, '#/sale?f=pending');
    pushOpLog('新建销售订单', no + ' 客户 ' + partnerName('crm', cust) + '，合计 ' + fmtMoney(total));
    m.close(); UI.toast('销售订单已创建，待审核', 'ok');
    renderRoute();
  });
}
function shipFromSO(so){
  if (!canOp('ob')) { UI.toast('当前账号无此操作权限','err'); return; }
  var rows = so.lines.map(function(l){ return { pid:l.pid, qty:Math.max(0, l.qty - shippedQtyOf(so.id, l.pid)), price:0 }; })
    .filter(function(r){ return r.qty > 0; });
  if (!rows.length) { UI.toast('该订单已全部出库', 'warn'); return; }
  var m = UI.modal({
    title:'销售出库 · ' + so.no, wide:true,
    body: '<div class="tipbar blue">' + UI.icon('alert',15) + '出库数量默认为未出库余量，可下调；保存后实时扣减库存并生成出库单</div>' +
      '<div class="form two" style="margin:12px 0"><div class="field"><label>出库日期</label><input id="obDate" type="date" value="' + todayStr() + '"></div>' +
      '<div class="field"><label>经手人</label><input id="obOp" type="text" value="' + currentUser().name + '"></div></div>' +
      '<div id="obLines"></div>',
    footer: '<button class="btn btn-ghost" data-act="cancel" type="button">取消</button><button class="btn btn-verm" data-act="save" type="button">确认出库</button>'
  });
  var ed = lineEditor(m.el.querySelector('#obLines'), rows);
  m.el.querySelector('[data-act="cancel"]').addEventListener('click', function(){ m.close(); });
  m.el.querySelector('[data-act="save"]').addEventListener('click', function(){
    var err = orderLinesValid(ed.rows);
    if (err) { UI.toast(err, 'warn'); return; }
    var date = m.el.querySelector('#obDate').value || todayStr();
    var op = m.el.querySelector('#obOp').value.trim() || currentUser().name;
    var lines = ed.rows.filter(function(r){ return r.pid && r.qty>0; }).map(function(r){ return { pid:r.pid, qty:Number(r.qty) }; });
    var res = createOutbound({ type:'sales', refId:so.id, date:date, operator:op, lines:lines, note:'销售出库' });
    if (res) { UI.toast(res, 'err'); return; }
    pushNote('ob', '销售出库完成', so.no + ' · ' + lines.length + ' 行', '#/ob');
    pushOpLog('销售出库', so.no + ' 出库 ' + lines.length + ' 行，经手人 ' + op);
    m.close(); UI.toast('出库完成，库存已扣减', 'ok');
    renderRoute();
  });
}

/* ================= 采购单 ================= */
Views.pur = {
  render: function(el, ctx){
    if (ctx.sub === 'view') return this.detail(el, ctx.params.id);
    if (!canView('pur')) { el.innerHTML = UI.deny(); return; }
    var f = ctx.params.f || '', q = ctx.params.q || '';
    var list = S.purchaseOrders.filter(function(o){
      var st = poStatus(o);
      if (f && st !== f) return false;
      if (!q) return true;
      q = q.toLowerCase();
      var s = byId(S.suppliers, o.supId);
      return (o.no + (s?s.name:'')).toLowerCase().indexOf(q) > -1;
    });
    var counts = { pending:0, audited:0, partial:0, received:0, done:0, canceled:0 };
    S.purchaseOrders.forEach(function(o){ counts[poStatus(o)]++; });
    var tabs = [
      { key:'', label:'全部' }, { key:'pending', label:'待审核', count:counts.pending },
      { key:'audited', label:'已审核', count:counts.audited }, { key:'partial', label:'部分入库', count:counts.partial },
      { key:'received', label:'已入库', count:counts.received }, { key:'done', label:'已完成', count:counts.done },
      { key:'canceled', label:'已取消', count:counts.canceled }
    ];
    var html = '<div class="page-head"><div><div class="page-title">采购单<span class="sep">/</span><span class="num" style="font-family:var(--serif);font-size:15px;color:var(--ink-2)">' + S.purchaseOrders.length + ' 单</span></div><div class="page-sub">供应商下单 · 审核 · 入库 · 付款闭环</div></div>' +
      '<div class="page-actions"><button class="btn btn-ghost" data-act="export" type="button">' + UI.icon('download',15) + '导出</button>' +
      (canOp('pur') ? '<button class="btn btn-verm" data-act="add" type="button">' + UI.icon('plus',15) + '新建采购单</button>' : '') + '</div></div>';
    html += '<div class="card"><div class="toolbar"><input type="search" placeholder="搜索 单号 / 供应商" value="' + q + '" data-role="q"><div class="spacer"></div></div>';
    html += UI.tabs(tabs, f, '#/pur?f={k}' + (q ? '&q=' + encodeURIComponent(q) : ''));
    html += UI.table({
      cols:[
        { k:'no', label:'单号', w:'160px', cls:'t-num muted', render:function(r){ return '<span style="font-family:var(--serif)">' + r.no + '</span>'; } },
        { k:'date', label:'日期', w:'100px', cls:'t-num muted' },
        { k:'sup', label:'供应商', render:function(r){ var s=byId(S.suppliers,r.supId); return '<span class="t-strong">' + (s?s.name:'已删除供应商') + '</span>'; } },
        { k:'total', label:'金额', w:'120px', cls:'t-money', render:function(r){ return fmtMoney(r.total); } },
        { k:'paid', label:'已付', w:'110px', cls:'t-money', render:function(r){ return '<span style="color:var(--teal-2)">' + fmtMoney(paidOutOf('po', r.id)) + '</span>'; } },
        { k:'status', label:'状态', w:'96px', render:function(r){ return stampPo(poStatus(r)); } },
        { k:'ops', label:'操作', w:'90px', render:function(r){ return rowOps([{ t:'单据', act:'view', id:r.id, cls:'' }]); } }
      ],
      rows: list,
      rowGo: '#/pur/view?id=',
      empty: UI.emptyState('pur','没有符合条件的采购单','新建采购单或切换筛选条件')
    });
    html += '</div>';
    el.innerHTML = html;
    el.querySelector('[data-role="q"]').addEventListener('input', function(ev){
      location.hash = '#/pur?q=' + encodeURIComponent(ev.target.value) + (f ? '&f=' + f : '');
    });
    bindOps(el, { add: createPO, view: function(id){ location.hash = '#/pur/view?id=' + id; }, export: function(){
      exportCSV('采购单-' + todayStr(), [['单号','日期','供应商','金额','已付','未付','状态']]
        .concat(list.map(function(o){ var st=poStatus(o); return [o.no,o.date,partnerName('sup',o.supId),o.total.toFixed(2),paidOutOf('po',o.id).toFixed(2),(o.total-paidOutOf('po',o.id)).toFixed(2),STATUS_META[st].label]; })));
    } });
  },
  detail: function(el, id){
    var po = byId(S.purchaseOrders, id);
    if (!po) { el.innerHTML = UI.emptyState('pur','采购单不存在','该单据可能已被删除'); return; }
    var st = poStatus(po);
    var s = byId(S.suppliers, po.supId);
    var paid = paidOutOf('po', po.id), unpaid = Math.round((po.total - paid)*100)/100;
    var html = '<div class="page-head"><div><div class="page-title">采购单<span class="sep">/</span>' + po.no + '</div><div class="page-sub">' + (s?s.name:'已删除供应商') + ' · ' + po.date + ' · ' + stampPo(st) + '</div></div>' +
      '<div class="page-actions"><button class="btn btn-ghost" data-act="back" type="button">' + UI.icon('back',15) + '返回列表</button>' +
      (canOp('fin') && st!=='pending' && st!=='canceled' && unpaid>0.005 ? '<button class="btn btn-teal" data-act="pay" type="button">' + UI.icon('coin',15) + '登记付款</button>' : '') +
      (canOp('ib') && (st==='audited'||st==='partial') ? '<button class="btn btn-verm" data-act="recv" type="button">' + UI.icon('ib',15) + '采购入库</button>' : '') +
      (canOp('pur') && st==='received' ? '<button class="btn btn-ink" data-act="done" type="button">' + UI.icon('check',15) + '完成采购</button>' : '') +
      (canOp('pur') && (st==='pending'||st==='audited') ? '<button class="btn btn-ink" data-act="audit" type="button">' + UI.icon('check',15) + '审核</button>' : '') +
      (canOp('pur') && (st==='pending'||st==='audited') ? '<button class="btn btn-ghost" data-act="cancel" type="button">' + UI.icon('x',15) + '取消</button>' : '') +
      (st==='canceled' && canOp('pur') ? '<button class="btn btn-danger" data-act="del" type="button">' + UI.icon('trash',15) + '删除</button>' : '') +
      '</div></div>';
    html += '<div class="detail-grid"><div class="card"><div class="card-head"><div><div class="card-title">账款</div></div></div><div class="sum-rows">' +
      '<div class="sum-row"><span class="k">订单金额</span><span class="v num">' + fmtMoney(po.total) + '</span></div>' +
      '<div class="sum-row"><span class="k">已付</span><span class="v num" style="color:var(--teal-2)">' + fmtMoney(paid) + '</span></div>' +
      '<div class="sum-row total"><span class="k">未付</span><span class="v num">' + fmtMoney(unpaid) + '</span></div></div></div>';
    html += '<div class="card"><div class="card-head"><div><div class="card-title">入库进度</div><div class="card-sub">已入库 / 应入库</div></div></div><div class="sum-rows">' +
      po.lines.map(function(l){
        var r = receivedQtyOf(po.id, l.pid);
        return '<div class="sum-row"><span class="k">' + prodName(l.pid) + '</span><span class="v num" style="color:' + (r>=l.qty?'var(--teal-2)':'var(--verm-2)') + '">' + fmtQty(r) + ' / ' + fmtQty(l.qty) + '</span></div>';
      }).join('') + '</div></div></div>';
    html += '<div class="card"><div class="card-head"><div><div class="card-title">明细</div><div class="card-sub">' + po.lines.length + ' 行</div></div></div>';
    html += UI.table({
      cols:[
        { k:'name', label:'产品', render:function(r){ return '<span class="t-strong">' + prodName(r.pid) + '</span>'; } },
        { k:'qty', label:'数量', w:'90px', cls:'t-num', render:function(r){ return fmtQty(r.qty) + ' ' + (function(){ var p=byId(S.products,r.pid); return p?p.unit:''; })(); } },
        { k:'price', label:'单价', w:'110px', cls:'t-money', render:function(r){ return fmtMoney(r.price); } },
        { k:'amt', label:'金额', w:'120px', cls:'t-money', render:function(r){ return fmtMoney(r.amt); } }
      ],
      rows: po.lines, empty: '无明细'
    });
    html += '</div>';
    var pays = S.payments.filter(function(p){ return p.type==='out' && p.refType==='po' && p.refId===po.id; }).slice().reverse();
    html += '<div class="card" style="margin-top:12px"><div class="card-head"><div><div class="card-title">付款记录</div><div class="card-sub">' + pays.length + ' 笔</div></div></div>';
    if (pays.length){
      html += UI.table({
        cols:[
          { k:'date', label:'日期', w:'100px', cls:'t-num muted' },
          { k:'amount', label:'金额', w:'120px', cls:'t-money', render:function(r){ return '<span style="color:var(--verm-2)">' + fmtMoney(r.amount) + '</span>'; } },
          { k:'method', label:'方式', w:'100px' },
          { k:'note', label:'备注', render:function(r){ return '<span class="muted">' + (r.note||'—') + '</span>'; } }
        ],
        rows: pays, empty: '暂无付款'
      });
    } else { html += '<div class="card-body">' + UI.emptyState('coin','暂无付款记录','采购审核后可通过「登记付款」结算货款') + '</div>'; }
    html += '</div>';
    el.innerHTML = html;
    el.querySelectorAll('[data-act]').forEach(function(b){
      b.addEventListener('click', function(){
        var act = b.getAttribute('data-act');
        if (act==='back') location.hash = '#/pur';
        else if (act==='audit') poAction(po, poAudit, '审核通过', '采购单已审核，可安排入库');
        else if (act==='cancel') poCancelAction(po);
        else if (act==='recv') receiveFromPO(po);
        else if (act==='done') poAction(po, poDone, '采购完成', '采购单已完成归档');
        else if (act==='pay') payModal('po', po.id);
        else if (act==='del') delOrder('po', po);
      });
    });
  }
};
function poAction(po, fn, okTitle, okMsg){
  UI.confirm(okTitle, '确定对采购单 ' + po.no + ' 执行此操作？').then(function(yes){
    if (!yes) return;
    var err = fn(po);
    if (err) { UI.toast(err, 'err'); return; }
    if (okTitle === '审核通过') pushNote('pur', '采购单已审核', po.no + ' 审核通过，可安排入库', '#/pur/view?id=' + po.id);
    else if (okTitle === '采购完成') pushNote('pur', '采购已完成', po.no + ' 已归档完成', '#/pur/view?id=' + po.id);
    pushOpLog(okTitle, '采购单 ' + po.no + ' ' + okMsg);
    UI.toast(okMsg, 'ok');
    renderRoute();
  });
}
function poCancelAction(po){
  UI.confirm('取消采购单', '确定取消采购单 ' + po.no + '？取消后不可恢复。', true).then(function(yes){
    if (!yes) return;
    var err = poCancel(po);
    if (err) { UI.toast(err, 'err'); return; }
    pushNote('pur', '采购单已取消', po.no + ' 已取消', '#/pur?f=canceled');
    pushOpLog('取消采购单', po.no + ' 已取消');
    UI.toast('采购单已取消', 'ok');
    renderRoute();
  });
}
function createPO(){
  if (!canOp('pur')) { UI.toast('当前账号无此操作权限','err'); return; }
  var rows = [{ pid:'', qty:1, price:0 }];
  var m = UI.modal({
    title:'新建采购单', wide:true,
    body: '<div class="form two" style="margin-bottom:14px">' +
      '<div class="field"><label><span class="req">*</span>供应商</label><select id="poSup"><option value="">选择供应商</option>' + S.suppliers.map(function(s){ return '<option value="' + s.id + '">' + s.name + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label>采购日期</label><input id="poDate" type="date" value="' + todayStr() + '"></div>' +
      '<div class="field full"><label>备注</label><input id="poNote" type="text" placeholder="交期、到货要求等"></div></div>' +
      '<div class="card-title" style="font-size:14px;margin-bottom:8px">明细行</div><div id="poLines"></div>',
    footer: '<span class="left"><button class="btn btn-ghost" data-act="addline" type="button">' + UI.icon('plus',13) + '添加一行</button></span>' +
      '<button class="btn btn-ghost" data-act="cancel" type="button">取消</button><button class="btn btn-verm" data-act="save" type="button">保存采购单</button>'
  });
  var ed = lineEditor(m.el.querySelector('#poLines'), rows);
  m.el.querySelector('[data-act="addline"]').addEventListener('click', function(){ ed.add(); });
  m.el.querySelector('[data-act="cancel"]').addEventListener('click', function(){ m.close(); });
  m.el.querySelector('[data-act="save"]').addEventListener('click', function(){
    var sup = m.el.querySelector('#poSup').value;
    var date = m.el.querySelector('#poDate').value || todayStr();
    var note = m.el.querySelector('#poNote').value.trim();
    if (!sup) { UI.toast('请选择供应商', 'warn'); return; }
    var err = orderLinesValid(ed.rows);
    if (err) { UI.toast(err, 'warn'); return; }
    var lines = ed.rows.map(function(r){ return { pid:r.pid, qty:Number(r.qty), price:Number(r.price), amt:calcAmt(r.qty, r.price) }; });
    var seq = nextSeq('po');
    var id = 'PO' + pad2(seq);
    var no = 'CG' + date.replace(/-/g,'') + String(seq);
    var total = lines.reduce(function(s,l){ return s+l.amt; }, 0);
    addItem(S.purchaseOrders, { id:id, no:no, date:date, supId:sup, note:note, audited:false, closed:false, done:false, total:Math.round(total*100)/100, lines:lines });
    pushNote('pur', '采购单待审核', partnerName('sup', sup) + ' · ' + no, '#/pur?f=pending');
    pushOpLog('新建采购单', no + ' 供应商 ' + partnerName('sup', sup) + '，合计 ' + fmtMoney(total));
    m.close(); UI.toast('采购单已创建，待审核', 'ok');
    renderRoute();
  });
}
function receiveFromPO(po){
  if (!canOp('ib')) { UI.toast('当前账号无此操作权限','err'); return; }
  var rows = po.lines.map(function(l){ return { pid:l.pid, qty:Math.max(0, l.qty - receivedQtyOf(po.id, l.pid)), price:0 }; })
    .filter(function(r){ return r.qty > 0; });
  if (!rows.length) { UI.toast('该采购单已全部入库', 'warn'); return; }
  var m = UI.modal({
    title:'采购入库 · ' + po.no, wide:true,
    body: '<div class="tipbar teal">' + UI.icon('alert',15) + '入库数量默认为未到货余量，可下调；保存后实时增加库存并生成入库单</div>' +
      '<div class="form two" style="margin:12px 0"><div class="field"><label>入库日期</label><input id="ibDate" type="date" value="' + todayStr() + '"></div>' +
      '<div class="field"><label>经手人</label><input id="ibOp" type="text" value="' + currentUser().name + '"></div></div>' +
      '<div id="ibLines"></div>',
    footer: '<button class="btn btn-ghost" data-act="cancel" type="button">取消</button><button class="btn btn-verm" data-act="save" type="button">确认入库</button>'
  });
  var ed = lineEditor(m.el.querySelector('#ibLines'), rows);
  m.el.querySelector('[data-act="cancel"]').addEventListener('click', function(){ m.close(); });
  m.el.querySelector('[data-act="save"]').addEventListener('click', function(){
    var err = orderLinesValid(ed.rows);
    if (err) { UI.toast(err, 'warn'); return; }
    var date = m.el.querySelector('#ibDate').value || todayStr();
    var op = m.el.querySelector('#ibOp').value.trim() || currentUser().name;
    var lines = ed.rows.filter(function(r){ return r.pid && r.qty>0; }).map(function(r){ return { pid:r.pid, qty:Number(r.qty) }; });
    var res = createInbound({ type:'purchase', refId:po.id, date:date, operator:op, lines:lines, note:'采购入库' });
    if (res) { UI.toast(res, 'err'); return; }
    pushNote('ib', '采购入库完成', po.no + ' · ' + lines.length + ' 行', '#/ib');
    pushOpLog('采购入库', po.no + ' 入库 ' + lines.length + ' 行，经手人 ' + op);
    m.close(); UI.toast('入库完成，库存已增加', 'ok');
    renderRoute();
  });
}

/* ================= 入库单 ================= */
Views.ib = {
  render: function(el, ctx){
    if (!canView('ib')) { el.innerHTML = UI.deny(); return; }
    var t = ctx.params.t || '', q = ctx.params.q || '';
    var list = S.inboundDocs.filter(function(d){
      if (t && d.type !== t) return false;
      if (!q) return true;
      q = q.toLowerCase();
      return (d.no + (d.refId ? refNo('po', d.refId) : '')).toLowerCase().indexOf(q) > -1;
    }).slice().reverse();
    var html = '<div class="page-head"><div><div class="page-title">入库单<span class="sep">/</span><span class="num" style="font-family:var(--serif);font-size:15px;color:var(--ink-2)">' + S.inboundDocs.length + ' 张</span></div><div class="page-sub">采购入库 · 其他入库 · 库存增加凭证</div></div>' +
      '<div class="page-actions">' +
      (canOp('ib') ? '<button class="btn btn-verm" data-act="add" type="button">' + UI.icon('plus',15) + '新建入库单</button>' : '') + '</div></div>';
    html += '<div class="card"><div class="toolbar"><input type="search" placeholder="搜索 单号 / 关联采购单" value="' + q + '" data-role="q">' +
      '<select data-role="t"><option value="">全部类型</option><option value="purchase"' + (t==='purchase'?' selected':'') + '>采购入库</option><option value="other"' + (t==='other'?' selected':'') + '>其他入库</option></select>' +
      '<div class="spacer"></div></div>';
    html += UI.table({
      cols:[
        { k:'no', label:'单号', w:'160px', cls:'t-num muted', render:function(r){ return '<span style="font-family:var(--serif)">' + r.no + '</span>'; } },
        { k:'date', label:'日期', w:'100px', cls:'t-num muted' },
        { k:'type', label:'类型', w:'100px', render:function(r){ return UI.docTag(r.type); } },
        { k:'ref', label:'关联', w:'160px', render:function(r){ return r.refId ? refNo('po', r.refId) : '<span class="muted">—</span>'; } },
        { k:'op', label:'经手人', w:'100px' },
        { k:'sum', label:'入库合计', w:'130px', cls:'t-money', render:function(r){ return fmtMoney(r.lines.reduce(function(s,l){ var p=byId(S.products,l.pid); return s + (p?l.qty*p.cost:0); },0)); } },
        { k:'detail', label:'明细', render:function(r){ return '<span class="muted">' + r.lines.map(function(l){ return prodName(l.pid) + '×' + fmtQty(l.qty); }).join('、') + '</span>'; } },
        { k:'ops', label:'操作', w:'80px', render:function(r){ return rowOps([{ t:'查看', act:'view', id:r.id, cls:'' }]); } }
      ],
      rows: list,
      empty: UI.emptyState('ib','暂无入库单','通过「新建入库单」或采购单的「采购入库」产生')
    });
    html += '</div>';
    el.innerHTML = html;
    el.querySelector('[data-role="q"]').addEventListener('input', function(ev){
      location.hash = '#/ib?q=' + encodeURIComponent(ev.target.value) + (t ? '&t=' + t : '');
    });
    el.querySelector('[data-role="t"]').addEventListener('change', function(ev){
      location.hash = '#/ib?t=' + ev.target.value + (q ? '&q=' + encodeURIComponent(q) : '');
    });
    bindOps(el, { add: createIB, view: function(id){ ibDetail(id); } });
  }
};
function ibDetail(id){
  var d = byId(S.inboundDocs, id); if (!d) return;
  docDetailModal('入库单 · ' + d.no, [
    { k:'日期', v:d.date }, { k:'类型', v: d.type==='purchase'?'采购入库':'其他入库' },
    { k:'关联', v:d.refId?refNo('po',d.refId):'—' }, { k:'经手人', v:d.operator||'—' }
  ], d.lines, [{ k:'入库合计（按成本）', v: fmtMoney(d.lines.reduce(function(s,l){ var p=byId(S.products,l.pid); return s+(p?l.qty*p.cost:0); },0)) }]);
}
function createIB(){
  if (!canOp('ib')) { UI.toast('当前账号无此操作权限','err'); return; }
  var rows = [{ pid:'', qty:1, price:0 }];
  var body = '<div class="form two" style="margin-bottom:12px">' +
    '<div class="field"><label>入库类型</label><select id="ibType"><option value="other">其他入库（备货 / 赠品 / 退回）</option><option value="purchase">采购入库（关联采购单）</option></select></div>' +
    '<div class="field" id="ibPoWrap"><label>关联采购单</label><select id="ibPo"><option value="">—</option></select></div>' +
    '<div class="field"><label>入库日期</label><input id="ibDate" type="date" value="' + todayStr() + '"></div>' +
    '<div class="field"><label>经手人</label><input id="ibOp" type="text" value="' + currentUser().name + '"></div>' +
    '<div class="field full"><label>备注</label><input id="ibNote" type="text" placeholder="质检情况、来源说明"></div></div>' +
    '<div class="card-title" style="font-size:14px;margin-bottom:8px">明细行</div><div id="ibLines"></div>';
  var m = UI.modal({
    title:'新建入库单', wide:true, body: body,
    footer: '<span class="left"><button class="btn btn-ghost" data-act="addline" type="button">' + UI.icon('plus',13) + '添加一行</button></span>' +
      '<button class="btn btn-ghost" data-act="cancel" type="button">取消</button><button class="btn btn-verm" data-act="save" type="button">确认入库</button>'
  });
  var ed = lineEditor(m.el.querySelector('#ibLines'), rows);
  /* 采购入库联动：选择采购单后预填未入库余量 */
  var poSel = m.el.querySelector('#ibPo');
  function fillPOs(){
    var av = S.purchaseOrders.filter(function(po){ var st=poStatus(po); return !po.closed && (st==='audited'||st==='partial'); });
    poSel.innerHTML = '<option value="">选择采购单</option>' + av.map(function(po){
      return '<option value="' + po.id + '">' + po.no + '（' + partnerName('sup', po.supId) + '）</option>';
    }).join('');
  }
  fillPOs();
  poSel.addEventListener('change', function(){
    if (!poSel.value) return;
    var po = byId(S.purchaseOrders, poSel.value);
    if (!po) return;
    rows.length = 0;
    po.lines.forEach(function(l){
      var rem = l.qty - receivedQtyOf(po.id, l.pid);
      if (rem > 0) rows.push({ pid:l.pid, qty:rem, price:0 });
    });
    ed.redraw();
  });
  m.el.querySelector('#ibType').addEventListener('change', function(){
    m.el.querySelector('#ibPoWrap').style.display = this.value==='purchase' ? '' : 'none';
    if (this.value!=='purchase'){ rows.length = 0; poSel.value=''; ed.redraw(); }
  });
  m.el.querySelector('[data-act="addline"]').addEventListener('click', function(){ ed.add(); });
  m.el.querySelector('[data-act="cancel"]').addEventListener('click', function(){ m.close(); });
  m.el.querySelector('[data-act="save"]').addEventListener('click', function(){
    var type = m.el.querySelector('#ibType').value;
    var refId = type==='purchase' ? poSel.value : '';
    if (type==='purchase' && !refId) { UI.toast('请选择关联采购单', 'warn'); return; }
    var date = m.el.querySelector('#ibDate').value || todayStr();
    var op = m.el.querySelector('#ibOp').value.trim() || currentUser().name;
    var note = m.el.querySelector('#ibNote').value.trim();
    var lines = ed.rows.filter(function(r){ return r.pid && r.qty>0; }).map(function(r){ return { pid:r.pid, qty:Number(r.qty) }; });
    if (!lines.length) { UI.toast('请至少添加一行入库明细', 'warn'); return; }
    var res = createInbound({ type:type, refId:refId, date:date, operator:op, lines:lines, note:note });
    if (res) { UI.toast(res, 'err'); return; }
    pushNote('ib', '入库单已生成', (type==='purchase'?'采购入库':'其他入库') + ' · ' + lines.length + ' 行', '#/ib');
    pushOpLog('生成入库单', (type==='purchase'?'采购入库':'其他入库') + ' ' + lines.length + ' 行，经手人 ' + op);
    m.close(); UI.toast('入库单已生成，库存已增加', 'ok');
    renderRoute();
  });
}

/* ================= 出库单 ================= */
Views.ob = {
  render: function(el, ctx){
    if (!canView('ob')) { el.innerHTML = UI.deny(); return; }
    var t = ctx.params.t || '', q = ctx.params.q || '';
    var list = S.outboundDocs.filter(function(d){
      if (t && d.type !== t) return false;
      if (!q) return true;
      q = q.toLowerCase();
      return (d.no + (d.refId ? refNo('so', d.refId) : '')).toLowerCase().indexOf(q) > -1;
    }).slice().reverse();
    var html = '<div class="page-head"><div><div class="page-title">出库单<span class="sep">/</span><span class="num" style="font-family:var(--serif);font-size:15px;color:var(--ink-2)">' + S.outboundDocs.length + ' 张</span></div><div class="page-sub">销售出库 · 其他出库 · 库存减少凭证</div></div>' +
      '<div class="page-actions">' +
      (canOp('ob') ? '<button class="btn btn-verm" data-act="add" type="button">' + UI.icon('plus',15) + '新建出库单</button>' : '') + '</div></div>';
    html += '<div class="card"><div class="toolbar"><input type="search" placeholder="搜索 单号 / 关联销售单" value="' + q + '" data-role="q">' +
      '<select data-role="t"><option value="">全部类型</option><option value="sales"' + (t==='sales'?' selected':'') + '>销售出库</option><option value="other"' + (t==='other'?' selected':'') + '>其他出库</option></select>' +
      '<div class="spacer"></div></div>';
    html += UI.table({
      cols:[
        { k:'no', label:'单号', w:'160px', cls:'t-num muted', render:function(r){ return '<span style="font-family:var(--serif)">' + r.no + '</span>'; } },
        { k:'date', label:'日期', w:'100px', cls:'t-num muted' },
        { k:'type', label:'类型', w:'100px', render:function(r){ return UI.docTag(r.type); } },
        { k:'ref', label:'关联', w:'160px', render:function(r){ return r.refId ? refNo('so', r.refId) : '<span class="muted">—</span>'; } },
        { k:'op', label:'经手人', w:'100px' },
        { k:'sum', label:'出库合计', w:'130px', cls:'t-money', render:function(r){ return fmtMoney(r.lines.reduce(function(s,l){ var p=byId(S.products,l.pid); return s + (p?l.qty*p.price:0); },0)); } },
        { k:'detail', label:'明细', render:function(r){ return '<span class="muted">' + r.lines.map(function(l){ return prodName(l.pid) + '×' + fmtQty(l.qty); }).join('、') + '</span>'; } },
        { k:'ops', label:'操作', w:'80px', render:function(r){ return rowOps([{ t:'查看', act:'view', id:r.id, cls:'' }]); } }
      ],
      rows: list,
      empty: UI.emptyState('ob','暂无出库单','通过「新建出库单」或销售订单的「销售出库」产生')
    });
    html += '</div>';
    el.innerHTML = html;
    el.querySelector('[data-role="q"]').addEventListener('input', function(ev){
      location.hash = '#/ob?q=' + encodeURIComponent(ev.target.value) + (t ? '&t=' + t : '');
    });
    el.querySelector('[data-role="t"]').addEventListener('change', function(ev){
      location.hash = '#/ob?t=' + ev.target.value + (q ? '&q=' + encodeURIComponent(q) : '');
    });
    bindOps(el, { add: createOB, view: function(id){ obDetail(id); } });
  }
};
function obDetail(id){
  var d = byId(S.outboundDocs, id); if (!d) return;
  docDetailModal('出库单 · ' + d.no, [
    { k:'日期', v:d.date }, { k:'类型', v: d.type==='sales'?'销售出库':'其他出库' },
    { k:'关联', v:d.refId?refNo('so',d.refId):'—' }, { k:'经手人', v:d.operator||'—' }
  ], d.lines, [{ k:'出库合计（按售价）', v: fmtMoney(d.lines.reduce(function(s,l){ var p=byId(S.products,l.pid); return s+(p?l.qty*p.price:0); },0)) }]);
}
function createOB(){
  if (!canOp('ob')) { UI.toast('当前账号无此操作权限','err'); return; }
  var rows = [{ pid:'', qty:1, price:0 }];
  var body = '<div class="form two" style="margin-bottom:12px">' +
    '<div class="field"><label>出库类型</label><select id="obType"><option value="other">其他出库（领用 / 报损 / 赠送）</option><option value="sales">销售出库（关联销售订单）</option></select></div>' +
    '<div class="field" id="obSoWrap"><label>关联销售订单</label><select id="obSo"><option value="">—</option></select></div>' +
    '<div class="field"><label>出库日期</label><input id="obDate" type="date" value="' + todayStr() + '"></div>' +
    '<div class="field"><label>经手人</label><input id="obOp" type="text" value="' + currentUser().name + '"></div>' +
    '<div class="field full"><label>备注</label><input id="obNote" type="text" placeholder="领用部门、用途等"></div></div>' +
    '<div class="card-title" style="font-size:14px;margin-bottom:8px">明细行</div><div id="obLines"></div>';
  var m = UI.modal({
    title:'新建出库单', wide:true, body: body,
    footer: '<span class="left"><button class="btn btn-ghost" data-act="addline" type="button">' + UI.icon('plus',13) + '添加一行</button></span>' +
      '<button class="btn btn-ghost" data-act="cancel" type="button">取消</button><button class="btn btn-verm" data-act="save" type="button">确认出库</button>'
  });
  var ed = lineEditor(m.el.querySelector('#obLines'), rows);
  var soSel = m.el.querySelector('#obSo');
  function fillSOs(){
    var av = S.salesOrders.filter(function(so){ var st=soStatus(so); return !so.closed && (st==='audited'||st==='partial'); });
    soSel.innerHTML = '<option value="">选择销售订单</option>' + av.map(function(so){
      return '<option value="' + so.id + '">' + so.no + '（' + partnerName('crm', so.custId) + '）</option>';
    }).join('');
  }
  fillSOs();
  soSel.addEventListener('change', function(){
    if (!soSel.value) return;
    var so = byId(S.salesOrders, soSel.value);
    if (!so) return;
    rows.length = 0;
    so.lines.forEach(function(l){
      var rem = l.qty - shippedQtyOf(so.id, l.pid);
      if (rem > 0) rows.push({ pid:l.pid, qty:rem, price:0 });
    });
    ed.redraw();
  });
  m.el.querySelector('#obType').addEventListener('change', function(){
    m.el.querySelector('#obSoWrap').style.display = this.value==='sales' ? '' : 'none';
    if (this.value!=='sales'){ rows.length = 0; soSel.value=''; ed.redraw(); }
  });
  m.el.querySelector('[data-act="addline"]').addEventListener('click', function(){ ed.add(); });
  m.el.querySelector('[data-act="cancel"]').addEventListener('click', function(){ m.close(); });
  m.el.querySelector('[data-act="save"]').addEventListener('click', function(){
    var type = m.el.querySelector('#obType').value;
    var refId = type==='sales' ? soSel.value : '';
    if (type==='sales' && !refId) { UI.toast('请选择关联销售订单', 'warn'); return; }
    var date = m.el.querySelector('#obDate').value || todayStr();
    var op = m.el.querySelector('#obOp').value.trim() || currentUser().name;
    var note = m.el.querySelector('#obNote').value.trim();
    var lines = ed.rows.filter(function(r){ return r.pid && r.qty>0; }).map(function(r){ return { pid:r.pid, qty:Number(r.qty) }; });
    if (!lines.length) { UI.toast('请至少添加一行出库明细', 'warn'); return; }
    var res = createOutbound({ type:type, refId:refId, date:date, operator:op, lines:lines, note:note });
    if (res) { UI.toast(res, 'err'); return; }
    pushNote('ob', '出库单已生成', (type==='sales'?'销售出库':'其他出库') + ' · ' + lines.length + ' 行', '#/ob');
    pushOpLog('生成出库单', (type==='sales'?'销售出库':'其他出库') + ' ' + lines.length + ' 行，经手人 ' + op);
    m.close(); UI.toast('出库单已生成，库存已扣减', 'ok');
    renderRoute();
  });
}
