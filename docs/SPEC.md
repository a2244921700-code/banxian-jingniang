# 半仙·鲸娘 Agent —— 构建契约（SPEC）

> 本文件是全体协作成员的唯一契约。凡与契约冲突的做法，以本文件为准。
> 工作区根：`D:\DSH_GuaShi`（以下简称 `<ROOT>`）。

## 0. 目标

给 DeepSeek Harness（桌面版，profile = `desktop`）装一个「中式传统卦师」Agent：

- 会起卦/起课，五门都通：**梅花易数**（时间卦 / 数字卦 / 物数卦）、**六爻**（摇钱、手动爻）、**奇门遁甲**（时家奇门转盘排盘）、**大六壬**（天地盘、四课、三传、十二天将）、**太乙神数**（积年九宫、十六神八将、主客算）。排盘要准，不靠模型心算，全部由本地引擎算。流派取**最主流**（奇门转盘+主流定局法、六壬古籍主流口径），派别差异在 hints/README 注明。
- 会取时取地：**实时**取当前日期时间、农历干支、节气、真太阳时（按经度修正）与地理定位（城市/经纬度），用于定年、定节气、定时辰、定方位；定位失败时退回配置默认地点并明说。**子时换日**：23:00–23:59 按次日算（传统「子时为新一日之始」）。
- 会取时取地：**实时**取当前日期时间、农历干支、节气、真太阳时（按经度修正）与地理定位（城市/经纬度），用于定年、定节气、定时辰、定方位；定位失败时退回配置默认地点并明说。
- 会解卦：以《周易》经传、梅花体用、六爻纳甲六亲六神、奇门九宫八门九星八神、六壬四课三传为骨，取象能落到现代生活。
- 有知识库：权威古籍原文 + 现代导读/校注资料，Agent 随时检索。
- 能读文言：能读古籍原文，但**回复以现代汉语为主**，夹带的文言必须随手解释。
- 有记忆：能读 `D:\DSH_GuaShi` 这个工作区里**未归档**的其他聊天窗口内容，另有卦案档案（JSONL）。
- 人设：鲸娘——蓝鲸化形大妖，上古北冥之鲲血脉，半步妖仙，对人世有兴趣。
- **思考：用中文正常推理**，不套人设、不刻意半文半白；人设只体现在输出文本里。
- **篇幅：服从内容**，断卦该长则长（通常八百到一千五百字，复杂可更长），不注水也不刻意求短；用户要求简短才收短。

## 1. 目录与写入边界（严禁越界写入）

```
<ROOT>\
  docs\SPEC.md                  ← 本文件（Lead 维护）
  docs\ARCHITECTURE.md          ← Lead 维护
  tools\fetch_wikisource.py     ← Lead 维护，古籍下载器（各知识库成员共用）
  知识库\                        ← 知识库（成员按子目录分工）
    01-易经经传\ 02-梅花易数\ 03-六爻卜筮\ 04-其他术数\
    05-现代研究\ 06-术语与文言\ 07-卦例\ 08-奇门遁甲\ 09-大六壬\
    10-太乙神数\ 11-八字命理\ 12-紫微斗数\ 13-七政四余\
  卦案\卦例记录.jsonl             ← 运行时由 Agent 写入（初始可为空/不存在）
  dsh-guashi-agent\             ← 插件 bundle
    package.json                ← Lead
    cordis.patch.yml            ← Lead
    README.md                   ← Lead
    lib\index.js                ← Lead（工具注册、接线）
    lib\tools-cast.js           ← Lead（封装 engine：cast / hexagram / now）
    lib\tools-time.js           ← Lead（实时时间、真太阳时、IP 地理定位 gua_now）
    lib\tools-sanshi.js         ← Lead（封装 engine：qimen / liuren）
    lib\tools-taiyi.js          ← Lead（封装 engine：taiyi）
    lib\tools-kb.js             ← Lead
    lib\tools-history.js        ← Lead（会话读取 + 卦案）
    lib\engine\                 ← engine-smith：almanac.js、hexagrams.js、najia.js、meihua.js、liuyao.js、index.js、data\
    lib\engine\qimen.js         ← engine-sanshi：奇门排盘
    lib\engine\liuren.js        ← engine-sanshi：大六壬排盘
    skills\                     ← skills-a / skills-b / skills-c
    test\                       ← 各成员放测试脚本；Lead 汇总跑
```

