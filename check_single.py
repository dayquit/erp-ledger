import subprocess, os, re
edge = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
base = r"C:\Users\小张睡不好\Doubao\chats\2026-10-23\new-chat\erp-ledger\账房ERP管理系统.html"
routes = ["", "#/dash", "#/crm", "#/crm/view?id=KH01", "#/sup", "#/prd", "#/sale", "#/sale/view?id=SO01",
          "#/pur", "#/ib", "#/ob", "#/inv", "#/inv?t=adjust", "#/fin", "#/fin?t=stmt&type=crm&id=KH01",
          "#/acct", "#/acct?t=roles", "#/set", "#/logs", "#/logs?t=op", "#/logs?t=login"]
bad_any = False
for r in routes:
    url = "file:///" + base.replace("\\", "/") + r
    p = subprocess.run([edge, "--headless=new", "--disable-gpu", "--dump-dom", "--enable-logging=stderr", url],
                       capture_output=True, timeout=60)
    dom = p.stdout.decode("utf-8", "replace")
    err = p.stderr.decode("utf-8", "replace")
    bad = dom.count("[object HTMLDivElement]")
    uncaught = any(k in err for k in ("Uncaught", "TypeError", "ReferenceError", "SyntaxError"))
    status = "OK " if (bad == 0 and not uncaught) else "BAD "
    print(status + (r or "dash") + "  badText=%d uncaught=%s domLen=%d" % (bad, uncaught, len(dom)))
    if bad > 0 or uncaught:
        bad_any = True
        print("   stderr:", [ln for ln in err.splitlines() if "rror" in ln][:3])
print("RESULT:", "ALL OK" if not bad_any else "HAS FAILURES")
