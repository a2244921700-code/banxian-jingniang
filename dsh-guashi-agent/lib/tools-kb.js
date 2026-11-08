// gua_kb —— 古籍知识库检索（文本优先）。
//
// 知识库目录里可能同时有：可直接读取的 .md/.txt、由 PDF 提取的 OCR 文本、以及只有
// 影印扫描的 PDF。设计见 docs/KNOWLEDGE-POLICY.md：**只把「能直接读成文字」的文件
// 放进正文检索**；PDF 只作为书目登记，命中不到时告诉模型「库中只有影印本」，
// 避免模型凭书名或记忆编原文。
//
// 分层来自 `知识库/_META/manifest.json`（tools/build_index.py 生成）：
//   text     A 类：原文/编者整理，优先
//   digest   B 类：编者摘要（自己的话）
//   ocr      B 类：机器提取文本，可检索但提示「须核原书」
//   pdf      C 类：readable=false，不检索，只在无命中时提示
//   meta     M 类：目录/书目，不参与正文匹配
//
// 索引按 mtime 缓存；manifest 同样按 mtime 缓存。

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { defineTool, fail } from './tool-utils.js'

const HEADING_RE = /^#{1,4}\s+(.+?)\s*$/
const SKIP_DIRS = new Set(['.git', 'node_modules', '__pycache__', '_META'])
const MANIFEST_RELATIVE = '_META/manifest.json'

function walkFiles(root, result = []) {
  let entries
  try {
    entries = readdirSync(root, { withFileTypes: true })
  } catch {
    return result
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue
    const full = path.join(root, entry.name)
    if (entry.isDirectory()) {
      walkFiles(full, result)
    } else if (entry.isFile() && /\.(md|markdown|txt)$/i.test(entry.name)) {
      result.push(full)
    }
  }
  return result
}

function splitQuery(query) {
  return String(query ?? '')
    .split(/[\s,，、;；|/]+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 0)
    .slice(0, 8)
}

function countOccurrences(haystack, needle, cap = 200) {
  if (!needle) return 0
  let count = 0
  let index = haystack.indexOf(needle)
  while (index !== -1 && count < cap) {
    count += 1
    index = haystack.indexOf(needle, index + needle.length)
  }
  return count
}

function headingBefore(text, position) {
  const before = text.slice(0, position)
  const lines = before.split('\n')
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const match = HEADING_RE.exec(lines[i])
    if (match) return { heading: match[1], line: i + 1 }
  }
  return { heading: '', line: 1 }
}

function lineOf(text, position) {
  let line = 1
  for (let i = 0; i < position; i += 1) if (text.charCodeAt(i) === 10) line += 1
  return line
}

function buildExcerpt(text, position, maxChars) {
  const half = Math.floor(maxChars / 2)
  let start = Math.max(0, position - half)
  let end = Math.min(text.length, position + half)
  const startBreak = text.indexOf('\n', start)
  if (startBreak !== -1 && startBreak < position) start = startBreak + 1
  const endBreak = text.lastIndexOf('\n', end)
  if (endBreak > position) end = endBreak
  let excerpt = text.slice(start, end).trim()
  const truncated = start > 0 || end < text.length
  if (truncated) excerpt = (start > 0 ? '……' : '') + excerpt + (end < text.length ? '……' : '')
  return { excerpt, start, truncated }
}

function bodyOffset(text) {
  // 跳过每本书固定的来源/版权说明头，避免检索命中「来源：…」这种噪音。
  const match = /\n##\s+/.exec(text)
  return match ? match.index + 1 : 0
}

function headingHits(text, term) {
  let count = 0
  for (const line of text.split('\n')) {
    if (HEADING_RE.test(line) && line.includes(term)) count += 1
  }
  return count
}

function tierOf(kind) {
  if (kind === 'text' || kind === 'digest') return 'A'
  if (kind === 'ocr') return 'B'
  if (kind === 'pdf') return 'C'
  return 'M'
}

