/* ============================================================
   账房 ERP · UI 组件库
   ============================================================ */
'use strict';

var UI = {};

/* ---------- 图标（手写内联 SVG，24 视口描边体系） ---------- */
UI.icons = {
  dash:'<path d="M4 13h6V4H4zM14 13h6V4h-6zM4 20h6v-5H4zM14 20h6v-9h-6z"/>',
  crm:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  prd:'<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v9"/>',
  sale:'<path d="M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/><path d="M1 3h3l2.6 13.4a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L21 7H5.3"/>',
  sup:'<path d="M1 5h4l2.5 4H21l-3 8H8L4 5z"/><circle cx="8" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M8 18h9"/>',
  pur:'<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18M8 10a4 4 0 0 0 8 0"/>',
  ib:'<path d="M12 3v10M7 8l5 5 5-5"/><path d="M3 17v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3"/>',
  ob:'<path d="M12 17V7M7 12l5-5 5 5"/><path d="M3 7V4a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3"/>',
  inv:'<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v9"/><path d="M9 21V13M15 21V13"/>',
  fin:'<circle cx="12" cy="12" r="9"/><path d="M12 7v10M15 9.5c0-1.2-1.3-2-3-2s-3 .8-3 2 1.2 1.8 3 2.2 3 .9 3 2.1-1.3 2-3 2-3-.8-3-2"/>',
  acct:'<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  set:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  user:'<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  edit:'<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
  trash:'<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>',
  eye:'<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>',
  check:'<path d="M20 6L9 17l-5-5"/>',
  x:'<path d="M18 6L6 18M6 6l12 12"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  print:'<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/>',
  back:'<path d="M19 12H5M12 19l-7-7 7-7"/>',
  alert:'<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  refresh:'<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15"/>',
  lock:'<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  tag:'<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1"/>',
  file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8"/>',
  wallet:'<path d="M20 12V8H6a2 2 0 0 1 0-4h14v4"/><path d="M20 12v4H6a2 2 0 0 1 0-4zM20 12H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h18v-8"/><circle cx="17" cy="16" r="1"/>',
  truck:'<path d="M1 5h14v12H1zM15 9h4l4 4v4h-8"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/>',
  box:'<path d="M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v9"/>',
  grid:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  key:'<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3L21 2M15 7l3 3M18 4l3 3"/>',
  calendar:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  save:'<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  chart:'<path d="M18 20V10M12 20V4M6 20v-6"/>',
  users:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  coin:'<circle cx="12" cy="12" r="9"/><path d="M12 7v10M15 9.5c0-1.2-1.3-2-3-2s-3 .8-3 2 1.2 1.8 3 2.2 3 .9 3 2.1-1.3 2-3 2-3-.8-3-2"/>',
  bank:'<rect x="3" y="9" width="18" height="4"/><path d="M4 13v6h16v-6M12 3L2 9h20z"/><path d="M8 15v2M12 15v2M16 15v2"/>',
  chevronL:'<path d="M15 18l-6-6 6-6"/>',
  chevronR:'<path d="M9 18l6-6-6-6"/>',
  chevronD:'<path d="M6 9l6 6 6-6"/>',
  login:'<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5M15 12H3"/>',
  pin:'<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  log:'<path d="M4 5h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h5"/>'
};
UI.icon = function(name, size){
  var d = UI.icons[name] || UI.icons.box;
  var s = size || 18;
  return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
};

/* ---------- 印章 ---------- */
UI.stamp = function(key){
  var m = STATUS_META[key] || { label:key, cls:'st-gray' };
  return '<span class="stamp ' + m.cls + '">' + UI.icon('check',11) + m.label + '</span>';
};
UI.docTag = function(type){
  var map = { purchase:'采购入库', other:'其他入库', sales:'销售出库' };
  var label = map[type] || type;
  var cls = type==='purchase' ? 'tag teal' : type==='sales' ? 'tag verm' : 'tag';
  return '<span class="' + cls + '">' + label + '</span>';
};
UI.ledgerTag = function(dt){
  var cls = 'tag';
  if (dt==='采购入库'||dt==='期初') cls='tag teal';
  if (dt==='销售出库') cls='tag verm';
  if (dt==='盘点调整') cls='tag amber';
  if (dt==='其他入库') cls='tag blue';
  if (dt==='其他出库') cls='tag';
  return '<span class="' + cls + '">' + dt + '</span>';
};

