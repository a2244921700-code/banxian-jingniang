// 工具层自检（不需要 Harness 进程）。
//
// 验证范围：
//   1. 8 个工具的定义形状（name / parameters JSON Schema / output / execute）。
//   2. gua_now：指定地点时不依赖网络，历法字段齐全。
//   3. gua_cast：梅花时间卦、六爻摇钱；乾为天 + 上爻动应得泽天夬。
//   4. gua_hexagram：乾卦卦辞爻辞、错综互。
//   5. gua_qimen / gua_liuren：固定时间出盘，字段自洽。
//   6. gua_kb：真实知识库检索（知识库为空时只要求不报错）。
//   7. gua_case：临时目录里 record / list / update 往返。
//   8. gua_history：假 sessionPersistence 验证工作区过滤、子代理剔除、归档剔除、消息抽取。
//
// 运行：node test/tools.test.mjs

import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { createTools, DEFAULT_CONFIG } from '../lib/index.js'

const NODE_OK = true

function toolsOf(ctx, overrides = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...overrides }
  return createTools(cfg, ctx)
}

function ganzhiText(value) {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') return value.name
  return undefined
}

function byName(tools, name) {
  const tool = tools.find((item) => item.name === name)
  assert.ok(tool, `缺少工具 ${name}`)
  return tool
}

async function call(tools, name, args) {
  return await byName(tools, name).execute(args, { agent: { session: { header: { id: 'session-test' } } } })
}

function fakeCtx(extra = {}) {
  return {
    get(name) {
      if (name in extra) return extra[name]
      return undefined
    },
  }
}

test('工具定义形状：11 个工具，参数是合法 JSON Schema', () => {
  const tools = toolsOf(fakeCtx())
  const names = tools.map((tool) => tool.name).sort()
  assert.deepEqual(names, [
    'gua_bazi',
    'gua_case',
    'gua_cast',
    'gua_hexagram',
    'gua_history',
    'gua_kb',
    'gua_liuren',
    'gua_now',
    'gua_qimen',
    'gua_taiyi',
    'gua_ziwei',
  ])
  for (const tool of tools) {
    assert.equal(typeof tool.description, 'string')
    assert.ok(tool.description.length > 20, `${tool.name} 描述太短`)
    assert.equal(tool.parameters.type, 'object')
    assert.equal(typeof tool.parameters.properties, 'object')
    assert.equal(typeof tool.execute, 'function')
    for (const [key, schema] of Object.entries(tool.parameters.properties)) {
      assert.equal(typeof schema.type, 'string', `${tool.name}.${key} 缺少 type`)
    }
  }
})

test('gua_now：指定地点时历法字段齐全（不依赖网络）', async () => {
  const tools = toolsOf(fakeCtx())
  const result = await call(tools, 'gua_now', { location: { city: '杭州' } })
  assert.equal(result.ok, true)
  assert.ok(result.now.local.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/))
  assert.equal(result.location.source, 'user')
  assert.ok(Math.abs(result.location.longitude - 120.15) < 0.5)
  assert.equal(typeof result.almanac, 'object')
  const dayGanzhi = result.almanac.ganzhi.day
  assert.equal(typeof (typeof dayGanzhi === 'string' ? dayGanzhi : dayGanzhi?.name), 'string')
  assert.ok(Array.isArray(result.almanac.xunKong))
  assert.ok(result.almanac.solarTerm.current.name.length > 0)
  assert.ok(result.almanac.trueSolarTime.local.length > 0)
})

test('gua_cast：梅花时间卦出盘完整', async () => {
  const tools = toolsOf(fakeCtx())
  const result = await call(tools, 'gua_cast', {
    method: 'meihua_time',
    question: '这次跳槽如何？',
    datetime: '2026-10-25T21:30:00+08:00',
  })
  assert.equal(result.ok, true)
  assert.equal(result.question, '这次跳槽如何？')
  assert.equal(typeof result.ben.name, 'string')
  assert.equal(result.ben.yao.length, 6)
  assert.ok(result.movingLine >= 1 && result.movingLine <= 6)
  assert.equal(typeof result.hu.name, 'string')
  assert.ok(result.bian === null || typeof result.bian.name === 'string')
  assert.equal(ganzhiText(result.time.ganzhi.day).length, 2)
  if (result.bian) assert.equal(result.bian.yao.length, 6)
})

