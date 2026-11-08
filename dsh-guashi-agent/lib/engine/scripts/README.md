# lib/engine/scripts —— 数据生成与核对脚本（engine-smith）

本目录是**开发期**工具，不参与运行时。运行时只读 `../data/hexagrams.json`。

## 数据生成

```powershell
$py = 'C:\Users\22449\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe'

# 1) 抓取《周易》64 卦原始 wikitext（繁体，2 个批量请求，间隔 ≥3.5s）
python fetch_hexagrams.py

# 2) 解析生成 data/hexagrams.json（含上下卦自校）
python build_hexagrams.py --report

# 3) 与早期逐页 action=parse 的 HTML 缓存交叉核对（可选）
python crosscheck_hexagrams.py

# 4) 历法与香港天文台对照表核对（开发期）
node verify_almanac.mjs
```

## 抓取源

- 维基文库《周易》各卦子页，原始 wikitext：
  `https://zh.wikisource.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=周易/乾|…`
- 一次 50 个标题，64 卦只需 2 个请求，规避逐页 `action=parse` 的 429 限流。
- 显示用语言标记 `-{...}-`、模板 `{{Header2 …}}`（删）、`{{另|A|B}}`（取首选 A）、
  `{{*|一作…}}`（编者夹注，删）、HTML 标签、列表标记均在 build 时清洗；
  **保留繁体原貌，不做繁简转换**。
- 页面自带“X下Y上”一句用于自校上下卦，64 卦全部与卦序表一致（build 会因此报错拦截）。

## 核对基准（测试期望值来源）

| 项目 | 来源 |
| --- | --- |
| 农历月首、春节、24 节气日期 | 香港天文台《公历农历对照表》<br>`https://www.hko.gov.hk/en/gts/time/calendar/text/files/T<年>e.txt`（1901、1949、1950、1984、2000、2024、2025、2026、2033 共 9 年） |
| 日柱 / 年柱 / 月柱 | 便民查询网万年历 `https://wannianrili.bmcx.com/<日期>__wannianrili/`<br>1900-01-01、1900-02-01、1949-10-01、2000-01-01、2020-01-01、2026-10-25；另与 solarlunar 2.0.7 的 `gzDay` 交叉核对一致 |
| 卦辞 / 彖 / 象 / 爻辞 | 维基文库繁体底本（即本目录生成的数据），测试中抽检乾、坤、屯、蒙、泰、否、既济、未济 8 卦逐字断言 |

## 已知偏差

1. **节气**：Meeus 低精度太阳视黄经（误差约 0.01°），反解节气时刻忽略 ΔT（<70 秒），
   时刻误差通常 <5 分钟；按“日期”比对时允许 ±1 天。实测与天文台 9 年 × 24 节气比对
   215/216 一致，仅 1950 年谷雨因本引擎算得 04-21 00:01、天文台记 04-20（跨零点）差 1 天。
2. **农历**：1900-01-31 ~ 2100-12-31，超界抛 `RangeError`；表为标准 1900–2100 月份大小/闰月编码。
   实测 9 年全部月首（112 个初一）与春节日期与天文台一致。
3. **子时换日（日界 23:00）**：23:00–23:59 算**次日**日柱与次日农历日（传统「子时为一日之始」）；
   晚子时时干按换日后的日干起（如癸日 23:30 → 壬子时）。给出经度时，以**真太阳时**是否已过 23:00
   判定日界与时辰。注意：多数网络万年历页面按 00:00 换日显示，查日柱时若在 23:00–23:59 需按次日读。
   实现见 `almanac.js` 的 `effectiveDay()` / `DAY_BOUNDARY_HOUR`；`dayPillar(date, {longitude})`、
   `lunarFromDate(date, {longitude})`、`getAlmanac(date, {longitude})` 均遵此制，返回 `enteredNextDay`
   与 `effectiveDate` 便于排查。
4. **繁体用字**：wikitext 保留原字（如「无」不作「無」、「后」不作「後」、「克」不作「剋」）；
   维基文库渲染页会做字词转换，故 HTML 版与本数据有上述 3 处用字差异，属正常。

## 缓存（.cache/，可安全删除）

- `wikitext/NN.txt`：64 卦原始 wikitext
- `NN.json`：早期逐页 `action=parse` 的 HTML（21 页，供 crosscheck）
- `T<年>e.txt`、`hko-expect.json`：香港天文台对照表原文与解析结果
