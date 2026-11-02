/* ============================================================
   账房 ERP · 数据层与业务逻辑
   ============================================================ */
'use strict';

var LS_KEY = 'zf_erp_v1';
var SS_KEY = 'zf_erp_session';
var RESET_MARK_KEY = 'zf_erp_reset_v113';
var S = null;                 // 全局状态
var MODULES = [
  { key:'dash', label:'仪表盘',     icon:'dash', num:'01' },
  { key:'crm',  label:'客户管理',   icon:'crm',  num:'02' },
  { key:'prd',  label:'产品管理',   icon:'prd',  num:'03' },
  { key:'sale', label:'销售订单',   icon:'sale', num:'04' },
  { key:'sup',  label:'供应商',     icon:'sup',  num:'05' },
  { key:'pur',  label:'采购单',     icon:'pur',  num:'06' },
  { key:'ib',   label:'入库单',     icon:'ib',   num:'07' },
  { key:'ob',   label:'出库单',     icon:'ob',   num:'08' },
  { key:'inv',  label:'库存管理',   icon:'inv',  num:'09' },
  { key:'fin',  label:'财务对账',   icon:'fin',  num:'10' },
  { key:'acct', label:'账号管控',   icon:'acct', num:'11' },
  { key:'logs', label:'操作日志',   icon:'log',  num:'12' },
  { key:'set',  label:'系统设置',   icon:'set',  num:'13' }
];
var ROLE_DEFS = [
  { key:'admin',     name:'管理员',     desc:'内置管理员，全部权限，不可修改' },
  { key:'sales',     name:'销售专员',   desc:'维护客户与销售订单，查看出入库与财务' },
  { key:'purchase',  name:'采购专员',   desc:'维护供应商与采购、入库单据' },
  { key:'warehouse', name:'仓库管理员', desc:'办理出入库、库存盘点与调整' },
  { key:'finance',   name:'财务专员',   desc:'登记收付款、处理对账报表' },
  { key:'viewer',    name:'访客',       desc:'只读查看业务数据，不可操作' }
];
var PAY_METHODS = ['银行转账','现金','支付宝','微信','承兑汇票'];
var CAT_COLORS = ['verm','teal','amber','blue','ink'];

/* ---------- 格式化 ---------- */
function pad2(n){ return String(n).padStart(2,'0'); }
function fmtDate(d){
  var x = (d instanceof Date) ? d : new Date(String(d).replace(/-/g,'/'));
  if (isNaN(x.getTime())) return d;
  return x.getFullYear() + '-' + pad2(x.getMonth()+1) + '-' + pad2(x.getDate());
}
function fmtDateTime(d){
  var x = (d instanceof Date) ? d : new Date(String(d).replace(/-/g,'/'));
  if (isNaN(x.getTime())) return String(d);
  return fmtDate(x) + ' ' + pad2(x.getHours()) + ':' + pad2(x.getMinutes());
}
function todayStr(){ return fmtDate(new Date()); }
function addDays(offset){ var d = new Date(); d.setDate(d.getDate()+offset); return d; }
function dayStr(offset){ return fmtDate(addDays(offset)); }
function monthStr(){ var n = new Date(); return n.getFullYear() + '-' + pad2(n.getMonth()+1); }
function fmtMoney(n){
  n = Number(n) || 0;
  return '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits:2, maximumFractionDigits:2 });
}
function fmtQty(n){
  var v = Number(n) || 0;
  return String(Number(v.toFixed(3)));
}
function calcAmt(qty, price){ return Math.round(Number(qty)*Number(price)*100)/100; }

/* ---------- 持久化 ---------- */
function saveState(){
  try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch(e){ console.warn('保存失败', e); }
}
function getSession(){
  try {
    var raw = localStorage.getItem(SS_KEY);
    if (raw) { var s = JSON.parse(raw); if (S.users.some(function(u){ return u.id===s.uid; })) return s; }
  } catch(e){}
  return { uid:'u-admin' };
}
function setSession(uid){
  localStorage.setItem(SS_KEY, JSON.stringify({ uid: uid }));
}
function currentUser(){
  var s = getSession();
  for (var i=0;i<S.users.length;i++) if (S.users[i].id===s.uid) return S.users[i];
  return S.users[0];
}
function curRoleKey(){ return currentUser().role; }
function canView(key){
  var r = S.roles[curRoleKey()];
  if (!r) return true;
  var p = r.perms && r.perms[key];
  if (!p) return true;   /* 老数据兼容：旧版本账号数据未配置新模块权限时，默认可见 */
  return !!p.v;
}
function canOp(key){
  var r = S.roles[curRoleKey()];
  if (!r) return false;
  var p = r.perms && r.perms[key];
  if (!p) return false;  /* 未配置权限默认不可操作，避免越权 */
  return !!p.o;
}
function visibleModules(){
  return MODULES.filter(function(m){ return canView(m.key); });
}
/* 权限迁移：老数据中的角色缺少新版本新增模块权限时自动补全；操作日志仅管理员可见（每次加载强制校正，覆盖旧数据已补的宽泛权限） */
function migrateState(){
  if (!S || !S.roles) return;
  MODULES.forEach(function(m){
    Object.keys(S.roles).forEach(function(rk){
      var r = S.roles[rk];
      if (!r) return;
      if (!r.perms) r.perms = {};
      var isAdmin = (rk === 'admin');
      if (m.key === 'logs'){
        r.perms.logs = isAdmin ? { v:1, o:1 } : { v:0, o:0 };
        return;
      }
      if (!r.perms[m.key]) r.perms[m.key] = isAdmin ? { v:1, o:1 } : { v:1, o:0 };
    });
  });
}

