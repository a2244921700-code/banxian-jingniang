#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""kb_postfix.py —— 知识库收尾清洗（幂等，可反复跑）。

修正早期下载器留下的三类残渣：
  1. MediaWiki 语言转换标记 `-{乾}-` -> `乾`；
  2. 残留的表格/模板碎片行（孤立 `|-`、`|}`、`{{…}}` 单层）；
  3. 繁简误转的卦名：`干一`/`干兑`/`干为天`/`干卦`/`干金`/`干宫` 中的「干」应为「乾」。
     （「天干」「干支」「若干」「干戈」「干谒」等真「干」不动。）

用法：
  python kb_postfix.py --dir D:\\DSH_GuaShi\\知识库 [--dry-run]
"""

import argparse
import os
import re
import sys

FIX_PATTERNS = [
    (re.compile(r'-\{([^{}]*)\}-'), r'\1'),
]

# 明显指卦名的「干」，按上下文回收成「乾」
QIAN_PATTERNS = [
    (re.compile(r'干(?=[一二三四五六七八九]?(?:、|为|卦|金|宫|父|马|健|龙|宫卦|兑|离|震|巽|坎|艮|坤))'), '乾'),
    (re.compile(r'(?<=[坤兑离震巽坎艮])干'), '乾'),
    (re.compile(r'干(?=为天|为地|为泽)'), '乾'),
    (re.compile(r'(?<=[，。；：、\s])干(?=[，。；：、\s]?[兑离震巽坎艮坤])'), '乾'),
    (re.compile(r'干宫'), '乾宫'),
    (re.compile(r'干卦'), '乾卦'),
    (re.compile(r'干金'), '乾金'),
    (re.compile(r'干父'), '乾父'),
    (re.compile(r'干马'), '乾马'),
    (re.compile(r'干健'), '乾健'),
    (re.compile(r'干龙'), '乾龙'),
]
# 保护真正的「干」用法
SHIELD = ['天干', '干支', '若干', '干戈', '干谒', '干禄', '干求', '干犯', '干名', '相干', '干扰', '干城',
          '干将', '干宝', '干时', '干请', '干渎', '干黩', '干纪', '干政', '干与', '干证', '干连', '干碍',
          '干休', '干折', '干没', '干粮', '干枯', '干燥', '干湿', '干肉', '干鱼', '干草', '干柴', '干粮']

JUNK_LINE = re.compile(r'^\s*(\|-+\s*|\|\}\s*|\{\|\s*|<\/?[a-z]+[^>]*>)\s*$')


def fix_text(text):
    original = text
    for pattern, repl in FIX_PATTERNS:
        text = pattern.sub(repl, text)
    text = text.replace('-{', '').replace('}-', '')
    # 模板碎片：单层 {{...}}
    text = re.sub(r'\{\{[^{}]*\}\}', '', text)
    # 卦名「干」回收：先遮住真「干」用词
    shielded = {}
    for index, word in enumerate(SHIELD):
        holder = '\ue100' + str(index) + '\ue101'
        if word in text:
            shielded[holder] = word
            text = text.replace(word, holder)
    for pattern, repl in QIAN_PATTERNS:
        text = pattern.sub(repl, text)
    for holder, word in shielded.items():
        text = text.replace(holder, word)
    # 清掉孤立的结构残行
    lines = []
    for line in text.split('\n'):
        if JUNK_LINE.match(line):
            continue
        if '[' in line and ']' in line and re.search(r'\[\[|\]\]', line):
            line = line.replace('[[', '').replace(']]', '')
        lines.append(line)
    text = '\n'.join(lines)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text, text != original


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dir', required=True)
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    changed = []
    for root, _dirs, files in os.walk(args.dir):
        for name in files:
            if not name.endswith(('.md', '.txt')):
                continue
            path = os.path.join(root, name)
            with open(path, encoding='utf-8') as handle:
                text = handle.read()
            fixed, diff = fix_text(text)
            if not diff:
                continue
            changed.append((path, len(text), len(fixed)))
            if not args.dry_run:
                with open(path, 'w', encoding='utf-8', newline='\n') as handle:
                    handle.write(fixed)
    for path, before, after in changed:
        print('修正 %s：%d -> %d 字' % (path, before, after))
    print('共修正 %d 个文件%s' % (len(changed), '（dry-run，未写入）' if args.dry_run else ''))
    if not changed:
        print('无需修正。')


if __name__ == '__main__':
    main()
