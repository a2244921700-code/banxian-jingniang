#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""fetch_wikisource.py —— 从中文维基文库抓取古籍正文，清洗并整理成 Markdown。

用法（PowerShell / cmd 均可，路径含空格要加引号）：

  python fetch_wikisource.py --title "梅花易數" --out "D:\\DSH_GuaShi\\知识库\\02-梅花易数\\梅花易数-原文.md"

参数：
  --title       维基文库页面标题（简体/繁体均可，自动跟随重定向）
  --out         输出文件（绝对路径，UTF-8 无 BOM）
  --delay       请求间隔秒，默认 1.5（遇到 429 自动退避重试）
  --no-subpages 不抓子页面
  --max-pages   最多抓多少个子页面（调试用）
  --no-simplify 不做繁转简（默认转简体，原文为繁体，转换不改字句）
  --split-size  超过该字符数则按 ## 标题拆分为 -part1/2/3 文件，默认 400000
  --dry-run     只列出将抓取的页面，不写文件

设计要点：
  * 统一 User-Agent；请求间 sleep；429/5xx 指数退避，最多 4 次。
  * 用 action=parse 取渲染后 HTML（模板已展开），再用 lxml 清洗 + 正则转文本，
    保留标题层级、列表、表格（单元格用 ｜ 分隔）。
  * 父页面与子页面内容高度重复时（父页面已含全书），只保留父页面，避免重复。
  * 输出头注明来源、抓取日期与版权说明；正文不改字句。