/* ---------- 初始化数据 ---------- */
function buildSeed(){
  var now = new Date();
  var baseDate = dayStr(-60);
  function mkPerms(map){ var p={}; MODULES.forEach(function(m){ p[m.key]={ v:!!(map&&map[m.key]&&map[m.key].v), o:!!(map&&map[m.key]&&map[m.key].o) }; }); return p; }

  var categories = [
    { id:'c1', name:'电子元件' }, { id:'c2', name:'五金配件' }, { id:'c3', name:'包装材料' },
    { id:'c4', name:'办公用品' }, { id:'c5', name:'线缆辅材' }
  ];
  var products = [
    { id:'SP01', name:'贴片电阻 0805', sku:'RC-0805-1K',   cat:'c1', unit:'盒(5000粒)', spec:'1kΩ ±1%',     price:0.028, cost:0.018, safety:120, stock:150, status:1 },
    { id:'SP02', name:'电解电容 470μF',sku:'CAP-EL-470',   cat:'c1', unit:'盒(500粒)',  spec:'470μF/25V',  price:0.32,  cost:0.21,  safety:60,  stock:90,  status:1 },
    { id:'SP03', name:'STM32主控芯片', sku:'IC-STM32F103', cat:'c1', unit:'片',         spec:'F103C8T6',    price:18.5,  cost:13.2,  safety:60,  stock:120, status:1 },
    { id:'SP04', name:'2.54mm 排针 40P',sku:'PIN-2.54-40', cat:'c2', unit:'条',         spec:'直插 40pin',  price:0.85,  cost:0.60,  safety:200, stock:300, status:1 },
    { id:'SP05', name:'304 不锈钢螺丝 M3',sku:'SCR-M3-304',cat:'c2', unit:'盒(1000枚)', spec:'M3×8 十字',   price:45,    cost:32,    safety:20,  stock:45,  status:1 },
    { id:'SP06', name:'铝合金散热器',   sku:'HS-AL-40',     cat:'c2', unit:'个',         spec:'40×40×20mm', price:6.8,   cost:4.9,   safety:50,  stock:95,  status:1 },
    { id:'SP07', name:'气泡袋 25×35',   sku:'PK-BUB-25',    cat:'c3', unit:'卷',         spec:'加厚 40g',    price:0.55,  cost:0.38,  safety:150, stock:300, status:1 },
    { id:'SP08', name:'瓦楞纸箱 五层',  sku:'PK-BOX-5L',    cat:'c3', unit:'个',         spec:'40×30×25cm', price:2.6,   cost:1.85,  safety:100, stock:90,  status:1 },
    { id:'SP09', name:'EPE 珍珠棉',     sku:'PK-EPE-2M',    cat:'c3', unit:'卷',         spec:'厚 2mm',      price:58,    cost:41,    safety:12,  stock:22,  status:1 },
    { id:'SP10', name:'A4 复印纸 80g',  sku:'OF-A4-80',     cat:'c4', unit:'箱(5包)',    spec:'80g 500张',  price:118,   cost:95,    safety:12,  stock:18,  status:1 },
    { id:'SP11', name:'中性笔 0.5mm',   sku:'OF-PEN-05',    cat:'c4', unit:'盒(12支)',   spec:'黑色 0.5mm', price:18,    cost:12,    safety:20,  stock:46,  status:1 },
    { id:'SP12', name:'电源线 3C 1.5m', sku:'CB-PWR-3C',    cat:'c5', unit:'条',         spec:'CCC 1.5m',   price:4.2,   cost:3.1,   safety:80,  stock:140, status:1 },
    { id:'SP13', name:'Type-C 数据线 1m',sku:'CB-TYC-1M',   cat:'c5', unit:'条',         spec:'60W 快充',   price:5.6,   cost:3.9,   safety:250, stock:210, status:1 },
    { id:'SP14', name:'网线 超五类',    sku:'CB-CAT5E-305', cat:'c5', unit:'箱(305m)',   spec:'非屏蔽',    price:268,   cost:196,   safety:20,  stock:14,  status:1 }
  ];
  var customers = [
    { id:'KH01', name:'玉林百汇电子商行', contact:'林经理', phone:'0775-2668xxx', address:'广西玉林市玉州区民主中路 88 号', taxNo:'91450900MA5K2xxxxx', note:'老客户，月结 30 天' },
    { id:'KH02', name:'广西南流贸易有限公司', contact:'陈总', phone:'0775-2886xxx', address:'广西玉林市陆川县珊罗镇工业园 3 栋', taxNo:'91450922MA5P1xxxxx', note:'' },
    { id:'KH03', name:'东莞联芯科技有限公司', contact:'王工', phone:'0769-2288xxxx', address:'东莞市松山湖高新区科技二路 9 号', taxNo:'91441900MA4Wxxxxxx', note:'电子元件批量采购' },
    { id:'KH04', name:'南宁恒信数码城', contact:'李店长', phone:'0771-5666xxx', address:'南宁市兴宁区人民东路 12 号数码城 3F', taxNo:'91450100MA5Hxxxxxx', note:'' },
    { id:'KH05', name:'深圳凌云电子工作室', contact:'赵采购', phone:'0755-8300xxxx', address:'深圳市福田区华强北路赛格广场 6F', taxNo:'91440300MA5Exxxxxx', note:'货到付款' }
  ];
  var suppliers = [
    { id:'GY01', name:'深圳华强元器件批发', contact:'刘经理', phone:'0755-8366xxxx', address:'深圳市福田区华强北路 1001 号', taxNo:'91440300MA5Wxxxxxx', note:'主营芯片/电容，账期 30 天' },
    { id:'GY02', name:'广东德昌五金制品', contact:'黄总', phone:'0769-8333xxxx', address:'东莞市长安镇乌沙工业区', taxNo:'91441900MA4Yxxxxxx', note:'' },
    { id:'GY03', name:'南宁纸品包装厂', contact:'韦厂长', phone:'0771-3111xxx', address:'南宁市西乡塘区金陵镇', taxNo:'91450107MA5Kxxxxxx', note:'纸箱与包装耗材' },
    { id:'GY04', name:'广州力德线缆', contact:'罗经理', phone:'020-8600xxxx', address:'广州市白云区石井街庆丰路 6 号', taxNo:'91440101MA59xxxxxx', note:'线材批发，可开专票' }
  ];
  var users = [
    { id:'u-admin',  username:'admin',  name:'账房掌柜',  role:'admin',     password:'123456', status:1, lastLogin:'' },
    { id:'u-lin',    username:'linxiao',name:'林晓',      role:'sales',     password:'123456', status:1, lastLogin:'' },
    { id:'u-chen',   username:'chenbin',name:'陈斌',      role:'purchase',  password:'123456', status:1, lastLogin:'' },
    { id:'u-zhou',   username:'zhouqiang',name:'周强',   role:'warehouse', password:'123456', status:1, lastLogin:'' },
    { id:'u-su',     username:'suqing', name:'苏晴',      role:'finance',   password:'123456', status:1, lastLogin:'' },
    { id:'u-view',   username:'visitor',name:'访客小王',  role:'viewer',    password:'123456', status:1, lastLogin:'' }
  ];

  var permsSeed = {
    admin:    { dash:{v:1,o:1}, crm:{v:1,o:1}, prd:{v:1,o:1}, sale:{v:1,o:1}, sup:{v:1,o:1}, pur:{v:1,o:1}, ib:{v:1,o:1}, ob:{v:1,o:1}, inv:{v:1,o:1}, fin:{v:1,o:1}, acct:{v:1,o:1}, logs:{v:1,o:1}, set:{v:1,o:1} },
    sales:    { dash:{v:1,o:1}, crm:{v:1,o:1}, prd:{v:1,o:1}, sale:{v:1,o:1}, sup:{v:0,o:0}, pur:{v:0,o:0}, ib:{v:1,o:0}, ob:{v:1,o:1}, inv:{v:1,o:0}, fin:{v:1,o:0}, acct:{v:0,o:0}, logs:{v:0,o:0}, set:{v:0,o:0} },
    purchase: { dash:{v:1,o:1}, crm:{v:0,o:0}, prd:{v:1,o:1}, sale:{v:1,o:0}, sup:{v:1,o:1}, pur:{v:1,o:1}, ib:{v:1,o:1}, ob:{v:1,o:0}, inv:{v:1,o:0}, fin:{v:1,o:0}, acct:{v:0,o:0}, logs:{v:0,o:0}, set:{v:0,o:0} },
    warehouse:{ dash:{v:1,o:1}, crm:{v:1,o:0}, prd:{v:1,o:0}, sale:{v:1,o:0}, sup:{v:1,o:0}, pur:{v:1,o:0}, ib:{v:1,o:1}, ob:{v:1,o:1}, inv:{v:1,o:1}, fin:{v:1,o:0}, acct:{v:0,o:0}, logs:{v:0,o:0}, set:{v:0,o:0} },
    finance:  { dash:{v:1,o:1}, crm:{v:1,o:0}, prd:{v:1,o:0}, sale:{v:1,o:0}, sup:{v:1,o:0}, pur:{v:1,o:0}, ib:{v:1,o:0}, ob:{v:1,o:0}, inv:{v:1,o:0}, fin:{v:1,o:1}, acct:{v:0,o:0}, logs:{v:0,o:0}, set:{v:0,o:0} },
    viewer:   { dash:{v:1,o:0}, crm:{v:0,o:0}, prd:{v:1,o:0}, sale:{v:1,o:0}, sup:{v:0,o:0}, pur:{v:1,o:0}, ib:{v:1,o:0}, ob:{v:1,o:0}, inv:{v:1,o:0}, fin:{v:1,o:0}, acct:{v:0,o:0}, logs:{v:0,o:0}, set:{v:0,o:0} }
  };
  var roles = {};
  ROLE_DEFS.forEach(function(rd){ roles[rd.key] = { name: rd.name, desc: rd.desc, perms: mkPerms(permsSeed[rd.key]) }; });

  /* —— 业务单据种子：先定义订单与出入库，再推出期初库存 —— */
  var salesOrders = [], purchaseOrders = [], inboundDocs = [], outboundDocs = [], stockLedger = [], payments = [];

  function pushSO(id, off, custId, note, audited, closed, done, lines){
    var total = 0;
    lines.forEach(function(l){ l.amt = calcAmt(l.qty, l.price); total += l.amt; });
    salesOrders.push({ id:id, no:'XS'+dayStr(off).replace(/-/g,'')+'0'+id.slice(-1), date:dayStr(off), custId:custId, note:note||'', audited:!!audited, closed:!!closed, done:!!done, total:Math.round(total*100)/100, lines:lines });
    return salesOrders[salesOrders.length-1];
  }
  function pushPO(id, off, supId, note, audited, closed, done, lines){
    var total = 0;
    lines.forEach(function(l){ l.amt = calcAmt(l.qty, l.price); total += l.amt; });
    purchaseOrders.push({ id:id, no:'CG'+dayStr(off).replace(/-/g,'')+'0'+id.slice(-1), date:dayStr(off), supId:supId, note:note||'', audited:!!audited, closed:!!closed, done:!!done, total:Math.round(total*100)/100, lines:lines });
    return purchaseOrders[purchaseOrders.length-1];
  }
  var net = {};   // 各产品净变动（入库-出库）
  function addNet(pid, q){ net[pid] = (net[pid]||0) + q; }

  /* 销售订单（历史） */
  var P = function(id){ for (var i=0;i<products.length;i++) if (products[i].id===id) return products[i]; };
  pushSO('SO01',-58,'KH01','常规补货',1,0,1,[{pid:'SP04',qty:50,price:P('SP04').price},{pid:'SP05',qty:12,price:P('SP05').price}]);
  pushSO('SO02',-49,'KH02','电子元件月单',1,0,1,[{pid:'SP01',qty:30,price:P('SP01').price},{pid:'SP02',qty:20,price:P('SP02').price}]);
  pushSO('SO03',-41,'KH03','芯片急单',1,0,1,[{pid:'SP03',qty:25,price:19.0},{pid:'SP13',qty:60,price:P('SP13').price}]);
  pushSO('SO04',-34,'KH04','门店备货',1,0,1,[{pid:'SP06',qty:18,price:P('SP06').price},{pid:'SP12',qty:40,price:P('SP12').price}]);
  pushSO('SO05',-26,'KH01','螺丝补货',1,0,0,[{pid:'SP05',qty:12,price:44},{pid:'SP07',qty:90,price:P('SP07').price}]);
  pushSO('SO06',-18,'KH05','包装耗材',1,0,0,[{pid:'SP09',qty:6,price:P('SP09').price},{pid:'SP10',qty:5,price:P('SP10').price}]);
  pushSO('SO07',-9,'KH02','办公采购',1,0,0,[{pid:'SP11',qty:8,price:P('SP11').price},{pid:'SP08',qty:30,price:P('SP08').price}]);
  pushSO('SO08',-3,'KH03','数据线备货',0,0,0,[{pid:'SP13',qty:40,price:P('SP13').price}]);
  pushSO('SO09',-1,'KH04','芯片试用单',0,0,0,[{pid:'SP03',qty:10,price:19.5}]);
  pushSO('SO10',-45,'KH05','网线询价单',0,1,0,[{pid:'SP14',qty:4,price:P('SP14').price}]);

  /* 采购订单（历史） */
  pushPO('PO01',-56,'GY01','芯片与线材备货',1,0,1,[{pid:'SP03',qty:60,price:13.0},{pid:'SP13',qty:80,price:3.8}]);
  pushPO('PO02',-44,'GY02','五金耗材',1,0,1,[{pid:'SP04',qty:150,price:0.58},{pid:'SP05',qty:30,price:31.5}]);
  pushPO('PO03',-35,'GY04','线材补货',1,0,0,[{pid:'SP12',qty:80,price:3.05},{pid:'SP14',qty:10,price:195}]);
  pushPO('PO04',-22,'GY01','电容电阻补货',1,0,0,[{pid:'SP02',qty:40,price:0.20},{pid:'SP01',qty:50,price:0.017}]);
  pushPO('PO05',-12,'GY03','包装物料',1,0,0,[{pid:'SP08',qty:60,price:1.8},{pid:'SP07',qty:120,price:0.36}]);
  pushPO('PO06',-5,'GY02','散热器订购',0,0,0,[{pid:'SP06',qty:20,price:4.8}]);
  pushPO('PO07',-40,'GY03','复印纸询价',0,1,0,[{pid:'SP10',qty:6,price:94}]);

  /* 入库单（按时间） */
  function pushIB(id, off, type, refId, operator, lines, note){
    inboundDocs.push({ id:id, no:'RK'+dayStr(off).replace(/-/g,'')+id.slice(-1), date:dayStr(off), type:type, refId:refId||'', operator:operator, lines:lines.map(function(l){return {pid:l.pid, qty:l.qty};}), note:note||'' });
    lines.forEach(function(l){ addNet(l.pid, l.qty); });
  }
  pushIB('IB01',-55,'purchase','PO01','陈斌',[{pid:'SP03',qty:60},{pid:'SP13',qty:80}],'采购入库，质检合格');
  pushIB('IB02',-43,'purchase','PO02','陈斌',[{pid:'SP04',qty:150},{pid:'SP05',qty:30}],'');
  pushIB('IB03',-33,'purchase','PO03','陈斌',[{pid:'SP12',qty:80}],'网线未到货，先入电源线');
  pushIB('IB04',-21,'purchase','PO04','陈斌',[{pid:'SP02',qty:40},{pid:'SP01',qty:50}],'');
  pushIB('IB05',-11,'purchase','PO05','陈斌',[{pid:'SP08',qty:60},{pid:'SP07',qty:120}],'');
  pushIB('IB06',-8,'other','','周强',[{pid:'SP06',qty:10}],'临时补货入库');
  pushIB('IB07',-2,'other','','周强',[{pid:'SP11',qty:20}],'办公用品备货');

  /* 出库单（按时间） */
  function pushOB(id, off, type, refId, operator, lines, note){
    outboundDocs.push({ id:id, no:'CK'+dayStr(off).replace(/-/g,'')+id.slice(-1), date:dayStr(off), type:type, refId:refId||'', operator:operator, lines:lines.map(function(l){return {pid:l.pid, qty:l.qty};}), note:note||'' });
    lines.forEach(function(l){ addNet(l.pid, -l.qty); });
  }
  pushOB('OB01',-52,'sales','SO01','周强',[{pid:'SP04',qty:50}],'销售出库');
  pushOB('OB02',-45,'sales','SO02','周强',[{pid:'SP01',qty:30},{pid:'SP02',qty:20}],'');
  pushOB('OB03',-38,'sales','SO03','周强',[{pid:'SP03',qty:25},{pid:'SP13',qty:60}],'');
  pushOB('OB04',-30,'sales','SO04','周强',[{pid:'SP06',qty:18},{pid:'SP12',qty:40}],'');
  pushOB('OB05',-22,'sales','SO05','周强',[{pid:'SP05',qty:12}],'气泡袋待后续发货');
  pushOB('OB06',-2,'other','','周强',[{pid:'SP09',qty:2}],'样品领用');

  /* 收付款（历史） */
  function pay(off, type, partnerType, partnerId, refType, refId, amount, method, note){
    payments.push({ id:'PAY'+(payments.length+1), date:dayStr(off), type:type, partnerType:partnerType, partnerId:partnerId, refType:refType, refId:refId, amount:Math.round(amount*100)/100, method:method, note:note||'' });
  }
  pay(-50,'in','crm','KH01','so','SO01',salesOrders[0].total,'银行转账','全额结清');
  pay(-44,'in','crm','KH02','so','SO02',salesOrders[1].total,'支付宝','');
  pay(-40,'in','crm','KH03','so','SO03',6000,'银行转账','首付款');
  pay(-30,'in','crm','KH03','so','SO03',Math.round((salesOrders[2].total-6000)*100)/100,'微信','尾款');
  pay(-28,'in','crm','KH04','so','SO04',salesOrders[3].total,'承兑汇票','');
  pay(-20,'in','crm','KH01','so','SO05',Math.round(salesOrders[4].total*0.3*100)/100,'银行转账','定金 30%');
  pay(-52,'out','sup','GY01','po','PO01',purchaseOrders[0].total,'银行转账','全额付款');
  pay(-40,'out','sup','GY02','po','PO02',Math.round(purchaseOrders[1].total*0.6*100)/100,'银行转账','到货付六成');
  pay(-30,'out','sup','GY04','po','PO03',Math.round(purchaseOrders[2].total*0.4*100)/100,'微信','预付款 40%');

  /* 库存流水：期初 → 逐笔变动，结存连续 */
  var bal = {};
  products.forEach(function(p){ bal[p.id] = p.stock - (net[p.id]||0); });
  products.forEach(function(p){
    stockLedger.push({ date: baseDate, docType:'期初', docNo:'—', pid:p.id, qty:bal[p.id], balance:bal[p.id], note:'期初结存' });
  });
  var events = [];
  inboundDocs.forEach(function(d){ d.lines.forEach(function(l){ events.push({ date:d.date, docType:'采购入库', docNo:d.no, pid:l.pid, qty:l.qty, note:d.note }); }); });
  outboundDocs.forEach(function(d){ d.lines.forEach(function(l){ events.push({ date:d.date, docType:'销售出库', docNo:d.no, pid:l.pid, qty:-l.qty, note:d.note }); }); });
  events.sort(function(a,b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  events.forEach(function(e){
    bal[e.pid] = Math.round((bal[e.pid] + e.qty)*1000)/1000;
    stockLedger.push({ date:e.date, docType:e.docType, docNo:e.docNo, pid:e.pid, qty:e.qty, balance:bal[e.pid], note:e.note||'' });
  });

  return {
    meta: { version:1, initAt: todayStr() },
    seq: { crm:6, sup:5, prd:15, so:11, po:8, ib:8, ob:7, pay:11, adj:0 },
    company: { name:'玉林账房供应链有限公司', short:'账房 ERP', contact:'王掌柜', phone:'0775-2660xxx', address:'广西玉林市玉州区人民中路 52 号', taxNo:'91450900MA5L8xxxxx' },
    categories: categories, products: products, customers: customers, suppliers: suppliers,
    salesOrders: salesOrders, purchaseOrders: purchaseOrders,
    inboundDocs: inboundDocs, outboundDocs: outboundDocs,
    stockLedger: stockLedger, payments: payments,
    users: users, roles: roles,
    settings: { lowStock:10, taxRate:13, currency:'¥', decimals:2 }
  };
}

/* 空白初始状态：保留账号体系 / 角色权限 / 公司信息 / 业务参数，业务数据全部为空 */
function buildBlank(){
  var seed = buildSeed();
  seed.meta = { version:1, initAt: todayStr() };
  seed.seq = { crm:1, sup:1, prd:1, so:1, po:1, ib:1, ob:1, pay:1, adj:1 };
  seed.categories = [];
  seed.products = [];
  seed.customers = [];
  seed.suppliers = [];
  seed.salesOrders = [];
  seed.purchaseOrders = [];
  seed.inboundDocs = [];
  seed.outboundDocs = [];
  seed.stockLedger = [];
  seed.payments = [];
  return seed;
}
/* 清空全部业务数据（保留账号与系统配置），会话回到管理员 */
function resetToBlank(){
  S = buildBlank();
  saveState();
  try { localStorage.removeItem(SS_KEY); } catch(e){}
  setSession('u-admin');
  return S;
}
function initStore(){
  var raw = null, mark = null;
  try { raw = localStorage.getItem(LS_KEY); } catch(e){}
  try { mark = localStorage.getItem(RESET_MARK_KEY); } catch(e){}
  if (raw) {
    try {
      var obj = JSON.parse(raw);
      if (obj && obj.meta && obj.meta.version===1 && obj.users && obj.roles) {
        /* v1.1.3 起默认空白初始：对旧版遗留数据执行一次性清空 */
        if (!mark) {
          S = buildBlank();
          saveState();
          try { localStorage.setItem(RESET_MARK_KEY, '1'); } catch(e){}
          window.__erpAutoReset = true;
        } else { S = obj; migrateState(); }
        return;
      }
    } catch(e){}
  }
  S = buildBlank();
  saveState();
  try { localStorage.setItem(RESET_MARK_KEY, '1'); } catch(e){}
}

/* ---------- 通用 CRUD ---------- */
function addItem(list, item){ list.push(item); saveState(); }
function updateItem(list, id, patch){ for (var i=0;i<list.length;i++) if (list[i].id===id){ Object.assign(list[i], patch); saveState(); return list[i]; } return null; }
function removeItem(list, id){ for (var i=0;i<list.length;i++) if (list[i].id===id){ list.splice(i,1); saveState(); return true; } return false; }
function byId(list, id){ for (var i=0;i<list.length;i++) if (list[i].id===id) return list[i]; return null; }
function nextSeq(key){ S.seq[key] = (S.seq[key]||0) + 1; return S.seq[key]; }
function catName(id){ var c = byId(S.categories, id); return c ? c.name : '—'; }
function prodName(pid){ var p = byId(S.products, pid); return p ? p.name : '已删除产品'; }
function partnerName(type, id){
  if (type==='crm'){ var c=byId(S.customers,id); return c?c.name:'—'; }
  var s = byId(S.suppliers, id); return s ? s.name : '—';
}
function roleName(key){ var r = S.roles[key]; return r ? r.name : key; }

/* ---------- 单据状态推导（销售 / 采购） ---------- */
function shippedQtyOf(soId, pid){
  var q = 0;
  S.outboundDocs.forEach(function(d){ if (d.type==='sales' && d.refId===soId){ d.lines.forEach(function(l){ if (l.pid===pid) q += l.qty; }); } });
  return q;
}
function receivedQtyOf(poId, pid){
  var q = 0;
  S.inboundDocs.forEach(function(d){ if (d.type==='purchase' && d.refId===poId){ d.lines.forEach(function(l){ if (l.pid===pid) q += l.qty; }); } });
  return q;
}
function soStatus(so){
  if (so.closed) return 'canceled';
  if (so.done) return 'done';
  var all = true, any = false;
  so.lines.forEach(function(l){
    var s = shippedQtyOf(so.id, l.pid);
    if (s >= l.qty) { any = true; } else { all = false; if (s>0) any = true; }
  });
  if (all && any) return 'shipped';
  if (any) return 'partial';
  if (so.audited) return 'audited';
  return 'pending';
}
function poStatus(po){
  if (po.closed) return 'canceled';
  if (po.done) return 'done';
  var all = true, any = false;
  po.lines.forEach(function(l){
    var r = receivedQtyOf(po.id, l.pid);
    if (r >= l.qty) { any = true; } else { all = false; if (r>0) any = true; }
  });
  if (all && any) return 'received';
  if (any) return 'partial';
  if (po.audited) return 'audited';
  return 'pending';
}
var STATUS_META = {
  pending:   { label:'待审核', cls:'st-amber' },
  audited:   { label:'已审核', cls:'st-ink' },
  partial:   { label:'部分出库', cls:'st-blue' },
  shipped:   { label:'已出库', cls:'st-verm' },
  received:  { label:'已入库', cls:'st-teal' },
  done:      { label:'已完成', cls:'st-teal' },
  canceled:  { label:'已取消', cls:'st-gray' }
};

/* ---------- 订单动作 ---------- */
function soAudit(so){ if (!canOp('sale')) return '无权操作'; if (so.audited || so.closed) return '当前状态不可审核'; so.audited = true; saveState(); return ''; }
function poAudit(po){ if (!canOp('pur')) return '无权操作'; if (po.audited || po.closed) return '当前状态不可审核'; po.audited = true; saveState(); return ''; }
function soCancel(so){ if (!canOp('sale')) return '无权操作'; var st = soStatus(so); if (st!=='pending' && st!=='audited') return '仅待审核/已审核可取消'; so.closed = true; saveState(); return ''; }
function poCancel(po){ if (!canOp('pur')) return '无权操作'; var st = poStatus(po); if (st!=='pending' && st!=='audited') return '仅待审核/已审核可取消'; po.closed = true; saveState(); return ''; }
function soDone(so){ if (!canOp('sale')) return '无权操作'; var st = soStatus(so); if (st==='shipped'){ so.done = true; saveState(); return ''; } return '仅已出库状态可完成'; }
function poDone(po){ if (!canOp('pur')) return '无权操作'; var st = poStatus(po); if (st==='received'){ po.done = true; saveState(); return ''; } return '仅已入库状态可完成'; }

/* ---------- 收付款 ---------- */
function paidOf(refType, refId){
  var t = 0;
  S.payments.forEach(function(p){ if (p.refType===refType && p.refId===refId && p.type==='in') t += p.amount; });
  return Math.round(t*100)/100;
}
function paidOutOf(refType, refId){
  var t = 0;
  S.payments.forEach(function(p){ if (p.refType===refType && p.refId===refId && p.type==='out') t += p.amount; });
  return Math.round(t*100)/100;
}
function crmFin(custId){
  var total=0, paid=0, orders=[];
  S.payments.forEach(function(p){ if (p.type==='in' && p.partnerType==='crm' && p.partnerId===custId) paid += p.amount; });
  S.salesOrders.forEach(function(so){
    if (so.custId!==custId) return;
    var st = soStatus(so);
    if (st==='canceled') return;
    var p = paidOf('so', so.id);
    total += so.total;
    orders.push({ ref:so, status:st, paid:p, unpaid:Math.round((so.total-p)*100)/100 });
  });
  return { total:Math.round(total*100)/100, paid:Math.round(paid*100)/100, unpaid:Math.round((total-paid)*100)/100, orders:orders };
}
function supFin(supId){
  var total=0, paid=0, orders=[];
  S.payments.forEach(function(p){ if (p.type==='out' && p.partnerType==='sup' && p.partnerId===supId) paid += p.amount; });
  S.purchaseOrders.forEach(function(po){
    if (po.supId!==supId) return;
    var st = poStatus(po);
    if (st==='canceled') return;
    var p = paidOutOf('po', po.id);
    total += po.total;
    orders.push({ ref:po, status:st, paid:p, unpaid:Math.round((po.total-p)*100)/100 });
  });
  return { total:Math.round(total*100)/100, paid:Math.round(paid*100)/100, unpaid:Math.round((total-paid)*100)/100, orders:orders };
}
function registerPayment(data){
  if (!canOp('fin')) return '无权操作';
  if (!(data.amount>0)) return '金额必须大于 0';
  if (data.type==='in'){
    var f = crmFin(data.partnerId);
    if (data.amount > f.unpaid + 1e-6) return '收款金额超过该客户未收余额';
  } else {
    var g = supFin(data.partnerId);
    if (data.amount > g.unpaid + 1e-6) return '付款金额超过该供应商未付余额';
  }
  S.payments.push({
    id:'PAY'+nextSeq('pay'), date:data.date||todayStr(), type:data.type,
    partnerType:data.partnerType, partnerId:data.partnerId,
    refType:data.refType||'', refId:data.refId||'',
    amount:Math.round(data.amount*100)/100, method:data.method, note:data.note||''
  });
  saveState();
  return '';
}

/* ---------- 库存：入库 / 出库 / 盘点 ---------- */
function applyStock(doc){
  /* doc: {type:'IB'|'OB' 或业务类型 purchase/sales/other, dir:'in'|'out', date, no, lines:[{pid,qty}], note, operator, docTypeLabel} */
  var dir = doc.dir === 'in' ? 1 : (doc.dir === 'out' ? -1 : (doc.type === 'IB' ? 1 : -1));
  if (dir < 0){
    var short = [];
    doc.lines.forEach(function(l){
      var p = byId(S.products, l.pid);
      if (!p || p.stock < l.qty) short.push((p?p.name:'未知') + '（现有 ' + fmtQty(p?p.stock:0) + '，需 ' + fmtQty(l.qty) + '）');
    });
    if (short.length) return '库存不足：' + short.join('；');
  }
  doc.lines.forEach(function(l){
    var p = byId(S.products, l.pid);
    if (!p) return;
    var q = dir * l.qty;
    p.stock = Math.round((p.stock + q)*1000)/1000;
    var last = null;
    for (var i=S.stockLedger.length-1;i>=0;i--){ if (S.stockLedger[i].pid===l.pid){ last = S.stockLedger[i]; break; } }
    var bal = (last ? last.balance : 0) + q;
    S.stockLedger.push({ date:doc.date, docType:doc.docTypeLabel, docNo:doc.no, pid:l.pid, qty:q, balance:Math.round(bal*1000)/1000, note:doc.note||'' });
  });
  saveState();
  return '';
}
function createInbound(data){
  if (!canOp('ib')) return '无权操作';
  if (!data.lines.length) return '请至少添加一行入库明细';
  var no = 'RK' + data.date.replace(/-/g,'') + pad2(nextSeq('ib'));
  var doc = { id:'IB'+String(S.seq.ib).padStart(3,'0'), no:no, date:data.date, type:data.type, refId:data.refId||'', operator:data.operator||'', lines:data.lines, note:data.note||'', dir:'in', docTypeLabel: data.type==='purchase' ? '采购入库' : '其他入库' };
  var err = applyStock(doc);
  if (err) return err;
  S.inboundDocs.push(doc);
  if (doc.type==='purchase' && data.refId){
    var po = byId(S.purchaseOrders, data.refId);
    if (po){ var st = poStatus(po); if (st==='received') po.done = true; }
  }
  saveState();
  return '';
}
function createOutbound(data){
  if (!canOp('ob')) return '无权操作';
  if (!data.lines.length) return '请至少添加一行出库明细';
  var no = 'CK' + data.date.replace(/-/g,'') + pad2(nextSeq('ob'));
  var doc = { id:'OB'+String(S.seq.ob).padStart(3,'0'), no:no, date:data.date, type:data.type, refId:data.refId||'', operator:data.operator||'', lines:data.lines, note:data.note||'', dir:'out', docTypeLabel: data.type==='sales' ? '销售出库' : '其他出库' };
  var err = applyStock(doc);
  if (err) return err;
  S.outboundDocs.push(doc);
  if (doc.type==='sales' && data.refId){
    var so = byId(S.salesOrders, data.refId);
    if (so){ var st = soStatus(so); if (st==='shipped') so.done = true; }
  }
  saveState();
  return '';
}
function adjustStock(pid, qty, note){
  if (!canOp('inv')) return '无权操作';
  var p = byId(S.products, pid);
  if (!p) return '产品不存在';
  qty = Number(qty) || 0;
  if (qty===0) return '调整数量不能为 0';
  p.stock = Math.round((p.stock + qty)*1000)/1000;
  var last = null;
  for (var i=S.stockLedger.length-1;i>=0;i--){ if (S.stockLedger[i].pid===pid){ last = S.stockLedger[i]; break; } }
  var bal = (last ? last.balance : 0) + qty;
  S.stockLedger.push({ date:todayStr(), docType:'盘点调整', docNo:'TZ'+pad2(nextSeq('adj')), pid:pid, qty:qty, balance:Math.round(bal*1000)/1000, note:note||'人工盘点' });
  saveState();
  return '';
}

/* ---------- 仪表盘统计 ---------- */
function monthSales(){ var m=monthStr(), t=0; S.salesOrders.forEach(function(o){ if (o.date.slice(0,7)===m && soStatus(o)!=='canceled') t+=o.total; }); return Math.round(t*100)/100; }
function monthPurchase(){ var m=monthStr(), t=0; S.purchaseOrders.forEach(function(o){ if (o.date.slice(0,7)===m && poStatus(o)!=='canceled') t+=o.total; }); return Math.round(t*100)/100; }
function todaySales(){ var d=todayStr(), t=0; S.salesOrders.forEach(function(o){ if (o.date===d && soStatus(o)!=='canceled') t+=o.total; }); return Math.round(t*100)/100; }
function stockValue(){ var t=0; S.products.forEach(function(p){ t+=p.stock*p.cost; }); return Math.round(t*100)/100; }
function lowStockList(){ return S.products.filter(function(p){ return p.status===1 && p.stock < p.safety; }); }
function receivablesTotal(){ var t=0; S.customers.forEach(function(c){ t+=crmFin(c.id).unpaid; }); return Math.round(t*100)/100; }
function payablesTotal(){ var t=0; S.suppliers.forEach(function(s){ t+=supFin(s.id).unpaid; }); return Math.round(t*100)/100; }
function pendingCounts(){
  var so=0, po=0;
  S.salesOrders.forEach(function(o){ if (soStatus(o)==='pending') so++; });
  S.purchaseOrders.forEach(function(o){ if (poStatus(o)==='pending') po++; });
  return { so:so, po:po };
}
/* 待办列表（供铃铛面板与仪表盘待办共用口径）：待审核销售订单 → 待审核采购单 → 库存告急 */
function todoList(){
  var rows = [];
  S.salesOrders.forEach(function(o){
    if (soStatus(o)==='pending') rows.push({ grp:'sale', icon:'sale', cls:'amber', title:o.no, meta: partnerName('crm',o.custId) + ' · ' + fmtMoney(o.total), go:'#/sale/view?id=' + o.id });
  });
  S.purchaseOrders.forEach(function(o){
    if (poStatus(o)==='pending') rows.push({ grp:'pur', icon:'pur', cls:'teal', title:o.no, meta: partnerName('sup',o.supId) + ' · ' + fmtMoney(o.total), go:'#/pur/view?id=' + o.id });
  });
  lowStockList().forEach(function(p){
    rows.push({ grp:'alert', icon:'alert', cls:'verm', title:p.name, meta:'现存量 ' + fmtQty(p.stock) + '，低于安全库存 ' + fmtQty(p.safety), go:'#/inv?t=overview&low=1' });
  });
  return rows;
}
function todoTotal(){ return todoList().length; }
function weekSeries(weeks){
  /* 返回 {labels, sales[], purchases[]}，weeks 为周起始日期数组 */
  var out = { labels:[], sales:[], purchases:[] };
  weeks.forEach(function(w){
    out.labels.push(w.slice(5));
    var s=0, p=0;
    S.salesOrders.forEach(function(o){ if (o.date>=w && o.date<nextWeek(w) && soStatus(o)!=='canceled') s+=o.total; });
    S.purchaseOrders.forEach(function(o){ if (o.date>=w && o.date<nextWeek(w) && poStatus(o)!=='canceled') p+=o.total; });
    out.sales.push(Math.round(s)); out.purchases.push(Math.round(p));
  });
  return out;
}
function nextWeek(w){ var d=new Date(w+'T00:00:00'); d.setDate(d.getDate()+7); return fmtDate(d); }
function lastWeeks(n){
  var arr=[], d=new Date(); var day=(d.getDay()+6)%7; d.setDate(d.getDate()-day);
  for (var i=n-1;i>=0;i--){ var x=new Date(d); x.setDate(x.getDate()-7*i); arr.push(fmtDate(x)); }
  return arr;
}
function catStockValue(){
  var map={};
  S.products.forEach(function(p){ var c=catName(p.cat); map[c]=(map[c]||0)+p.stock*p.cost; });
  var arr=[];
  for (var k in map) arr.push({ name:k, value:Math.round(map[k]) });
  arr.sort(function(a,b){ return b.value-a.value; });
  return arr.slice(0,8);
}
function pay7days(){
  var arr=[], d=new Date();
  for (var i=6;i>=0;i--){ var x=new Date(d); x.setDate(x.getDate()-i); arr.push(fmtDate(x)); }
  var out={ labels:[], in:[], out:[] };
  arr.forEach(function(dt){
    out.labels.push(dt.slice(5));
    var a=0, b=0;
    S.payments.forEach(function(p){ if (p.date===dt){ if (p.type==='in') a+=p.amount; else b+=p.amount; } });
    out.in.push(Math.round(a)); out.out.push(Math.round(b));
  });
  return out;
}

/* ---------- 导出 CSV ---------- */
function exportCSV(filename, rows){
  if (!rows.length) return;
  var esc = function(v){ return '"' + String(v==null?'':v).replace(/"/g,'""') + '"'; };
  var csv = rows.map(function(r){ return r.map(esc).join(','); }).join('\r\n');
  var blob = new Blob(['\uFEFF' + csv], { type:'text/csv;charset=utf-8;' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename + '.csv';
  document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 300);
}

/* ---------- 备份 / 恢复 / 重置 ---------- */
function backupData(){
  var blob = new Blob([JSON.stringify(S, null, 2)], { type:'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '账房ERP备份-' + todayStr() + '.json';
  document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 300);
}
function restoreData(text){
  try {
    var obj = JSON.parse(text);
    if (!(obj && obj.meta && obj.meta.version===1 && obj.users && obj.roles)) return '备份文件格式不正确';
    S = obj; saveState();
    migrateState();           /* 恢复后校正新模块权限（如操作日志仅管理员），兼容旧版备份 */
    saveState();
    try { CUR_SESSION = null; sessionStorage.removeItem('zf_erp_cur_session'); } catch(e){}
    ensureSession();          /* 重建当前登录会话，保证恢复后的操作日志仍可归属会话 */
    return '';
  } catch(e){ return '无法解析备份文件'; }
}
function resetData(){
  S = buildSeed(); saveState();
}

/* ---------- 通知中心 ---------- */
var NOTES = [];
var NOTES_KEY = 'zf_erp_notes';
function loadNotes(){
  try {
    var raw = localStorage.getItem(NOTES_KEY);
    NOTES = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(NOTES)) NOTES = [];
  } catch(e){ NOTES = []; }
}
function saveNotes(){
  try { localStorage.setItem(NOTES_KEY, JSON.stringify(NOTES.slice(0,120))); } catch(e){}
}
function pushNote(type, title, sub, go){
  NOTES.unshift({ id:'N' + Date.now() + '_' + Math.floor(Math.random()*1000), type:type, title:title, sub:sub||'', go:go||'', ts:Date.now(), read:false });
  if (NOTES.length > 120) NOTES.length = 120;
  saveNotes();
  refreshBell();
}
function unreadNotes(){
  return NOTES.filter(function(n){ return !n.read; });
}
function markAllNotesRead(){
  NOTES.forEach(function(n){ n.read = true; });
  saveNotes();
}
function noteTime(ts){
  var d = new Date(ts), now = new Date();
  var hm = ('0'+d.getHours()).slice(-2) + ':' + ('0'+d.getMinutes()).slice(-2);
  var y = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  var days = Math.round((y - dd) / 86400000);
  if (days === 0) return '今天 ' + hm;
  if (days === 1) return '昨天 ' + hm;
  return (d.getMonth()+1) + '月' + d.getDate() + '日';
}

/* ---------- 登录日志 / 操作日志（按登录会话聚合） ---------- */
var LOGS_KEY = 'zf_erp_logs';
var LOGIN_LOGS = [];
var OP_LOGS = [];
var CUR_SESSION = null;   /* 当前登录会话 */
function loadLogs(){
  try {
    var raw = localStorage.getItem(LOGS_KEY);
    if (raw) {
      var d = JSON.parse(raw);
      LOGIN_LOGS = Array.isArray(d.login) ? d.login : [];
      OP_LOGS = Array.isArray(d.op) ? d.op : [];
    }
  } catch(e){ LOGIN_LOGS = []; OP_LOGS = []; }
}
function saveLogs(){
  try { localStorage.setItem(LOGS_KEY, JSON.stringify({ login: LOGIN_LOGS, op: OP_LOGS })); } catch(e){}
}
function logWho(){
  var u = (typeof currentUser === 'function') ? currentUser() : null;
  return { account: u ? u.username : '-', name: u ? u.name : '-' };
}
/* 建立一条登录会话：每次登录（含账号切换）生成一条登录日志，会话内的操作挂靠该会话 */
function newSession(action, detail){
  var w = logWho();
  var id = 's' + Date.now().toString(36) + '_' + Math.floor(Math.random()*10000);
  CUR_SESSION = { id:id, account:w.account, name:w.name };
  LOGIN_LOGS.unshift({ session:id, ts:Date.now(), account:w.account, name:w.name, action:action || '登录系统', detail:detail || '登录成功' });
  if (LOGIN_LOGS.length > 300) LOGIN_LOGS.length = 300;
  saveLogs();
  try { sessionStorage.setItem('zf_erp_cur_session', JSON.stringify(CUR_SESSION)); } catch(e){}
  return CUR_SESSION;
}
/* 页面首次进入时建立登录会话（同一浏览器标签页刷新复用，不重复计登录） */
function ensureSession(){
  if (CUR_SESSION) return CUR_SESSION;
  try {
    var raw = sessionStorage.getItem('zf_erp_cur_session');
    if (raw){ var s = JSON.parse(raw); if (s && s.id && s.account){ CUR_SESSION = s; return s; } }
  } catch(e){}
  return newSession('登录系统', '登录成功');
}
function pushLoginLog(action, detail){
  return newSession(action, detail);
}
function pushOpLog(action, detail){
  var w = logWho();
  var sid = CUR_SESSION ? CUR_SESSION.id : null;
  if (!sid){ var s = ensureSession(); sid = s ? s.id : null; }
  OP_LOGS.unshift({ session:sid, ts:Date.now(), account:w.account, name:w.name, action:action, detail:detail || '' });
  if (OP_LOGS.length > 500) OP_LOGS.length = 500;
  saveLogs();
}
/* 某条登录日志对应的会话操作记录：优先按会话 id 精确匹配；老数据（无 session 字段）按「该次登录后、同账号下次登录前」时间窗口归集 */
function sessionOps(item, idx){
  if (item.session) return OP_LOGS.filter(function(o){ return o.session === item.session; });
  var acc = item.account;
  var next = null;
  for (var j = idx + 1; j < LOGIN_LOGS.length; j++){
    if (LOGIN_LOGS[j].account === acc){ next = LOGIN_LOGS[j]; break; }
  }
  var t0 = item.ts || 0, t1 = next ? (next.ts || Infinity) : Infinity;
  return OP_LOGS.filter(function(o){ return o.account === acc && o.ts >= t0 && o.ts < t1; });
}
function logTime(ts){
  var d = new Date(ts);
  if (isNaN(d.getTime())) return '-';
  var p = function(n){ return ('0'+n).slice(-2); };
  return d.getFullYear() + '-' + p(d.getMonth()+1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}
function clearLogs(){
  LOGIN_LOGS = []; OP_LOGS = []; saveLogs();
}
