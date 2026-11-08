// gua_qimen / gua_liuren —— 奇门遁甲（时家转盘）与大六壬排盘。
//
// 引擎负责盘面：局数、九宫、八门九星八神、天地盘、四课、三传、十二天将。
// 工具层只做：解析时间、附上历法信息、把引擎的 hints 汇总成给模型的摆盘提示。
// 用神与吉凶判断属于 skills，不在引擎里做。

import { defineTool, fail, parseDateTime } from './tool-utils.js'

async function buildAlmanac(date, location) {
  const longitude = Number.isFinite(location?.longitude) ? Number(location.longitude) : null
  try {
    const { getAlmanac } = await import('./engine/almanac.js')
    return getAlmanac(date, Number.isFinite(longitude) ? { longitude } : {})
  } catch {
    return null
  }
}

export function createSanshiTools(config) {
  const cfg = config ?? {}

  const qimenTool = defineTool({
    name: 'gua_qimen',
    description:
      '奇门遁甲排盘（Agent 默认：时家 + 转盘 + 拆补法 + 中五寄坤二；除非用户明确要求，不要改用其他盘式/起局/多局）。给时间（缺省为当前）与所问之事，返回阴阳遁与局数、值符值使、旬首、旬空驿马，以及九宫盘面：地盘干、天盘干、八门、九星、八神、暗干、门/星旺衰、宫位五行与方位，并附穿壬四层（地盘地支/月将/神将/建星）。可选：盘式（转盘/飞盘/括囊）、定局法（拆补/置闰/茅山/阴盘/分家阳盘/刻家阴盘）、局式（时家/年家/月家/日家/太乙日家/山向/罗盘/套玄空）、中五寄宫、早晚子时、置闰天数、暗干排法。除「时家+转盘+拆补/置闰」外均为实验性扩展（meta.experimental=true，hints 标「实验·未校核」）。断法见 guashi-qimen 技能；起课前可先 gua_now 取时取地。',
    parameters: {
      datetime: { type: 'string', description: '起局时刻，ISO 格式；缺省用当前时间。' },
      question: { type: 'string', description: '所问何事（原样回显）。' },
      location: { type: 'object', description: '可选 { city?, longitude? }，用于真太阳时；一般用 gua_now 的结果。' },
      method: { type: 'string', enum: ['转盘', '飞盘', '括囊'], description: '盘式，默认转盘；飞盘/括囊为实验性盘式（未与权威排盘逐项校核，hints 与 meta.experimental 标明）。' },
      juType: {
        type: 'string',
        enum: ['时家', '年家', '月家', '日家', '太乙日家', '山向', '罗盘', '套玄空'],
        description: '局式，默认时家；年家/月家/日家/太乙日家/山向/罗盘/套玄空为实验性（起局口径待校核）。',
      },
      juMethod: {
        type: 'string',
        enum: ['拆补', '置闰', '茅山', '阴盘', '分家阳盘', '刻家阴盘'],
        description: '定局法：拆补（默认，现代主流）、置闰（古法超神接气置闰）；茅山/阴盘/分家阳盘/刻家阴盘为实验性。',
      },
      jiGong: {
        type: 'string',
        enum: ['坤二', '阳艮阴坤'],
        description: '中五寄宫：默认统一寄坤二宫；可选「阳遁寄艮八、阴遁寄坤二」。',
      },
      lateZi: {
        type: 'string',
        enum: ['nextDay', 'sameDay'],
        description: '23:00–23:59 晚子时：默认 nextDay（子时换日）；sameDay 为夜子时（日柱不换、时柱按次日日干起子时）。',
      },
      zhirunDays: {
        type: 'number',
        enum: [8, 9],
        description: '置闰触发天数：8（默认）或 9（仅 juMethod=置闰 生效）。',
      },
      anGanMode: {
        type: 'string',
        enum: [
          '八门地盘携带之干',
          '时干找值使飞布,遇地盘相同入中',
          '时干找值使飞布,遇宫内有时干则入中',
          '时干加值使转天盘,遇伏吟入中',
          '暗天干地支飞布法',
        ],
        description: '暗干排法：默认「八门地盘携带之干」；其余四法为实验性（hints 标注）。',
      },
      chuanRen: { type: 'boolean', description: '是否附穿壬四层（地盘地支/月将/神将/建星），默认 true（实验性附加层）。' },
      feiPanUseZhongMen: { type: 'boolean', description: '飞盘/括囊是否用中门（九门），默认 false。' },
      kuoNangTianPanGanZiFei: { type: 'boolean', description: '括囊天盘干是否「自飞九宫」，默认 false（随九星）。' },
      shan: { type: 'string', description: '山向局坐山（二十四山，如「子」）；仅 juType=山向 用。' },
      xiang: { type: 'string', description: '山向局朝向（二十四山，如「午」）；仅 juType=山向 用。' },
      mingYun: { type: 'boolean', description: '返回命运局（原命局 + 10 步大运局；实验性，不套八字），默认 false。' },
    },
    timeoutMs: 20_000,
    async execute(args) {
      let date
      try {
        date = parseDateTime(args.datetime)
      } catch (error) {
        return fail(error?.message ?? error)
      }
      try {
        const engine = await import('./engine/qimen.js')
        const longitude = Number.isFinite(args.location?.longitude) ? Number(args.location.longitude) : undefined
        const baseOptions = {
          date,
          method: args.method ?? '转盘',
          juType: args.juType ?? '时家',
          juMethod: args.juMethod ?? '拆补',
          jiGong: args.jiGong ?? '坤二',
          lateZi: args.lateZi ?? 'nextDay',
          zhirunDays: args.zhirunDays == null ? 8 : Number(args.zhirunDays),
          anGanMode: args.anGanMode ?? '八门地盘携带之干',
          chuanRen: args.chuanRen == null ? true : Boolean(args.chuanRen),
          feiPanUseZhongMen: Boolean(args.feiPanUseZhongMen),
          kuoNangTianPanGanZiFei: Boolean(args.kuoNangTianPanGanZiFei),
          shan: args.shan ?? null,
          xiang: args.xiang ?? null,
          longitude,
        }
        if (args.mingYun) {
          const mingYun = engine.castQimenMingYun(baseOptions)
          if (!mingYun || typeof mingYun !== 'object') return fail('奇门命运局没有返回盘面。')
          try {
            const { saveChartSnapshot } = await import('./chart-snapshot.js')
            await saveChartSnapshot('qimen', mingYun.natal, cfg.chartSnapshotPath)
          } catch {
            // snapshot for the sidebar panel is optional
          }
          return {
            ok: true,
            question: args.question ?? null,
            ...mingYun,
            hints: [
              ...(mingYun.natal?.hints ?? []),
              '命运局：原命局 + 10 步大运局（每 9 年一步、时柱顺排，阴阳遁与局数不变）；实验口径，未排起运岁数/顺逆/流年。',
              '奇门以用神落宫与克应为主，卦辞不作断。',
            ],
          }
        }
        const chart = engine.castQimen(baseOptions)
        if (!chart || typeof chart !== 'object') return fail('奇门引擎没有返回盘面。')
        try {
          const { saveChartSnapshot } = await import('./chart-snapshot.js')
          await saveChartSnapshot('qimen', chart, cfg.chartSnapshotPath)
        } catch {
          // snapshot for the sidebar panel is optional
        }
        const almanac = await buildAlmanac(date, args.location)
        return {
          ok: true,
          question: args.question ?? null,
          time: chart.time ?? almanac,
          ...chart,
          hints: [...(chart.hints ?? []), '奇门以用神落宫与克应为主，卦辞不作断。'],
        }
      } catch (error) {
        return fail(`奇门排盘失败：${error?.message ?? error}`)
      }
    },
  })

  const liurenTool = defineTool({
    name: 'gua_liuren',
    description:
      '大六壬排盘。给时间（缺省为当前）与所问之事，返回月将与过宫依据、天地盘（十二支）、四课（日干寄宫）、三传（九宗门取法）、十二天将（昼夜贵人与顺逆）、旬空。六壬重四课三传与天将，断法见 guashi-liuren 技能；起课前可先 gua_now 取时取地。',
    parameters: {
      datetime: { type: 'string', description: '起课时刻，ISO 格式；缺省用当前时间。' },
      question: { type: 'string', description: '所问何事（原样回显）。' },
      location: { type: 'object', description: '可选 { city?, longitude? }；昼夜贵人判断也受时区影响，可用 gua_now 的结果。' },
      daynight: { type: 'string', enum: ['auto', '昼', '夜'], description: '昼夜，默认 auto（卯至申为昼）。' },
    },
    timeoutMs: 20_000,
    async execute(args) {
      let date
      try {
        date = parseDateTime(args.datetime)
      } catch (error) {
        return fail(error?.message ?? error)
      }
      try {
        const engine = await import('./engine/liuren.js')
        const longitude = Number.isFinite(args.location?.longitude) ? Number(args.location.longitude) : undefined
        const chart = engine.castLiuren({ date, daynight: args.daynight ?? 'auto', longitude })
        if (!chart || typeof chart !== 'object') return fail('六壬引擎没有返回盘面。')
        const almanac = await buildAlmanac(date, args.location)
        return {
          ok: true,
          question: args.question ?? null,
          time: chart.time ?? almanac,
          ...chart,
          hints: [...(chart.hints ?? []), '六壬以四课三传为骨，天将为用；课体既定再取神煞。'],
        }
      } catch (error) {
        return fail(`六壬排盘失败：${error?.message ?? error}`)
      }
    },
  })

  return [qimenTool, liurenTool]
}


