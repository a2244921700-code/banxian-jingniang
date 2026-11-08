// gua_bazi —— 八字（子平）排盘。
//
// 输入出生公历时间与性别，可选出生地经度与真太阳时开关；输出与前端
// `client/bazi-chart` 契约对齐的四柱、十神、藏干、星运、自坐、空亡、纳音、
// 常用神煞子集、大运（顺逆/起运/交运）、流年、流月。旺衰/格局/用神/应期属断法，
// 由技能与知识库处理，引擎不写断语。

import { defineTool, fail, parseDateTime } from './tool-utils.js'

export function createBaziTool(config) {
  const cfg = config ?? {}
  const defaultLocation = cfg.defaultLocation ?? {}

  const tool = defineTool({
    name: 'gua_bazi',
    description:
      '八字（子平）排盘。给出生公历时间（datetime，必须）与性别（gender：男/女），可选出生地/经度（location.longitude，默认按真太阳时排盘）、姓名、now（计算当前大运/流年的参照时间）。返回四柱、日主、十神、藏干、十二长生（星运/自坐）、旬空、纳音、常用神煞子集、大运（顺逆、起运、交运）与每条大运下的流年、流月，以及 hints。旺衰/格局/用神/应期见 guashi-bazi 技能（待建）；断卦记档用 gua_case。',
    parameters: {
      datetime: { type: 'string', description: '出生公历时刻，ISO 或 "YYYY-MM-DD HH:mm"；可用 +08:00 注明时区。' },
      gender: { type: 'string', enum: ['男', '女'], description: '性别，必填（决定大运顺逆）。' },
      name: { type: 'string', description: '可选：盘主称呼。' },
      location: { type: 'object', description: '可选 { city?, longitude? }；给经度则默认按真太阳时排盘。' },
      trueSolarTime: { type: 'boolean', description: '是否用真太阳时（有经度时默认 true；false 则按北京时间）。' },
      now: { type: 'string', description: '可选：计算「当前大运/流年」的参照时间，缺省当下。' },
    },
    timeoutMs: 20_000,
    async execute(args) {
      if (!args.gender) return fail('八字排盘需要性别（男/女）。')
      if (!args.datetime) return fail('八字排盘需要出生公历时间（datetime）。')
      let date
      let now
      try {
        date = parseDateTime(args.datetime)
        now = args.now ? parseDateTime(args.now) : new Date()
      } catch (error) {
        return fail(error?.message ?? error)
      }
      try {
        const engine = await import('./engine/bazi.js')
        const longitude = Number.isFinite(args.location?.longitude)
          ? Number(args.location.longitude)
          : (Number.isFinite(defaultLocation.longitude) ? Number(defaultLocation.longitude) : undefined)
        const chart = engine.castBazi({
          date,
          gender: args.gender,
          name: args.name,
          longitude,
          trueSolarTime: args.trueSolarTime !== false,
          now,
        })
        try {
          const { saveChartSnapshot } = await import('./chart-snapshot.js')
          await saveChartSnapshot('bazi', chart, cfg.chartSnapshotPath)
        } catch {
          // snapshot for the sidebar panel is optional
        }
        const curDy = chart.dayun[chart.meta.currentDayunIndex]
        const curLn = curDy?.liunian?.find((x) => x.year === chart.meta.currentLiunianYear)
        return {
          ok: true,
          summary: {
            fourPillars: chart.meta.fourPillars,
            rizhu: chart.meta.rizhu,
            shengxiao: chart.meta.shengxiao,
            direction: chart.meta.direction,
            qiyun: chart.meta.qiyun,
            currentDayun: curDy ? `${curDy.from}-${curDy.to} ${curDy.gan}${curDy.zhi}` : null,
            currentLiunian: curLn ? `${curLn.year} ${curLn.gan}${curLn.zhi}` : null,
          },
          ...chart,
          hints: [
            ...(chart.hints ?? []),
            '断法：先看日主旺衰与格局用神，再看大运流年；本工具只出盘面，吉凶归 guashi-bazi 技能（待建）。',
          ],
        }
      } catch (error) {
        return fail(`八字排盘失败：${error?.message ?? error}`)
      }
    },
  })

  return tool
}

