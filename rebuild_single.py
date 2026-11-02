# -*- coding: utf-8 -*-
"""从被污染的 HTML 还原多文件入口，再以修正逻辑合成产物。

v1.3.0 变更：地址数据不再内联，改为外链 js/regions/<省份名>.js 共 34 个文件（用户显式要求拆分）。
还原时生成 ECharts + 6 个业务 js script + 34 个 regions script；合成时仅内联 6 个业务 js，regions 保持外链。
"""
import os, io, re, json

base = r"C:\Users\小张睡不好\Doubao\chats\2026-10-23\new-chat\erp-ledger"
html_path = os.path.join(base, "账房ERP管理系统.html")
backup_dir = os.path.join(base, "_backup")
os.makedirs(backup_dir, exist_ok=True)
css_path = os.path.join(base, "css", "app.css")
js_order = ["core.js", "ui.js", "views1.js", "views2.js", "views3.js", "main.js"]  # regions.js 不再内联

regions_dir = os.path.join(base, "js", "regions")
# 省份顺序与 js/regions.js 原始键顺序保持一致
prov_order = list(json.loads(re.search(r'var REGION_DATA\s*=\s*(\{.*\})\s*;',
    io.open(os.path.join(base, "js", "regions.js"), encoding="utf-8").read(), re.S).group(1)).keys())
region_files = [p + ".js" for p in prov_order]
assert len(region_files) == 34, "regions 文件数量 != 34"

with io.open(html_path, "r", encoding="utf-8") as f:
    c = f.read()
with io.open(css_path, "r", encoding="utf-8") as f:
    css = f.read()
parts = []
for j in js_order:
    with io.open(os.path.join(base, "js", j), "r", encoding="utf-8") as f:
        parts.append(f.read())
js_all = "\n;\n".join(parts)

# --- 1) 还原 css：内联 style 块 -> link 标签 ---
s0 = c.index("<style>")
s1 = c.index("</style>", s0) + len("</style>")
c = c[:s0] + '<link rel="stylesheet" href="css/app.css">' + c[s1:]

# --- 2) 还原脚本区：损坏的 script 区域 -> 完整 ECharts 标签 + 6 个业务 js script + 34 个 regions script ---
open_pos = c.index('<script src="https://cdn.jsdelivr.net/npm/echarts@5.6.0/dist/echarts.min.js"')
last_close = c.rindex("</script>") + len("</script>")
tail = c[open_pos:last_close]
m = re.search(r'integrity="([^"]+)"', tail)
assert m, "integrity 未找到"
integrity = m.group(1)
orig_block = ('<script src="https://cdn.jsdelivr.net/npm/echarts@5.6.0/dist/echarts.min.js" integrity="%s" crossorigin="anonymous"></script>\n' % integrity)
for j in js_order:
    orig_block += '<script src="js/%s"></script>\n' % j
for f in region_files:
    orig_block += '<script src="js/regions/%s"></script>\n' % f
c = c[:open_pos] + orig_block + c[last_close:]

# 完整性断言：还原后的 shell 不含任何内联 JS
assert "<script>" not in c, "还原后仍含内联 script"
assert c.count('src="js/') == 6 + 34, "js script 标签数量 != 40"

# --- 备份还原后的多文件入口 ---
backup_path = os.path.join(backup_dir, "账房ERP管理系统-多文件入口.html")
with io.open(backup_path, "w", encoding="utf-8") as f:
    f.write(c)
print("backup written:", os.path.getsize(backup_path))

# --- 3) 修正逻辑合成：css 内联、业务 js 内联、regions 保持外链 ---
html = c.replace('<link rel="stylesheet" href="css/app.css">', "<style>\n" + css + "\n</style>")
for j in js_order:
    html = html.replace('<script src="js/%s"></script>' % j, "")
pat = re.compile(r'(<script src="https://cdn\.jsdelivr\.net/npm/echarts@5\.6\.0/dist/echarts\.min\.js"[^>]*></script>)', re.S)
m2 = pat.search(html)
assert m2, "ECharts script tag not found"
html = html.replace(m2.group(1), m2.group(1) + "\n<script>\n" + js_all + "\n</script>", 1)

with io.open(html_path, "w", encoding="utf-8") as f:
    f.write(html)
print("done. size=", os.path.getsize(html_path))
print("externalScripts=", html.count('<script src='))
print("inlineScripts=", html.count('<script>'))
print("strayIntegrity=", ("integrity=" in html[html.rindex("</html>") - 2000:]))