test('gua_cast：六爻乾为天上爻动，变泽天夬', async () => {
  const tools = toolsOf(fakeCtx())
  const result = await call(tools, 'gua_cast', {
    method: 'liuyao_coins',
    throws: [7, 7, 7, 7, 7, 9],
    datetime: '2026-10-25T21:30:00+08:00',
  })
  assert.equal(result.ok, true)
  assert.equal(result.ben.fullName, '乾为天')
  assert.ok(result.bian, '应有变卦')
  assert.equal(result.bian.name, '夬')
  assert.equal(result.lines.length, 6)
  assert.equal(result.lines[5].moving, true)
  assert.equal(result.lines[5].ganzhi, '壬戌')
  // 乾为天：世在上爻（六爻），应在三爻
  assert.equal(result.lines[2].shiYing, '应')
  assert.equal(result.lines[5].shiYing, '世')
  assert.ok(result.lines.every((line) => typeof line.liuqin === 'string' && line.liuqin.length > 0))
})

test('gua_hexagram：乾卦与错综互', async () => {
  const tools = toolsOf(fakeCtx())
  const result = await call(tools, 'gua_hexagram', { name: '乾' })
  assert.equal(result.ok, true)
  assert.equal(result.hexagram.number, 1)
  assert.equal(result.hexagram.fullName, '乾为天')
  assert.equal(result.hexagram.yao.length, 6)
  assert.ok(result.hexagram.guaCi.length > 0)
  assert.equal(result.cuo.name, '坤')
  assert.equal(result.zong.name, '乾')
  assert.equal(result.hu.name, '乾')
})

test('gua_qimen：固定时间出奇门盘，九宫与值符值使自洽', async () => {
  const tools = toolsOf(fakeCtx())
  const result = await call(tools, 'gua_qimen', {
    question: '明天签约',
    datetime: '2026-10-25T21:30:00+08:00',
  })
  assert.equal(result.ok, true)
  assert.ok(['阳遁', '阴遁'].includes(result.ju.yinYang))
  assert.ok(result.ju.number >= 1 && result.ju.number <= 9)
  assert.ok(result.palaces.length >= 8)
  const fu = result.palaces.find((palace) => palace.index === result.zhiFu.palace)
  assert.ok(fu, '值符落宫必须在九宫内')
  assert.equal(fu.star, result.zhiFu.star)
  const shi = result.palaces.find((palace) => palace.index === result.zhiShi.palace)
  assert.ok(shi, '值使落宫必须在九宫内')
  assert.equal(shi.door, result.zhiShi.door)
  assert.equal(typeof ganzhiText(result.time.ganzhi.day), 'string')
  assert.equal(result.meta.jiGong, '坤二')
  assert.equal(result.meta.isDefaultSchool, true)
  assert.equal(result.meta.school.includes('时家'), true)
  assert.equal(result.meta.anGanMode, '八门地盘携带之干')
  assert.ok(result.palaces.some((palace) => palace.anGan && palace.anGan.length === 1))
  assert.ok(['旺', '相', '休', '囚', '死', ''].includes(result.palaces[0].starWangShuai))
  const tuned = await call(tools, 'gua_qimen', {
    datetime: '2026-10-25T21:30:00+08:00',
    juMethod: '置闰',
    jiGong: '阳艮阴坤',
    lateZi: 'sameDay',
    zhirunDays: 9,
  })
  assert.equal(tuned.ok, true)
  assert.equal(tuned.meta.jiGong, '阳艮阴坤')
  assert.equal(tuned.meta.zhirunDays, 9)
  assert.equal(tuned.meta.lateZi, 'sameDay')
  assert.equal(tuned.ju.juMethod, '置闰')
})

test('gua_liuren：固定时间出六壬盘，四课三传完整', async () => {
  const tools = toolsOf(fakeCtx())
  const result = await call(tools, 'gua_liuren', {
    question: '这趟出行顺否',
    datetime: '2026-10-25T21:30:00+08:00',
  })
  assert.equal(result.ok, true)
  assert.equal(result.yueJiang.branch.length, 1)
  assert.equal(result.tianDiPan.length, 12)
  assert.equal(result.siKe.length, 4)
  assert.equal(result.sanChuan.chuan.length, 3)
  assert.equal(result.tianJiang.length, 12)
  assert.equal(result.sanChuan.chuan[0].index, 1)
})

test('gua_taiyi：固定时间出太乙盘', async () => {
  const tools = toolsOf(fakeCtx())
  const result = await call(tools, 'gua_taiyi', {
    question: '问一波事业走向',
    datetime: '2026-10-25T21:30:00+08:00',
    mode: '时计',
  })
  assert.equal(result.ok, true)
  assert.equal(result.mode, '时计')
  assert.ok(result.ju, '应有局数/积年信息')
  assert.ok(result.taiyi, '应有太乙落宫信息')
  assert.ok(Array.isArray(result.palaces) && result.palaces.length >= 8, '应有九宫盘面')
  assert.ok(Array.isArray(result.hints))
  assert.equal(typeof ganzhiText(result.time.ganzhi.day), 'string')
})

