# 紫微斗数可视化客户端 · 项目规划（v0.1）

- 更新：2026-11-07 01:00
- 目标一句话：把「半仙·鲸娘」从纯对话 Agent，升级为 **AI 可操作、人看得到** 的桌面客户端——中间/主区是紫微命盘，旁边是 Agent 对话与断语；Agent 通过工具输出结构化盘面，前端负责渲染与交互。
- 本文是长期记忆锚点：路径、决定、进度、数据契约都记在这里；每完成一步回来勾状态。

---

## 0. 当前进度（2026-11-07）

| 项 | 状态 |
|---|---|
| JDK 21 + FFDec 26.4.0 环境 | ✅ 完成 |
| base.apk（文墨天机 2.5.26）解包 + App.swf 反编译 | ✅ 980 个 AS3 文件、10.2 MB |
| 从反编译代码提取盘面结构/配色/组件线索 | ✅ 有了初步结论（见 §2） |
| 前端原型骨架（index.html + chart.css） | ✅ 已建 |
| A2 渲染层 `chart.js` + 示例盘 | ✅ 完成（12 宫渲染、四化/庙旺/神煞、中宫信息） |
| A3 交互（详情栏/切换神煞四化/主题/示例盘） | ✅ 完成 |
| A4 AI 操作 API（render/getData/setTheme/toggle/focus/onSelect） | ✅ 完成 |
| A5 验收（截图 + 自检 + README） | ✅ 完成：`preview.png`、`selftest.html`（9 项 PASS）、`README.md` |
| A6 打磨（字号密度/PNG 导出；移动端不做） | ⬜ 可选 |
| 紫微引擎 `engine/ziwei.js` + 工具 `gua_ziwei` | ✅ 完成：`ziwei.js`/`ziwei-data.js`/`tools-ziwei.js`；5 项引擎测试，60 例 py-iztro 对照零差异 |
| 格局数据集入库、`guashi-ziwei` 技能、人设升级 | ✅ 格局大全 + 技能完成；人设升级暂停（待作者其他前提内容） |
| 客户端与 DSH 集成 | 🟡 已实现右侧栏插件 `guashi-chart-panel`（八字/紫微自动打开），待重启验收 |

---

## 1. 为什么做、做成什么样

- 现状：卦师 Agent 只能输出文字；紫微斗数排盘没有引擎也没有可视化。
- 目标形态：
  - **看得见**：12 宫命盘、主星/辅星/四化/庙旺/大限流年/神煞，一屏读完。
  - **AI 可操作**：盘面由工具输出的 JSON 驱动，Agent 能刷新盘、切主题、聚焦某宫、下断语；人也能点选宫位看细节。
  - **持续可用**：先独立静态页面（零依赖、双击可开），后续再考虑嵌进 DSH Web 侧栏或做成独立客户端。
- 视觉基调：浅灰纸面（参考文墨天机的 `#CECECE` 底 + 白格 + `#6666CC` 蓝紫强调），另备「墨色」主题给鲸娘气质。

---

## 2. 从「文墨天机」反编译得到的盘面认知

App：`com.ziwei001.zwmobilepro`（文墨天机 专业版 2.5.26），Adobe AIR 应用，界面在 `App.swf`（13 MB），Haxe/OpenFL 编写，类名混淆为 `WenMoTianJiK*`。

| 发现 | 内容 | 对我们的用处 |
|---|---|---|
| 盘面布局 | 12 宫环形：`巳午未申 / 辰□ □酉 / 卯□ □戌 / 寅丑子亥`，中间 2×2 为中宫信息 | 直接作为原型网格 |
| 每宫内容 | 宫名 + 地支、大限/流年标记、主星+庙旺、辅星、四化（禄权科忌）、神煞 | 设计每格内容槽位 |
| 配色 | 底 `#CECECE`、格 `#FFFFFF`、线 `#B2B2B2`、强调 `#6666CC`、弹窗渐变灰 | 浅色主题色板 |
| UI 框架 | `WenMoTianJiK9442K`（UI/UIButton/UILabel/UIWindow/UITabPages/UIList…） | 组件命名参考 |
| 命盘绘制 | `WenMoTianJiK93C9K`（`K9367K` 等）：TextField + BitmapData 逐格绘制 | 印证「宫格 + 文字」方案 |
| 星曜算法 | `WenMoTianJiK9373K`：`getStar/getYunStar/getLiuStar` 等取星函数与星表 | 阶段 B 对照安星法 |
| 格局数据 | `WenMoTianJiK9329K`：明文格局条目（吉/凶格、诗曰、命例）4.1 万字符 | 阶段 C 整理入库 |
| 限制 | 界面中文在加密字符串池 `StrPoolData.bin`（175,941 B），未解出明文 | 原型标签用通行叫法，不依赖它 |

