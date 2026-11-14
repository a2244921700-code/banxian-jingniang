// gua_history / gua_case —— 跨窗口记忆与卦案档案。
//
// 两件事：
//   1. gua_history：读「本工作区里未归档的其它聊天窗口」——用户要的是「换个窗口开
//      会话，卦师还记得以前替他断过什么」。实现只读：通过 Host 的 sessionPersistence
//      服务列出/打开会话日志，按 cwd 过滤到 D:/DSH_GuaShi，剔除子代理会话与已归档
//      会话（归档名单来自 $DSH_HOME/storages/workspace.json），绝不写入任何会话。
//   2. gua_case：卦案档案，一行一条 JSONL，追加记录、按需更新复盘。这是卦师长久的
//      记忆，与聊天窗口无关。

import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { defineTool, fail, formatBeijing, currentSessionId, normalizeCwd, truncate } from './tool-utils.js'

const SESSION_ID_RE = /^[A-Za-z0-9_-]{1,120}$/

function dshHome() {
  return process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
}

function readArchivedSessionIds() {
  const file = path.join(dshHome(), 'storages', 'workspace.json')
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'))
    const ids = data?.global?.archivedSessionIds
    if (Array.isArray(ids)) return new Set(ids.map(String))
    return new Set()
  } catch {
    return null // 读不到就明说，而不是假装没有归档
  }
}

function messageContentText(message) {
  const blocks = Array.isArray(message?.content) ? message.content : []
  const parts = []
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue
    if (block.type === 'text' && typeof block.text === 'string') parts.push(block.text)
  }
  return parts.join('\n').trim()
}

/** 从会话事件流里抽出可读对话（user / assistant 两种）。 */
function extractMessages(events, maxChars) {
  const messages = []
  for (const event of events ?? []) {
    if (!event || typeof event !== 'object') continue
    if (event.type === 'user/message') {
      const text = messageContentText(event.data)
      if (!text) continue
      const cut = truncate(text, maxChars)
      messages.push({ role: 'user', at: event.time ?? null, text: cut.text, truncated: cut.truncated })
    } else if (event.type === 'assistant/message') {
      const text = messageContentText(event.data?.message ?? event.data)
      if (!text) continue
      const cut = truncate(text, maxChars)
      messages.push({ role: 'assistant', at: event.time ?? null, text: cut.text, truncated: cut.truncated })
    }
  }
  return messages
}

async function openSessionEvents(persistence, sessionId) {
  const handle = await persistence.open(sessionId, 'read')
  try {
    const result = await handle.read()
    return result?.events ?? []
  } finally {
    try {
      await handle.close()
    } catch {
      // 关不掉也无妨：read 句柄不占写所有权
    }
  }
}

