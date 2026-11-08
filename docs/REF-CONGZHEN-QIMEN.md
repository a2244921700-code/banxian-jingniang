# 参考：从真奇门 2.9.1 反编译分析（奇门侧）

- 分析日期：2026-11-07
- 用途：为「半仙·鲸娘」的奇门遁甲引擎/前端提供功能清单、盘面排布、设置项与数据模型参考；只作个人研习，不复制其代码、素材、配色文件分发。
- 配套：`docs/REF-BAZI-APP.md`（八字）、`docs/REF-WENZHEN-BAZI.md` 旧名、`docs/APK-REVERSE-ENGINEERING.md`（解包手册）。

## 一、获取渠道与验真

**官方渠道**：
1. 官网 `https://www.congzhenyixue.com/` → 产品「从真奇门 IOS+Android」的二维码；
2. 二维码解码结果：`https://a.app.qq.com/o/simple.jsp?pkgname=cn.congzhen.CongZhenQiMenAndroid`（腾讯应用宝的官方落地页）；
3. 应用宝详情页 `https://sj.qq.com/appdetail/cn.congzhen.CongZhenQiMenAndroid`：开发者/运营者均为「北京如因律动科技有限公司」，版本 **2.9.1**，备案号 京ICP备2024091211号-2A；
4. 应用宝下载地址（官方 CDN）：`http://imtt.dd.qq.com/.../5A23C2C4F05D2E023072DB29E1B53DF0.apk`。

**验真结果**：

| 项 | 结果 |
|---|---|
| 包名 | `cn.congzhen.CongZhenQiMenAndroid`（与官网二维码一致） |
| 版本 | versionName 2.9.1 / versionCode 20901（与应用宝页一致） |
| 大小 | 21,241,015 bytes（与应用宝元数据 `apk_size` 一致） |
| MD5 | `5A23C2C4F05D2E023072DB29E1B53DF0`（与应用宝元数据 MD5 一致） |
| 签名 | `CN=congzhen, OU=qimen, O=hebei`，SHA256 with RSA，SHA-1 `1B:EB:59:D1:3D:BF:1C:16:D7:A5:B6:94:6D:89:9C:16:75:DF:1E:D3` |
| 加固 | 无（dex 正常、无 1 字节占位、无 ijiami/jiagu 特征） |
| 广告 SDK | Manifest 中未见 bytedance/腾讯广点通/Google Ads/快手/百度 mobads；有 umeng/crash、极光/号码认证等常规 SDK |
| 结论 | 应用宝官方渠道 + 官网二维码 + 包名/版本/大小/MD5 四项一致，判定为官方正版；第三方下载站（逗游、应用汇等）仅作参考，不作为下载源 |

> 辨认广告冒充的要点：只认官网二维码跳到 `a.app.qq.com` / 应用宝详情页的开发者与运营者；核对包名、版本、大小、MD5；安装包签名证书主题；不要从「高速下载」「破解版」「无广告版」页面下载。

## 二、反编译产物

- 原始 APK：`D:\DSH\reverse\congzhen\apk\congzhenqimen-2.9.1.apk`
- 资源：`D:\DSH\reverse\congzhen\apktool`（255 个 layout、45 个 Activity、strings/colors/manifest）
- 代码：`D:\DSH\reverse\congzhen\jadx`（5,731 个源文件，35.7 MB；46 个反编译错误，关键类可读）
- 官方截图：`D:\DSH\reverse\congzhen\shots\shot_{1..4}.png`（应用宝宣传图，仅本地参考）

## 三、功能地图（45 个 Activity + 布局/字符串）

### 排盘
- 首页（`activity_main` + `frag_home`）：
  - 顶部日期/时间 + 「现在」；四柱干支（年/月/日/时）；
  - 阴/阳遁 X 局、旬首、值符、值使；
  - 起局方式/盘式标签（如「时家拆补·转盘」）与格局提示（星反、门伏等）；
  - 九宫盘面（见下）；
  - 底部年命选择、日空/日马、时空/时马；
  - 操作：断法、局信息、宫信息、保存案例、AI 提示词、截图、排盘设置。