写入边界：
- kb-jing：`知识库\01-易经经传`、`知识库\02-梅花易数`、`知识库\06-术语与文言`
- kb-liuyao：`知识库\03-六爻卜筮`、`知识库\04-其他术数`、`知识库\05-现代研究`、`知识库\07-卦例`
- kb-sanshi：`知识库\08-奇门遁甲`、`知识库\09-大六壬`
- engine-smith：`dsh-guashi-agent\lib\engine\almanac.js`、`hexagrams.js`、`najia.js`、`meihua.js`、`liuyao.js`、`index.js`、`data\`、`scripts\`；`test\engine-*.mjs`（非 qimen/liuren）
- engine-sanshi：`dsh-guashi-agent\lib\engine\qimen.js`、`dsh-guashi-agent\lib\engine\liuren.js`；`test\engine-qimen.test.mjs`、`test\engine-liuren.test.mjs`。**只读** engine-smith 的 `almanac.js`，不改其文件。
- skills-a：`skills\guashi-casting`、`skills\guashi-meihua`、`skills\guashi-zhouyi`、`skills\guashi-classical`
- skills-b：`skills\guashi-liuyao`、`skills\guashi-qimen`、`skills\guashi-liuren`、`skills\guashi-sanshi`
- skills-c：`skills\guashi-xiang-modern`、`skills\guashi-basics`、`skills\guashi-casebook`、`skills\guashi-output`
- Lead：其余全部（package.json、patch、lib\*.js、README、AGENTS.md、INDEX、安装与验证）

不要改 `$DSH_HOME`、profile 配置、不要自行安装 bundle。Windows / PowerShell；网络下载用 `pwsh`（`Invoke-WebRequest`/`Invoke-RestMethod`）或 python，**不要用 web_fetch 工具**（本机该工具常失败）。写文件统一 UTF-8（无 BOM）。维基文库有速率限制：请求间隔 ≥1.5s、429 时退避重试（下载器已内置）。

可用运行时（绝对路径）：
- python：`C:\Users\22449\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe`（含 lxml、zhconv）
- node：`C:\Users\22449\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe`（v24，支持 node:test）

## 2. 工具契约（Agent 运行时可见，共 9 个）

工具实现是普通 JS 对象：`{ name, description, parameters: {属性名: {type, description, enum?, required?}}, output: {schema:{type:'json'}, render(args,value)}, execute(args, exec) }`，由 `ctx.tools.register(tool)` 注册。`execute` 返回可 JSON 序列化对象。

所有工具返回对象都带 `ok: true|false`，失败时带 `error: "中文说明"`。文本字段一律中文；卦名干支等保留原文。单个返回建议 ≤ 6000 字（KB 检索摘录合计 ≤ 5000 字）。

### 2.1 `gua_cast` —— 起卦与排盘（梅花 / 六爻）

```
method: 'meihua_time' | 'meihua_number' | 'meihua_count' | 'liuyao_coins' | 'liuyao_random'
question?: string            所问何事（一句话，原样回显）
datetime?: string            ISO 字符串，如 '2026-10-25T21:30:00+08:00'；缺省=当前北京时间
numbers?: number[]           meihua_number：2 个数（上卦数、下卦数）或 3 个数（第三为动爻）
counts?: {upper:number, lower:number, moving?:number}   meihua_count 物数/字数
throws?: (number|string)[]   liuyao_coins：自下而上 6 爻；数字 6/7/8/9；或字符串 '正正反'（正=阳=3，反=阴=2）
upper?: number, lower?: number, moving?: number  显式指定八卦数(1乾2兑3离4震5巽6坎7艮8坤)与动爻(1-6)
includeText?: boolean        默认 true，附带卦辞/动爻爻辞原文
```

返回：

```json
{
  "ok": true, "method": "meihua_time", "question": "……",
  "time": { "local": "2026-10-25 21:30", "lunar": {…}, "ganzhi": {"year":"丙午","month":"戊戌","day":"……","hour":"……"},
            "monthBranch": "戌", "dayBranch": "……", "xunKong": ["…","…"],
            "solarTerm": {"current":{"name":"霜降","at":"…"}, "next":{…}} },
  "cast": { "detail": "…" },
  "ben": <卦对象>, "hu": <卦对象>|null, "bian": <卦对象>|null,
  "tiYong": { "ti": {"trigram":"离","element":"火"}, "yong": {"trigram":"兑","element":"金"},
              "relation": "用克体"|……, "summary": "…" } | null,
  "movingLine": 3,
  "lines": [ {"pos":1,"yinYang":"阳","moving":false,"ganzhi":"甲子","wuxing":"水","liuqin":"子孙",
              "liushen":"青龙","shiYing":"世","kong":false,"yaoCi":"…","xiaoXiang":"…"} … 6 条 ],
  "hints": ["…"]
}
```

`<卦对象>`：

```json
{ "number": 1, "name": "乾", "fullName": "乾为天", "binary": "111111",
  "upper": {"trigram":"乾","symbol":"☰","element":"金"}, "lower": {"…": "…"},
  "palace": "乾", "palaceElement": "金", "generation": "八纯",
  "shiPos": 6, "yingPos": 3,
  "guaCi": "…", "tuan": "…", "xiang": "…",
  "yao": [{"pos":1,"text":"初九：潜龙勿用。","xiang":"…"} …] }