test('gua_bazi：固定出生时间出八字盘', async () => {
  const tools = toolsOf(fakeCtx())
  const result = await call(tools, 'gua_bazi', {
    datetime: '1988-11-02T09:30:00+08:00',
    gender: '男',
    name: '示例盘',
    location: { city: '上海', longitude: 121.4737 },
  })
  assert.equal(result.ok, true)
  assert.equal(result.summary.fourPillars, '戊辰 壬戌 辛酉 癸巳')
  assert.equal(result.meta.rizhu, '辛金')
  assert.equal(result.meta.direction, '顺行')
  assert.equal(result.pillars.length, 4)
  assert.equal(result.dayun.length, 10)
  assert.equal(result.dayun[0].from, 1990)
  assert.equal(result.dayun[0].gan + result.dayun[0].zhi, '癸亥')
  const ln2026 = result.dayun.find((d) => d.from === 2020).liunian.find((x) => x.year === 2026)
  assert.equal(ln2026.gan + ln2026.zhi, '丙午')
  assert.equal(ln2026.liuyue.length, 12)
  assert.ok(Array.isArray(result.hints))
  const missingGender = await call(tools, 'gua_bazi', { datetime: '1988-11-02T09:30:00+08:00' })
  assert.equal(missingGender.ok, false)
  const missingDate = await call(tools, 'gua_bazi', { gender: '女' })
  assert.equal(missingDate.ok, false)
})
test('gua_ziwei：固定出生时间出紫微盘', async () => {
  const tools = toolsOf(fakeCtx())
  const result = await call(tools, 'gua_ziwei', {
    datetime: '1990-05-15T14:30:00+08:00',
    gender: '男',
    name: '示例盘',
    location: { city: '上海', longitude: 121.4737 },
  })
  assert.equal(result.ok, true)
  assert.equal(result.summary.mingGong, '命宫在戌')
  assert.equal(result.summary.wuxingJu, '土五局')
  assert.equal(result.summary.ziwei, '戌')
  assert.equal(result.meta.wuxingJu, '土五局')
  assert.equal(result.palaces.length, 12)
  assert.equal(new Set(result.palaces.map((p) => p.zhi)).size, 12)
  const mainCount = result.palaces.reduce((n, p) => n + p.stars.length, 0)
  assert.equal(mainCount, 14)
  assert.ok(Array.isArray(result.hints))
  // 缺性别/出生时间应返回明确错误
  const missingGender = await call(tools, 'gua_ziwei', { datetime: '1990-05-15T14:30:00+08:00' })
  assert.equal(missingGender.ok, false)
  const missingDate = await call(tools, 'gua_ziwei', { gender: '女' })
  assert.equal(missingDate.ok, false)
})

test('gua_kb：文本优先，PDF 不进检索', async () => {
  const tools = toolsOf(fakeCtx())
  const manifestPath = path.join(DEFAULT_CONFIG.knowledgeBaseDir, '_META', 'manifest.json')
  assert.ok(existsSync(manifestPath), '知识库应有 _META/manifest.json（重跑 tools/build_index.py）')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  assert.ok(Array.isArray(manifest.entries))
  assert.ok(manifest.entries.length > 0)

  const textHit = await call(tools, 'gua_kb', { query: '用神', limit: 3 })
  assert.equal(textHit.ok, true)
  assert.ok(textHit.hits.length > 0)
  assert.ok(textHit.hits.every((hit) => hit.readable === true && hit.kind !== 'pdf'), '正文命中不应来自 PDF')
  assert.ok(textHit.hits.every((hit) => typeof hit.tier === 'string' && typeof hit.quality === 'string'))

  // 真知识库若已无 PDF（默认：现代书籍已移出归档区），则 pdfOnly 必为空；
  // 若将来放回影印 PDF，则 query 对应 book 时应返回 pdfOnly 提示而不是正文命中。
  const pdfEntry = manifest.entries.find((entry) => entry.kind === 'pdf')
  const probe = await call(tools, 'gua_kb', { query: '大六壬探原', book: '大六壬探原', includeOcr: false })
  assert.equal(probe.ok, true)
  assert.ok((probe.hits || []).every((hit) => hit.kind !== 'pdf'))
  if (pdfEntry) {
    assert.ok((probe.pdfOnly || []).length > 0, '有影印 PDF 时应提示 pdfOnly')
  } else {
    assert.equal((probe.pdfOnly || []).length, 0, '知识库无 PDF 时 pdfOnly 应为空')
  }

  // includeOcr=false 时不得返回 B 类 OCR 文本
  const noOcr = await call(tools, 'gua_kb', { query: '奇门', includeOcr: false, limit: 8 })
  assert.equal(noOcr.ok, true)
  assert.ok((noOcr.hits || []).every((hit) => hit.kind !== 'ocr'))
})