- 多局（`frag_moreqimen` + `ui/duoju`）：
  - 年家奇门（`CZNianJiaQiMenActivity` + 运年九星）
  - 月家奇门（`CZYueJiaQiMenActivity` + 值年月九星）
  - 日家奇门（`CZRiJiaQiMenActivity`）
  - 太乙日家奇门（`CZTaiYiRiJiaQiMenActivity`）
  - 山向奇门（`CZShanXiangQiMenActivity`，二十四山向+年份）
  - 奇门罗盘（`CZQiMenLuoPanActivity`）
  - 奇门套玄空（`CZQiMenTaoXuanKongActivity`）
  - 命运局 / 套八字（`CZMingYunJuFragment`、`CZTaoBaZiFragment`：局式1/2/3/命运局/套八字 多标签，套八字下接大运流年）
- 案例：从真案例库、我的保存、搜索（`ui/anli`、`ui/home/CZSaveJuShiActivity` 等）
- 其他：城市选择、活时选择、照局/照局预览、1080 局解、截图水印、AI 提示词、VIP、使用说明、关于、反馈、登录/手机绑定。

### 起局方式与盘式（来自 `third/qimen/entity/b.java`）

| 维度 | 选项 |
|---|---|
| 起局方式 | 时家拆补、时家置闰、时家茅山、时家阴盘、分家阳盘、刻家阴盘（6） |
| 盘式 | 转盘、飞盘、括囊（3） |
| 暗干排法 | 时干找值使飞布（遇地盘相同入中 / 遇宫内有时干入中）、八门地盘携带之干（转盘有效）、时干加值使转天盘（遇伏吟入中）、暗天干地支飞布法（飞盘常用）（5） |
| 寄宫 | 统一寄坤二宫；阳遁寄艮八宫、阴遁寄坤二宫（2） |
| 子时 | 早晚子时开关 |
| 置闰 | 置闰定局天数 8 天 / 9 天 |
| 盘面显示 | 显示旺衰 + 12 长生、迫墓刑标红、宫位（数/旺衰/内外盘）提示、转盘显示地盘八神、飞盘使用中门、飞盘/括囊甲时值符找仪不选找戊、括囊天盘干自飞九宫、星门神单字简化、八节旺衰 / 正五行旺衰、门宫关系等 |
| 主题 | 从真经典（简约大气）、奇门穿壬（地盘地支/月将/神将/建星）、阴盘经典（暗干显示局外围）、阴盘穿壬（暗干在内、外围穿壬） |
| 颜色 | 黑蓝经典（符使/日时干标蓝）、五行颜色（符使/日时干下划线） |
| 其他 | 移星换斗（阴盘转盘）、初入自动起局、断法库/自定义断法、AI 提示词导出、案例库 |

## 四、盘面 UI 规范（据官方截图 + layout）

### 1. 顶部信息区（`item_jushi_topdata.xml`）

- 日期行：`2024年7月22日(六月十七) 09:09` + 「现在」按钮；
- 四柱：甲年 辰 / 辛月 未 / 丁日 亥 / 乙时 巳（年、月、日、时四列，每列上干下支）；
- 局信息：`阴遁二局`、`甲辰旬`、`值符:天柱`、`值使:惊门`；
- 方式行：起局方式+盘式标签（「时家拆补转盘」）、格局标签（「星反」等）、上一局/下一局/更多。

### 2. 九宫盘面（`layout_jushi_gongdatas_show.xml` + `CZGongTvGraySmallView`）

3×3 宫格，每宫显示（从上到下）：