"""

import argparse
import datetime
import html as html_mod
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

API = 'https://zh.wikisource.org/w/api.php'
UA = 'DSH-GuaShi-KB/1.0 (local divination knowledge base builder; python-urllib)'
DELAY = 1.5
_last_request = [0.0]

try:
    import zhconv  # 繁转简
except Exception:  # pragma: no cover
    zhconv = None

try:
    import lxml.html  # 清洗 HTML
except Exception:  # pragma: no cover
    lxml = None


def log(msg):
    sys.stdout.write(str(msg) + '\n')
    sys.stdout.flush()


def api(params):
    params = dict(params)
    params.setdefault('format', 'json')
    params.setdefault('formatversion', '2')
    url = API + '?' + urllib.parse.urlencode(params)
    for attempt in range(5):
        wait = DELAY - (time.time() - _last_request[0])
        if wait > 0:
            time.sleep(wait)
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': UA,
                'Accept': 'application/json',
                'Accept-Language': 'zh-Hant,zh;q=0.9',
            })
            with urllib.request.urlopen(req, timeout=90) as resp:
                raw = resp.read()
            _last_request[0] = time.time()
            return json.loads(raw.decode('utf-8'))
        except urllib.error.HTTPError as exc:
            _last_request[0] = time.time()
            if exc.code == 404:
                return None
            if exc.code in (429, 503):
                back = 20 * (attempt + 1)
                log('  [warn] HTTP %s，退避 %ss 后重试（%s）' % (exc.code, back, params.get('page') or params.get('apprefix')))
                time.sleep(back)
                continue
            log('  [warn] HTTP %s，第 %s 次重试' % (exc.code, attempt + 1))
            time.sleep(5 * (attempt + 1))
        except Exception as exc:  # 网络抖动
            _last_request[0] = time.time()
            log('  [warn] %s，第 %s 次重试' % (exc, attempt + 1))
            time.sleep(5 * (attempt + 1))
    raise RuntimeError('请求失败：%s' % url)


def norm_text(text):
    text = html_mod.unescape(text or '')
    text = text.replace('\u3000', ' ').replace('\u00a0', ' ')
    text = re.sub(r'[ \t\r\f\v]+', ' ', text)
    return text.strip()


def clean_html(piece):
    if not piece:
        return ''
    if lxml is not None:
        try:
            doc = lxml.html.fromstring(piece)
            drop_xpath = (
                '//script | //style | //noscript | //link | //meta | '
                "//*[contains(@class,'mw-editsection')] | "
                "//*[contains(@class,'navbox')] | "
                "//*[contains(@class,'sistersitebox')] | "
                "//*[contains(@class,'ws-noexport')] | "
                "//*[contains(@class,'noprint')] | "
                "//*[contains(@class,'printfooter')] | "
                "//*[contains(@class,'catlinks')] | "
                "//table[contains(@class,'ws-header')] | "
                "//div[contains(@class,'ws-header')] | "
                "//div[contains(@class,'header_notes')]"
            )
            for el in doc.xpath(drop_xpath):
                el.drop_tree()
            piece = lxml.html.tostring(doc, encoding='unicode')
        except Exception:
            pass

    # 标题 → @@Hn@@
    def heading(match):
        level = min(int(match.group(1)), 4)
        inner = re.sub(r'<[^>]+>', '', match.group(2))
        return '\n@@H%d@@ %s\n' % (level, norm_text(inner))

    s = re.sub(r'<h([1-6])[^>]*>(.*?)</h\1\s*>', heading, piece, flags=re.S | re.I)
    s = re.sub(r'<li[^>]*>', '\n@@LI@@ ', s, flags=re.I)
    s = re.sub(r'</li\s*>', '\n', s, flags=re.I)
    s = re.sub(r'<br\s*/?>', '\n', s, flags=re.I)
    s = re.sub(r'<tr[^>]*>', '\n', s, flags=re.I)
    s = re.sub(r'<t[dh][^>]*>', ' ｜ ', s, flags=re.I)
    s = re.sub(r'<(p|div|blockquote|dd|dt|pre|section|center|ul|ol|table|h[1-6]|figure|caption)[^>]*>', '\n', s, flags=re.I)
    s = re.sub(r'</(p|div|blockquote|dd|dt|pre|section|center|ul|ol|table|h[1-6]|figure|caption)\s*>', '\n', s, flags=re.I)
    s = re.sub(r'<[^>]+>', '', s)

    lines = []
    nav_line = re.compile(
        r'^(上一[卷章篇]|下一[卷章篇]|返回目[录錄]|目[录錄]|跳转[至到]|跳轉[至到]|'
        r'[←↑→]\s*.*|.*[←↑→]$|编辑|編輯|檢索|检索|分类[:：]|分類[:：]|'
        r'本作品.*|Public domain|CC BY-SA.*|维基文库|維基文庫.*|'
        r'^\s*[｜|\-—\s]*$)$'
    )
    for raw in s.split('\n'):
        line = norm_text(raw)
        if not line:
            continue
        kind = ''
        if line.startswith('@@H'):
            m = re.match(r'@@H(\d)@@\s*(.*)$', line)
            if m:
                level = min(int(m.group(1)), 4)
                text = m.group(2).strip()
                if not text:
                    continue
                lines.append('#' * level + ' ' + text)
            continue
        if line.startswith('@@LI@@'):
            line = '- ' + line[len('@@LI@@'):].strip()
        if nav_line.match(line):
            continue
        # 维基文库 Header 模板渲染出的元数据表格行：单格且是作者/书名等，丢弃
        if '｜' in line and re.search(r'(作者|撰|輯|辑|校對|校对|來源|来源|朝代|年代|卷數|卷数|書名|书名)', line) and line.count('｜') <= 1:
            continue
        if re.fullmatch(r'｜\s*[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]{1,12}\s*', line):
            continue
        lines.append(line)

    # 合并连续空段、去掉标题前后多余空行
    out = []
    for line in lines:
        if not line:
            continue
        if out and line.startswith('#') and out[-1] == '':
            out.pop()
        out.append(line)
        if line.startswith('#'):
            out.append('')
    text = '\n'.join(out)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def natural_key(title):
    base = title.rsplit('/', 1)[-1]
    base = base.replace('（', '(').replace('）', ')')
    m = re.search(r'第?([零〇一二三四五六七八九十百]+)[卷章篇回]?', base)
    if m:
        num = chinese_number(m.group(1))
        if num is not None:
            return (0, num, base)
    m = re.match(r'(\d+)[^\d]*$', base)
    if m:
        return (0, int(m.group(1)), base)
    m = re.search(r'(\d+)', base)
    if m:
        return (0, int(m.group(1)), base)
    return (1, 0, base)


CN_NUM = {'零': 0, '〇': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5,
          '六': 6, '七': 7, '八': 8, '九': 9}


def chinese_number(text):
    unit = 0
    total = 0
    current = 0
    for ch in text:
        if ch in CN_NUM:
            current = CN_NUM[ch]
        elif ch == '十':
            unit = 10
            if current == 0:
                current = 1
            total += current * unit
            current = 0
        elif ch == '百':
            total += (current or 1) * 100
            current = 0
        elif ch == '千':
            total += (current or 1) * 1000
            current = 0
        else:
            return None
    return total + current


def get_page_html(title):
    # uselang=zh-hant + Accept-Language: zh-Hant —— 强制取繁体原文。
    # 若取到简体渲染，MediaWiki 语言转换会把「乾一」误转成「干一」，卦名就坏了。
    data = api({'action': 'parse', 'page': title, 'prop': 'text', 'redirects': '1', 'uselang': 'zh-hant'})
    if not data or 'parse' not in data:
        return None
    return data['parse']


def list_subpages(title):
    pages = []
    cont = {}
    for _ in range(40):
        params = {'action': 'query', 'list': 'allpages', 'apprefix': title + '/', 'aplimit': '100'}
        params.update(cont)
        data = api(params)
        if not data or 'query' not in data:
            break
        pages.extend(item['title'] for item in data['query'].get('allpages', []))
        cont = data.get('continue') or {}
        if not cont.get('apcontinue'):
            break
        cont = {'apcontinue': cont['apcontinue']}
    return pages


def fetch_book(title, want_subpages=True, max_pages=None):
    """返回 [(section_title or None, markdown_text)] 与元信息。"""
    root = get_page_html(title)
    if root is None:
        raise RuntimeError('页面不存在或无法解析：%s' % title)
    canonical = root.get('title', title)
    root_text = clean_html(root.get('text', ''))
    sections = [(None, root_text)]
    meta = {'title': canonical, 'subpages': [], 'skipped_subpages': False}

    if not want_subpages:
        return sections, meta
    subpages = sorted(list_subpages(canonical), key=natural_key)
    if max_pages:
        subpages = subpages[:max_pages]
    meta['subpages'] = subpages
    if not subpages:
        return sections, meta

    # 父页面已含全书时跳过子页面（长度 + 内容包含启发式）
    if len(root_text) > 20000:
        skip = True
        for page in subpages[:3]:
            parsed = get_page_html(page)
            if not parsed:
                skip = False
                break
            sub_text = clean_html(parsed.get('text', '')).replace('\n', '')
            probe = re.sub(r'\s', '', sub_text)[:80]
            if probe and probe not in re.sub(r'\s', '', root_text):
                skip = False
                break
        if skip:
            meta['skipped_subpages'] = True
            log('  父页面已含全书（%d 字符），跳过 %d 个子页面' % (len(root_text), len(subpages)))
            return sections, meta

    for page in subpages:
        log('  · %s' % page)
        parsed = get_page_html(page)
        if not parsed:
            log('    (取不到，跳过)')
            continue
        text = clean_html(parsed.get('text', ''))
        if not text:
            continue
        short = page[len(canonical) + 1:]
        sections.append((short, text))
        if max_pages and len(sections) - 1 >= max_pages:
            break
    return sections, meta


# 繁转简时要保持原字形的字：这些字在术数文本里几乎总是卦名/术语：
#   乾（卦名，误转为「干」）、著（著作，误转为「着」）。
# 先换成私用区占位符，转完再换回，避免「乾一、兑二」被转成「干一、兑二」。
KEEP_GLYPHS = {'乾': '\ue000', '著': '\ue001', '鬥': '\ue002'}


# ── 批量模式：一次 API 请求取多页原始 wikitext ────────────────────────────────
# action=query&prop=revisions 一次可拿 40 页正文，70 页只需两三个请求。
# 代价是拿到的是 wikitext 而非渲染 HTML，需要本地清洗模板/链接/表格标记。

# 这些模板的参数里装的是正文，不能当模板删掉：
#   四库全书本：SK notes（本义/程传/集说/通释的双行注）、SK anchor（经文大字）、YL（年号）
#   周易正義：+（卦体）、*（经文）、批（孔疏）
# 其余模板（header2、PD-old、SKchar、导航盒等）照旧丢弃。
KEEP_TEMPLATES = {
    'SK notes', 'SK anchor', 'SKnote', 'SK note', 'YL', '+', '*', '批',
    'SKQS', 'SK qs', '另', '!',
}


def split_template_params(inner):
    """按顶层的 | 切模板参数（不吃 [[a|b]] 与嵌套模板里的竖线）。"""
    params = []
    depth_braces = 0
    depth_brackets = 0
    current = []
    i = 0
    while i < len(inner):
        two = inner[i:i + 2]
        if two == '{{':
            depth_braces += 1
            current.append(two)
            i += 2
            continue
        if two == '}}':
            depth_braces = max(0, depth_braces - 1)
            current.append(two)
            i += 2
            continue
        if two == '[[':
            depth_brackets += 1
            current.append(two)
            i += 2
            continue
        if two == ']]':
            depth_brackets = max(0, depth_brackets - 1)
            current.append(two)
            i += 2
            continue
        ch = inner[i]
        if ch == '|' and depth_braces == 0 and depth_brackets == 0:
            params.append(''.join(current))
            current = []
            i += 1
            continue
        current.append(ch)
        i += 1
    params.append(''.join(current))
    return params


def expand_templates(text):
    """把白名单模板展开成参数正文，其余模板整块丢弃（可处理嵌套）。"""
    out = []
    i = 0
    length = len(text)
    while i < length:
        if text[i:i + 2] != '{{':
            out.append(text[i])
            i += 1
            continue
        depth = 0
        j = i
        while j < length:
            if text[j:j + 2] == '{{':
                depth += 1
                j += 2
                continue
            if text[j:j + 2] == '}}':
                depth -= 1
                j += 2
                if depth == 0:
                    break
                continue
            j += 1
        if depth != 0:
            # 未闭合，原样保留余下文本
            out.append(text[i:])
            break
        inner = text[i + 2:j - 2]
        params = split_template_params(inner)
        name = params[0].strip()
        keep = name in KEEP_TEMPLATES
        if keep:
            values = []
            for index, param in enumerate(params[1:]):
                stripped = param.strip()
                if not stripped:
                    continue
                # {{另|甲|乙}} 之类：取第一个参数（正字），第二个是异体
                if name in ('另', '!') and index > 0:
                    continue
                # 具名参数 / NUMBERED=值
                named = re.match(r'^[A-Za-z_][\w-]*\s*=\s*(.*)$', stripped, flags=re.S)
                if named:
                    stripped = named.group(1).strip()
                if re.fullmatch(r'\d+', stripped):
                    continue  # 位置编号之类的空参
                values.append(stripped)
            body = ' '.join(values)
            out.append(expand_templates(body))
        i = j
    return ''.join(out)


def clean_wikitext(text):
    s = text
    # 注释
    s = re.sub(r'<!--.*?-->', '', s, flags=re.S)
    # 语言转换标记：-{乾}- / -{A|云}- / -{T|标题}- / -{zh-hans:乾;zh-hant:乾}-
    def lang_variant(match):
        body = match.group(1)
        if body.startswith('T|') or body.startswith('t|'):
            return ''
        if '|' in body and ':' not in body:
            return body.split('|')[-1]
        if ':' in body:
            first = body.split(';')[0]
            return first.split(':', 1)[-1]
        return body

    s = re.sub(r'-\{(.*?)\}-', lang_variant, s, flags=re.S)
    # <ref> 与 <ref name=x/>
    s = re.sub(r'<ref[^>]*>.*?</ref\s*>', '', s, flags=re.S | re.I)
    s = re.sub(r'<ref[^>]*/\s*>', '', s, flags=re.I)
    # 模板：白名单展开（四库本的本义/注疏/经文就装在这些模板参数里），其余剥除
    s = expand_templates(s)
    # 分类/文件链接整段删
    for _ in range(12):
        new = re.sub(r'\{\{[^{}]*\}\}', '', s, flags=re.S)
        if new == s:
            break
        s = new
    # 分类/文件链接整段删
    s = re.sub(r'\[\[(Category|分類|File|Image|檔案|文件)\s*:[^\]]*\]\]', '', s, flags=re.I)
    # 内链：[[目标|显示]] -> 显示；[[目标]] -> 目标
    s = re.sub(r'\[\[[^\]|]*\|([^\]]*)\]\]', r'\1', s)
    s = re.sub(r'\[\[([^\]]+)\]\]', r'\1', s)
    # 外链 [http://x 文本] -> 文本
    s = re.sub(r'\[https?://[^\s\]]+\s*([^\]]*)\]', r'\1', s)
    # <br> 换行，其余标签剥掉
    s = re.sub(r'<br\s*/?>', '\n', s, flags=re.I)
    s = re.sub(r'<[^>]+>', '', s)
    # 魔术字
    s = re.sub(r'__[A-Z_]+__', '', s)
    # 表格：{| ... |} 的行转成「单元格 ｜ 单元格」
    out = []
    for raw in s.split('\n'):
        line = raw.rstrip()
        if re.match(r'^\s*\{\|', line) or re.match(r'^\s*\|\}', line) or re.match(r'^\s*\|-', line):
            continue
        if re.match(r'^\s*\|[+}]', line) or re.match(r'^\s*!', line):
            cells = re.split(r'\s*[|!]{2}\s*', line.lstrip('|!+} '))
            cleaned = []
            for cell in cells:
                cell = cell.strip()
                if '|' in cell:
                    cell = cell.split('|', 1)[1].strip()
                if cell:
                    cleaned.append(cell)
            if cleaned:
                out.append(' ｜ '.join(cleaned))
            continue
        out.append(line)
    s = '\n'.join(out)
    # 列表标记（必须在标题转换之前做：wikitext 的 # 是列表序号，
    # 若放在标题转换之后，会把刚生成的「## 标题」误吃成「- 标题」）。
    # 古籍正文里列表多是经文分行，直接去掉行首的 * # ; : 标记，保留整行文字，
    # 既不会出现「- #初九」这种残渣，也不会破坏经文。
    s = re.sub(r'^[*#;:]+\s*', '', s, flags=re.M)
    # 标题
    def heading(match):
        level = min(len(match.group(1)), 4)
        return '\n' + '#' * level + ' ' + match.group(2).strip() + '\n'

    s = re.sub(r'^(={1,6})\s*(.*?)\s*=+\s*$', heading, s, flags=re.M)
    # 粗斜体
    s = s.replace("'''", '**').replace("''", '*')
    # 剩余模板/表格碎片
    s = re.sub(r'\{\{|\}\}', '', s)
    s = re.sub(r'^[\s|!]+$', '', s, flags=re.M)
    # 导航行
    nav = re.compile(r'^(上一[卷章篇]|下一[卷章篇]|返回目[录錄]|目[录錄]|跳转[至到]|跳轉[至到]|编辑|編輯|分類[:：]|分类[:：]|维基文库|維基文庫).*$')
    lines = []
    for raw in s.split('\n'):
        line = norm_text(raw)
        if not line:
            continue
        if nav.match(line):
            continue
        lines.append(line)
    text = '\n'.join(lines)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def api_raw_pages(titles):
    """一次拿多页原始 wikitext，返回 {最终标题: 正文}。"""
    data = api({
        'action': 'query',
        'prop': 'revisions',
        'rvprop': 'content',
        'rvslots': 'main',
        'redirects': '1',
        'titles': '|'.join(titles),
    })
    result = {}
    if not data or 'query' not in data:
        return result
    for page in data['query'].get('pages', []):
        title = page.get('title')
        revisions = page.get('revisions') or []
        if not revisions:
            continue
        content = None
        slots = revisions[0].get('slots')
        if isinstance(slots, dict):
            content = (slots.get('main') or {}).get('content')
        if content is None:
            content = revisions[0].get('*')
        if content is not None:
            result[title] = content
    return result


def fetch_book_bulk(title, want_subpages=True, max_pages=None, batch_size=60, order_list=None):
    """批量模式：Special:Export 一把取回全书 wikitext（含子页），本地清洗。

    比逐页 api.php 宽松得多：73 页的《周易》通常 3 个请求内拿完。
    order_list 给出子页顺序（如六十四卦卦序）；缺省按题名自然序。
    """
    canonical, root_content = resolve_redirect_bulk(title)
    if root_content is None:
        raise RuntimeError('页面不存在或取不到：%s' % title)
    meta = {'title': canonical, 'subpages': [], 'skipped_subpages': False, 'mode': 'bulk-export'}
    if not want_subpages:
        return [(None, clean_wikitext(root_content))], meta

    subpages = []
    try:
        subpages = sorted(list_subpages(canonical), key=natural_key)
    except Exception as exc:
        log('  [warn] allpages 失败（%s），改从父页面链接中提取子页' % exc)
        subpages = subpages_from_wikitext(canonical, root_content)
    if order_list:
        rank = {name: index for index, name in enumerate(order_list)}
        subpages.sort(key=lambda page: (rank.get(page.split('/')[-1], len(rank)), natural_key(page)))
    # 四庫全書本常有一个 /全覽 子页，是全书重复拼接，跳过以免内容翻倍
    before = len(subpages)
    subpages = [page for page in subpages if page.split('/')[-1].strip() != '全覽']
    if len(subpages) != before:
        log('  · 跳过 %d 个「全覽」重复子页' % (before - len(subpages)))
    if max_pages:
        subpages = subpages[:max_pages]
    meta['subpages'] = subpages
    if not subpages:
        return [(None, clean_wikitext(root_content))], meta

    raw = {}
    batches = [subpages[i:i + batch_size] for i in range(0, len(subpages), batch_size)]
    for index, batch in enumerate(batches, 1):
        data = export_pages(batch)
        if not data:
            log('  [warn] 第 %d 批没有返回内容' % index)
        raw.update(data)
        if len(batches) > 1:
            log('  · 批量取回第 %d/%d 批（%d 页）' % (index, len(batches), len(batch)))

    # 子页若是重定向（例如「周易/序卦」→「易傳/序卦」），跟到真页面
    for sub in list(raw.keys()):
        content = raw.get(sub) or ''
        match = REDIRECT_RE.match(content.strip())
        if match:
            target = match.group(1).split('|')[0].strip()
            resolved = export_pages([target])
            if target in resolved:
                raw[sub] = resolved[target]
                log('    · %s 重定向到 %s' % (sub.split('/')[-1], target))

    sections = []
    root_clean = clean_wikitext(root_content)
    # 父页面若只是目录（很短且含子页链接），仍保留其序/凡例部分
    if root_clean:
        sections.append((None, root_clean))
    for sub in subpages:
        content = raw.get(sub)
        if content is None:
            log('    (批量结果里没有 %s，跳过)' % sub)
            continue
        text = clean_wikitext(content)
        if text:
            sections.append((sub[len(canonical) + 1:], text))
    return sections, meta


def fetch_book_via_parse(title, want_subpages=True, max_pages=None):
    return fetch_book(title, want_subpages, max_pages)


def export_pages(titles):
    """用 Special:Export 一次 POST 取多页原始 wikitext（比 api.php 宽松，且一次多页）。

    返回 {标题: 正文}。不跟随重定向，调用方自行处理「#REDIRECT」。
    """
    if not titles:
        return {}
    body = urllib.parse.urlencode({
        'pages': '\n'.join(titles),
        'curonly': '1',
        'wpDownload': '1',
    }).encode('utf-8')
    url = 'https://zh.wikisource.org/wiki/Special:Export'
    for attempt in range(5):
        wait = DELAY - (time.time() - _last_request[0])
        if wait > 0:
            time.sleep(wait)
        try:
            req = urllib.request.Request(url, data=body, headers={
                'User-Agent': UA,
                'Content-Type': 'application/x-www-form-urlencoded',
            })
            with urllib.request.urlopen(req, timeout=120) as resp:
                raw = resp.read()
            _last_request[0] = time.time()
            return parse_export_xml(raw)
        except urllib.error.HTTPError as exc:
            _last_request[0] = time.time()
            if exc.code in (429, 503):
                back = 20 * (attempt + 1)
                log('  [warn] Export HTTP %s，退避 %ss' % (exc.code, back))
                time.sleep(back)
                continue
            raise RuntimeError('Export 请求失败：HTTP %s' % exc.code)
        except Exception as exc:
            _last_request[0] = time.time()
            log('  [warn] Export %s，第 %s 次重试' % (exc, attempt + 1))
            time.sleep(5 * (attempt + 1))
    raise RuntimeError('Export 请求失败：%s' % ('、'.join(titles[:3])))


def parse_export_xml(raw):
    import xml.etree.ElementTree as ET
    ns = '{http://www.mediawiki.org/xml/export-0.11/}'
    result = {}
    root = ET.fromstring(raw)
    for page in root.findall(ns + 'page'):
        title_el = page.find(ns + 'title')
        rev = page.find(ns + 'revision')
        if title_el is None or rev is None:
            continue
        text_el = rev.find(ns + 'text')
        if text_el is None or text_el.text is None:
            continue
        result[title_el.text] = text_el.text
    return result


REDIRECT_RE = re.compile(r'^#(?:REDIRECT|重定向)\s*\[\[([^\]]+)\]\]', re.I)


def resolve_redirect_bulk(title, depth=0):
    """Export 不跟随重定向：若首页是 #REDIRECT，跟到真页面。"""
    content = export_pages([title]).get(title)
    if content is None or depth >= 3:
        return title, content
    match = REDIRECT_RE.match(content.strip())
    if match:
        target = match.group(1).split('|')[0].strip()
        return resolve_redirect_bulk(target, depth + 1)
    return title, content


