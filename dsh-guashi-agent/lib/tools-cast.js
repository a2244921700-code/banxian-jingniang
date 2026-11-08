// gua_cast / gua_hexagram —— 起卦排盘与卦典查询。
//
// 一切数值都来自 lib/engine，工具层只做：参数整理、日期解析、把排盘结果与
// 当时的历法信息拼在一起、给模型几句摆盘提示。模型不必也不该自己心算卦数。

import { defineTool, fail, parseDateTime } from './tool-utils.js'

const CAST_METHODS = ['meihua_time', 'meihua_number', 'meihua_count', 'liuyao_coins', 'liuyao_random']

function normalizeNumbers(numbers) {
  if (!Array.isArray(numbers)) return undefined
  const cleaned = numbers.map((n) => Number(n)).filter((n) => Number.isFinite(n))
  return cleaned.length > 0 ? cleaned : undefined
}

function normalizeThrows(throws) {
  if (!Array.isArray(throws)) return undefined
  return throws.map((item) => {
    if (typeof item === 'number') return item
    const text = String(item)
    if (/^[6789]$/.test(text)) return Number(text)
    // '正正反'：正为阳（3），反为阴（2）；三枚合计 6-9
    const chars = [...text].filter((ch) => '正反'.includes(ch))
    if (chars.length === 1) return chars[0] === '正' ? 7 : 8 // 单爻正/反按少阳/少阴
    if (chars.length === 3) {
      const heads = chars.filter((ch) => ch === '正').length
      return 6 + heads // 0->6 老阴, 1->7 少阳, 2->8 少阴, 3->9 老阳
    }
    return Number.NaN
  })
}

async function almanacFor(date, longitude) {
  const { getAlmanac } = await import('./engine/almanac.js')
  try {
    return getAlmanac(date, Number.isFinite(longitude) ? { longitude } : {})
  } catch {
    return null
  }
}