/* ---------- Toast ---------- */
UI.toast = function(msg, type){
  var root = document.getElementById('toastRoot');
  if (!root) return;
  var icon = type==='ok' ? 'check' : type==='err' ? 'x' : type==='warn' ? 'alert' : 'alert';
  var el = document.createElement('div');
  el.className = 'toast ' + (type||'');
  el.innerHTML = UI.icon(icon,16) + '<span>' + msg + '</span>';
  root.appendChild(el);
  setTimeout(function(){ el.style.opacity='0'; el.style.transition='opacity .3s'; }, 2600);
  setTimeout(function(){ el.remove(); }, 3000);
};

/* ---------- 弹层 ---------- */
UI.modal = function(opts){
  var root = document.getElementById('modalRoot');
  var veil = document.createElement('div');
  veil.className = 'modal-veil';
  var box = document.createElement('div');
  box.className = 'modal' + (opts.wide ? ' wide' : '');
  box.setAttribute('role','dialog');
  box.innerHTML = '<div class="modal-head"><div class="modal-title">' + (opts.title||'') + '</div>' +
    '<button class="modal-close" type="button" aria-label="关闭"></button></div>' +
    '<div class="modal-body">' + (opts.body||'') + '</div>' +
    '<div class="modal-foot">' + (opts.footer||'') + '</div>';
  box.querySelector('.modal-close').innerHTML = UI.icon('x',16);
  box.querySelector('.modal-close').addEventListener('click', close);
  veil.addEventListener('click', close);
  root.appendChild(veil); root.appendChild(box);
  document.body.style.overflow = 'hidden';
  function close(){
    if (opts.onClose) { try { opts.onClose(); } catch(e){} }
    if (box && box.parentNode) box.parentNode.removeChild(box);
    if (veil && veil.parentNode) veil.parentNode.removeChild(veil);
    document.body.style.overflow = '';
  }
  setTimeout(function(){
    var f = box.querySelector('input,select,textarea');
    if (f) f.focus();
  }, 50);
  return { close: close, el: box };
};

/* ---------- 确认框 ---------- */
UI.confirm = function(title, msg, danger){
  return new Promise(function(resolve){
    var m = UI.modal({
      title: title,
      body: '<div style="display:flex;gap:12px;align-items:flex-start"><span style="color:' + (danger?'#b3261e':'#a97c11') + '">' + UI.icon(danger?'trash':'alert',22) + '</span><div style="font-size:13.5px;color:var(--ink-2)">' + msg + '</div></div>',
      footer: '<button class="btn btn-ghost" data-act="no" type="button">再想想</button>' +
              '<button class="btn ' + (danger?'btn-danger':'btn-verm') + '" data-act="yes" type="button">' + (danger?'确认执行':'确认') + '</button>'
    });
    m.el.querySelector('[data-act="no"]').addEventListener('click', function(){ m.close(); resolve(false); });
    m.el.querySelector('[data-act="yes"]').addEventListener('click', function(){ m.close(); resolve(true); });
  });
};