def subpages_from_wikitext(canonical, root_text):
    """从父页面 wikitext 里找子页面链接，作为 allpages 的备份。"""
    found = set()
    for match in re.finditer(r'\[\[(?:%s)?(/[^\]|#]+)' % re.escape(canonical), root_text):
        suffix = match.group(1).strip('/')
        if suffix:
            found.add(canonical + '/' + suffix)
    return sorted(found, key=natural_key)


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


def demote_headings(text):
    """把正文里已有的 ## / ### 标题降一级，避免与「## 子页面名」混淆。"""
    def repl(match):
        level = min(len(match.group(1)) + 1, 6)
        return '#' * level + ' ' + match.group(2).strip()

    return re.sub(r'^(#{2,5})\s+(.+?)\s*$', repl, text, flags=re.M)


def build_markdown(title, sections, meta, source_title):
    today = datetime.date.today().isoformat()
    head = [
        '# 《%s》 · 原文' % title,
        '',
        '- 来源：中文维基文库 https://zh.wikisource.org/wiki/%s' % urllib.parse.quote(source_title.replace(' ', '_')),
        '- 抓取日期：%s' % today,
        '- 底本说明：维基文库转录本（原书为繁体）；本文经机器繁转简，未改字句。引用请以维基文库繁体底本复核。',
        '- 版权：古籍原文属公有领域；维基文库转录部分依 CC BY-SA 4.0 使用。仅作占筮研习之用。',
        '- 整理：tools/fetch_wikisource.py 自动抓取清洗，章节标题据原书卷章。',
        '',
    ]
    body = []
    for section_title, text in sections:
        if not text:
            continue
        if section_title:
            body.append('')
            body.append('## %s' % section_title)
            body.append('')
            text = demote_headings(text)
        body.append(text)
    md = '\n'.join(head) + '\n' + '\n'.join(body).strip() + '\n'
    return re.sub(r'\n{3,}', '\n\n', md)