1. 宫数 + 宫位关系（如 `4538 兑→巽→坤 因外`；`因/外` 表示宫旺衰/内外盘提示）；
2. **八神**（金色；可选显示地盘八神）；
3. **九星**（按五行色）+ 天盘干（如 天心 癸）；
4. **八门**（按五行/吉凶色；可单字简化）+ 地盘干（如 伤门 丙）；
5. 暗干/寄干（按暗干排法）；
6. 左侧小字：旺衰/月令/十二长生标签（如 `休·月废`, `刑·养胎`, `旺·月囚`, `官` 等）；
7. 马星、空亡、四害（迫墓刑）按设置标红/标注；
8. 中宫显示中宫天盘干/地盘干（截图示例：戊 / 丁）与寄宫信息。

### 3. 底部

- 年命：未选择（可设置）；
- 日空：午未 / 日马：巳；时空：寅卯 / 时马：亥；
- 操作按钮：断法、局信息、宫信息、保存案例、AI 提示词、截图、排盘设置；
- 底部导航：首页、多局、断法、案例、我。

### 4. 多局/套八字

- 顶部标签：局式1、局式2、局式3、命运局、套八字（可同时起多个局）；
- 套八字页在盘面下加「八字大运流年」横条：大运（2005 1岁 … 2086 82岁）+ 当前大运/流年，流年行可继续展开；
- 命运局：生辰原命局 + 10 步大运局（每 9 年一步，按 时柱 顺排，阴阳遁和局数不变，只变时辰干支）。

### 5. 配色（`res/values/colors.xml`）

| 用途 | 色值 |
|---|---|
| 木 | `#34a853` |
| 火 | `#ea4335` |
| 土 | `#cd7f32` |
| 金 | `#ffa601` |
| 水 | `#4285f4` |
| 主红/按钮 | `#b72028` |
| 深蓝（启动） | `#163295` |
| 灰字 | `#999999` |
| 宫格线 | `#dddddd` |
| 背景 | `#ffffff` / `#f4f5f7` / `#fcfcfc` |

## 五、内部数据模型（反编译类名/字段，作为我们数据契约参考）

- `CZJuDataEntity`：`baZi`（四柱）、`isYang`、`juIndex`、`juStr`、`juSanYuan`、`jieQiCur/Pre/Next`、`gongDatas`（九宫）、`gongDiZhiDatas`（穿壬地支）、`kongNian/Yue/Ri/Shi` 空亡、`horseStarUse`/`keMa` 马星、`feiPanYiKong`、`fuTouDiArr` 等。
- `CZGongDataEntity`：`gongType`（九宫）、`baShen` / `baShenDiPan`、`baMen` / `baMenDiPan` / `baMenKuoNang`、`diPanGan` / `diPanJiGan` / 暗干、`isKongWang`、`isMaXing`、`feiPanUseZhongMen`、`isFeiPanOrKuoNang`、刘亲十神字段等。
- `CZGongDiZhiEntity`：`diPanDiZhi`、`renPanDiZhi`、`yueJiang`、`shenJiang`、`jianChu`（穿壬四层）。
- 排盘实现类在混淆包 `f2/q.java`、`f2/l.java`、`f2/g.java`、`d2/a.java`、`o2/d.java`（各起局方式/盘式组合）；静态表/枚举在 `third/qimen/entity/CZJuStaticDatas.java`、`CZJuShiConifgEntity.java`、`b.java`；旺衰在 `qiju/util/CZWangShuaiUtil.java`。
- **参考原则**：只看枚举、字段与盘面结构；算法按通行奇门规则自行实现（拆补/置闰已有，茅山/阴盘/飞盘/括囊等按公开法另行补），不照抄代码。

### 补充：起局方式枚举（反编译 CZJuShiConifgEntity.CZQMQiJuType）

时家拆补(1)、时家置闰(2)、时家茅山(3)、时家阴盘(4)、分家阳盘(5)、刻家阴盘(6)、年家奇门(7)、月家奇门(8)、日家奇门(9)、太乙日家(10)、山向奇门(11)。

盘式枚举 CZQMQiPanType：转盘、飞盘、括囊。
主题枚举 CZQMJuShiTheme：经典、五行、时家黑蓝穿壬、时家五行穿壬、阴盘黑蓝、阴盘五行、阴盘天/门/地/户黑蓝、阴盘天/门/地/户五行（共 8 种）。
马/空类型 CZQMMaKongType：时、日、月、年。
六亲显示 CZQMLiuQinType：隐藏、六亲、十神。
## 六、与我们奇门引擎的差距

