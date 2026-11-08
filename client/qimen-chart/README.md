# 奇门遁甲 · 九宫盘（多局 / 多设置前端原型 v0.2）

「半仙·鲸娘」的奇门前端第二步：**零依赖、双击可开**的九宫盘页面，把「时家拆补转盘」的单一盘面扩展为
**多起局方式 / 多盘式 / 多设置 / 多局标签 / 穿壬盘面**的可交互原型。

- 数据由引擎 `lib/engine/qimen.js` 的 `castQimen()` / `castQimenMingYun()` **实算**，经 `tools/gen-sample.mjs`
  预生成到 `sample-data.js`；页面本身不排盘、不改引擎。
- 引擎未实现的字段一律不写或置空，页面显示「—」；实验/未校核项显示「实验/待校核」标签，**不拿转盘数据冒充飞盘**。
- 版式只参考 `docs/REF-CONGZHEN-QIMEN.md` 的结构（九宫卡片、信息层级、多局标签），配色/样式自绘，未复制其素材。

## 打开

双击 `index.html`（或拖进浏览器），不需要服务器与构建。

- 默认示例盘：2024-07-22 09:09（甲辰 辛未 丁亥 乙巳，阴遁二局·中元·拆补·转盘，与旧版示例一致）。
- 另两局：局式2（2026-11-07 20:45）、局式3（2026-11-08 10:30），用于演示多局标签切换。
- 命运局：1990-06-15 10:30 起原命局 + 十步大运局（实验/待校核）。

## 默认流派

本页默认口径：**时家奇门 · 转盘 · 拆补法 · 中五寄坤二**（现代主流常用，与 `gua_qimen` 默认一致；置闰为可选古法）。页面顶部与排盘设置底部均标出该默认；其余起局/盘式/多局均属实验或可选，按「实验/待校核」显示。

## 页面

- **顶部**：品牌、多局标签（局式1 / 局式2 / 局式3 / 命运局）、当前起局方式与盘式 pill。
- **排盘设置**：六个下拉（见下表），每项带「未实现 / 实验·待校核」后缀；顶部汇总标记；可一键重置本局设置。
- **提示条**：实验盘、未生成组合、命运局不可用等情形明确提示（含引擎给出的原因），不做静默回退。
- **信息卡**：日期/农历/节气、四柱（上干下支）、`阴阳遁X局·元·节气·符头·定局法·值符·值使`、
  以及值符/值使落宫、旬首、寄宫、子时口径、暗干排法、月建、穿壬月将/昼夜贵/贵人等 chips。
- **九宫盘面**：3×3，每宫显示
  1. 宫名 + 方位 + 空/马角标；
  2. 八神（金）、九星 + 天盘干；
  3. 八门 + 地盘干；
  4. 暗干（可关）；
  5. **穿壬**：地盘地支 + 每条地支的「月将 / 神将 / 建星」（引擎无数据时整块显示「—」并可关）；
  6. 星/门旺衰（可关）、备注（可关）；
  7. 中五宫显示天/地盘干、天禽寄宫与说明。
- **宫位详情**：点任意宫联动，列出八神/九星/八门/天地盘干/暗干/旺衰/空马，以及逐条穿壬四层。
- **命运局标签**：显示「原命局 + 第1–10 步大运局」选择带（虚岁区间、年份、时柱干支），点击切换盘面；
  引擎未提供时显示「未提供」并留「—」，不做套八字。
- **底部**：日空/时空/时马/日柱/月建；暗干、旺衰、穿壬、备注四个显示开关；五行/穿壬图例。

### 排盘设置项