export function createHistoryTools(config, ctx) {
  const cfg = config ?? {}
  const workspacePath = cfg.workspacePath ?? 'D:/DSH_GuaShi'
  const targetCwd = normalizeCwd(workspacePath)
  const caseDir = cfg.caseDir ?? 'D:/DSH_GuaShi/卦案'
  const caseFile = path.join(caseDir, '卦例记录.jsonl')

  function persistence() {
    try {
      return ctx && typeof ctx.get === 'function' ? ctx.get('sessionPersistence') : undefined
    } catch {
      return undefined
    }
  }

  function queryService() {
    try {
      return ctx && typeof ctx.get === 'function' ? ctx.get('sessionQuery') : undefined
    } catch {
      return undefined
    }
  }

  async function sessionApi() {
    // 主路径：sessionPersistence（核心服务，能在预设作用域取到）。
    const sp = persistence()
    if (sp) {
      return {
        list: async () => (await sp.list()) ?? [],
        read: (sessionId) => openSessionEvents(sp, sessionId),
      }
    }
    // 備路径：sessionQuery 的 live-preferred 视图（部分宿主只挂查询服务）。
    const qs = queryService()
    if (qs && typeof qs.listSessions === 'function' && typeof qs.readSurface === 'function') {
      return {
        list: async () => (await qs.listSessions()) ?? [],
        read: async (sessionId) => (await qs.readSurface(sessionId))?.events ?? [],
      }
    }
    throw new Error('当前宿主没有暴露 sessionPersistence / sessionQuery 服务，读不到其它窗口的会话。')
  }

  async function collectSessions(includeArchived) {
    const api = await sessionApi()
    const rawList = await api.list()
    const archived = includeArchived ? null : readArchivedSessionIds()
    const list = []
    for (const snapshot of rawList) {
      const header = snapshot?.header ?? snapshot
      if (!header || typeof header.id !== 'string') continue
      if (normalizeCwd(header.cwd) !== targetCwd) continue
      if (header.parentSession) continue
      if (header.origin === 'subagent') continue
      if (archived && archived.has(header.id)) continue
      list.push({
        id: header.id,
        createdAt: Number(header.createdAt) || null,
        agentPreset: header.agentPreset ?? null,
        live: snapshot?.live === true,
        archived: null,
        sizeBytes: Number.isFinite(snapshot?.sizeBytes) ? snapshot.sizeBytes : null,
        eventCount: Number.isFinite(snapshot?.eventCount) ? snapshot.eventCount : null,
        title: null,
      })
    }
    list.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    // 标题尽力而取：sessionQuery 提供了按 id 折标题的接口，取不到就留 null
    try {
      const qs = queryService()
      if (qs && typeof qs.readTitleSnapshots === 'function' && list.length > 0) {
        const ids = list.slice(0, 60).map((item) => item.id)
        const results = await qs.readTitleSnapshots(ids)
        const titleById = new Map()
        for (const result of results ?? []) {
          if (result?.status === 'fulfilled' && result.value?.title?.title) {
            titleById.set(result.sessionId, result.value.title.title)
          }
        }
        for (const item of list) {
          if (titleById.has(item.id)) item.title = titleById.get(item.id)
        }
      }
    } catch {
      // 标题缺省时由 read_session 用首条用户消息兜底
    }
    return { list, archivedKnown: archived !== null }
  }

  const historyTool = defineTool({
    name: 'gua_history',
    description:
      '读本工作区（D:/DSH_GuaShi）里未归档的其它聊天窗口，找回「以前替他断过什么卦」。三个动作：list_sessions 列会话（标题、时间、预设）；read_session 读某个会话的对话（默认最近 40 条，可 offset 往前翻）；search_sessions 在这些会话里搜关键词（如某个卦名、某件事）。只读，不写任何会话；已归档会话默认不列。',
    parameters: {
      action: {
        type: 'string',
        enum: ['list_sessions', 'read_session', 'search_sessions'],
        required: true,
        description: '要做的动作。',
      },
      sessionId: { type: 'string', description: 'read_session 必填：会话 id，如 session-629829dd-…。' },
      query: { type: 'string', description: 'search_sessions 必填：关键词。' },
      limit: { type: 'integer', description: 'list_sessions 默认 30；read_session 默认 40 条消息；search_sessions 默认 12 条命中。' },
      offset: { type: 'integer', description: 'read_session：从第几条消息起（0 起）；缺省取最近 limit 条。' },
      maxChars: { type: 'integer', description: '每条消息截断字数，默认 1500。' },
      includeArchived: { type: 'boolean', description: '是否包含已归档会话，默认 false（用户要的是未归档窗口）。' },
    },
    timeoutMs: 60_000,
    async execute(args) {
      if (args.action === 'list_sessions') {
        try {
          const { list, archivedKnown } = await collectSessions(args.includeArchived === true)
          const limit = Math.min(Math.max(Number.isFinite(args.limit) ? Number(args.limit) : 30, 1), 100)
          const sessions = list.slice(0, limit).map((item) => ({
            id: item.id,
            title: item.title,
            createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : null,
            createdAtLocal: item.createdAt ? formatBeijing(new Date(item.createdAt)).local : null,
            agentPreset: item.agentPreset,
            eventCount: item.eventCount,
            sizeBytes: item.sizeBytes,
            archived: false,
          }))
          return {
            ok: true,
            workspace: workspacePath,
            sessions,
            total: list.length,
            note:
              `本工作区共 ${list.length} 个未归档会话（按时间倒序）。` +
              (archivedKnown ? '' : '归档名单读取失败，已归档会话可能混入，请以 GUI 里的归档状态为准。') +
              (sessions.some((item) => !item.title) ? '部分会话没有标题，可 read_session 看首条消息。' : ''),
          }
        } catch (error) {
          return fail(error?.message ?? error, { workspace: workspacePath })
        }
      }

      if (args.action === 'read_session') {
        if (typeof args.sessionId !== 'string' || !SESSION_ID_RE.test(args.sessionId)) {
          return fail('read_session 需要合法的 sessionId（先用 list_sessions 查）。')
        }
        const maxChars = Math.min(Math.max(Number.isFinite(args.maxChars) ? Number(args.maxChars) : 1500, 120), 8000)
        try {
          let title = null
          try {
            const qs = queryService()
            if (qs?.readTitle) {
              const snapshot = await qs.readTitle(args.sessionId)
              title = snapshot?.title ?? null
            }
          } catch {
            title = null
          }
          const api = await sessionApi()
          const events = await api.read(args.sessionId)
          const messages = extractMessages(events, maxChars)
          if (messages.length === 0) {
            return { ok: true, session: { id: args.sessionId, title }, total: 0, offset: 0, messages: [], note: '这个会话没有可读的用户/助手消息（可能是空会话或只有工具调用）。' }
          }
          const limit = Math.min(Math.max(Number.isFinite(args.limit) ? Number(args.limit) : 40, 1), 200)
          const total = messages.length
          const offset = Number.isFinite(args.offset)
            ? Math.min(Math.max(Number(args.offset), 0), Math.max(total - 1, 0))
            : Math.max(0, total - limit)
          const selected = messages.slice(offset, offset + limit)
          const firstUser = messages.find((message) => message.role === 'user')
          return {
            ok: true,
            session: { id: args.sessionId, title: title ?? (firstUser ? truncate(firstUser.text, 60).text : null) },
            total,
            offset,
            messages: selected,
            note:
              `共 ${total} 条对话，本次返回第 ${offset + 1}-${offset + selected.length} 条。` +
              (offset > 0 ? `再往前看：offset=${Math.max(0, offset - limit)}。` : ''),
          }
        } catch (error) {
          return fail(`读会话失败：${error?.message ?? error}`, { sessionId: args.sessionId })
        }
      }

      // search_sessions
      if (typeof args.query !== 'string' || args.query.trim() === '') {
        return fail('search_sessions 需要 query 关键词。')
      }
      const query = args.query.trim()
      const limit = Math.min(Math.max(Number.isFinite(args.limit) ? Number(args.limit) : 12, 1), 50)
      const maxSessions = 20
      const maxMessageChars = Math.min(Math.max(Number.isFinite(args.maxChars) ? Number(args.maxChars) : 1500, 200), 4000)
      try {
        const api = await sessionApi()
        const { list } = await collectSessions(args.includeArchived === true)
        const candidates = list.slice(0, maxSessions)
        const hits = []
        let scanned = 0
        for (const item of candidates) {
          if (item.sizeBytes && item.sizeBytes > 8 * 1024 * 1024) continue
          let messages
          try {
            messages = extractMessages(await api.read(item.id), Math.min(maxMessageChars, 1500))
          } catch {
            continue
          }
          scanned += 1
          const lowered = query.toLowerCase()
          for (let i = messages.length - 1; i >= 0 && hits.length < limit * 3; i -= 1) {
            const message = messages[i]
            const index = message.text.toLowerCase().indexOf(lowered)
            if (index === -1) continue
            const start = Math.max(0, index - 80)
            const end = Math.min(message.text.length, index + query.length + 120)
            hits.push({
              sessionId: item.id,
              title: item.title,
              at: message.at ? new Date(message.at).toISOString() : null,
              role: message.role,
              snippet: (start > 0 ? '……' : '') + message.text.slice(start, end) + (end < message.text.length ? '……' : ''),
            })
          }
          if (hits.length >= limit) break
        }
        hits.sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))
        const finalHits = hits.slice(0, limit)
        return {
          ok: true,
          query,
          hits: finalHits,
          sessionsScanned: scanned,
          note:
            finalHits.length === 0
              ? `在最近 ${scanned} 个未归档会话里没找到「${query}」。可先 list_sessions 看有哪些窗口，或用更短的关键词。`
              : `在 ${scanned} 个未归档会话里命中 ${finalHits.length} 条（从新到旧）。`,
        }
      } catch (error) {
        return fail(`检索会话失败：${error?.message ?? error}`)
      }
    },
  })

  // ── gua_case ───────────────────────────────────────────────────────────────

  function readCases() {
    if (!existsSync(caseFile)) return []
    const lines = readFileSync(caseFile, 'utf8').split('\n')
    const cases = []
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        cases.push(JSON.parse(trimmed))
      } catch {
        // 坏行跳过，不连坐整份档案
      }
    }
    return cases
  }

  function writeCases(cases) {
    mkdirSync(caseDir, { recursive: true })
    const tmp = `${caseFile}.tmp`
    writeFileSync(tmp, cases.map((item) => JSON.stringify(item)).join('\n') + '\n', 'utf8')
    renameSync(tmp, caseFile)
  }

  function briefHexagram(value) {
    if (!value) return null
    if (typeof value === 'string') return value
    if (typeof value === 'object') return value.fullName ?? value.name ?? null
    return null
  }

  const caseTool = defineTool({
    name: 'gua_case',
    description:
      '卦案档案（长期记忆，存 D:/DSH_GuaShi/卦案/卦例记录.jsonl）。断完一卦用 record 记档（问事、方法、本卦变卦、断语、要点、应期）；用 list 查旧案；用户回来复盘或提到应验时，用 update 补记录（outcome、verified）。跨窗口/跨会话记住替谁断过什么，靠它。**ben/bian 只传字符串**（卦名或课体简述，如「泽火革」「阴遁三局，立冬下元」），不要传对象；盘面复杂就压成一句摘要。',
    parameters: {
      action: {
        type: 'string',
        enum: ['record', 'list', 'update'],
        required: true,
        description: 'record 记新案；list 查旧案；update 复盘。',
      },
      question: { type: 'string', description: 'record：所问何事。' },
      method: { type: 'string', description: 'record：起卦方法（梅花时间/数字、六爻、奇门、六壬）。' },
      ben: { type: 'string', description: 'record：本卦/课体字符串，如「泽火革」；奇门可写「阴遁三局，立冬下元，辛亥时」等简述。' },
      bian: { type: 'string', description: 'record：变卦字符串，如「泽山咸」；无变卦可省略。' },
      judgment: { type: 'string', description: 'record：当时的断语（结论与依据要点）。' },
      keyPoints: { type: 'array', items: { type: 'string' }, description: 'record：断卦要点数组。' },
      tags: { type: 'array', items: { type: 'string' }, description: 'record：标签，如 ["求财","跳槽"]。' },
      followUpAt: { type: 'string', description: 'record：预计验证应期，如 "2026-11-05" 或 "一月内"。' },
      query: { type: 'string', description: 'list：在问事/断语/标签里搜关键词。' },
      tag: { type: 'string', description: 'list：按标签过滤。' },
      limit: { type: 'integer', description: 'list：返回条数，默认 20。' },
      caseId: { type: 'string', description: 'update：要更新的案号（record 返回的 caseId）。' },
      outcome: { type: 'string', description: 'update：实际应验结果。' },
      note: { type: 'string', description: 'update：复盘补充。' },
      verified: { type: 'boolean', description: 'update：是否已应验。' },
    },
    timeoutMs: 30_000,
    async execute(args, exec) {
      const stamp = formatBeijing(new Date())
      if (args.action === 'record') {
        if (typeof args.question !== 'string' || args.question.trim() === '') {
          return fail('record 需要 question（问的是什么事）。')
        }
        if (typeof args.judgment !== 'string' || args.judgment.trim() === '') {
          return fail('record 需要 judgment（当时的断语）。')
        }
        const random = Math.random().toString(36).slice(2, 6)
        const caseId = `case-${stamp.date.replace(/-/g, '')}-${stamp.time.replace(/:/g, '')}-${random}`
        const record = {
          caseId,
          at: stamp.local,
          atIso: stamp.iso,
          createdAt: Date.now(),
          sessionId: currentSessionId(exec),
          question: args.question.trim(),
          method: args.method ?? null,
          ben: briefHexagram(args.ben),
          bian: briefHexagram(args.bian),
          judgment: args.judgment.trim(),
          keyPoints: Array.isArray(args.keyPoints) ? args.keyPoints.map(String).slice(0, 20) : [],
          tags: Array.isArray(args.tags) ? args.tags.map(String).slice(0, 20) : [],
          followUpAt: args.followUpAt ?? null,
          outcome: null,
          note: null,
          verified: false,
          revision: 1,
        }
        try {
          mkdirSync(caseDir, { recursive: true })
          appendFileSync(caseFile, JSON.stringify(record) + '\n', 'utf8')
          return { ok: true, caseId, case: record, path: caseFile, note: '已记档。应验后记得用 update 复盘。' }
        } catch (error) {
          return fail(`写卦案失败：${error?.message ?? error}`, { path: caseFile })
        }
      }

      if (args.action === 'list') {
        const cases = readCases()
        const query = typeof args.query === 'string' ? args.query.trim().toLowerCase() : ''
        const tag = typeof args.tag === 'string' ? args.tag.trim() : ''
        let filtered = cases
        if (query) {
          filtered = filtered.filter((item) =>
            [item.question, item.judgment, item.ben, item.bian, ...(item.tags ?? []), ...(item.keyPoints ?? [])]
              .filter(Boolean)
              .join(' ')
              .toLowerCase()
              .includes(query),
          )
        }
        if (tag) filtered = filtered.filter((item) => (item.tags ?? []).includes(tag))
        filtered.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
        const limit = Math.min(Math.max(Number.isFinite(args.limit) ? Number(args.limit) : 20, 1), 200)
        return {
          ok: true,
          total: filtered.length,
          cases: filtered.slice(0, limit),
          path: caseFile,
          note: filtered.length === 0 ? '没有符合条件的卦案。' : `共 ${filtered.length} 条，返回最近 ${Math.min(limit, filtered.length)} 条。`,
        }
      }

      // update
      if (typeof args.caseId !== 'string' || args.caseId.trim() === '') {
        return fail('update 需要 caseId（先用 list 查）。')
      }
      const ifMissing = { ok: false, error: `没有找到案号 ${args.caseId}。` }
      try {
        const cases = readCases()
        const target = cases.find((item) => item.caseId === args.caseId)
        if (!target) return ifMissing
        if (typeof args.outcome === 'string') target.outcome = args.outcome
        if (typeof args.note === 'string') target.note = args.note
        if (typeof args.verified === 'boolean') target.verified = args.verified
        if (typeof args.followUpAt === 'string') target.followUpAt = args.followUpAt
        if (typeof args.judgment === 'string' && args.judgment.trim()) target.judgment = args.judgment.trim()
        target.updatedAt = stamp.local
        target.revision = (Number(target.revision) || 1) + 1
        writeCases(cases)
        return { ok: true, caseId: target.caseId, case: target, path: caseFile, note: '复盘已保存。' }
      } catch (error) {
        return fail(`更新卦案失败：${error?.message ?? error}`, { path: caseFile })
      }
    },
  })

  return [historyTool, caseTool]
}