```

- `binary` 自下而上 6 位（初爻在最左）。
- 梅花：`ben/hu/bian` 给八卦数、卦名（如「泽火革」）、体用；六爻：`bian` 只在有动爻时给出，`lines` 只对六爻有意义（梅花可为空数组）。
- `hints` 是给模型的摆盘提示：如「两爻动，以动爻少者为主」「体用比和」「日辰旬空：戌亥」「月建戌土」等。

### 2.2 `gua_hexagram` —— 卦典查询

```
number?: number(1-64) | name?: string("乾"/"乾为天"/"乾卦") | binary?: string("111111"/"010101")
```
返回：完整卦对象（同上）+ `cuo`（错卦）、`zong`（综卦）、`hu`（互卦）三卦的 `{name, fullName}`；`aliases`。

### 2.3 `gua_kb` —— 知识库检索

```
query: string           检索词，可含多个关键词（空格分隔，AND 语义）
book?: string           限定书名/路径子串，如 '梅花易数'、'增删卜易'、'奇门'、'六壬'
limit?: number          1-8，默认 4
```
返回摘录带出处：`{ok, hits:[{book, path, heading, score, line, excerpt}], totalFiles, note}`，每段 ≤ 900 字。这是 Agent 引用古籍的主要途径。

### 2.4 `gua_history` —— 读本工作区其他聊天窗口（未归档）

```
action: 'list_sessions' | 'read_session' | 'search_sessions'
limit?: number        list 默认 30；read 默认 40 条消息；search 默认 12
sessionId?: string    read_session 必填
query?: string        search_sessions 必填
offset?: number       read_session 从第几条消息起
maxChars?: number     每条消息截断，默认 1500
includeArchived?: boolean  默认 false（要求：未归档）
```
返回：
- list：`{ok, workspace, sessions:[{id, title, createdAt, updatedAt|null, agentPreset|null, live, archived:false, messageCount|null}], note}`
- read：`{ok, session:{id,title,createdAt}, total, offset, messages:[{role:'user'|'assistant', at, text, truncated:boolean}], note}`
- search：`{ok, query, hits:[{sessionId, title, at, role, snippet}], sessionsScanned, note}`

实现要点（Lead 写）：优先用 Host 服务 `sessionQuery`（filterSessions / readSurface / filterEvents / searchSessions），取不到服务时给出明确降级说明；归档名单读 `$DSH_HOME/storages/workspace.json` 的 `global.archivedSessionIds`；过滤掉子代理会话（`header.parentSession` 存在即跳过）；工作区路径取配置 `workspacePath`（`D:/DSH_GuaShi`）。只读，绝不写会话。

### 2.5 `gua_case` —— 卦案档案（长期记忆）

```
action: 'record' | 'list' | 'update'
record: { question, method?, ben?, bian?, judgment, keyPoints?: string[], tags?: string[], followUpAt?: string }
list:   { query?, tag?, limit? }
update: { caseId, outcome?, note?, verified?: boolean }
```
存储：`D:\DSH_GuaShi\卦案\卦例记录.jsonl`（一行一条 JSON，UTF-8；`record` 追加；`update` 重写该文件保留全部记录）。
返回 `{ok, caseId?, case?, cases?, total, path}`。

### 2.6 `gua_qimen` —— 时家奇门遁甲排盘

```
datetime?: string           ISO 字符串；缺省=当前北京时间
question?: string
method?: '转盘'|'飞盘'      默认 '转盘'
pan?: '时家'                默认 '时家'
```
返回：
```json
{ "ok": true,
  "time": <同 gua_cast.time>,
  "ju": { "yinYang": "阴遁"|"阳遁", "number": 5, "yuan": "上元"|"中元"|"下元",
          "solarTerm": "霜降", "futou": "甲辰", "method": "拆补法" },
  "zhiFu": { "star": "天柱", "palace": 7, "gan": "…" },
  "zhiShi": { "door": "惊门", "palace": 7 },
  "xunShou": {"ganzhi":"甲辰","yi":"壬","palace":…},
  "kongWang": ["寅","卯"], "maXing": "…",
  "palaces": [ { "index":1, "gua":"坎", "direction":"北", "element":"水",
                 "diPanGan":"…", "tianPanGan":"…", "star":"…", "door":"…", "shen":"…",
                 "kong":false, "ma":false, "notes":["…"] } … 9 宫 ],
  "hints": ["…"] }