/* ---------- 表单 ---------- */
UI.field = function(f, val){
  var req = f.req ? '<span class="req">*</span>' : '';
  var v = val != null ? val : (f.value != null ? f.value : '');
  var help = f.help ? '<span class="help">' + f.help + '</span>' : '';
  var inp = '';
  var full = f.full ? ' full' : '';
  if (f.type === 'select'){
    var opts = (f.options||[]).map(function(o){
      var ov = typeof o === 'object' ? o.value : o;
      var ol = typeof o === 'object' ? o.label : o;
      return '<option value="' + ov + '"' + (String(ov)===String(v) ? ' selected' : '') + '>' + ol + '</option>';
    }).join('');
    inp = '<select data-f="' + f.name + '"><option value="">' + (f.placeholder||'请选择') + '</option>' + opts + '</select>';
  } else if (f.type === 'textarea'){
    inp = '<textarea data-f="' + f.name + '" placeholder="' + (f.placeholder||'') + '">' + (v||'') + '</textarea>';
  } else {
    inp = '<input data-f="' + f.name + '" type="' + (f.type||'text') + '" value="' + (v==null?'':String(v).replace(/"/g,'&quot;')) + '" placeholder="' + (f.placeholder||'') + '"' + (f.min!=null?' min="'+f.min+'"':'') + (f.max!=null?' max="'+f.max+'"':'') + (f.step!=null?' step="'+f.step+'"':'') + '>';
  }
  return '<div class="field' + full + '"><label>' + req + f.label + '</label>' + inp + help + '<span class="err"></span></div>';
};
UI.form = function(fields, values){
  return '<div class="form ' + (fields.some(function(f){return f.full;}) ? 'two' : '') + '">' +
    fields.map(function(f){ return UI.field(f, values && values[f.name]); }).join('') + '</div>';
};
UI.readForm = function(el){
  var ok = true, values = {};
  el.querySelectorAll('[data-f]').forEach(function(inp){
    var name = inp.getAttribute('data-f');
    var val = inp.value.trim();
    var fieldEl = inp.closest('.field');
    var f = null;
    UI._lastSchema.forEach(function(s){ if (s.name===name) f = s; });
    if (f){
      if (f.req && !val){ fieldEl.classList.add('invalid'); fieldEl.querySelector('.err').textContent = '此项必填'; ok = false; }
      else if (f.type==='number' && val && isNaN(Number(val))){ fieldEl.classList.add('invalid'); fieldEl.querySelector('.err').textContent = '请输入数字'; ok = false; }
      else { fieldEl.classList.remove('invalid'); }
    }
    values[name] = val;
  });
  return { ok:ok, values:values };
};
UI.setFormSchema = function(schema){ UI._lastSchema = schema; };

/* ---------- 表格（返回 HTML 字符串） ---------- */
UI.table = function(opts){
  var cols = opts.cols, rows = opts.rows || [];
  var hasCols = cols.some(function(c){ return c.w; });
  var head = '<thead><tr>' + cols.map(function(c){ return '<th' + (c.w ? ' style="width:' + c.w + '"' : '') + '>' + c.label + '</th>'; }).join('') + '</tr></thead>';
  var body;
  if (!rows.length){
    body = '<tbody><tr><td colspan="' + cols.length + '"><div class="tbl-empty">' + (opts.empty || '暂无数据') + '</div></td></tr></tbody>';
  } else {
    body = '<tbody>' + rows.map(function(r, i){
      var tds = cols.map(function(c){
        var cell = c.render ? c.render(r, i) : (r[c.k] != null ? r[c.k] : '—');
        return '<td' + (c.cls ? ' class="' + c.cls + '"' : '') + '>' + cell + '</td>';
      }).join('');
      var trAttr = ' data-i="' + i + '"';
      if (opts.clickable || opts.rowGo) trAttr += ' class="row-click"';
      if (opts.rowGo && r.id != null) trAttr += ' data-id="' + r.id + '"';
      return '<tr' + trAttr + '>' + tds + '</tr>';
    }).join('') + '</tbody>';
  }
  var colgroup = hasCols ? '<colgroup>' + cols.map(function(c){ return '<col' + (c.w ? ' style="width:' + c.w + '"' : '') + '>'; }).join('') + '</colgroup>' : '';
  return '<div class="tbl-wrap"><table class="tbl"' + (opts.rowGo ? ' data-rowgo="' + opts.rowGo + '"' : '') + '>' + colgroup + head + body + '</table></div>';
};

/* ---------- 页签 ---------- */
UI.tabs = function(items, active, go){
  var goAttr = (typeof go === 'string' && go.indexOf('{k}') > -1) ? ' data-go="' + go.replace(/"/g, '&quot;') + '"' : '';
  return '<div class="tabs"' + goAttr + '>' + items.map(function(t){
    var cnt = t.count != null ? '<span class="cnt">' + t.count + '</span>' : '';
    return '<button class="tab' + (t.key===active ? ' active' : '') + '" data-k="' + t.key + '" type="button">' + t.label + cnt + '</button>';
  }).join('') + '</div>';
};

/* ---------- 下拉 ---------- */
UI.dropdown = function(anchor, items, opts){
  var root = document.getElementById('dropdownRoot');
  root.innerHTML = '';
  var panel = document.createElement('div');
  panel.className = 'dropdown';
  panel.style.position = 'absolute';
  if (items.length){
    panel.innerHTML = items.map(function(it, i){
      if (it.head) return '<div class="dd-head">' + it.title + '</div>';
      return '<div class="dd-item" data-i="' + i + '">' +
        (it.icon ? '<span class="ic">' + UI.icon(it.icon,14) + '</span>' : '') +
        '<span class="dd-main"><span class="dd-t">' + it.title + '</span>' + (it.sub ? '<span class="dd-s">' + it.sub + '</span>' : '') + '</span>' +
        (it.right || '') + '</div>';
    }).join('');
    panel.querySelectorAll('.dd-item').forEach(function(di){
      di.addEventListener('click', function(){
        close();
        var fn = items[Number(di.getAttribute('data-i'))];
        if (fn && fn.onClick) fn.onClick();
      });
    });
  } else {
    panel.innerHTML = '<div class="dd-empty">' + (opts && opts.empty || '暂无内容') + '</div>';
  }
  root.appendChild(panel);
  var r = anchor.getBoundingClientRect();
  var pRect = panel.getBoundingClientRect();
  var left = r.left;
  var top = r.bottom + 6;
  if (left + pRect.width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - pRect.width - 8);
  if (top + pRect.height > window.innerHeight - 8) top = Math.max(8, r.top - pRect.height - 6);
  panel.style.left = left + 'px';
  panel.style.top = top + 'px';
  function close(){ if (root.firstChild === panel) root.innerHTML = ''; document.removeEventListener('click', onDoc, true); }
  function onDoc(ev){ if (root.firstChild !== panel) return; if (!panel.contains(ev.target) && !anchor.contains(ev.target)) close(); }
  setTimeout(function(){ document.addEventListener('click', onDoc, true); }, 10);
  return { close: close, el: panel };
};

/* ---------- ECharts 挂载 ---------- */
UI._charts = [];
UI.chart = function(id, option){
  var dom = document.getElementById(id);
  if (!dom || typeof echarts === 'undefined') return null;
  var c = echarts.init(dom);
  c.setOption(option);
  UI._charts.push(c);
  new ResizeObserver(function(){ c.resize(); }).observe(dom);
  return c;
};
UI.disposeCharts = function(){
  UI._charts.forEach(function(c){ try { c.dispose(); } catch(e){} });
  UI._charts = [];
};
UI.chartTheme = {
  verm:'#c23a26', teal:'#147d74', amber:'#a97c11', blue:'#3a5a9c', ink:'#212b3c', gray:'#8a92a1',
  inkText:'#212b3c', subText:'#5c6676', splitLine:'#e0dccf', axisLine:'#cfc9b8'
};
UI.baseChartOpts = function(){
  var t = UI.chartTheme;
  return {
    color:[t.verm, t.teal, t.amber, t.blue, t.ink, t.gray],
    textStyle:{ fontFamily:'Noto Sans SC, Microsoft YaHei, sans-serif', color:t.inkText },
    tooltip:{ confine:true, backgroundColor:'#212b3c', borderWidth:0, textStyle:{color:'#faf8f1', fontSize:12} },
    grid:{ left:'4%', right:'4%', bottom:'6%', top:34, containLabel:true },
    legend:{ type:'scroll', bottom:0, icon:'rect', itemWidth:10, itemHeight:10, textStyle:{color:t.subText, fontSize:12} }
  };
};

/* ---------- 工具条筛选状态 ---------- */
UI.filterChip = function(label, key, active, count){
  return '<button class="tab' + (active ? ' active' : '') + '" data-k="' + key + '" type="button">' + label + (count!=null ? '<span class="cnt">' + count + '</span>' : '') + '</button>';
};

/* ---------- 空态 ---------- */
UI.emptyState = function(icon, title, sub){
  return '<div style="text-align:center;padding:44px 16px;color:var(--ink-3)">' +
    '<div style="width:52px;height:52px;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;border:1px dashed var(--line-2);border-radius:50%;color:var(--ink-3)">' + UI.icon(icon,26) + '</div>' +
    '<div style="font-family:var(--serif);font-size:15px;color:var(--ink-2)">' + title + '</div>' +
    (sub ? '<div style="font-size:12.5px;margin-top:4px">' + sub + '</div>' : '') + '</div>';
};

/* ---------- 权限提示 ---------- */
UI.deny = function(){
  return '<div class="card"><div class="deny">' + UI.icon('lock',44) +
    '<h2>此模块不在当前账号权限内</h2><p>请切换有权限的账号，或由管理员在「账号管控」中调整角色权限。</p></div></div>';
};
