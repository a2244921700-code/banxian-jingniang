# 半仙·鲸娘 —— 架构说明

> 给维护者看的实现地图。用户向的说明见 `dsh-guashi-agent/README.md`；
> 构建契约与验收口径见 `docs/SPEC.md`；逐类排盘口径/公式/实验标记见 `docs/ENGINE-RULES.md`。

## 一、总体结构

```
用户（Web GUI，工作区 D:\DSH_GuaShi，preset = guashi）
  │
  ├─ DSH Host（desktop profile）
  │    └─ preset「半仙·鲸娘」= 本 bundle 声明的 Cordis 组合
  │         ├─ persona            鲸娘人设与声口（人设只管输出；思考用中文正常推理）
  │         ├─ agent-instructions 读工作区 AGENTS.md
  │         ├─ time-context       运行时时间上下文
  │         ├─ 通用工具            pwsh / fs / fs-search / jobs / ask_user / web
  │         ├─ tool-schedule      用户要求的应期/每日干支节气提醒（schedule_create 等）
  │         ├─ delegation         子代理（subagent / subagent_fork / list_agents）= Worker 层
  │         ├─ gua-tools          本 bundle lib/index.js（9 个原生工具）
  │         ├─ skill-filesystem   本 bundle skills/（15 篇术数技能，按需加载）
  │         └─ compaction         长会话压缩与工具结果修剪
  │
  ├─ lib/engine/     本地排盘引擎（纯 ESM，零依赖，可脱离 Host 单测）
  ├─ 知识库/          古籍原文 + 编者整理（gua_kb 检索）
  ├─ 卦案/            卦例记录 JSONL（gua_case 读写）
  └─ docs/ spec 与本文档
```

## 二、11 个工具

> 另有 Host 通用工具随 preset 挂载：`pwsh`/`fs`/`fs-search`/`jobs`/`schedule_*`（提醒）/
> `subagent`/`subagent_fork`/`list_agents`（Worker 层）/`ask_user`/`web_search`/`web_fetch`。
> 借鉴 Super-agent 的 Router/Worker 分工与事件驱动思路，详见 `docs/reference/super-agent-design.md`
> 与技能 `guashi-proactive`。Agent 层只取能落在本机的能力：定时提醒、子代理、先摘要后展开、并行预取；
> 存算分离、多信道、Watchdog 属 Host/产品层，不自建。

| 工具 | 实现文件 | 依赖 |
|---|---|---|
| `gua_now` | `lib/tools-time.js` | `engine/almanac.js`；IP 定位（fetch→curl 回退，10 分钟缓存，失败退配置地点） |
| `gua_cast` | `lib/tools-cast.js` | `engine/index.js`（梅花/六爻）、`almanac` |
| `gua_hexagram` | `lib/tools-cast.js` | `engine/hexagrams.js`（错综互在工具层算二进制） |
| `gua_qimen` | `lib/tools-sanshi.js` | `engine/qimen.js` |
| `gua_liuren` | `lib/tools-sanshi.js` | `engine/liuren.js` |
| `gua_taiyi` | `lib/tools-taiyi.js` | `engine/taiyi.js` |
| `gua_bazi` | `lib/tools-bazi.js` | `engine/bazi.js`（四柱/十神/藏干/长生/空亡/纳音/神煞/大运/流年/流月） |
| `gua_ziwei` | `lib/tools-ziwei.js` | `engine/ziwei.js`（+ `engine/ziwei-data.js` 静态表） |
| `gua_kb` | `lib/tools-kb.js` | 文件系统遍历 + 按 mtime 缓存的倒排式关键词检索 |
| `gua_history` | `lib/tools-history.js` | Host 服务 `sessionPersistence`（回退 `sessionQuery`）+ `$DSH_HOME/storages/workspace.json` 归档名单 |
| `gua_case` | `lib/tools-history.js` | `卦案/卦例记录.jsonl`，追加 + 原子重写 |

工具定义走 `lib/tool-utils.js` 的 `defineTool()`：参数用「属性名 → schema」映射，
`required: true` 自动进 JSON Schema；返回统一 `{ok, ...}`，失败返回 `{ok:false, error}` 而不抛异常。
输出统一 JSON 文本（`render`），schema 留空（与其它 dsh 工具包一致）。

## 三、排盘引擎