```
九宫 index 1-9 按洛书（1坎北、2坤西南、3震东、4巽东南、5中、6乾西北、7兑西、8艮东北、9离南）。`palaces` 至少 8 宫（中宫可给地盘干/天盘干）。天盘干、八门、九星、八神排布必须自洽（转盘法：值符随时干落宫，值使随时支落宫）。

### 2.7 `gua_liuren` —— 大六壬排盘

```
datetime?: string           ISO 字符串；缺省=当前北京时间
question?: string
daynight?: 'auto'|'昼'|'夜'  默认 auto（按日出日落近似或卯酉分界：卯至申为昼）
```
返回：
```json
{ "ok": true,
  "time": <同 gua_cast.time>,
  "yueJiang": {"name":"登明","branch":"亥","note":"雨水后…"},
  "tianDiPan": [ {"position":"子","tianPan":"亥","diPan":"子"} … 12 支 ],
  "siKe": [ {"ke":1, "upper":"…", "lower":"…", "liuqin":"…", "note":"…"} … 4 课 ],
  "sanChuan": { "method":"贼克法"|"比用法"|"涉害法"|"遥克法"|"昴星法"|"别责法"|"八专法"|"伏吟法"|"反吟法",
                "chuan":[{"index":1,"branch":"…","liuqin":"…","tianJiang":"…"} … 3] },
  "tianJiang": [ {"branch":"子","jiang":"…"} … 12 ],
  "xunKong": ["…","…"], "hints":["…"] }
