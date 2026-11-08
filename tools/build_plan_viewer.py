#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""build_plan_viewer.py —— 把 docs/PLAN-ZIWEI-CLIENT.md 渲染成可阅读的静态看板页。

用法：
  python tools/build_plan_viewer.py
输出：
  docs/plan-viewer.html（浅色纸面、表格、代码块；内含 180 秒自动刷新）

说明：浏览器 file:// 下无法 fetch 本地 md，所以采用「生成时内嵌」方案；
改了 md 后重新跑本脚本即可，已打开的 Edge 窗口会在 3 分钟内自动刷新。
"""
import html
import os
import re
from datetime import datetime

try:
    import markdown
except ImportError as exc:  # pragma: no cover
    raise SystemExit("需要 python markdown 库：pip install markdown") from exc

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MD = os.path.join(ROOT, "docs", "PLAN-ZIWEI-CLIENT.md")
OUT = os.path.join(ROOT, "docs", "plan-viewer.html")

TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta http-equiv="refresh" content="180"/>
<title>紫微客户端 · 项目规划</title>
<style>
:root{--paper:#F6F4EE;--ink:#26241F;--ink-soft:#5B564B;--line:#D9D2C4;--accent:#5A5AB8;--accent-soft:#ECEBF7;--code:#23272E;--code-ink:#E8E2D5;}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:"Noto Serif SC","Source Han Serif SC","Songti SC",SimSun,serif;line-height:1.75;font-size:15px;}
.topbar{position:sticky;top:0;z-index:9;display:flex;justify-content:space-between;align-items:center;padding:12px 28px;background:rgba(246,244,238,.94);border-bottom:1px solid var(--line);backdrop-filter:blur(6px);}
.topbar h1{font-size:17px;margin:0;letter-spacing:.12em;color:var(--accent)}
.topbar .meta{font-size:11.5px;color:var(--ink-soft)}
.layout{display:flex;gap:28px;max-width:1400px;margin:0 auto;padding:26px 32px 60px;align-items:flex-start}
main{flex:1 1 auto;min-width:0}
aside{flex:0 0 235px;position:sticky;top:74px;font-size:12.5px;color:var(--ink-soft);border-left:1px solid var(--line);padding-left:18px;max-height:calc(100vh - 110px);overflow:auto}
aside b{display:block;color:var(--accent);letter-spacing:.1em;margin-bottom:8px;font-size:11.5px}
aside a{display:block;color:var(--ink-soft);text-decoration:none;padding:2px 0;border-bottom:1px dashed transparent}
aside a:hover{color:var(--accent);border-bottom-color:var(--line)}
h1{font-size:23px;margin:8px 0 4px;letter-spacing:.06em}
h2{font-size:18px;margin:30px 0 10px;padding-bottom:5px;border-bottom:1px solid var(--line);color:var(--accent);scroll-margin-top:70px}
h3{font-size:15px;margin:18px 0 6px}
p{margin:8px 0}
ul,ol{margin:6px 0 10px;padding-left:22px}
li{margin:3px 0}
strong{color:#1c1b17}
code{font-family:ui-monospace,Consolas,"Cascadia Mono",monospace;font-size:12.5px;background:var(--accent-soft);color:#3B3B7A;padding:1px 4px;border-radius:3px}
pre{background:var(--code);color:var(--code-ink);padding:14px 16px;border-radius:8px;overflow:auto;font-size:12.5px;line-height:1.5}
pre code{background:none;color:inherit;padding:0}
table{border-collapse:collapse;width:100%;margin:12px 0;font-size:13px}
th,td{border:1px solid var(--line);padding:6px 10px;text-align:left;vertical-align:top}
th{background:#EFEBE1;color:#4A4438;font-weight:600;white-space:nowrap}
tr:nth-child(even) td{background:rgba(255,255,255,.45)}
blockquote{margin:12px 0;padding:8px 16px;border-left:3px solid var(--accent);background:var(--accent-soft);color:var(--ink-soft)}
hr{border:none;border-top:1px solid var(--line);margin:26px 0}
.foot{max-width:1400px;margin:0 auto;padding:0 32px 30px;font-size:11.5px;color:var(--ink-soft)}
.badge{display:inline-block;border:1px solid var(--accent);color:var(--accent);border-radius:4px;padding:0 6px;font-size:11px;margin-left:6px;letter-spacing:.05em}
</style>
</head>
<body>
<div class="topbar">
  <h1>紫微斗数可视化客户端 · 项目规划 <span class="badge">v0.1</span></h1>
  <div class="meta">打开于 __NOW__ ｜ 内容以 docs/PLAN-ZIWEI-CLIENT.md 为准</div>
</div>
<div class="layout">
<main>
__BODY__
</main>
<aside>
  <b>快速导航</b>
  <a href="#sec0">0 当前进度</a>
  <a href="#sec1">1 为什么做</a>
  <a href="#sec2">2 从文墨天机学到</a>
  <a href="#sec3">3 阶段规划</a>
  <a href="#sec4">4 盘面布局与数据契约</a>
  <a href="#sec5">5 任务看板</a>
  <a href="#sec6">6 决定与待定</a>
  <a href="#sec7">7 记忆锚点速查</a>
</aside>
</div>
<div class="foot">本页由 tools/build_plan_viewer.py 生成（静态内嵌，每 180 秒自动刷新）。源文件：__MDPATH__</div>
</body>
</html>"""


def fix_h2(match):
    content = match.group(2)
    num = re.match(r"\s*(\d+)", content)
    sid = "sec" + num.group(1) if num else "sec"
    return '<h2 id="%s">%s</h2>' % (sid, content)


def main():
    text = open(MD, encoding="utf-8").read()
    body = markdown.markdown(text, extensions=["tables", "fenced_code", "sane_lists"])
    body = re.sub(r"<h2([^>]*)>(.*?)</h2>", fix_h2, body, flags=re.S)
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    out = TEMPLATE.replace("__BODY__", body).replace("__NOW__", now).replace(
        "__MDPATH__", html.escape(MD)
    )
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(out)
    print("written: %s (%d chars)" % (OUT, len(out)))


if __name__ == "__main__":
    main()