| 能力 | 从真奇门 | 我们（`engine/qimen.js`） |
|---|---|---|
| 定局 | 拆补、置闰、茅山、阴盘、分家阳盘、刻家阴盘 | 拆补、置闰 |
| 盘式 | 转盘、飞盘、括囊 | 转盘 |
| 暗干 | 5 种排法 | 无 |
| 寄宫 | 2 种（坤二 / 阳艮阴坤） | 固定 |
| 中五 | 转盘/飞盘/括囊不同规则、飞盘用中门 | 不转中五、天禽寄坤二 |
| 旺衰 | 八节旺衰/正五行旺衰、12 长生、四害标红 | 无 |
| 穿壬 | 地盘地支/月将/神将/建星，阴盘穿壬 | 无 |
| 多局 | 年/月/日/时/太乙日家/山向/罗盘/套玄空 | 仅时家 |
| 命运局/套八字 | 有（10 步大运、流年） | 无 |
| 案例/AI 提示词 | 有 | 有 `gua_case` 与手写断语，未做提示词导出 |
| 前端 | 九宫卡片 + 多主题 + 多标签 | 无奇门前端（目前只有八字/紫微） |

## 七、下一步建议（若要「从真奇门式」奇门前端）

1. **先扩引擎**：`engine/qimen.js` 增加：
   - 起局方式枚举（拆补/置闰/茅山/阴盘/阳盘/刻家），先做拆补/置闰已有 + 茅山/阴盘；
   - 盘式（转盘/飞盘/括囊）与暗干排法、寄宫选项；
   - 输出补：八神/九星/八门/天盘干/地盘干/暗干/旺衰/12 长生/空亡/马星/穿壬；
   - 年家/月家/日家多局可作为第二期；命运局/套八字复用八字引擎。
2. **前端**：`client/qimen-chart/` 采用 3×3 宫格卡片（每宫 6 层信息），顶部四柱+局信息，底部年命/日空/时空+操作栏，底部导航；多标签页（局式1/2/3/命运局/套八字）。
3. **托盘**：先做「盘面正确 + 可切换起局方式/主题」，再做断法提示/AI 提示词/案例。
4. **数据契约**：按上面 `CZJuDataEntity/CZGongDataEntity` 的字段精简成我们自己的 schema，不依赖其类名。

## 七点五、已落地（2026-11-07）

- 引擎：gua_qimen 增加 jiGong（坤二/阳艮阴坤）、lateZi（nextDay/sameDay）、zhirunDays（8/9）、nGanMode（已实现「八门地盘携带之干」）、门/星旺衰、暗干字段；默认行为与旧测试兼容，奇门测试 27 项全绿。
- 前端：client/qimen-chart/ 九宫盘原型（顶部四柱/局信息、九宫卡片、暗干/旺衰/备注开关、点宫详情、selftest 11 项）；示例盘即本文截图同日期（2024-07-22 09:09，阴遁二局）。
- 仍未做：飞盘/括囊、茅山/阴盘/分家阳盘/刻家阴盘、其余 4 种暗干、穿壬、多局、命运局/套八字、案例库。
## 八、版权与边界

- 本 APK 仅作个人研习；不复制其代码、素材、字体、案例文本到产品；
- 版式只参考结构（九宫卡片、字段顺序、信息层级），配色/图标重新设计；
- 排盘算法按公开奇门规则与我们的 KB（奇门遁甲统宗/御定奇门宝鉴等）自行实现；
- 不传播 APK、不绕过其会员/付费功能。

## 九、本机参考文件

- `docs/reference/congzhen-qimen/`：关键 layout、strings、colors、manifest 副本（仅供对照）。
- 原始反编译：`D:\DSH\reverse\congzhen\apktool`、`jadx`；截图：`D:\DSH\reverse\congzhen\shots`。