def write_output(out_path, md, split_size):
    base, ext = os.path.splitext(out_path)
    ext = ext or '.md'
    if len(md) <= split_size:
        os.makedirs(os.path.dirname(out_path) or '.', exist_ok=True)
        with open(out_path, 'w', encoding='utf-8', newline='\n') as fh:
            fh.write(md)
        return [out_path]
    # 按 ## 标题拆分
    parts = []
    head, rest = md.split('\n## ', 1)
    chunks = ['## ' + part for part in rest.split('\n## ')]
    current = []
    size = len(head)
    for chunk in chunks:
        if size + len(chunk) > split_size and current:
            parts.append('\n'.join(current))
            current = []
            size = len(head)
        current.append(chunk)
        size += len(chunk)
    if current:
        parts.append('\n'.join(current))
    files = []
    for idx, part in enumerate(parts, 1):
        path = '%s-part%d%s' % (base, idx, ext)
        with open(path, 'w', encoding='utf-8', newline='\n') as fh:
            fh.write(head + '\n' + part + '\n')
        files.append(path)
    return files


def main():
    parser = argparse.ArgumentParser(description='从中文维基文库抓取古籍并整理为 Markdown')
    parser.add_argument('--title', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--delay', type=float, default=1.5)
    parser.add_argument('--no-subpages', action='store_true')
    parser.add_argument('--max-pages', type=int, default=None)
    parser.add_argument('--no-simplify', action='store_true')
    parser.add_argument('--split-size', type=int, default=400000)
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--bulk', action='store_true', help='批量取原始 wikitext（省请求，适合多子页大书）')
    parser.add_argument('--batch-size', type=int, default=60)
    parser.add_argument('--order', default=None, help='子页面顺序，逗号分隔的题名末段，如六十四卦卦序')
    args = parser.parse_args()

    global DELAY
    DELAY = max(args.delay, 0.5)

    order_list = [item.strip() for item in args.order.split(',') if item.strip()] if args.order else None
    if args.bulk:
        sections, meta = fetch_book_bulk(
            args.title, not args.no_subpages, args.max_pages, args.batch_size, order_list
        )
    else:
        sections, meta = fetch_book(args.title, not args.no_subpages, args.max_pages)
    joined = '\n\n'.join(text for _, text in sections if text)
    log('页面：%s；章节 %d；原始字符数 %d%s' % (
        meta['title'], len(sections), len(joined),
        '（子页面已跳过）' if meta.get('skipped_subpages') else ''))
    if args.dry_run:
        log('子页面：%s' % ('、'.join(meta['subpages'][:50]) or '无'))
        return

    md = build_markdown(meta['title'], sections, meta, meta['title'])
    if not args.no_simplify:
        md, ok = simplify(md)
        if not ok:
            log('  [warn] 未安装 zhconv，输出保留繁体（pip install zhconv 可转简体）')
    files = write_output(args.out, md, args.split_size)
    for path in files:
        size = os.path.getsize(path)
        with open(path, encoding='utf-8') as fh:
            chars = len(fh.read())
        log('写出：%s（%d 字符，%d 字节）' % (path, chars, size))
    log(json.dumps({'ok': True, 'files': files, 'chars': len(md)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