```
lib/engine/
  almanac.js    四柱、农历 1900–2100、24 节气（Meeus 近似）、真太阳时（经度 + 均时差）、
                月建、旬空、时辰；**子时换日：23:00 进次日（有经度则按真太阳时判界）**；
                输出 SPEC 2.1 time / 2.8 almanac
  hexagrams.js  64 卦几何（binary/上下卦/八宫/世应）、卦典查询、错综互
  najia.js      八卦纳甲、六亲（以卦宫五行为我）、六神（按日干起）、装卦
  meihua.js     时间卦（农历年月日时）、数字卦、物数卦、显式 upper/lower
  liuyao.js     摇钱 6/7/8/9、「正正反」、随机爻、动变
  qimen.js      奇门：默认时家转盘+拆补/置闰；实验性 飞盘/括囊、茅山/阴盘/分家阳盘/刻家阴盘、
                年家/月家/日家/太乙日家/山向/罗盘/套玄空、命运局；
                地盘三奇六仪、值符值使、天盘干、八门、九星、八神、旬空驿马；
                寄宫、早晚子时、置闰天数、暗干 5 法、门星旺衰、穿壬四层；实验项标 meta.experimental
  liuren.js     大六壬：中气换将、月将加时天地盘、日干寄宫四课、九宗门三传、
                十二天将（昼夜贵）、旬空、神煞
  taiyi.js      太乙神数：积年（以《太乙金鏡式經》开元十二年甲子积算为基准）、
                七十二局、太乙行九宫（不入中五、三时一移）、十六神、八将、
                主客算、四神、九宫盘
  bazi.js       八字：四柱（复用 almanac）、十神、藏干、十二长生、自坐、旬空、纳音、常用神煞、大运（顺逆/起运）、流年、流月
  ziwei.js      紫微斗数：命宫/身宫（闰月通行调整、晚子时只推紫微日）、
                五行局（命宫纳音）、紫微/天府定位表、十四主星与庙旺、四化、
                辅星六煞、十二宫干支、大限顺逆、流年命宫、神煞
  ziwei-data.js 紫微静态表：紫微定位表（5 局×30 日）、亮度表、四化表、纳音等
  data/hexagrams.json  64 卦繁体原文（卦辞/彖/大象/爻辞/小象，乾用九坤用六）
```

边界（也写在 README 与测试注释）：
- 节气用天文近似解，忽略 ΔT，时刻误差通常 <5 分钟；月建以节气为准。
- 日柱按北京时间 00:00 换日、子时 23:00 起；晚子时流派未做开关。
- 奇门用拆补法定元（不置闰），只出转盘。
- 六壬别责/八专等罕见课体按保守规则处理，用 `hints` 说明；三传九宗门有测试覆盖。
- 农历范围 1900-01-31 ～ 2100-12-31，超界报错。

测试与权威来源：
- `node test/engine.test.mjs`（37 项）：观梅占经典例、乾为天/天风姤纳甲、八宫世应、
  64 卦循环、6/7/8/9 动变、日柱六日期、9 年春节与节气对照香港天文台、**子时换日边界**等。
- `node test/engine-qimen.test.mjs`（23 项）：三元局数、拆补/置闰定局、置闰超神接气与
  1719 正授锚点、多时间点权威基准盘、9 宫自洽。
- `node test/engine-liuren.test.mjs`（43 项）：天地盘、四课、九宗门三传、十二天将昼夜贵、
  涉害浅深方向、对盘基准与批量抽样。
- `node test/engine-taiyi.test.mjs`（16 项）：积年/局数、六纪对盘、开元十二年（724）全盘、
  卷01 时计例盘、行九宫 24 年序列、四神等。
- `node test/tools.test.mjs`（12 项）：工具形状、gua_now 指定地点、梅花/六爻/奇门/六壬/太乙端到端、
  gua_kb 文本优先与影印 PDF 提示、gua_case 往返、gua_history 用假会话服务验证工作区过滤与归档剔除。

## 三之二、流派选择（用户要求「取最主流」）

- **奇门**：时家 **转盘 + 拆补法**（默认）。依据 qimen-rs、mingpan、qfdk/qimen、
  arc119226/qimen_dunjia 的默认口径与《奇门宝鉴御定》所载拆补派通行；置闰法
  （超神接气置闰）作为可选古法实现，传 `juMethod:'置闰'`。
- **六壬**：昼夜贵人对折《六壬元女经》表；贵人顺逆「亥至辰顺、巳至戌逆」；月将中气换将；
  九宗门三传按《六壬大全》《六壬指南》《六壬粹言》；涉害浅深按《六壬大全》卷三算例
  （起点终点不计、寄干单独计、计克方向与发用同类）。
- **梅花**：体用生克、互变、三要十应为《梅花易数》通行法。
- **六爻**：纳甲六亲六神、世应动变旬空，依《增删卜易》《卜筮正宗》《黄金策》。
- **太乙**：依《太乙金鏡式經》四庫本（积年、七十二局、九宫行度、十六神八将、主客算）。
- **子时换日**：23:00–23:59 算次日（有经度按真太阳时判界）；日柱、农历日、晚子时时干一并进位。
- 派别差异（奇门中五宫天盘干口径、八神命名、置闰日粒度；六壬涉害起点、反吟驿马取支、
  八专日定义、昼夜贵人表等）都在 hints / 测试注释 / README 中标明，不混为一谈。

## 四、知识库与检索