test('gua_kb：真实知识库检索', async () => {
  const tools = toolsOf(fakeCtx())
  const result = await call(tools, 'gua_kb', { query: '用神', limit: 2 })
  assert.equal(result.ok, true)
  assert.ok(result.totalFiles >= 0)
  assert.ok(Array.isArray(result.hits))
  if (result.totalFiles > 0) {
    assert.equal(typeof result.note, 'string')
  }
})

test('gua_case：临时目录 record / list / update', async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'guashi-case-'))
  const tools = toolsOf(fakeCtx(), { caseDir: dir })
  const recorded = await call(tools, 'gua_case', {
    action: 'record',
    question: '测试：本月项目能否过审',
    method: '梅花时间',
    ben: { fullName: '泽火革' },
    bian: { fullName: '泽山咸' },
    judgment: '革故鼎新之象，先难后易，宜换沟通口径。',
    keyPoints: ['体用：体离火为用，用兑金，火克金', '五爻动'],
    tags: ['测试', '工作'],
    followUpAt: '2026-11-05',
  })
  assert.equal(recorded.ok, true)
  assert.ok(recorded.caseId.startsWith('case-'))
  const file = path.join(dir, '卦例记录.jsonl')
  assert.ok(readFileSync(file, 'utf8').includes(recorded.caseId))

  const listed = await call(tools, 'gua_case', { action: 'list', query: '过审' })
  assert.equal(listed.ok, true)
  assert.ok(listed.cases.some((item) => item.caseId === recorded.caseId))

  const updated = await call(tools, 'gua_case', {
    action: 'update',
    caseId: recorded.caseId,
    outcome: '过审了，比预想早两天。',
    verified: true,
  })
  assert.equal(updated.ok, true)
  assert.equal(updated.case.verified, true)
  assert.equal(updated.case.revision, 2)
  const reread = await call(tools, 'gua_case', { action: 'list', tag: '测试' })
  assert.equal(reread.cases[0].outcome, '过审了，比预想早两天。')
})

test('gua_history：工作区过滤、子代理与归档剔除、消息抽取', async () => {
  const home = mkdtempSync(path.join(os.tmpdir(), 'guashi-home-'))
  const storages = path.join(home, 'storages')
  mkdirSync(storages, { recursive: true })
  writeFileSync(
    path.join(storages, 'workspace.json'),
    JSON.stringify({ global: { archivedSessionIds: ['session-archived'] } }),
    'utf8',
  )
  const previousHome = process.env.DSH_HOME
  process.env.DSH_HOME = home

  const eventsOf = (id) => [
    { type: 'user/message', seq: 1, time: 1761385000000, data: { role: 'user', content: [{ type: 'text', text: `旧卦：${id} 问跳槽` }] } },
    { type: 'assistant/message', seq: 2, time: 1761385001000, data: { turn: 1, step: 1, message: { role: 'assistant', content: [{ type: 'text', text: '体用比和，宜缓不宜急。' }] }, stream: [] } },
  ]
  const snapshots = [
    { header: { id: 'session-live-a', cwd: 'D:\\DSH_GuaShi', createdAt: 1761385000000, agentPreset: 'guashi' }, eventCount: 2, sizeBytes: 1024 },
    { header: { id: 'session-archived', cwd: 'D:\\DSH_GuaShi', createdAt: 1761384000000 }, eventCount: 2, sizeBytes: 1024 },
    { header: { id: 'session-child', cwd: 'D:\\DSH_GuaShi', createdAt: 1761383000000, parentSession: 'session-live-a' }, eventCount: 2, sizeBytes: 1024 },
    { header: { id: 'session-other-ws', cwd: 'D:\\DSH_Novel', createdAt: 1761382000000 }, eventCount: 2, sizeBytes: 1024 },
  ]
  const persistence = {
    async list() {
      return snapshots
    },
    async open(id) {
      return {
        async read() {
          return { events: eventsOf(id) }
        },
        async close() {},
      }
    },
  }
  try {
    const tools = toolsOf(fakeCtx({ sessionPersistence: persistence }))
    const listed = await call(tools, 'gua_history', { action: 'list_sessions' })
    assert.equal(listed.ok, true)
    assert.deepEqual(listed.sessions.map((item) => item.id), ['session-live-a'])
    assert.equal(listed.total, 1)

    const read = await call(tools, 'gua_history', { action: 'read_session', sessionId: 'session-live-a' })
    assert.equal(read.ok, true)
    assert.equal(read.messages.length, 2)
    assert.equal(read.messages[0].role, 'user')
    assert.match(read.messages[0].text, /旧卦/)

    const searched = await call(tools, 'gua_history', { action: 'search_sessions', query: '跳槽' })
    assert.equal(searched.ok, true)
    assert.equal(searched.hits.length, 1)
    assert.equal(searched.hits[0].sessionId, 'session-live-a')

    const missing = await call(tools, 'gua_history', { action: 'read_session', sessionId: '../evil' })
    assert.equal(missing.ok, false)
  } finally {
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
  }
})