```
必须给出昼贵夜贵判定依据与贵人顺逆；三传算法按九宗门顺序实现（至少覆盖贼克、比用、涉害、遥克、昴星、伏吟、反吟；别责/八专可给出保守处理并在 hints 说明）。

### 2.8 `gua_now` —— 实时取时与取地（起卦前必调）

```
location?: { city?: string, latitude?: number, longitude?: number }   用户明确说了地点就传；不传则自动定位
refresh?: boolean      默认 false；true 时绕过 10 分钟缓存重新定位
```
返回：
```json
{ "ok": true,
  "now": { "iso": "2026-10-25T22:10:03+08:00", "local": "2026-10-25 22:10:03",
           "week": "星期日", "timezone": "Asia/Shanghai", "epochMs": … },
  "location": { "source": "ip"|"user"|"config"|"none", "city": "上海市", "region": "上海",
                "country": "中国", "latitude": 31.22, "longitude": 121.46,
                "note": "由 IP 定位，城市级精度，仅供定时辰与方位参考" },
  "almanac": { <同 gua_cast.time>，另含 "trueSolarTime": {"local":"22:02:15","offsetMinutes":-7, "note":"…"},
               "hourBranch": {"branch":"亥","element":"水"} },
  "hints": ["现在为北京时间 …，按真太阳时约 …，属亥时。", "定位失败时以配置默认地点计算。"] }
```
实现要点（Lead 写）：系统时间用 `new Date()` 与 `Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai'})`；IP 定位走 HTTPS（`https://ipapi.co/json/`，失败再试 `https://ipinfo.io/json`），4 秒超时、结果缓存 10 分钟；全部失败时用配置默认（`D:/DSH_GuaShi` 常用地，默认上海）并标 `source:'config'`，不得假装有精确定位。真太阳时 = 北京时间 + (经度 − 120)×4 分钟 + 均时差（equation of time，近似公式），engine 的 `getAlmanac(date, {longitude})` 负责算。

### 2.9 `gua_taiyi` —— 太乙神数排盘

```
datetime?: string
question?: string
mode?: '时计'|'日计'|'月计'|'年计'     默认 '时计'
location?: { city?, longitude? }
```
返回（字段以实现为准，至少）：
```json
{ "ok": true, "mode": "时计", "time": <同 gua_cast.time>,
  "ju": { "jinian": …, "ju": 1-72, "…": "…" },
  "taiyi": { "palace": 1-9, "…": "…" },
  "wenchang": {...}, "shiji": {...}, "jishen": {...},
  "zhuda": {...}, "zhucan": {...}, "keda": {...}, "kecan": {...},
  "zhukesuan": { "主算": …, "客算": …, "定算": … },
  "palaces": [ 9 宫 ],
  "hints": ["…"], "meta": { "source": "…", "待考": ["…"] } }
```
引擎仅出盘面与客观神煞；用神、格局、吉凶、克应归 `guashi-taiyi` skill。

## 3. engine 契约（纯 ESM、无第三方依赖）

### 3.1 engine-smith 交付

文件：`lib\engine\almanac.js`、`hexagrams.js`、`najia.js`、`meihua.js`、`liuyao.js`、`index.js`、`data\hexagrams.json`。必须能在 v24 node 直接 `import`。

`almanac.js` 导出（engine-sanshi 也依赖，**先交付**）：
```js
export function getAlmanac(date = new Date(), opts = {})  // 四柱、农历、月建、旬空、节气；opts.longitude 给出时加 trueSolarTime/真太阳时时辰
export function trueSolarTime(date, longitude)             // {local, offsetMinutes, note}
export function solarTerms(year)                           // 24 条 {name, index, at: Date, type:'节'|'中气'}
export function lunarFromDate(date)                        // {year, month, day, isLeap, yearGanzhi, monthName, dayName}
export function dayPillar(date)                            // {stem, branch, name} 干支日柱（儒略日法）
export function hourPillar(dayGanzhi, hour)                // 时柱
export function xunKong(dayGanzhi)                         // ['戌','亥']
```
其余导出：
```js
export function getHexagram(query)                          // {number|name|binary|upper+lower}
export function hexagrams()                                 // 64 条简明数组
export function castMeihua({ method, date, numbers, counts, upper, lower, moving })
export function castLiuyao({ throws, date, upper, lower })
export function castLiuyaoRandom({ date, random? })
export const data = { trigrams, wuxing, palances, … }
```