export function createCastTools(config) {
  const cfg = config ?? {}

  const castTool = defineTool({
    name: 'gua_cast',
    description:
      '起卦并排盘（梅花易数与六爻共用）。method 五选一：meihua_time 时间卦（用农历年月日时，先 gua_now 取时）；meihua_number 数字卦（numbers 给 2 或 3 个数）；meihua_count 物数卦（counts 给上下卦数、动爻）；liuyao_coins 摇钱卦（throws 自下而上 6 爻，数字 6/7/8/9 或 "正正反" 字符串）；liuyao_random 由本机掷出六爻。返回卦名、上下卦、卦辞爻辞、动爻变卦、六爻纳甲六亲六神世应旬空、体用生克；不要自己心算，盘面以此为准。',
    parameters: {
      method: { type: 'string', enum: CAST_METHODS, required: true, description: '起卦方法。' },
      question: { type: 'string', description: '所问何事（一句话，原样回显；未问清就先问清再起）。' },
      datetime: { type: 'string', description: '起卦时刻，ISO 格式如 2026-10-25T21:30:00+08:00；缺省用当前时间。' },
      location: {
        type: 'object',
        description: '可选地点 { city?, longitude? }：给出经度则真太阳时与时辰按当地校正。一般直接用 gua_now 的结果，不必重复传。',
      },
      numbers: {
        type: 'array',
        description: 'meihua_number：2 个数（上卦数、下卦数），或 3 个数（第三个定动爻）。',
      },
      counts: {
        type: 'object',
        description: 'meihua_count：{ upper: 数, lower: 数, moving?: 数 }。物数、字数、声音数皆可。',
      },
      throws: {
        type: 'array',
        description: 'liuyao_coins：自下而上 6 爻，每爻为 6/7/8/9 或 "正正反" 之类三枚结果。',
      },
      upper: { type: 'integer', description: '显式指定上卦（1乾 2兑 3离 4震 5巽 6坎 7艮 8坤）。' },
      lower: { type: 'integer', description: '显式指定下卦（同上）。' },
      moving: { type: 'integer', description: '显式指定动爻（1-6）。' },
      includeText: { type: 'boolean', description: '是否附卦辞爻辞原文，默认 true。' },
    },
    timeoutMs: 20_000,
    async execute(args) {
      let date
      try {
        date = parseDateTime(args.datetime)
      } catch (error) {
        return fail(error?.message ?? error)
      }
      const engine = await import('./engine/index.js')
      const longitude = Number.isFinite(args.location?.longitude) ? Number(args.location.longitude) : null
      const almanac = await almanacFor(date, longitude)
      try {
        let result
        switch (args.method) {
          case 'meihua_time':
            result = engine.castMeihua({ method: 'time', date })
            break
          case 'meihua_number': {
            const numbers = normalizeNumbers(args.numbers)
            if (!numbers) return fail('meihua_number 需要 numbers：2 个数（上下卦）或 3 个数（第三为动爻）。')
            result = engine.castMeihua({ method: 'number', date, numbers })
            break
          }
          case 'meihua_count': {
            // 物数卦：counts 给上下卦数；也可直接给 upper/lower（八卦数或卦名）与 moving，
            // 用于「已有一卦，只要排盘」或补算变卦。
            if (args.counts && typeof args.counts === 'object') {
              result = engine.castMeihua({ method: 'count', date, counts: args.counts })
            } else if (args.upper != null && args.lower != null) {
              result = engine.castMeihua({
                method: 'count',
                date,
                upper: args.upper,
                lower: args.lower,
                moving: args.moving,
              })
            } else {
              return fail('meihua_count 需要 counts：{upper, lower, moving?}，或直接给 upper/lower（+ moving）。')
            }
            break
          }
          case 'liuyao_coins': {
            const throws = normalizeThrows(args.throws)
            if (!throws || throws.length !== 6 || throws.some((n) => !Number.isFinite(n))) {
              return fail('liuyao_coins 需要 throws：自下而上 6 爻，每爻 6/7/8/9 或 "正正反"。')
            }
            result = engine.castLiuyao({ throws, date, upper: args.upper, lower: args.lower })
            break
          }
          case 'liuyao_random':
            result = engine.castLiuyaoRandom({ date })
            break
          default:
            return fail(`未知起卦方法：${args.method}`)
        }
        if (!result || typeof result !== 'object') return fail('排盘引擎没有返回结果。')
        if (args.includeText === false) {
          result = stripText(result)
        }
        const hints = [...(result.hints ?? [])]
        if (args.method.startsWith('meihua') && result.tiYong?.summary && !hints.some((h) => h.includes('体用'))) {
          hints.push(result.tiYong.summary)
        }
        return {
          ...result,
          ok: true,
          question: args.question ?? null,
          time: result.time ?? almanac,
          cast: result.cast ?? { method: args.method },
          hints,
        }
      } catch (error) {
        return fail(`起卦失败：${error?.message ?? error}`)
      }
    },
  })

  const hexagramTool = defineTool({
    name: 'gua_hexagram',
    description:
      '查卦典：给卦序（1-64）、卦名（乾 / 乾为天 / 水雷屯）或六位二进制（自下而上，如 111111）之一，返回该卦的上下卦、八宫五行、世应、卦辞彖象、六爻爻辞与小象，以及错卦、综卦、互卦。解卦引经前用它核对原文。',
    parameters: {
      number: { type: 'integer', description: '卦序 1-64。' },
      name: { type: 'string', description: '卦名，可用简称（乾）、别卦名（乾为天）或加「卦」字。' },
      binary: { type: 'string', description: '六位二进制，自下而上（初爻在最左），如 111111 为乾。' },
    },
    timeoutMs: 10_000,
    async execute(args) {
      const engine = await import('./engine/index.js')
      const query = {}
      if (Number.isFinite(args.number)) query.number = Number(args.number)
      if (typeof args.name === 'string' && args.name.trim()) query.name = args.name.trim()
      if (typeof args.binary === 'string' && /^[01]{6}$/.test(args.binary.trim())) query.binary = args.binary.trim()
      if (Object.keys(query).length === 0) return fail('要给 number、name 或 binary 其中之一。')
      try {
        const hexagram = engine.getHexagram(query)
        if (!hexagram) return fail('没有找到这一卦，请检查卦序、卦名或二进制。')
        const extra = {}
        try {
          const binary = String(hexagram.binary ?? '')
          if (/^[01]{6}$/.test(binary)) {
            const bits = [...binary].map(Number)
            const reverseBits = [...bits].reverse()
            extra.cuo = brief(engine.getHexagram({ binary: bits.map((b) => (b === 1 ? '0' : '1')).join('') }))
            extra.zong = brief(engine.getHexagram({ binary: reverseBits.join('') }))
            const huBinary = [bits[1], bits[2], bits[3], bits[2], bits[3], bits[4]].join('')
            extra.hu = brief(engine.getHexagram({ binary: huBinary }))
          }
        } catch {
          // 互错综只是附加信息，失败不影响主查询
        }
        return { ok: true, hexagram, ...extra }
      } catch (error) {
        return fail(`查卦失败：${error?.message ?? error}`)
      }
    },
  })

  return [castTool, hexagramTool]
}

function brief(hexagram) {
  if (!hexagram) return null
  return { number: hexagram.number, name: hexagram.name, fullName: hexagram.fullName, binary: hexagram.binary }
}

function stripText(result) {
  const cleaned = { ...result }
  const stripHex = (h) => {
    if (!h || typeof h !== 'object') return h
    const { guaCi, tuan, xiang, yao, ...rest } = h
    return rest
  }
  if (cleaned.ben) cleaned.ben = stripHex(cleaned.ben)
  if (cleaned.bian) cleaned.bian = stripHex(cleaned.bian)
  if (cleaned.hu) cleaned.hu = stripHex(cleaned.hu)
  if (Array.isArray(cleaned.lines)) {
    cleaned.lines = cleaned.lines.map(({ yaoCi, xiaoXiang, ...rest }) => rest)
  }
  return cleaned
}