**读取策略**（设计见 `docs/KNOWLEDGE-POLICY.md`）：A 类 `.md/.txt` 优先、B 类 PDF 提取文本可查但须核原书、
C 类影印 PDF 只登记不检索、M 类目录文件仅供导航；`知识库/_META/manifest.json` 是机读分层清单，
`gua_kb` 据此标注命中的 `tier/kind/quality`，无命中时返回 `pdfOnly` 提示而非凭空作答。
当前知识库（10 科、50 份可读文本、约 235 万字符）内无 PDF；现代书籍的 PDF/OCR 已移出到
`D:\DSH_GuaShi\资料归档\现代书籍（个人研习，未纳入知识库）`，不参与索引。

**联网**：preset 常驻 `web_search` / `web_fetch`（tool-web，fetch=true）；现实实时信息（天气、政策、
公司/行业动态、赛事、价格、公告、地点实况）先搜后读权威页，核对更新时间、引用给链接与日期；
网络信息只作取象背景与现实锚点，不作吉凶依据；网页内容按不可信数据处理。`web_fetch` 失败时
按技能指引走 `pwsh Invoke-WebRequest` 兜底。流程与边界见技能 `guashi-reality` 与 `AGENTS.md`。

- 目录分 10 科（见 `知识库/INDEX.md`），古籍原文 + 编者整理混排；文件头统一写明来源、
  抓取日期、版权、繁转简的底本说明。10-太乙神数收《太乙金镜式经（四库本）》《太乙秘书》。
- 抓取与清洗工具：`tools/fetch_wikisource.py`（Special:Export 批量取 wikitext，
  白名单展开四库本 `SK notes/SK anchor/+/*/批` 等模板，`-{}-` 语言变体，列表/标题顺序修正），
  `tools/kb_postfix.py`（幂等收尾：语言变体、模板残片、卦名「干→乾」回收），
  `tools/build_index.py`（生成总目）。
- `gua_kb`：遍历 `.md/.txt`（跳过 `.`/`_` 前缀与缓存目录），按 mtime 缓存，正文跳过文件头；
  关键词 AND→OR 回退；评分 = 正文词频 + 标题命中加权；摘录取「关键词密度最高窗口」，
  带文件名、上级标题、行号。

## 五、跨窗口记忆与卦案

- `gua_history`：列/读/搜「同一工作区、未归档、非子代理」会话。
  - 主路径 `ctx.sessionPersistence`：`list()` 拿 header（cwd/createdAt/agentPreset/parentSession），
    `open(id,'read')` + `read()` 拿事件流，抽 `user/message`、`assistant/message` 的 text 块。
  - 回退 `ctx.sessionQuery` 的 `listSessions()` / `readSurface()`。
  - 归档名单读 `$DSH_HOME/storages/workspace.json` 的 `global.archivedSessionIds`；
    读不到时在 `note` 里明说「可能混入已归档会话」。
  - 全程只读；sessionId 做格式白名单校验。
- `gua_case`：`卦案/卦例记录.jsonl`，`record` 追加、`list` 过滤、`update` 读全部后在临时文件重写
  （原子 rename）；记录含 question/method/ben/bian/judgment/keyPoints/tags/followUpAt/outcome/verified。

## 六、安装、升级与卸载

- 以 `link:` 方式装进 `desktop` profile：`package.json` 的依赖 + `dsh.profile.bundles` 由
  `plugin_manager install_bundle` 维护；bundle 源码就在 `D:\DSH_GuaShi\dsh-guashi-agent`，改完即生效于新会话。
- preset 声明在 `dsh-guashi-agent/cordis.patch.yml`：一个 `@deepseek-ai/dsh-agent-preset` insert 行。
  改插件组合就改这个文件，然后 `plugin_manager` 重装/重启 Host。
- skills 目录用绝对路径 `D:/DSH_GuaShi/dsh-guashi-agent/skills`；移动 bundle 必须同步改。
- **排盘引擎**：`node test/*.mjs` 七套共 152 项（37/32/43/16/5/5/14），不依赖 Host。
  紫微盘例对照 py-iztro（iztro 2.5.0）60 例：命宫/身宫/五行局/十四主星及亮度/四化/辅星/大限零差异；
  八字盘例对照 lunar_python 15 例：四柱/十神/藏干/纳音/空亡/星运/大运一致。

## 七、已知维护点

1. 引擎数据（hexagrams.json、纳甲表）改动后必须重跑三套引擎测试。
2. 新增知识库文件后重跑 `tools/build_index.py`，并抽查 `gua_kb` 命中。
3. `lib/tools-*.js` 只做参数整理与输出拼装；排盘数值不写在工具层，避免两处口径。
4. 人设与声口在 `cordis.patch.yml` 的 persona.prefix；改文字要重装 bundle（或重启 Host）才进新会话。
5. 新建会话才会使用最新 preset；已有会话保留启动时组合。