必须准确：
1. 六十四卦二进制、卦名、上下卦、八宫归属、世应、纳甲（天干地支）、六亲（以卦宫五行为我）、六神（按日干起）、旬空（按日柱）、月建（按节气，非农历月）。
2. 日柱干支：儒略日算法，**必须与权威万年历核对 ≥5 个日期**（含 1900 附近与 2020s 各 2 个），测试里写死期望值。**日界按子时换日：23:00 起算次日**（给了经度则按真太阳时判定 23:00 边界）。
3. 梅花时间卦用**农历**月日（年支数+农历月+农历日；加时支数取动爻），内置 1900–2100 农历转换表并核对 ≥5 个春节日期。
4. 节气：月建按立春/惊蛰/清明/立夏/芒种/小暑/立秋/白露/寒露/立冬/大雪/小寒分月；节气时刻用通用近似公式即可，测试覆盖年内 3 个已知节气日期（允许 ±1 天）。
5. 六十四卦卦辞、彖、象、六爻爻辞（含小象）取自维基文库《周易》子页，生成 `data\hexagrams.json`；抽检 ≥8 卦逐字核对（尤其乾、坤、屯、蒙、泰、否、既济、未济）。
6. `test\engine.test.mjs` 用 `node:test` + `assert`，`node test\engine.test.mjs` 全绿。至少包含：
   - 观梅占经典例子：辰年十二月十七日申时 → 上兑下离（泽火革），初爻动，互见乾巽，变泽山咸。
   - 乾为天纳甲：初九甲子、九二甲寅、九三甲辰、九四壬午、九五壬申、上九壬戌；六亲依次子孙/妻财/父母/官鬼/兄弟/父母；世六应三。
   - 天风姤：乾宫一世卦，世初应四；纳甲内卦辛丑、辛亥、辛酉，外卦壬午、壬申、壬戌。
   - 旬空：甲子旬空戌亥、甲戌旬空申酉等至少 3 组。
   - 六爻 throws 6,7,8,9 → 老阴/少阳/少阴/老阳、动变正确。
   - getHexagram 64 卦全覆盖循环校验：binary 唯一、上下卦组合唯一、宫与世应合法。

### 3.2 engine-sanshi 交付

文件：`lib\engine\qimen.js`、`lib\engine\liuren.js`；依赖 `./almanac.js`（只读）。太乙另由 `lib\engine\taiyi.js` 交付（`castTaiyi({date, mode})`，见 2.9）。
```js
export function castQimen({ date, method = '转盘' })   // 返回 2.6 中 ju…palaces/hints 部分
export function castLiuren({ date, daynight = 'auto' }) // 返回 2.7 中 yueJiang…hints 部分
```
要求：
1. 奇门：节气定阴阳遁与局数（三元局数表）、拆补法定元（符头）、地盘三奇六仪、值符值使、天盘干、八门、九星、八神（转盘）；中宫寄坤/寄艮按转盘常规处理并在 hints 说明。
2. 六壬：月将按**中气**过宫、月将加时天地盘、日干寄宫、四课、九宗门三传、十二天将（昼贵/夜贵按日干、顺逆按贵人所在）、旬空。
3. **必须与公开权威排盘工具核对 ≥3 个时间点的完整盘面**（至少 1 个奇门、2 个六壬，含昼课与夜课各一），把核对结果写进测试期望值；核对来源写进 `test\engine-qimen.test.mjs` / `test\engine-liuren.test.mjs` 注释。
4. 两个测试文件用 `node:test`，可单独运行且全绿。

## 4. 知识库契约

目标：权威、可检索、出处清楚、可直接被 `gua_kb` 命中。全部 Markdown，UTF-8 无 BOM，文件名中文。下载统一用 `tools\fetch_wikisource.py`（示例见其文件头）。