反编译产物路径（记忆锚点）：
- APK：`C:\Users\22449\Downloads\base.apk`
- 解包：`D:\DSH\reverse\wmtj\apk`
- 反编译脚本：`D:\DSH\reverse\wmtj\scripts\scripts`（980 个 .as）
- 资源导出：`D:\DSH\reverse\wmtj\assets_out`
- 工具：`D:\DSH\reverse\tools\ffdec`

---

## 3. 阶段规划

### A. 前端原型（当前阶段）

目标：**一屏正确的 12 宫命盘**，数据驱动、可交互、可截图；为后面接引擎打好壳。

- A1 盘面网格与样式（已完成骨架）：4×4 CSS Grid，中宫 2×2，浅色主题 + 墨色主题。
- A2 渲染层 `chart.js`：按数据契约渲染 12 宫、中宫信息、图例。
- A3 交互：点击宫位 → 右侧详情栏（宫位/星曜/大限/流年/神煞）；按钮切换神煞、四化、主题、示例盘。
- A4 AI 操作接口：`window.ZiweiChart.render(data)`、`setTheme`、`toggle`、`getData`、`onSelect`；支持被外部脚本/后端调用。
- A5 验收：示例盘 + 截图 + README（怎么开、怎么改数据、怎么接引擎）。
- A6 打磨：移动端自适应、导出 PNG（后续）、盘面字号/密度可调。

**A 阶段验收标准**
1. 12 宫地支位置正确（见 §4 环序），宫名按命宫顺排；
2. 每宫主星/辅星/四化/庙旺/神煞显示正确，四化四色可辨；
3. 中宫：姓名、性别、公历、农历、四柱、五行局、命主/身主、命/身宫、大限、流年；
4. 点任意宫位出详情；切换主题/神煞/四化即时生效；
5. 零外部依赖，双击 `index.html` 可开；窄屏可用。

### B. 紫微引擎 `engine/ziwei.js` + 工具 `gua_ziwei`

- 输入：公历/农历生日、时辰、性别、地点（真太阳时）。
- 输出：与前端契约一致的盘面 JSON（12 宫、星曜、四化、大限、流年、宫位）。
- 内容：五行局、安紫微/天府系、十四主星、辅星（昌曲魁钺禄存羊陀火铃空劫）、四化、十二宫、大限/流年斗君、三方四正。
- 对照：《紫微斗数全书》（已有 KB）+ 文墨天机 `K9373K` 星表思路 + 通行安星法。
- 测试：2–3 个公开盘例（与通行排盘软件对照），再进 `tools.test.mjs`。

### C. 内容与断法（半仙·鲸娘）

- 把 `K9329K` 格局数据整理为「紫微格局大全（据文墨天机数据集整理，仅个人研习）」入 `知识库\12-紫微斗数`；
- 新技能 `guashi-ziwei`：安星速查 + 断法（命身三方四正、四化、大限流年、格局）；
- 人设升级：鲸娘 → 半仙·鲸娘（易占六门 + 三命），输出规范加「先定盘后论断、不宿命不吓人」；
- KB 12/13 补 `_目录.md` 与使用说明。

### D. 客户端集成（待定）

三选一（到时拍板）：
1. 独立静态页 + 本地小服务（Agent 推送 JSON，最简单）；
2. 嵌进 DSH Web 右侧栏（需要写 client plugin，费劲但「就是侧栏」）；
3. 独立桌面窗口（Electron/Tauri 起壳，长期形态）。

---

## 4. 盘面布局与数据契约（冻结，改动需记到本文件）

### 4.1 12 宫位置（CSS Grid 4×4）

```
巳(0,0) 午(0,1) 未(0,2) 申(0,3)
辰(1,0) [ 中 宫 2×2 ] 酉(1,3)
卯(2,0) [ 中 宫 2×2 ] 戌(2,3)
寅(3,0) 丑(3,1) 子(3,2) 亥(3,3)
```

- 环序（顺次）：`寅 丑 子 亥 戌 酉 申 未 午 巳 辰 卯`（沿四边逆时针一圈）。
- 宫名排法：命宫在哪一格，就从那格起，按环序顺次排 `命宫、兄弟、夫妻、子女、财帛、疾厄、迁移、交友、官禄、田宅、福德、父母`。
- 身宫：落于身宫地支所在格，角标「身」。

### 4.2 数据契约（前端 ⇄ 引擎）

```json
{
  "meta": {
    "name": "示例盘",
    "gender": "男",
    "birthSolar": "1990-05-15 14:30",
    "birthLunar": "庚午年 四月 廿一 未时",
    "fourPillars": "庚午 辛巳 乙酉 癸未",
    "wuxingJu": "火六局",
    "mingZhu": "贪狼",
    "shenZhu": "天相",
    "shenGongZhi": "未",
    "daxian": "6-15岁 丙戌",
    "liunian": "2026 丙午"
  },
  "palaces": [
    {
      "zhi": "午",
      "name": "命宫",
      "isMing": true,
      "isShen": false,
      "daxian": "6-15",
      "liunian": "2026 命宫",
      "stars": [{ "name": "紫微", "bright": "庙", "sihua": "权" }],
      "aux": [{ "name": "文昌", "sihua": "科" }],
      "sha": ["擎羊", "天刑"]
    }
  ]
}
```

