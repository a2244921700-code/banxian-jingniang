# 八字命盘 · 专业细盘（前端原型 v0.1）

「半仙·鲸娘」八字客户端的第一步：**零依赖、双击可开**的细盘页面。
自研专业细盘版式；当前数据为**虚构示例**（1988-11-02 09:30，戊辰年 壬戌月 辛酉日 癸巳时，男，非真人命例），后续由 `gua_bazi` 引擎输出同构数据替换。

## 打开方式

双击 `index.html`（或拖进浏览器）。不需要服务器、不需要构建。

## 页面

### 排盘（默认）

- 顶部信息卡：姓名/性别、农历/阳历、起运、交运、司令。
- **主盘表格**：列 = `日期 / 流月 / 流年 / 大运 / 年柱 / 月柱 / 日柱 / 时柱`；行 =
  `主星（十神） / 天干 / 地支 / 藏干（含副星） / 星运（十二长生） / 自坐 / 空亡 / 纳音 / 神煞`。
- 下方三条选择带：
  - **大运**：10 步大运（含起运前一段），点击切换；
  - **流年**：当前大运的 10 年，点击切换；
  - **流月**：当前流年的 12 个节气月，点击切换。
- 默认展示：**四柱 + 当前大运 + 当前流年 + 当前流月**（示例盘默认 2019 乙卯大运、2026 丙午年、辛丑月，与参考截图一致）；其余大运/流年/流月由用户点击交互查看。
- 五行配色：木 `#2fa13a`、火 `#d30505`、土 `#8b6d03`、金 `#ef9104`、水 `#2e83f6`。

### 合婚（独立页）

与排盘页相互独立（顶部页签切换）：双人卡片 + 对照表（生肖、日元、夫妻宫、旺衰、格局、五行最旺/最弱、纳音、神煞、相互关系、婚姻格言）。当前为示例数据。

## 数据契约（草案，供后续 `gua_bazi` 对齐）

```js
{
  meta: { name, gender, solar, lunar, qiyun, jiaoyun, siling, rizhu, /* … */ },
  pillars: {
    year:  { gan, zhi, shishen, canggan: [{gan, shishen}], xingyun, zizuo, kongwang, nayin, shensha: [] },
    month: { … }, day: { … }, hour: { … }
  },
  dayun:   [{ from, to, label, age, gan, zhi }],
  liunian: [{ year, age, gan, zhi, shishen }],
  liuyue:  [{ idx, jieqi, gan, zhi, shishen }]
}
```

当前 `bazi.js` 内部按此结构计算示例盘（十神/藏干/十二长生/自坐/旬空/纳音/部分神煞/大运流年流月），后续可整体迁到 `lib/engine/bazi.js`。

## 对外 API（给 Agent / 外部脚本用）

```js
BaziChart.render(data)          // 重绘整盘（当前使用内置示例盘）
BaziChart.getState()            // { dayunIdx, liunianYear, liuyueIdx, columns, … }
BaziChart.selectDayun(i)        // 切换第 i 步大运（0–9）
BaziChart.selectLiunian(year)   // 切换流年（须在当前大运 10 年内）
BaziChart.selectLiuyue(i)       // 切换流月（0–11，寅月…丑月）
BaziChart.onSelect = state => {} // 选择变化回调
```

示例：控制台 `BaziChart.selectDayun(3)` 会切到 2029 甲寅大运，并刷新下方流年列表。

## 当前状态与边界

- ✅ 细盘表格、四柱/大运/流年/流月联动、五行配色、神煞、大运/流年/流月选择、合婚独立页、API。
- ⚠️ 数据为**示例盘**；神煞目前为示例数据 + 部分规则子集（出生四柱按参考盘、动态列计算子集），引擎完成后统一由 `gua_bazi` 输出。
- ⬜ 未做：基本信息页、断事笔记、分柱（五柱）、流日流时、合婚计算（当前为静态示例）、书库/题库。
- 版式参考：`docs/REF-BAZI-APP.md`；截图参考 `preview.png`。

## 自检

`selftest.html`（无头浏览器 18 项）：表格结构、四柱/默认大运流年流月、星运/空亡/纳音、切换与回调、合婚页签。