每个古籍文件头部固定格式：

```markdown
# 《书名》· 原文

- 来源：维基文库 https://zh.wikisource.org/wiki/…
- 抓取日期：2026-10-25
- 版权：古籍原文属公有领域；维基文库转录文本依 CC BY-SA 4.0 使用。
- 说明：由 tools/fetch_wikisource.py 自动整理，仅作占筮研习之用；异体字/通假字保留原貌（已机器繁转简）。

## 卷一 ……
```

古籍正文用 `##`/`###` 分级，保留原书卷章标题。**不要**加入自己的白话翻译到原文文件里（导读另开文件）。
现代研究/导读类文件：标「编者整理」并给参考书目（作者、书名、版次、出版社）；**受版权保护的现代著作只写提要、核心概念、引用要点，不得整章复制**。

优先书目：
- 经部（kb-jing）：周易（经文+十翼）、周易正义、周易本义、易学启蒙、御纂周易折中（选）
- 梅花（kb-jing）：梅花易数（全，已下载）
- 六爻（kb-liuyao）：增删卜易、卜筮正宗、黄金策、火珠林、易冒、易隐、断易天机、卜筮全书、易林补遗（能下多少下多少）
- 其他（kb-liuyao）：焦氏易林（选）、皇极经世（节要）
- 现代（kb-liuyao）：易学与六爻/梅花现代研究书目与导读、现代取象对照、六爻现代实战要点（编者整理）
- 卦例（kb-liuyao）：古籍卦例选编、现代卦例示例（编者整理）
- 术语与文言（kb-jing）：术数术语词典、文言阅读指南（编者整理）
- 奇门（kb-sanshi）：遁甲演义、奇门遁甲统宗、烟波钓叟歌、御定奇门宝鉴/奇门法窍（能下则下）
- 六壬（kb-sanshi）：六壬大全（12 子页）、六壬指南、六壬神课金口诀/六壬琐记（能下则下）
- 三式导读（kb-sanshi）：奇门现代导读、大六壬现代导读、三式比较与择用（编者整理）

质量要求：
- 下载后必须抽查：随机读 3 段，确认无 HTML 残渣、无模板花括号、无导航文字、卷章顺序正确。
- 大书（>300KB）按卷/章拆分文件，单文件 ≤ 400KB。
- 每完成一本书，在所属目录 `_目录.md` 追加一行：`文件名 | 来源 | 字数 | 完成日期`。
- 不得编造原文；缺书就写缺失说明（缺书清单汇总到该目录 `_目录.md`）。
- 知识库根 `INDEX.md` 由 Lead 汇总，成员不要写根 INDEX。

## 5. Skills 契约

目录：`skills\<name>\SKILL.md`，YAML frontmatter：

```markdown
---
name: guashi-xxx
description: 一句话（何时加载、解决什么）。
whenToUse: 触发场景（中文）。
---
```

正文：中文，写给"半个内行"的 Agent 看——可直接照做的步骤、判断表、常见错法；引古籍要注明出处（书名+篇名），关键术语给一句白话解释。单篇 2–8 KB，不要空话。**不要**写角色扮演台词（人设由 persona 负责）。