- `palaces` 长度 12，按 `zhi` 匹配位置（不依赖数组顺序）。
- `bright` ∈ 庙/旺/得/利/平/陷；缺省不显示。
- `sihua` ∈ 禄/权/科/忌。
- `sha` 为神煞名数组，不显示时可空。
- 中宫由 `meta` 渲染；后续可加 `extra`（如自化、三方四正标记）。

### 4.3 前端对外 API

```js
ZiweiChart.render(data)        // 重绘整盘
ZiweiChart.getData()           // 取当前数据
ZiweiChart.setTheme('light'|'dark')
ZiweiChart.toggle('sha'|'sihua', true|false)
ZiweiChart.focus(zhi)          // 选中某宫并展开详情
ZiweiChart.onSelect = (palace) => {}   // 点宫回调
```

---

## 5. 任务看板

| 编号 | 任务 | 状态 | 产出 |
|---|---|---|---|
| A1 | 盘面网格与样式 | ✅ | `client/ziwei-chart/index.html`、`chart.css` |
| A2 | chart.js 渲染 + 示例数据 | ✅ | `chart.js`（12 宫/中宫/四化/庙旺/神煞） |
| A3 | 详情栏与交互 | ✅ | 同上：点宫详情、切换、主题、示例盘 |
| A4 | AI 操作 API | ✅ | `ZiweiChart.render/getData/setTheme/toggle/focus/onSelect` |
| A5 | 截图验收 + README | ✅ | `preview.png`、`selftest.html`（9 项 PASS）、`README.md` |
| A6 | 字号密度/PNG 导出（移动端不做） | ⬜ 可选 | 样式补丁 |
| B1 | 安星基础（五行局/紫微/天府系） | ✅ | `lib/engine/ziwei.js`、`ziwei-data.js` |
| B2 | 十四主星 + 辅星 + 四化 | ✅ | 同上（主星亮度/四化、昌曲魁钺左右禄存羊陀火铃空劫、天马、红鸾天喜、神煞） |
| B3 | 十二宫/大限/流年/三方四正 | ✅ 十二宫/大限/流年命宫；三方四正待 C/D |
| B4 | 工具 `gua_ziwei` + 测试 | ✅ | `lib/tools-ziwei.js`、`test/engine-ziwei.test.mjs`（5 项）、tools 测试 14 项 |`r`n| D1 | 右侧栏命盘插件 | 🟡 已装，待重启验收 | `plugins/guashi-chart-panel/`（Host RPC + Client 右栏标签 + 自动打开） |
| C1 | 格局数据整理入 KB | ✅ | `知识库/12-紫微斗数/紫微格局大全.md`（约 0.6 万字符，富/贵/正格/贫贱/杂局 + 两诀 + 十等论） |
| C2 | `guashi-ziwei` 技能 | ✅ | `skills/guashi-ziwei/SKILL.md`（读盘六看/十二宫/十四主星/四化/大限流年/输出规范） |
| C3 | 人设升级「半仙·鲸娘」 | ✅ 完成（易占六门 + 命理三科；工具 11 个、技能 17 篇） | preset 文案、README |

---

## 6. 决定与待定

**已定**
- 前端先做零依赖静态页（HTML/CSS/JS），DOM 渲染，不引入框架；
- 浅色纸面为主、墨色可选，贴近文墨天机盘面观感；
- 数据契约先行，前端不写死任何盘面数据；
- 反编译只作个人研习参考，不复制其代码/素材分发。

**待定**
1. 客户端形态：独立页 + 本地服务 / DSH 侧栏插件 / 桌面壳（阶段 D 再定）；
2. 是否在盘面上叠「三方四正连线」与「自化/飞星」标记；
3. 盘面字号密度（紧凑版给手机，宽松版给桌面）；
4. 是否提供 PNG/PDF 导出；
5. 字符串池加密是否继续攻（当前不影响 A/B，只影响 C 阶段文字标签参考）。

---

## 7. 记忆锚点速查

- 原型目录：`D:\DSH_GuaShi\client\ziwei-chart\`
- 计划文档：`D:\DSH_GuaShi\docs\PLAN-ZIWEI-CLIENT.md`（本文件）
- 规划看板页：`D:\DSH_GuaShi\docs\plan-viewer.html`（由 `tools\build_plan_viewer.py` 生成，每 180 秒自动刷新；改了本文件后重跑脚本）
- 紫微知识库：`D:\DSH_GuaShi\知识库\12-紫微斗数\`（紫微斗数全书 + 赋文 + _目录.md）
- 相关旧计划：`docs\PLAN-BANXIAN.md`（半仙·鲸娘总升级计划）
- 反编译参考：`D:\DSH\reverse\wmtj\`（App.swf 脚本 980 个，K9373K 星表、K93C9K 绘制、K9329K 格局）




