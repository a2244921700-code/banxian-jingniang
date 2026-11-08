window.__ModuleLoader__.load({
  id: '@local/guashi-chart-panel',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useRef, useState } = React

    const ID = '@local/guashi-chart-panel'
    const TAB_ID = 'guashi-chart-panel'
    const KIND = 'guashi-chart'
    const RESOURCE = 'dsh-resource://guashi-chart/latest'
    const RPC_ENDPOINT = 'guashi-chart/dispatch'
    let latestChartType = 'ziwei'

    const ELEMENT_COLOR = {
      木: '#2fa13a', 火: '#d30505', 土: '#8b6d03', 金: '#ef9104', 水: '#2e83f6',
    }
    const BRANCH_ELEMENT = {
      子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火',
      午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
    }
    const SIHUA_COLOR = { 禄: '#2e8b57', 权: '#c95052', 科: '#2e83f6', 忌: '#8b1a1a' }
    const BAGUA_POS = {
      巳: [1, 1], 午: [2, 1], 未: [3, 1], 申: [4, 1],
      辰: [1, 2], 酉: [4, 2], 卯: [1, 3], 戌: [4, 3],
      寅: [1, 4], 丑: [2, 4], 子: [3, 4], 亥: [4, 4],
    }

    const CSS = `
.gcp-root{height:100%;overflow:auto;background:var(--dsw-alias-bg-base,#f7f7f7);color:var(--dsw-alias-label-primary,#313131);font-size:12px;line-height:1.5;padding:12px 14px;box-sizing:border-box}
.gcp-root *{box-sizing:border-box}
.gcp-headline{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:2px}
.gcp-headline b{font-size:18px;letter-spacing:.08em}
.gcp-sub{color:var(--dsw-alias-label-secondary,#666);font-size:11.5px}
.gcp-pill{display:inline-block;border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:10px;padding:1px 8px;font-size:11px;margin:2px 4px 2px 0;color:var(--dsw-alias-label-secondary,#666)}
.gcp-card{border:1px solid var(--dsw-alias-border-l1,#e3e3e3);border-radius:8px;background:var(--dsw-alias-bg-layer-1,#fff);margin-top:10px;overflow:hidden}
.gcp-table{display:grid;grid-template-columns:46px repeat(4,minmax(0,1fr))}
.gcp-table>div{border-right:1px solid var(--dsw-alias-border-l1,#eee);border-bottom:1px solid var(--dsw-alias-border-l1,#eee);padding:5px 4px;min-height:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-size:11.5px;min-width:0;word-break:break-all}
.gcp-table>div:nth-child(5n){border-right:none}
.gcp-label{color:var(--dsw-alias-label-dimmed,#999);font-size:10.5px!important;align-items:flex-start!important;text-align:left!important;padding-left:7px!important;background:var(--dsw-alias-bg-layer-2,#fbfbfb)}
.gcp-col-head{background:var(--dsw-alias-bg-layer-2,#f3f3f3);font-weight:600;color:var(--dsw-alias-label-secondary,#555)}
.gcp-gan{font-size:19px;font-weight:700;line-height:1.2}
.gcp-zhi{font-size:19px;font-weight:700;line-height:1.2}
.gcp-ss{font-size:10.5px;color:var(--dsw-alias-label-secondary,#777)}
.gcp-cang{font-size:10.5px;color:var(--dsw-alias-label-secondary,#666);align-items:flex-start!important;text-align:left!important}
.gcp-cang-line{white-space:nowrap}
.gcp-sha{font-size:10px;color:var(--dsw-alias-label-tertiary,#888);align-items:flex-start!important;text-align:left!important;padding:3px 5px!important}
.gcp-sha span{display:block;line-height:1.4}
.gcp-section{margin-top:10px;font-size:11px;color:var(--dsw-alias-label-secondary,#666);letter-spacing:.04em}
.gcp-strip{display:flex;gap:5px;overflow-x:auto;padding:4px 0 2px}
.gcp-chip{flex:0 0 auto;min-width:58px;border:1px solid var(--dsw-alias-border-l1,#e3e3e3);border-radius:6px;background:var(--dsw-alias-bg-layer-1,#fff);padding:4px 7px;text-align:center;cursor:pointer;line-height:1.35;color:var(--dsw-alias-label-secondary,#555);font-size:11px}
.gcp-chip:hover{border-color:var(--dsw-alias-brand-primary,#d9a441)}
.gcp-chip.on{border-color:var(--dsw-alias-brand-primary,#d1a348);background:var(--dsw-alias-bg-layer-2,#fff9ee)}
.gcp-chip .gz{display:block;font-size:13px;font-weight:600;margin-top:1px}
.gcp-chip .sub{display:block;font-size:10px;color:var(--dsw-alias-label-dimmed,#999)}
.gcp-now{margin-top:8px;display:flex;gap:12px;flex-wrap:wrap;font-size:11.5px;color:var(--dsw-alias-label-secondary,#555)}
.gcp-empty{padding:36px 20px;text-align:center;color:var(--dsw-alias-label-dimmed,#999);line-height:1.8}
.gcp-ziwei{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:repeat(4,minmax(96px,1fr));gap:4px;margin-top:10px}
.gcp-palace{border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:5px;background:var(--dsw-alias-bg-layer-1,#fff);padding:4px 5px;font-size:10.5px;min-width:0;overflow:hidden}
.gcp-palace.ming{border-color:var(--dsw-alias-brand-primary,#d1a348)}
.gcp-palace-title{display:flex;justify-content:space-between;gap:4px;font-weight:600;font-size:11px;color:var(--dsw-alias-label-primary,#333)}
.gcp-palace-title em{font-style:normal;color:var(--dsw-alias-label-dimmed,#999);font-weight:400}
.gcp-stars{margin-top:2px;line-height:1.45}
.gcp-star{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gcp-star b{font-weight:600}
.gcp-star .br{color:var(--dsw-alias-label-tertiary,#999);font-size:9.5px;margin-left:2px}
.gcp-star .sh{font-weight:700;margin-left:2px}
.gcp-aux{color:var(--dsw-alias-label-secondary,#777);font-size:10px;line-height:1.4}
.gcp-daxian{color:var(--dsw-alias-label-dimmed,#999);font-size:10px;margin-top:2px}
.gcp-center{grid-column:2 / 4;grid-row:2 / 4;border:1px solid var(--dsw-alias-brand-primary,#d1a348);border-radius:5px;background:var(--dsw-alias-bg-layer-2,#fffdf6);padding:8px 9px;display:flex;flex-direction:column;justify-content:center;gap:3px;font-size:11px;color:var(--dsw-alias-label-secondary,#555)}
.gcp-center b{color:var(--dsw-alias-label-primary,#333);font-size:11.5px}
.gcp-error{color:var(--dsw-alias-state-error-primary,#c00);font-size:11.5px;margin-top:8px}
.gcp-foot{margin-top:10px;font-size:10.5px;color:var(--dsw-alias-label-dimmed,#999);text-align:center}
.gcp-qm-pillars{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 2px}
.gcp-qm-pillar{border:1px solid var(--dsw-alias-border-l1,#e3e3e3);border-radius:6px;background:var(--dsw-alias-bg-layer-1,#fff);padding:3px 8px;font-size:11px;color:var(--dsw-alias-label-secondary,#555)}
.gcp-qm-pillar b{color:var(--dsw-alias-label-primary,#333);font-size:13px;letter-spacing:.05em}
.gcp-qm-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;margin-top:8px}
.gcp-qm-palace{border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:6px;background:var(--dsw-alias-bg-layer-1,#fff);padding:4px 5px;min-height:108px;font-size:10.5px;overflow:hidden}
.gcp-qm-palace.center{background:var(--dsw-alias-bg-layer-2,#fffdf6);border-color:var(--dsw-alias-brand-primary,#d1a348)}
.gcp-qm-palace-head{display:flex;justify-content:space-between;gap:3px;color:var(--dsw-alias-label-dimmed,#999);font-size:10px;font-weight:600}
.gcp-qm-palace-head em{font-style:normal;color:var(--dsw-alias-state-error-primary,#b3261e)}
.gcp-qm-shen{color:#b58b16;font-size:11.5px;font-weight:600;margin-top:2px}
.gcp-qm-star,.gcp-qm-door{display:flex;gap:4px;align-items:baseline;margin-top:1px;white-space:nowrap}
.gcp-qm-star b,.gcp-qm-door b{font-size:12px}
.gcp-qm-angan{color:var(--dsw-alias-label-tertiary,#999);margin-top:1px}
.gcp-qm-angan b{color:#8b6d03;font-weight:600}
.gcp-qm-tags{display:flex;gap:3px;flex-wrap:wrap;margin-top:2px}
.gcp-qm-tags span{border:1px solid var(--dsw-alias-border-l1,#eee);border-radius:3px;padding:0 3px;color:var(--dsw-alias-label-tertiary,#999);font-size:9.5px}
.gcp-qm-center{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:82px;gap:2px;font-size:10.5px;color:var(--dsw-alias-label-secondary,#666)}
.gcp-qm-center b{font-size:17px;color:var(--dsw-alias-label-primary,#333)}
.gcp-qm-foot{margin-top:8px;font-size:10.5px;color:var(--dsw-alias-label-dimmed,#999);text-align:center}
.gcp-warn{color:#a15c00!important;border-color:#d9a441!important;background:#fff8e8!important}
`

    async function rpc(ctx, action) {
      const result = await ctx.connection.rpc.call('/api', RPC_ENDPOINT, { action })
      if (!result || !result.ok) {
        const message = result && result.error && result.error.message ? result.error.message : '命盘通道未响应'
        throw new Error(message)
      }
      return result.value
    }

    function openPanel(ctx) {
      // openResource already expands the panel with the normal push track and
      // seeds the tab; calling ctx.layout.openRightbar() as well opens the
      // rightbar without a track, leaving the frame in a half-open state until
      // the user toggles the sidebar.
      try {
        ctx.sidebarRight.openResource(RESOURCE)
      } catch {
        // Last-resort fallback when the tab type is not registered yet.
        try {
          ctx.layout.openRightbar(true, false)
        } catch {
          // ignore
        }
      }
    }

    function useLatestChart(ctx, refreshMs) {
      const [state, setState] = useState({ loading: true, data: null, error: null })
      useEffect(() => {
        let stopped = false
        let rev = null
        async function load(first) {
          try {
            const value = await rpc(ctx, 'latest')
            if (stopped) return
            const nextRev = value && value.rev ? value.rev : null
            if (first || nextRev !== rev) {
              rev = nextRev
              setState({ loading: false, data: value, error: null })
            }
          } catch (error) {
            if (!stopped) setState((prev) => ({ ...prev, loading: false, error: error.message }))
          }
        }
        load(true)
        const timer = setInterval(() => load(false), refreshMs || 1800)
        return () => { stopped = true; clearInterval(timer) }
      }, [])
      return state
    }

    function sx(element) {
      return { color: ELEMENT_COLOR[element] || 'inherit' }
    }

    function PillarTable({ chart }) {
      const pillars = Array.isArray(chart.pillars) ? chart.pillars : []
      if (!pillars.length) return h('div', { className: 'gcp-empty' }, '这盘没有四柱数据。')
      const cell = (key, render, cls) => h('div', { key, className: 'gcp-label' }, key)
      const rows = []
      const addRow = (label, render, extraCls) => {
        rows.push(cell(label, null, extraCls))
        pillars.forEach((p, i) => rows.push(h('div', { key: label + i, className: extraCls || '' }, render(p, i))))
      }
      addRow('主星', (p) => h('span', { className: 'gcp-ss' }, p.shishen || ''))
      addRow('天干', (p) => h('span', { className: 'gcp-gan', style: sx(p.ganEl) }, p.gan || ''))
      addRow('地支', (p) => h('span', { className: 'gcp-zhi', style: sx(p.zhiEl) }, p.zhi || ''))
      addRow('藏干', (p) => h('div', { className: 'gcp-cang' }, (p.canggan || []).map((c, i) => h('div', { key: i, className: 'gcp-cang-line' }, h('span', { style: sx(ELEMENT_COLOR_OF(c.gan)) }, c.gan), h('span', { className: 'gcp-ss' }, ' ' + (c.shishen || ''))))), 'gcp-cang')
      addRow('星运', (p) => h('span', { className: 'gcp-ss' }, p.xingyun || ''))
      addRow('自坐', (p) => h('span', { className: 'gcp-ss' }, p.zizuo || ''))
      addRow('空亡', (p) => h('span', { className: 'gcp-ss' }, p.kongwang || ''))
      addRow('纳音', (p) => h('span', { className: 'gcp-ss' }, p.nayin || ''))
      addRow('神煞', (p) => h('div', { className: 'gcp-sha' }, (p.shensha || []).map((s, i) => h('span', { key: i }, s))), 'gcp-sha')
      return h('div', { className: 'gcp-card' },
        h('div', { className: 'gcp-table' },
          h('div', { className: 'gcp-label' }, '四柱'),
          pillars.map((p, i) => h('div', { key: p.label || i, className: 'gcp-col-head' }, p.label || '')),
          rows))
    }

    function ELEMENT_COLOR_OF(gan) {
      const map = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' }
      return map[gan] || ''
    }

    function BaziView({ chart }) {
      const meta = chart.meta || {}
      const dayun = Array.isArray(chart.dayun) ? chart.dayun : []
      const [dyIdx, setDyIdx] = useState(typeof meta.currentDayunIndex === 'number' ? meta.currentDayunIndex : 0)
      const [lnYear, setLnYear] = useState(meta.currentLiunianYear || null)
      const [lyIdx, setLyIdx] = useState(0)

      useEffect(() => {
        setDyIdx(typeof meta.currentDayunIndex === 'number' ? meta.currentDayunIndex : 0)
        setLnYear(meta.currentLiunianYear || null)
        setLyIdx(0)
      }, [chart])

      const dy = dayun[dyIdx] || dayun[0]
      const years = dy && Array.isArray(dy.liunian) ? dy.liunian : []
      const ln = years.find((x) => x.year === lnYear) || years[0]
      const ly = ln && Array.isArray(ln.liuyue) ? ln.liuyue[lyIdx] : null

      function pickDayun(index) {
        setDyIdx(index)
        const next = dayun[index]
        if (next && next.liunian && next.liunian.length) setLnYear(next.liunian[0].year)
        setLyIdx(0)
      }

      return h('div', null,
        h('div', { className: 'gcp-headline' },
          h('b', null, meta.fourPillars || '八字命盘'),
          h('span', { className: 'gcp-pill' }, meta.rizhu || ''),
          h('span', { className: 'gcp-pill' }, meta.shengxiao ? '属' + meta.shengxiao : ''),
          h('span', { className: 'gcp-pill' }, meta.direction || '')),
        h('div', { className: 'gcp-sub' }, (meta.name || '') + ' · ' + (meta.lunar || '') + ' · ' + (meta.qiyun || '')),
        h(PillarTable, { chart }),
        h('div', { className: 'gcp-section' }, '大运（点击切换）'),
        h('div', { className: 'gcp-strip' }, dayun.map((d, i) => h('div', {
          key: d.from || i,
          className: 'gcp-chip' + (i === dyIdx ? ' on' : ''),
          onClick: () => pickDayun(i),
          title: d.from + '-' + d.to,
        }, h('span', null, d.label || d.from), h('span', { className: 'gz' },
          h('span', { style: sx(ELEMENT_COLOR_OF(d.gan)) }, d.gan),
          h('span', { style: sx(BRANCH_ELEMENT[d.zhi]) }, d.zhi)),
        h('span', { className: 'sub' }, d.age || '')))),
        h('div', { className: 'gcp-section' }, '流年 · ' + (dy ? dy.gan + dy.zhi + '（' + dy.from + '-' + dy.to + '）' : '')),
        h('div', { className: 'gcp-strip' }, years.map((y) => h('div', {
          key: y.year,
          className: 'gcp-chip' + (ln && y.year === ln.year ? ' on' : ''),
          onClick: () => { setLnYear(y.year); setLyIdx(0) },
        }, h('span', null, y.year), h('span', { className: 'gz' }, y.gan + y.zhi), h('span', { className: 'sub' }, y.shishen)))),
        ln ? h('div', { className: 'gcp-now' },
          h('span', null, '流年：' + ln.year + ' ' + ln.gan + ln.zhi + ' · ' + (ln.shishen || '') + ' · ' + (ln.age || '') + '岁'),
          ly ? h('span', null, '流月：' + ly.jieqi + ' ' + ly.gan + ly.zhi + ' · ' + (ly.shishen || '')) : null) : null,
        ln ? h('div', { className: 'gcp-strip' }, (ln.liuyue || []).map((m, i) => h('div', {
          key: i,
          className: 'gcp-chip' + (i === lyIdx ? ' on' : ''),
          onClick: () => setLyIdx(i),
        }, h('span', null, m.jieqi), h('span', { className: 'gz' }, m.gan + m.zhi), h('span', { className: 'sub' }, m.shishen)))) : null,
        h('div', { className: 'gcp-foot' }, '引擎：gua_bazi · 点击大运 / 流年 / 流月切换'))
    }

    function ZiweiPalace({ palace }) {
      const stars = Array.isArray(palace.stars) ? palace.stars : []
      const aux = Array.isArray(palace.aux) ? palace.aux : []
      const sha = Array.isArray(palace.sha) ? palace.sha : []
      return h('div', { className: 'gcp-palace' + (palace.isMing ? ' ming' : '') },
        h('div', { className: 'gcp-palace-title' },
          h('span', null, (palace.name || '') + (palace.isShen ? '·身' : '')),
          h('em', null, palace.zhi || '')),
        h('div', { className: 'gcp-stars' },
          stars.map((s, i) => h('div', { key: i, className: 'gcp-star' },
            h('b', { style: s.sihua ? { color: SIHUA_COLOR[s.sihua] } : null }, s.name),
            s.sihua ? h('span', { className: 'sh', style: { color: SIHUA_COLOR[s.sihua] } }, s.sihua) : null,
            s.bright ? h('span', { className: 'br' }, s.bright) : null)),
          aux.length ? h('div', { className: 'gcp-aux' }, aux.map((a, i) => h('span', { key: i, style: a.sihua ? { color: SIHUA_COLOR[a.sihua] } : null }, a.name + (a.sihua || '') + ' '))) : null,
          sha.length ? h('div', { className: 'gcp-aux' }, sha.join(' ')) : null),
        palace.daxian ? h('div', { className: 'gcp-daxian' }, '大限 ' + palace.daxian) : null)
    }

    function ZiweiView({ chart }) {
      const meta = chart.meta || {}
      const palaces = Array.isArray(chart.palaces) ? chart.palaces : []
      const byZhi = {}
      palaces.forEach((p) => { byZhi[p.zhi] = p })
      const cells = []
      Object.keys(BAGUA_POS).forEach((zhi) => {
        const [c, r] = BAGUA_POS[zhi]
        const palace = byZhi[zhi]
        if (!palace) return
        cells.push(h('div', { key: zhi, style: { gridColumn: c, gridRow: r } }, h(ZiweiPalace, { palace })))
      })
      const ming = palaces.find((p) => p.isMing)
      const shen = palaces.find((p) => p.isShen)
      return h('div', null,
        h('div', { className: 'gcp-headline' },
          h('b', null, meta.fourPillars || '紫薇命盘'),
          h('span', { className: 'gcp-pill' }, meta.wuxingJu || ''),
          h('span', { className: 'gcp-pill' }, meta.gender || '')),
        h('div', { className: 'gcp-sub' }, (meta.name || '') + ' · ' + (meta.birthLunar || '') + ' · 命主' + (meta.mingZhu || '') + ' · 身主' + (meta.shenZhu || '')),
        h('div', { className: 'gcp-ziwei' },
          cells,
          h('div', { className: 'gcp-center' },
            h('div', null, h('b', null, '命宫 ' + (ming ? ming.zhi : '')), ' · 身宫 ' + (shen ? shen.zhi : '')),
            h('div', null, '五行局：' + (meta.wuxingJu || '') + ' · 命主：' + (meta.mingZhu || '')),
            h('div', null, '身主：' + (meta.shenZhu || '')),
            h('div', null, '当前大限：' + (meta.daxian || '') + ' · 流年：' + (meta.liunian || '')),
            h('div', { style: { color: 'var(--dsw-alias-label-dimmed,#999)', marginTop: '4px' } }, '四化色：禄 / 权 / 科 / 忌'))),
        h('div', { className: 'gcp-foot' }, '引擎：gua_ziwei · 依通行安星法'))
    }

    function QimenPalace({ palace }) {
      const txt = (v) => (v == null || v === '' ? '—' : String(v))
      const badges = [palace.kong ? '空' : null, palace.ma ? '马' : null].filter(Boolean)
      const tags = [
        palace.starWangShuai ? '星' + palace.starWangShuai : null,
        palace.doorWangShuai ? '门' + palace.doorWangShuai : null,
      ].filter(Boolean)
      return h('div', { className: 'gcp-qm-palace' + (palace.index === 5 ? ' center' : '') },
        h('div', { className: 'gcp-qm-palace-head' },
          h('span', null, (palace.gua || '') + '宫' + (palace.direction ? '·' + palace.direction : '')),
          h('em', null, badges.join(' '))),
        palace.index === 5
          ? h('div', { className: 'gcp-qm-center' },
            h('div', null, '天盘 ', h('b', null, txt(palace.tianPanGan))),
            h('div', null, '地盘 ', h('b', null, txt(palace.diPanGan))),
            h('div', null, '天禽寄宫'))
          : h('div', null,
            h('div', { className: 'gcp-qm-shen' }, txt(palace.shen)),
            h('div', { className: 'gcp-qm-star' },
              h('b', { style: sx(palace.starElement) }, txt(palace.star)),
              h('span', { style: sx(ELEMENT_COLOR_OF(palace.tianPanGan)) }, txt(palace.tianPanGan))),
            h('div', { className: 'gcp-qm-door' },
              h('b', { style: sx(palace.doorElement) }, txt(palace.door)),
              h('span', { style: sx(ELEMENT_COLOR_OF(palace.diPanGan)) }, txt(palace.diPanGan))),
            palace.anGan ? h('div', { className: 'gcp-qm-angan' }, '暗干 ', h('b', null, palace.anGan)) : null,
            tags.length ? h('div', { className: 'gcp-qm-tags' }, tags.map((t, i) => h('span', { key: i }, t))) : null))
    }

    function QimenView({ chart }) {
      const meta = chart.meta || {}
      const ju = chart.ju || {}
      const byIndex = {}
      ;(Array.isArray(chart.palaces) ? chart.palaces : []).forEach((p) => { byIndex[p.index] = p })
      const order = [4, 9, 2, 3, 5, 7, 8, 1, 6]
      const pillars = [['年', meta.yearGanzhi], ['月', meta.monthGanzhi], ['日', meta.dayGanzhi], ['时', meta.displayHourGanzhi || meta.hourGanzhi]]
      const xun = chart.xunShou || {}
      const zf = chart.zhiFu || {}
      const zs = chart.zhiShi || {}
      const cr = chart.chuanRenTop || chart.chuanRen || null
      const expr = meta.experimental || (Array.isArray(meta.experimentalItems) && meta.experimentalItems.length)
      const school = meta.school || [ju.juType, ju.panMethod, ju.juMethod].filter(Boolean).join(' · ') || '时家 · 转盘 · 拆补'
      const juText = (ju.yinYang || '') + (ju.number == null ? '' : ju.number) + '局' + (ju.yuan ? ' · ' + ju.yuan : '')
      const crText = cr
        ? '穿壬：月将 ' + ((cr.yueJiang && (cr.yueJiang.branch || cr.yueJiang.name)) || '—') +
          ' · ' + (cr.dayNight || '—') + '贵 · 贵人 ' + ((cr.guiren && cr.guiren.branch) || '—')
        : null
      return h('div', null,
        h('div', { className: 'gcp-headline' },
          h('b', null, '奇门遁甲 · 九宫盘'),
          h('span', { className: 'gcp-pill' }, juText),
          h('span', { className: 'gcp-pill' }, school),
          expr ? h('span', { className: 'gcp-pill gcp-warn' }, '实验/待校核') : null),
        h('div', { className: 'gcp-sub' },
          '值符 ' + (zf.star || '—') + '（' + (zf.palace == null ? '—' : zf.palace) + '宫） · 值使 ' + (zs.door || '—') + '（' + (zs.palace == null ? '—' : zs.palace) + '宫） · 旬首 ' + (xun.ganzhi || '—') + '／' + (xun.yi || '—') + '仪' +
          (crText ? ' · ' + crText : '')),
        h('div', { className: 'gcp-qm-pillars' }, pillars.map(([label, gz], i) => h('span', { key: i, className: 'gcp-qm-pillar' },
          label + ' ', h('b', null, gz || '—')))),
        h('div', { className: 'gcp-qm-grid' }, order.map((index) => {
          const p = byIndex[index]
          return p ? h(QimenPalace, { key: index, palace: p })
            : h('div', { key: index, className: 'gcp-qm-palace' }, h('div', { className: 'gcp-qm-palace-head' }, '第' + index + '宫'), '—')
        })),
        h('div', { className: 'gcp-qm-foot' },
          '引擎：gua_qimen · ' + (meta.isDefaultSchool ? '默认流派' : '实际口径') + ' · ' + (ju.method || '') +
          (expr && meta.experimentalItems && meta.experimentalItems.length ? ' · 实验项：' + meta.experimentalItems.join('、') : '')))
    }

    function ChartBody({ ctx }) {
      const { loading, data, error } = useLatestChart(ctx, 1800)
      if (loading) return h('div', { className: 'gcp-empty' }, '正在读盘……')
      if (error) return h('div', { className: 'gcp-root' }, h('div', { className: 'gcp-error' }, error))
      if (!data || !data.chart) return h('div', { className: 'gcp-root' }, h('div', { className: 'gcp-empty' }, '还没有命盘。', h('br'), '在对话里让鲸娘排一盘八字、紫薇或奇门，这里会自动打开。'))
      if (data.type) latestChartType = data.type
      return h('div', { className: 'gcp-root' },
        h('style', null, CSS),
        data.type === 'qimen'
          ? h(QimenView, { chart: data.chart })
          : data.type === 'ziwei'
            ? h(ZiweiView, { chart: data.chart })
            : h(BaziView, { chart: data.chart }))
    }

    function Watcher({ ctx }) {
      const firstRev = useRef(null)
      useEffect(() => {
        let stopped = false
        let last = firstRev.current
        async function tick() {
          try {
            const value = await rpc(ctx, 'status')
            if (stopped) return
            const rev = value && value.rev ? value.rev : null
            if (last !== null && rev && rev !== last) openPanel(ctx)
            last = rev
            firstRev.current = rev
          } catch {
            // host may not be ready yet; retry on next tick
          }
        }
        const timer = setInterval(tick, 1200)
        tick()
        return () => { stopped = true; clearInterval(timer) }
      }, [])
      return null
    }

    const inject = ['connection', 'slots', 'sidebarRight', 'sidebarRightTabs', 'layout']

    function apply(ctx) {
      ctx.effect(() => ctx.sidebarRightTabs.register({
        id: TAB_ID,
        kind: KIND,
        keepMounted: true,
        patterns: ['dsh-resource://guashi-chart/**'],
        title: () => (latestChartType === 'bazi' ? '八字命盘' : latestChartType === 'qimen' ? '奇门九宫盘' : '紫薇命盘'),
      }))
      ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
        name: 'sidebar.right.pane.tab',
        key: TAB_ID,
      }, () => h(ChartBody, { ctx })))
      ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
        name: 'conversation.composer.dock',
        id: ID,
        order: 5,
      }, () => h(Watcher, { ctx })))
    }

    return { inject, apply, ID }
  },
})