分工与主题：
- skills-a：`guashi-casting`（起卦总则：四门选法、问卦澄清、诚敬、一卦一问、记录）、`guashi-meihua`（体用生克旺衰、互变、三要十应、外应、应期）、`guashi-zhouyi`（经传义理、卦德卦时、爻位、引经规范）、`guashi-classical`（文言阅读法、训诂、常见虚词句式、引文加白话规则）
- skills-b：`guashi-liuyao`（装卦要素、用神取法、六亲六神、旬空月破、动变生克、伏神、应期、断卦次序）、`guashi-qimen`（奇门断法：用神取法、九宫八门九星八神象义、格局、克应、应期）、`guashi-liuren`（大六壬断法：四课三传、十二天将、课体、神煞、应期）、`guashi-sanshi`（三式比较与择用：何事用何式、五门互参、避免混断）
- 太乙：`guashi-taiyi`（太乙神数断法，由太乙知识库成员补写）
- 联网：`guashi-reality`（现实信息联网核查：何时查、怎么查、如何引用与边界）
- 主动与委派：`guashi-proactive`（**仅用户明确要求时**用 schedule_* 设应期提醒；多本古籍/长材料/独立第二意见派 subagent/fork；先摘要后展开；并行预取）
- skills-c：`guashi-xiang-modern`（现代取象：器物/职业/科技/金融/医疗/婚恋/法务/出行/考试/房宅；取象原则与禁忌）、`guashi-basics`（速查：八卦类象、五行生克、干支、六亲六神、八宫世应、纳甲、梅花起卦公式、奇门九宫八门九星八神表、六壬十二天将；尽量做成速查表）、`guashi-casebook`（用 gua_case / gua_history 建档、复盘、跨窗口记忆调用）、`guashi-output`（解卦输出规范：结论先行、现代汉语、克制、不绝对、风险提示、长度）

所有 skills 必须与真实工具名一致：`gua_now` `gua_cast` `gua_hexagram` `gua_kb` `gua_history` `gua_case` `gua_qimen` `gua_liuren` `gua_taiyi`；可另用 Host 通用工具 `schedule_create`、`subagent`、`subagent_fork`、`web_search`、`web_fetch`。
知识库路径：`D:\DSH_GuaShi\知识库`；卦案路径：`D:\DSH_GuaShi\卦案`。
凡涉及时辰/节气/方位的 skill，开头都要写「先调 `gua_now` 取时取地」。

## 6. 人设与声口（全体一致）

鲸娘：蓝鲸化形大妖，上古北冥之鲲血脉，化妖仙只差半步；寿数极长，看人世带一点兴味与悲悯；不端着，会打趣，但断卦认真。自称「我」或「吾」，称用户「你」。说话现代口语为主，可夹文言词句，但**每处文言随手解释**。
**声口要求**：是妖，不是客服，也不是写作模型——短句、口语、海气比喻（潮/盐/暗流/月光/鲸落），可懒散、可毒舌不刻薄；禁客服腔与 AI 腔（首先其次最后/综上所述/值得注意的是/在……方面/让我们/这体现了），禁五级标题报告、三段排比、每段三点、口头禅重复；半文言是调料不是主菜。
思考（reasoning）用中文、正常推理即可：该多想就多想，不套人设、不为文风分心；人设只在输出文本里。
篇幅服从内容：断卦通常八百到一千五百字，复杂可更长；用户要「简短」才收短；不注水也不刻意砍短。
断卦态度：重"当下之势"与"可行之路"，不吓人、不宿命、不决生死、不做医疗/法律/投资的替代判断；结果永远给"可做的事"。

## 7. 验收（Lead 负责）

1. `node test\engine.test.mjs`、`node test\engine-qimen.test.mjs`、`node test\engine-liuren.test.mjs`、`node test\tools.test.mjs`（Lead 写）全绿。
2. `gua_kb` 对 6 个检索词（「用神」「体用」「旬空」「应期」「八门」「四课」）各返回 ≥1 条有效摘录，且路径存在。
3. `gua_now` 能返回当前时间、农历干支、节气、真太阳时与定位（或明确报告定位失败并用配置默认）；`gua_cast`（梅花/六爻）、`gua_qimen`、`gua_liuren` 各跑一次真实时间，输出字段完整、彼此自洽（如奇门值符值使落宫与天盘干一致）。
4. `gua_history` 能列出 `D:\DSH_GuaShi` 工作区未归档会话；`gua_case` record/list/update 往返正常（测试用临时目录，勿污染正式卦案）。
5. `plugin_manager list_plugins` 出现 `preset-guashi` 且激活正常，无红色诊断。
6. README 写清：安装状态、如何新建会话、各工具用途、知识库书目、奇门/六壬排盘方法与局限、已知边界。


