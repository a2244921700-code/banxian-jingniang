#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""fetch_daizhige.py —— 从殆知阁（daizhige.org）抓取古籍全文页，清洗为 Markdown。

殆知阁的书籍页是静态 HTML，正文在 <div class="markdown-content"> 里，
通常是若干 <p> 段落（部分书用 <br> 分行、表格存异体字/图例）。本脚本：

  1. 抓页面（带 UA、429/5xx 退避重试）；
  2. 取 markdown-content 容器，去 script/style；
  3. <p> → 段落，<h1..h6>/《…》独立段 → 标题，<li> → 列表，<table> → 行（单元格 ｜ 分隔）；
  4. 繁转简（保护「乾/著/鬥」等易误转字），输出带来源头的 Markdown；
  5. 超过 --split-size 时按标题边界拆成 -partN 文件。

用法（PowerShell / cmd）：
  python fetch_daizhige.py --url "https://daizhige.org/易藏/术数/渊海子平.html" ^
      --out "D:\\DSH_GuaShi\\知识库\\11-八字命理\\渊海子平-原文.md" --delay 2

  python fetch_daizhige.py --title "三命通会" --out "...\\三命通会-原文.md"
      （--title 默认拼到 易藏/术数/ 下）
"""

import argparse
import datetime
import html as html_mod
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = 'https://daizhige.org'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DSH-GuaShi-KB/1.0'
DEFAULT_DELAY = 2.0
_last = [0.0]

try:
    import zhconv
except Exception:
    zhconv = None

try:
    from lxml import html as LH
except Exception:
    LH = None

KEEP_GLYPHS = {'乾': '\ue000', '著': '\ue001', '鬥': '\ue002'}
TITLE_RE = re.compile(r'^《([^》]{1,40})》$')


def log(msg):
    sys.stdout.write(str(msg) + '\n')
    sys.stdout.flush()


def fetch(url, delay):
    for attempt in range(6):
        wait = delay - (time.time() - _last[0])
        if wait > 0:
            time.sleep(wait)
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9'})
            with urllib.request.urlopen(req, timeout=90) as resp:
                raw = resp.read()
            _last[0] = time.time()
            return raw.decode('utf-8', 'ignore')
        except urllib.error.HTTPError as exc:
            _last[0] = time.time()
            if exc.code == 404:
                raise RuntimeError('页面不存在：%s' % url)
            back = 15 * (attempt + 1)
            log('  [warn] HTTP %s，退避 %ss' % (exc.code, back))
            time.sleep(back)
        except Exception as exc:
            _last[0] = time.time()
            log('  [warn] %s，第 %s 次重试' % (exc, attempt + 1))
            time.sleep(8 * (attempt + 1))
    raise RuntimeError('抓取失败：%s' % url)


def norm(text):
    text = html_mod.unescape(text or '')
    text = text.replace('\u3000', ' ').replace('\xa0', ' ')
    text = re.sub(r'[ \t\r\f\v]+', ' ', text)
    return text.strip()


def clean_node(node):
    lines = []

    def emit(text):
        text = norm(text)
        if text:
            lines.append(text)

    def walk(el):
        tag = el.tag if isinstance(el.tag, str) else ''
        if tag in ('script', 'style', 'noscript'):
            return
        if tag in ('h1', 'h2', 'h3', 'h4', 'h5', 'h6'):
            text = norm(el.text_content())
            if text:
                level = min(int(tag[1]), 4)
                lines.append('')
                lines.append('#' * level + ' ' + text)
                lines.append('')
            return
        if tag == 'p':
            # <br> 转行
            for br in el.xpath('.//br'):
                br.tail = '\n' + (br.tail or '')
            text = norm(el.text_content().replace('\n', ' '))
            if not text:
                return
            m = TITLE_RE.match(text)
            if m and len(text) <= 42:
                lines.append('')
                lines.append('### ' + text)
                lines.append('')
            else:
                lines.append(text)
            return
        if tag == 'li':
            text = norm(el.text_content())
            if text:
                lines.append('- ' + text)
            return
        if tag == 'table':
            for tr in el.xpath('.//tr'):
                cells = [norm(c.text_content()) for c in tr.xpath('./td|./th')]
                cells = [c for c in cells if c]
                if cells:
                    lines.append(' ｜ '.join(cells))
            return
        if tag in ('div', 'section', 'article', 'blockquote', 'ul', 'ol', 'tbody', 'thead', 'center'):
            for child in el:
                walk(child)
            # 纯文本 div
            if len(el) == 0:
                emit(el.text_content())
            return
        # 其它标签：直接输出文本
        if len(el) == 0:
            emit(el.text_content())

    for child in node:
        walk(child)
    return lines


def simplify(text):
    if zhconv is None:
        return text, False
    try:
        protected = text
        for glyph, holder in KEEP_GLYPHS.items():
            protected = protected.replace(glyph, holder)
        converted = zhconv.convert(protected, 'zh-cn')
        for glyph, holder in KEEP_GLYPHS.items():
            converted = converted.replace(holder, glyph)
        return converted, True
    except Exception:
        return text, False


def build_markdown(title, url, lines, canonical_title):
    today = datetime.date.today().isoformat()
    head = [
        '# 《%s》 · 原文' % title,
        '',
        '- 来源：殆知阁 https://daizhige.org%s' % canonical_title,
        '- 原页：%s' % url,
        '- 抓取日期：%s' % today,
        '- 版权：古籍原文属公有领域；殆知阁转录整理本仅个人研习用，不商用。',
        '- 整理：tools/fetch_daizhige.py 抓取清洗（分段、表格转行、机器繁转简，未改字句）；'
        '异体字/通假字保留原貌，引用请核原书。',
        '',
    ]
    body = '\n'.join(lines).strip()
    body = re.sub(r'\n{3,}', '\n\n', body)
    return '\n'.join(head) + '\n' + body + '\n'


def rewrite(text, split_size):
    if len(text) <= split_size:
        return [text]
    parts = []
    head, sep, rest = text.partition('\n\n')
    # 按标题边界切
    chunks = re.split(r'\n(?=### )', rest)
    current = []
    size = len(head)
    for chunk in chunks:
        if size + len(chunk) > split_size and current:
            parts.append(head + '\n\n' + '\n'.join(current))
            current = []
            size = len(head)
        current.append(chunk)
        size += len(chunk)
    if current:
        parts.append(head + '\n\n' + '\n'.join(current))
    return parts


def write_out(path, text, split_size):
    chunks = rewrite(text, split_size)
    if len(chunks) == 1:
        with open(path, 'w', encoding='utf-8', newline='\n') as fh:
            fh.write(chunks[0])
        return [path]
    base, ext = os.path.splitext(path)
    files = []
    for idx, chunk in enumerate(chunks, 1):
        p = '%s-part%d%s' % (base, idx, ext or '.md')
        with open(p, 'w', encoding='utf-8', newline='\n') as fh:
            fh.write(chunk)
        files.append(p)
    return files


def main():
    parser = argparse.ArgumentParser(description='从殆知阁抓取古籍全文并整理为 Markdown')
    parser.add_argument('--url', help='书籍页完整 URL')
    parser.add_argument('--title', help='书名；与 --url 二选一，默认拼到 易藏/术数/ 下')
    parser.add_argument('--out', required=True)
    parser.add_argument('--delay', type=float, default=DEFAULT_DELAY)
    parser.add_argument('--split-size', type=int, default=380000)
    parser.add_argument('--no-simplify', action='store_true')
    args = parser.parse_args()

    if args.url:
        url = args.url
    elif args.title:
        url = BASE + '/' + urllib.parse.quote('易藏/术数') + '/' + urllib.parse.quote(args.title) + '.html'
    else:
        raise SystemExit('需要 --url 或 --title')
    canonical = urllib.parse.urlparse(url).path

    log('抓取：%s' % url)
    raw = fetch(url, max(args.delay, 1.0))
    doc = LH.fromstring(raw)
    for bad in doc.xpath('//script|//style|//noscript'):
        bad.drop_tree()
    nodes = doc.xpath('//*[contains(@class,"markdown-content")]')
    if not nodes:
        raise RuntimeError('没有找到 markdown-content 正文容器')
    lines = []
    for node in nodes:
        lines.extend(clean_node(node))
    title = args.title
    if not title:
        t = doc.xpath('//title/text()')
        title = norm(t[0]).replace(' - 殆知阁', '') if t else '佚名'
    text = build_markdown(title, url, lines, canonical)
    if not args.no_simplify:
        text, ok = simplify(text)
        if not ok:
            log('  [warn] 未安装 zhconv，输出保留繁体')
    files = write_out(args.out, text, args.split_size)
    for p in files:
        chars = len(open(p, encoding='utf-8').read())
        log('写出：%s（%d 字符）' % (p, chars))
    log('原始字符数：%d' % len(text))


if __name__ == '__main__':
    main()