| 维度 | 选项 | 引擎状态 |
|---|---|---|
| 起局方式 | 时家拆补 / 时家置闰（默认盘可校核） | ✅ 可用 |
| 起局方式 | 时家茅山、时家阴盘、分家阳盘、刻家阴盘 | ⚠️ 实验/待校核 |
| 起局方式 | 年家、月家、日家、太乙日家、山向、奇门罗盘、奇门套玄空 | ⚠️ 实验/待校核（含 `meta.jiuYun`、`meta.shanXiang`、`meta.luoPan`、`meta.xuanKong` 等附加信息） |
| 盘式 | 转盘（默认） / 飞盘 / 括囊 | 飞盘、括囊 ⚠️ 实验/待校核 |
| 寄宫 | 统一寄坤二（默认） / 阳遁寄艮八·阴遁寄坤二 | ✅ 可用 |
| 早晚子时 | 子时换日（默认） / 夜子时 | ✅ 可用 |
| 置闰天数 | 8 天（默认） / 9 天 | ✅ 可用（仅时家置闰生效） |
| 暗干排法 | 八门地盘携带之干（默认） | ✅ 可用 |
| 暗干排法 | 时干找值使飞布（两种入中口径）、时干加值使转天盘、暗天干地支飞布法 | ⚠️ 实验/待校核 |

「实验/待校核」项的盘面由引擎按实验口径输出、`hints` 首条标「【实验·未校核】本盘含：…」，
页面顶部提示条同步列出。**示例数据只为「已实现的组合」预生成盘面**：设置切到未生成的组合时，
盘面区显示占位与原因（不采用临近设置的数据顶替）。

## 数据生成（引擎改完必须重跑）

```powershell
node client/qimen-chart/tools/gen-sample.mjs
```

- 只读调用 `dsh-guashi-agent/lib/engine/qimen.js`（不写引擎/工具/测试）；
- 逐项探测起局方式、盘式、暗干排法：引擎抛错、`hints` 说未实现或盘面与基准相同 → 标 `supported:false`；
  `meta.experimental` / `meta.experimentalItems` → 标 `experimental:true`；
- 生成内容：局式1 全量（各起局方式 + 拆补/置闰 × 寄宫 × 早晚子时 + 置闰天数/盘式/暗干变体）、
  局式2/3 基础变体、命运局原命局 + 10 步大运局；穿壬 `chuanRen` 逐宫 / 顶层信息一并写入；
- 缺字段置 null（前端显示「—」）；顶层 12 条穿壬明细与逐宫重复，示例只保留逐宫明细与顶层摘要以控制体积；
- 当前产物：`sample-data.js` 约 **379 KB**，37 张盘（其中实验盘 17），命运局 10 步；
- `sample-data.js` 头部与 `window.QIMEN_WORKSPACE.meta` 记录引擎路径、字节数、mtime、生成时间，便于核对是否过期。

开发期还可用 `QIMEN_ENGINE` / `QIMEN_SAMPLE_OUT` 环境变量指向临时 mock 引擎/输出目录，做契约回归（不改正式数据）。

## 数据契约（前端工作区 v2）

```js
window.QIMEN_SAMPLE     // 单盘（兼容旧 API），= 局式1 默认盘
window.QIMEN_WORKSPACE = {
  version, meta: { generatedAt, engine: { path, mtime, bytes, exports, hasMingYun }, counts, note },
  catalog: { juModes[], panModes[], jiGongs[], lateZis[], zhirunDays[], anGanModes[] }, // 每项 {id,label,supported,experimental,notes}
  defaults: { juMode, panMode, jiGong, lateZi, zhirunDays, anGanMode },
  scenes: [{ id, label, datetime, question, charts: [{ key, settings, experimental, experimentalItems, notes, chart }] }],
  mingyun: { supported, experimental, birth, notes, natal, steps: [{ index, label, ageFrom, ageTo, year, hourGanzhi, chart }] },
  tabs: [{ id, label, type: 'scene'|'mingyun', sceneId? }]
}
```

单张 `chart` 与 `gua_qimen` 引擎输出同构（只增不改）：`input{datetime,solarTerm,fourPillars,dayKong,hourKong,lunar}`、
`ju{yinYang,number,yuan,solarTerm,futou,method,juMethod,juType,panMethod,…}`、`zhiFu`/`zhiShi`/`xunShou`/
`kongWang`/`maXing`、`palaces[9]`（含 `chuanRen{diPanDiZhi,items[{branch,tianPan,yueJiang,shenJiang,jianXing}]}`、
`kuoNangDoor` 等）、`hints[]`、`meta{…,experimental,experimentalItems,extras{…}}`、`settings`（实际生效）、
`requested`（原样请求）、`chuanRenTop{yueJiang,dayNight,guiren,monthBranch}`。

## 对外 API