export function createKbTool(config) {
  const cfg = config ?? {}
  const kbDir = cfg.knowledgeBaseDir ?? 'D:/DSH_GuaShi/知识库'
  const cache = new Map()
  const manifestCache = { mtimeMs: -1, value: null }

  function loadManifest() {
    const file = path.join(kbDir, MANIFEST_RELATIVE)
    let stat
    try {
      stat = statSync(file)
    } catch {
      return null
    }
    if (manifestCache.value && manifestCache.mtimeMs === stat.mtimeMs) return manifestCache.value
    try {
      const data = JSON.parse(readFileSync(file, 'utf8'))
      const byPath = new Map()
      for (const entry of data.entries ?? []) byPath.set(String(entry.path), entry)
      const value = { data, byPath, mtimeMs: stat.mtimeMs }
      manifestCache.mtimeMs = stat.mtimeMs
      manifestCache.value = value
      return value
    } catch {
      return null
    }
  }

  function entryFor(relative, manifest) {
    const fromManifest = manifest?.byPath?.get(relative)
    if (fromManifest) return fromManifest
    // 没有 manifest 时按路径兜底推断
    const inModern = relative.startsWith('11-现代书籍/')
    return {
      path: relative,
      kind: inModern ? 'ocr' : 'text',
      readable: true,
      quality: inModern ? 'ocr-uncorrected' : 'clean',
    }
  }

  function isMetaFile(relative, entry) {
    const base = path.basename(relative)
    if (entry?.kind === 'meta') return true
    if (base === 'INDEX.md' || base.startsWith('_')) return true
    return false
  }

  function loadDocs(bookFilter, includeOcr) {
    const manifest = loadManifest()
    const files = walkFiles(kbDir)
    const docs = []
    for (const file of files) {
      const relative = path.relative(kbDir, file).replace(/\\/g, '/')
      const entry = entryFor(relative, manifest)
      if (isMetaFile(relative, entry)) continue
      if (entry.readable === false) continue
      if (!includeOcr && entry.kind === 'ocr') continue
      if (
        bookFilter &&
        !relative.toLowerCase().includes(bookFilter.toLowerCase()) &&
        !path.basename(file).toLowerCase().includes(bookFilter.toLowerCase())
      ) {
        continue
      }
      let stat
      try {
        stat = statSync(file)
      } catch {
        continue
      }
      const cached = cache.get(file)
      if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
        docs.push({ ...cached, file, relative, entry })
        continue
      }
      let text
      try {
        text = readFileSync(file, 'utf8')
      } catch {
        continue
      }
      const doc = { mtimeMs: stat.mtimeMs, size: stat.size, text }
      cache.set(file, doc)
      docs.push({ ...doc, file, relative, entry })
    }
    return { docs, totalFiles: files.length, manifest }
  }

  function pdfOnlyMatches(manifest, terms, bookFilter, limit = 5) {
    if (!manifest) return []
    const found = []
    for (const entry of manifest.data.entries ?? []) {
      if (entry.readable !== false || entry.kind !== 'pdf') continue
      const haystack = [entry.name, entry.title, entry.section].filter(Boolean).join(' ').toLowerCase()
      if (bookFilter && !haystack.includes(bookFilter.toLowerCase())) continue
      if (!terms.some((term) => haystack.includes(term.toLowerCase()))) continue
      found.push({
        book: entry.title || entry.name,
        path: entry.path,
        section: entry.section,
        bytes: entry.bytes ?? null,
        note: '库中仅存影印/扫描 PDF，无文本可检索；不能据其内容作答。',
      })
      if (found.length >= limit) break
    }
    return found
  }

  const tool = defineTool({
    name: 'gua_kb',
    description:
      '检索本地知识库（D:/DSH_GuaShi/知识库），**只检索能直接读成文字的文件**：优先 A 类原文/编者整理的 .md、.txt，其次 B 类由 PDF 提取的 OCR 文本（会提示须核原书）。多个关键词空格分隔（AND 语义），可用 book 限定书目。**PDF 影印本不在检索范围**；若某书只有影印 PDF，会返回 pdfOnly 提示「无可检索文本」，不得凭书名或记忆编原文。引《周易》《梅花易数》《增删卜易》《卜筮正宗》《遁甲演义》《六壬大全》《太乙金镜式经》等原文前先查这里。',
    parameters: {
      query: { type: 'string', required: true, description: '检索词，可多个，空格分隔。如「用神 忌神」「体用 生克」「旬空 月破」。' },
      book: { type: 'string', description: '限定书名或路径子串，如「增删卜易」「奇门」「六壬」「梅花」「太乙」。' },
      limit: { type: 'integer', description: '返回条数 1-8，默认 4。' },
      includeOcr: { type: 'boolean', description: '是否检索 B 类 OCR 提取文本（默认 true）。设 false 只查原文/编者整理等干净文本。' },
    },
    timeoutMs: 20_000,
    async execute(args) {
      const terms = splitQuery(args.query)
      if (terms.length === 0) return fail('query 不能为空。')
      const limit = Math.min(Math.max(Number.isFinite(args.limit) ? Number(args.limit) : 4, 1), 8)
      const includeOcr = args.includeOcr !== false
      let loaded
      try {
        loaded = loadDocs(typeof args.book === 'string' ? args.book.trim() : '', includeOcr)
      } catch (error) {
        return fail(`知识库不可读：${error?.message ?? error}`, { knowledgeBaseDir: kbDir })
      }
      const { docs, totalFiles, manifest } = loaded
      const manifestStats = manifest?.data?.stats ?? null
      const initialBookFilter = typeof args.book === 'string' ? args.book.trim() : ''
      if (docs.length === 0) {
        const pdfOnly = pdfOnlyMatches(manifest, terms, initialBookFilter)
        const parts = [
          `知识库在 ${kbDir} 下没有可检索文本${initialBookFilter ? `（book 过滤：${initialBookFilter}）` : ''}。可先看 知识库/INDEX.md，或把 book 放宽。`,
        ]
        if (pdfOnly.length > 0) {
          parts.push('库中有这些书但只有影印 PDF（readable=false），不能据其内容作答；需要内容请用户提供文字版或自行查阅 PDF。')
        }
        return {
          ok: true,
          hits: [],
          pdfOnly,
          totalFiles,
          manifestStats,
          note: parts.join(''),
        }
      }
      const scored = []
      for (const doc of docs) {
        const text = doc.text
        const start = bodyOffset(text)
        const body = text.slice(start)
        const counts = []
        let allPresent = true
        let bodyTotal = 0
        for (const term of terms) {
          const bodyCount = countOccurrences(body, term)
          const headingCount = headingHits(body, term)
          counts.push({ term, count: bodyCount, headingCount })
          bodyTotal += bodyCount
          if (bodyCount === 0) allPresent = false
        }
        if (bodyTotal === 0) continue // 只有文件头命中的，不算
        // A 类原文/编者整理优先；B 类 OCR 文本略降权，避免同等相关时压过原文。
        const weight = doc.entry?.kind === 'ocr' ? 0.9 : 1
        const score = counts.reduce(
          (sum, item) => sum + Math.min(item.count, 30) * (1 + item.term.length * 0.5) + item.headingCount * 12,
          0,
        ) * weight
        scored.push({ doc, counts, allPresent, total: bodyTotal, score, start })
      }
      let picked = scored.filter((item) => item.allPresent)
      let matchedAll = true
      if (picked.length === 0) {
        matchedAll = false
        picked = scored
      }
      picked.sort((a, b) => b.score - a.score || b.total - a.total)
      const hits = []
      for (const item of picked.slice(0, limit)) {
        const text = item.doc.text
        const body = text.slice(item.start)
        // 定位：取「关键词密度最高」的窗口，而不是首次出现。
        const anchorTerm = [...item.counts]
          .filter((entry) => entry.count > 0)
          .sort((a, b) => a.count - b.count)[0]
        const positions = []
        if (anchorTerm) {
          let searchFrom = 0
          for (let i = 0; i < 40; i += 1) {
            const found = body.indexOf(anchorTerm.term, searchFrom)
            if (found < 0) break
            positions.push(found)
            searchFrom = found + anchorTerm.term.length
          }
        }
        let bestPosition = 0
        let bestDensity = -1
        for (const candidate of positions.length > 0 ? positions : [0]) {
          const windowStart = Math.max(0, candidate - 700)
          const windowEnd = Math.min(body.length, candidate + 700)
          const window = body.slice(windowStart, windowEnd)
          let density = 0
          for (const entry of item.counts) {
            if (entry.count === 0) continue
            density += Math.min(countOccurrences(window, entry.term), 20) * (1 + entry.term.length * 0.5)
          }
          if (density > bestDensity) {
            bestDensity = density
            bestPosition = candidate
          }
        }
        const position = item.start + bestPosition
        const { excerpt, truncated } = buildExcerpt(text, position, 1600)
        const { heading } = headingBefore(text, position)
        const basename = path.basename(item.doc.relative).replace(/\.(md|txt)$/i, '')
        const kind = item.doc.entry?.kind ?? 'text'
        hits.push({
          book: basename,
          path: item.doc.file,
          heading: heading ? '#' + '#' + ' ' + heading : '',
          line: lineOf(text, position),
          score: Number(item.score.toFixed(2)),
          excerpt,
          truncated,
          kind,
          tier: tierOf(kind),
          quality: item.doc.entry?.quality ?? 'clean',
          readable: true,
          matchedTerms: item.counts.filter((entry) => entry.count > 0).map((entry) => entry.term),
        })
      }

      const bookFilter = typeof args.book === 'string' ? args.book.trim() : ''
      const onlyDigest = hits.length > 0 && hits.every((hit) => hit.kind === 'digest')
      // PDF 影印本只在三种情况下提示：无命中、命中全是编者摘要、或 book 明确指向只有 PDF 的书。
      const needPdfHint = hits.length === 0 || onlyDigest
      const pdfOnly = needPdfHint || bookFilter
        ? pdfOnlyMatches(manifest, terms, bookFilter)
        : []
      const ocrHit = hits.some((hit) => hit.kind === 'ocr')
      const parts = []
      if (hits.length === 0) {
        parts.push('没有命中可检索文本：换更短的词、去掉 book 限制，或直接用 read 工具打开知识库文件。')
        if (pdfOnly.length > 0) {
          parts.push('库中有这些书但只有影印 PDF（readable=false），不能据其内容作答；需要内容请用户提供文字版或自行查阅 PDF。')
        }
      } else if (matchedAll) {
        parts.push(`命中 ${hits.length} 条（全部关键词均出现）。`)
      } else {
        parts.push('没有同时包含全部关键词的段落，以下为部分命中，请斟酌。')
      }
      if (onlyDigest) {
        parts.push('命中项是编者摘要（digest）而非原文；若所问之书只有影印 PDF，摘要只能作线索，不得冒充原文。')
      }
      if (ocrHit) parts.push('其中包含 B 类机器提取文本（quality=ocr-uncorrected），引用须注明「机器提取，须核原书」。')
      if (hits.length > 0 && manifestStats) {
        parts.push(`知识库可检索文本约 ${manifestStats.totalChars ?? '?'} 字（A 类 ${manifestStats.text ?? '?'} 份，B 类 ${(manifestStats.ocr ?? 0) + (manifestStats.digest ?? 0)} 份；C 类影印 PDF ${manifestStats.pdf ?? 0} 份不参与检索）。`)
      }
      return {
        ok: true,
        hits,
        pdfOnly,
        totalFiles,
        manifestStats,
        note: parts.join(''),
      }
    },
  })

  return tool
}
