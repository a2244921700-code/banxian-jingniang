# 知识库读取策略（设计）

> 目标：让 Agent **只读"能直接读成文字"的内容**，不依赖 PDF/影印件，也不假装读过。
> 本文件是策略说明；`tools/build_index.py`、`lib/tools-kb.js`、`AGENTS.md` 按此实现。
>
> **现状（2026-11-06）**：现代书的 PDF/OCR 资料已移出知识库，归档在
> `D:\DSH_GuaShi\资料归档\现代书籍（个人研习，未纳入知识库）`，不参与检索；
> 知识库现有 **13 科、131 份可读文本、约 590 万字符**，无 PDF。11–13 科（八字命理、紫微斗数、
> 七政四余）为「半仙·鲸娘」升级准备，书目见各科 `_目录.md`。

## 一、分层（Tier）

| 层级 | 文件类型 | `readable` | 进正文检索 | Agent 用法 |
|---|---|---|---|---|
| A 原文/编者整理 | `.md` / `.txt`，质量干净 | true | ✅ | 可直接 `gua_kb` 检索、`read` 通读、引原文（注明书名篇名） |
| B OCR 提取文本 | 由 PDF 提取的 `.md`（同名 PDF 存在时） | true | ✅（评分 ×0.9） | 可检索/摘要；**引用须注明"机器提取，须核原书"**，不得整章复述 |
| C 影印/扫描 PDF | `.pdf` | **false** | ❌ | 只能说"库中有影印本、无文本可检索"，**不臆测原文** |
| M 元文件 | `INDEX.md`、`_目录.md`、`_书目与使用说明.md` | true | ❌ | 仅导航/版本核对 |

当前知识库只有 A 类；B/C 类在归档区（见上）。若将来把某本现代书放回知识库：
同目录放同名 `.md` → 进 B 类可检索；只放 PDF → 进 C 类只登记。

## 二、机读清单：`知识库/_META/manifest.json`

由 `tools/build_index.py` 与 `INDEX.md` 一同生成，`gua_kb` 按 mtime 缓存读取：

```json
{
  "version": 1,
  "generatedAt": "2026-10-25T...",
  "tiers": { "text": "...", "ocr": "...", "pdf": "...", "meta": "..." },
  "entries": [
    { "path": "01-易经经传/周易-经文与十翼.md", "kind": "text", "readable": true,
      "quality": "clean", "chars": 48808, "title": "《周易》 · 原文", "source": "维基文库" },
    { "path": "11-现代书籍/大六壬探原-袁树珊.pdf", "kind": "pdf", "readable": false,
      "quality": "scan-only", "bytes": 5550653 }
  ],
  "stats": { "text": 50, "ocr": 0, "digest": 0, "pdf": 0, "meta": 10, "totalChars": 2351535 }
}
```

## 三、`gua_kb` 的检索行为

1. **只索引可读文本**（`.md`/`.txt`），跳过 M 元文件；PDF 永不进正文检索。
2. 命中带 `tier`（A/B）、`kind`、`quality`（`clean`/`editorial`/`ocr-uncorrected`），模型据此决定怎么引。
3. B 类（OCR）略降权（×0.9），同等相关时优先 A 类。
4. 参数 `includeOcr`（默认 true）：设 false 只查 A 类干净文本。
5. **无命中 / 只命中摘要 / `book` 指向只有 PDF 的书** 时：在 manifest 的 `readable:false` 条目里匹配，
   返回 `pdfOnly` 列表与提示「库中仅存影印本，无可检索文本，不能据其内容作答」。
6. 返回 `note` 汇总可检索字数、各层份数、OCR 提示（若有）。

## 四、Agent 行为规范（`AGENTS.md` 每次会话自动加载）

1. 回答优先引 A 类 `.md`/`.txt` 原文；引文注明书名+篇名/卷次。
2. 引 B 类 OCR 文本，必须注明「机器提取，未校对，须核原书」，且只作要点。
3. 只有 C 类 PDF 的书：如实说「无可检索文本」，不得凭书名或记忆编原文。
4. 不把归档区的 PDF/OCR 资料当作知识库内容引用。
5. 书目/版本问题先查 `INDEX.md` 与各科 `_目录.md`。

## 五、维护

- 新增/删除知识库文件后重跑：`python tools/build_index.py --root D:\DSH_GuaShi\知识库`
  （同时重建 `INDEX.md` 与 `_META/manifest.json`）。
- 要给某本只有 PDF 的书补文本：同目录放同名 `.md`，重跑 build_index，PDF 自动降为参考、`.md` 转为可检索。
- 归档区不进索引；如需恢复某书，移回知识库对应科目录后重跑 build_index。