```js
QimenChart.render(data)              // 传工作区（多局）或单盘 chart（兼容旧版）；返回 API
QimenChart.getData()                 // 当前盘面（chart）
QimenChart.getState()                // { activeTabId, tab, settings, options, selected, mingyunStep, experimental, chuanRen, notice }
QimenChart.getOptions()              // 显示开关
QimenChart.getWorkspace()            // 当前工作区
QimenChart.setOption(k, v)           // 'anGan' | 'wangShuai' | 'notes' | 'chuanRen'
QimenChart.setSettings(partial)      // 改当前局式标签的排盘设置并重绘
QimenChart.selectTab(id)             // 切换局式/命运局标签
QimenChart.selectMingyunStep(i)      // 命运局：0=原命局，1..10=大运步
QimenChart.select(index)             // 选中第 index 宫（1–9/5 为中宫）
QimenChart.onSelect = palace => {}   // 点宫回调
```

示例：`QimenChart.setSettings({panMode:'飞盘'})` 会切到飞盘实验盘并显示「实验/待校核」提示条；
`QimenChart.selectTab('mingyun')` 切到命运局标签。

## 自检

```powershell
# 只跑自检（无头 Edge，旧 --headless + --virtual-time-budget + Start-Process）
powershell -NoProfile -ExecutionPolicy Bypass -File client\qimen-chart\tools\selftest.ps1
# 自检 + 重生成 preview.png
powershell -NoProfile -ExecutionPolicy Bypass -File client\qimen-chart\tools\selftest.ps1 -Shot
```

**当前结果：`SELFTEST OK 51/51`（0 FAIL，无 JS 错误）**。`selftest.html` 覆盖：

1. 工作区/九宫卡片/宫序/四柱/局信息/值符值使/八神/数据元信息/无 JS 错误；
2. 暗干显示与开关、旺衰与开关；
3. 穿壬：每宫有穿壬块、四层（地盘/月将/神将/建星）渲染或缺失显示「—」、头部穿壬 chip、开关；
4. 点宫 onSelect / 详情联动 / 详情穿壬行；
5. 设置面板 6 项、起局方式 13 项、未实现/实验标签、置闰天数、暗干 5 法；
6. 切换寄宫、置闰、飞盘（支持则渲染实验盘 + 提示；不支持则占位不冒充）、切回与重置；
7. 多局标签 4 个、切局式2/3、标签高亮、切回；多局起局方式（年家）与山向/套玄空附加信息；
8. 局式2 未生成组合 → 占位 + 原因提示，不拿其他盘冒充；
9. 命运局：大运条、切大运步生效；引擎未提供时明确提示且不伪造盘面；
10. `getData`/`getState`/`getWorkspace`/`setOption`，以及 `render(单盘)` 旧 API 兼容。

`preview.png`：1440×1500 无头 Edge 截图（2026-11-07，引擎 mtime 2026-11-07T12:57Z 的示例数据）。

## 当前边界

- ✅ 已做：九宫盘、多局标签（局式1/2/3 + 命运局）、六个设置维度与实验标签、穿壬四层、暗干/旺衰/空马、
  点宫详情、占位与「—」不伪造、API、自检、生成器。
- ⚠️ 实验/待校核：飞盘/括囊；茅山/阴盘/分家阳盘/刻家阴盘；年/月/日/太乙日家/山向/罗盘/套玄空；
  其余 4 种暗干排法；命运局。规则与字段已接通，但口径未经完整校核，仅供参考。
- ⬜ 未做：断法/AI 提示词导出、案例库、套八字（任务明确不做）、把 `gua_qimen` 实时输出接进右侧栏、
  多主题换肤、保存/截图水印。
- 页面数据为 `sample-data.js` 静态示例；引擎更新后需重跑 `tools/gen-sample.mjs` 并重跑自检/截图。

## 文件

```
client/qimen-chart/
  index.html        页面
  qimen.css         样式
  qimen.js          渲染与交互（window.QimenChart）
  sample-data.js    由 tools/gen-sample.mjs 生成，勿手改
  selftest.html     自检（无头 Edge 跑）
  tools/gen-sample.mjs   调引擎生成示例数据
  tools/selftest.ps1     无头自检/截图脚本
  preview.png       实渲截图
  README.md
```
