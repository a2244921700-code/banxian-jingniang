# 参考：八字排盘 App 反编译分析（前端/功能参考）

- 分析日期：2026-11-07
- 对象：`C:\Users\22449\问真八字.apk`
- 用途：为「半仙·鲸娘」的**八字（子平）排盘引擎与前端可视化**提供功能清单、盘面排布与配色参考；只作个人研习，不复制其代码/素材分发。
- 配套：紫微侧参考见 `docs/reference/super-agent-design.md`（架构）与本仓库 `client/ziwei-chart`（前端契约）；紫微反编译在 `D:\DSH\reverse\wmtj`。

## 一、App 身份与加密状态

| 项 | 值 |
|---|---|
| 应用名 | 八字排盘 App（个人研习参考） |
| 包名 | `com.wzwh.bzpaipan`（与文墨天机 AIR 壳同包名，同一产品线） |
| 版本 | 2.8.3（versionCode 283），minSdk 23 / targetSdk 34 |
| 大小 | 86.78 MB，单 `classes.dex` 21.5 MB |
| 加固 | **爱加密（ijiami）**：`application android:name="s.h.e.l.l.S"`；`assets/ijiami.dat`、`libijmDataEncryption_*.so`、`raw/libnativesoHelper_1.ogg`（9.26 MB 加密载荷）、运行时 `libjgdtc.so` |

**反编译结论**：
- `apktool d` 成功解出**全部资源**（453 个 layout、strings、colors、drawables、AndroidManifest 125 个 activity），见 `D:\DSH\reverse\wzbf\apktool`；
- `jadx` 只能解出**壳代码**：`s.h.e.l.l.S`、`napiapzb.hwzw.moc.DtcLoader`、`R`、`DecodeProbes`，共 6 个源文件；真实业务代码加密在 `.ogg`/native 层，静态不可得（jadx 输出 `D:\DSH\reverse\wzbf\jadx`）；
- `bttets/`（698 个资源文件，含 books 510、bz_h5 128）全部被替换为 **1 字节占位**，内容不在 APK 内或受保护；
- 因此：**前端布局/文案/配色可完整参考，排盘算法不能静态提取**；算法需按通行子平法自研，并用开源库（如 lunar-python/sxtwl/bazi）对照校准——与紫微侧 py-iztro 对照思路相同。

关键路径：
- 解包：`D:\DSH\reverse\wzbf\apk`
- apktool 资源：`D:\DSH\reverse\wzbf\apktool`（`res/layout`、`res/values`、`AndroidManifest.xml`）
- jadx 壳码：`D:\DSH\reverse\wzbf\jadx`
- 参考副本（本仓库）：`docs/reference/bazi-app/`（命盘/简盘/细盘/基础信息/合婚/显示设置布局 + strings/colors/manifest）

## 二、功能地图（来自 125 个 Activity + 布局 + 文案）

### 1. 排盘
- **基本排盘 / 专业排盘**（`PaiPanEnterSet`）；命盘（`fragment_bz_mingpan`）、**简盘**（`fragment_jianhuapan_view`）、**细盘**（`fragment_bzxipan`/`XiPanActivity`）、多盘批量（`MultiPanActivity`）。
- **合婚**（`BzHeHunActivity`，含合婚记录）。
- **财运/运势记录**（`CaiYunActivity`、`CaiYunRecordActivity`）。
- 关系视图：`GZRelactionActivity`（干支关系）、`HeChongGuanXiActivity`（合冲关系）、`ImageLookUpActivity`（按图查盘/截图识别）。
- 排盘设置：基本/专业、显示项、年柱换年（立春/元旦）、节气换月、人元司令、真太阳时、虚岁、大运显示时间、夜盘、背景色、显示模块。
- **自定义神煞**：`CustomShenShaActivity` 等 8 个界面可新增/编辑神煞和起法条件；**格局规则**可设（`GejuSetActivity`、`GejuRuleSetActivity`）。
- 多用户、分组、案例批量删除/替换、用户信息导出。

### 2. 特色：五柱十字（分柱）
- 设置项「显示第五柱-分柱」「重置分柱设置」「每10分钟换分柱（默认）」。
- 规则（App 内说明原文要点）：时柱再细分为 12 个「分柱」，每 10 分钟一个地支；**真太阳时校正**是前提；起干用「时上起分法」（时干起甲子顺推），与五虎遁/五鼠遁一脉相承；另有一档「每 2 分钟顺推一个干支」的细则（早晚子时相关）。
- 学术提示（App 自述）：五柱十字属现代命理研究，传统经典无直接记载，仅作参考。

### 3. 早晚子时 / 时间口径
- 「早晚子时」开关：关闭时子时 23:00 起算至次日 00:59；开启时 23:00 与 00:00 分别重新起甲子；其他时辰从各自起点起甲子。
- 真太阳时、出生地区经纬度、节气换月、年柱换年（立春/元旦）均为可设置项——与我们的 `gua_now`/almanac 方向一致，但**口径要写进引擎选项与 hints**。

### 4. 书库/学堂（H5）
- `BookshelfActivity`、`BookWebActivity`、`activity_bazixuetang`、`XueTangResultActivity`、`TiKuH5Activity`（题库）、`BookSearchH5Activity`、`GzRelationH5Activity`、`CalendarWebActivity`、`PersonalCollectH5Activity` 等——书库与课程多为 WebView/H5 内容（`bttets/bz_h5` 目录名可证），与我们「KB + 前端」方向不同，但说明 八字 App 也走「盘 + 书 + 题库」。

### 5. 其他
- 生日提醒（`BirthdayRemind*`、`MemorialRemind*`）、桌面小组件（`middle_bz_time_app_widget`、`mini_bz_time_app_widget`）、VIP/支付/广告、登录绑定、反馈、系统消息、引导页。
- 用户/系统设置大量：`RyslfySet`（人元司令）、`NianZhuSwitchSet`（年柱换年）、`JieQiSwitchSet`（节气换月）、`XuShiSuiSet`（虚岁）、`SunTimeSetting`（真太阳时）、`DyShowTimeSet`（大运显示时间）、`SetShowModule`、`SetDSCG`、`AutoSetDzCg`、`AutoSetTaiYuanMGSGTX`、`AutoSetXCPH`、`TianGanSetChong`、`TianGanDuHe` 等。

## 三、盘面 UI 排布（可直接照做）

### 1. 命盘（`fragment_bz_mingpan.xml`）

- 顶部：标题 + 基础信息卡（生肖图标、姓名、农历/阳历 + 乾造/坤造、查看/编辑图标）。
- 提示条：「点击文字{十神，十二长生，纳音，神煞}可查看知识解析」。
- 主体是**横向排列的表格**：列 = **日期 / 年柱 / 月柱 / 日柱 / 时柱**（可选第五柱「分柱」），行 = 各层信息；左右各有可横向滚动的同步列（`SyncHorizontalScrollView`），首列「日期」为固定标签列（`*_fixed` 行）。

行结构（自上而下）：
| 行 | 内容 |
|---|---|
| 表头 | 日期、年柱、月柱、日柱、时柱 |
| 主星 | 十神（如 偏财 / 食神 / 元男 / 偏印；日柱标「元男/元女」） |
| 天干 | 天干大字（20sp）+ 五行小图标 |
| 地支 | 地支大字 + 五行小图标 |
| 藏干 | 每个地支下的藏干（1–3 个，竖列，含五行色） |
| 副星 | 藏干对应的十神 |
| 星运 | 十二长生（地势） |
| 自坐 | 自坐十二长生 |
| 空亡 | 旬空 |
| 纳音 | 六十甲子纳音 |
| 神煞 | 各柱神煞，可多条 |

- 显示开关（`activity_set_base_pan_show.xml`）：主星、藏干、福星、纳音、星运、自坐、空亡、神煞、土司(?)、遁天岁(?)、用神；每项单独 SwitchButton，可整体重置。

### 2. 简盘（`fragment_jianhuapan_view.xml`）

- 顶部：基础信息（农历/阳历、乾造、胎命身「胎元/命宫/身宫」）；「起运：出生后…」「交运：逢…」。
- **大运**横排（每步 10 年，显示 星运、吉/平、起止年龄）。
- **流年**横排（按年，显示星运与「始于/止于」）、**小运**、**流月**、**流日**、**流时**（逐级展开，VIP 权限提示）。
- 底部提示：流年提示、节气提示、**岁运天干/地支/整柱、原局天干** 的关系，以及**五行旺相休囚死**（如 木死、火囚、土休、金旺、水相）。

### 3. 细盘（`fragment_bzxipan.xml`）

- 列：日期、流年、大运、年柱、月柱、日柱、时柱；行含 天干、地支、藏干、流月干/支、十二长生（星运）、自坐、纳音、空亡、神煞、大运神煞。
- 附：天干提示/地支提示（合冲关系）、大运神煞、节气提示。

### 4. 基础信息盘（`fragment_base_info_pan.xml`）

- 姓名、生肖、性别、农历、阳历、真太阳时、出生地区；
- 人元司令、出生节气、星座、星宿、胎元、空亡、命宫、胎息、身宫、命卦；
- 日主属性（如 甲木）、阴阳参考（偏阴/偏阳）、旺衰参考（从强/…）、格局参考（正官格…）、同党/异党百分比；
- 五行能量（木/火/土/金/水 百分比）、五行个数、含藏干数；
- VIP 入口。

### 5. 合婚（`activity_bz_hehun_view.xml`）

- 双人基础参数（生肖、日元、夫妻宫、旺衰、格局、五行缺失、最旺/最弱五行）；
- 五行参数、四柱参数（年/月/日/时干支柱）、纳音参数、神煞参数（年柱=祖辈宫、日柱=夫妻宫等）、相互关系、婚姻格言。

## 四、配色与字体（可直接用于前端）

五行色（`res/values/colors.xml`）：
| 五行 | 色值 |
|---|---|
| 水 | `#2e83f6`（另深色 `#4f80ee`） |
| 金 | `#ef9104`（另一套 `#ab9e35`） |
| 土 | `#8b6d03`（另一套 `#797022`） |
| 火 | `#d30505`（暗色 `#56501f`） |
| 木 | `#2fa13a`（暗色 `#ebda52`） |

其他：
- 页面底 `#f7f7f7` / `#f9f9f9`，内容条 `#f7f7f7`，分隔 `#e3e3e3`、`#dfdfdf`；
- 主文字 `#313131` / `#4d4d4d`，次要 `#9e9e9e` / `#999999`，白色 `#ffffff`；
- 金色强调 `#d9b580` / `#d1a348`（标题、装饰线、VIP）；
- 五格底色为白/浅灰交替（斑马纹），标题行浅灰。

## 五、对我们的启示（八字段）

### 1. 引擎需要补的模块（相对现有 engine）

现有引擎已有：四柱（含子时换日/真太阳时判界）、节气、旬空、纳音、神煞表（KB）等；八字侧还缺：
- 十神（日干 vs 其余干支，含藏干十神）；
- 藏干表 + 十二长生（地势）+ 自坐 + 空亡（日空/年空/…）；
- 五行个数/能量（含藏干权重）、旺衰、同党/异党；
- 格局判定（正官/七杀/正财/偏财/食神/伤官/正印/偏印/建禄/阳刃…）；
- 大运（阳男阴女顺排、阴男阳女逆排；起运三天折一年；交运时间）；
- 流年/流月/流日/流时、小运、岁运与四柱的关系（合冲刑害）；
- 胎元、命宫、身宫、胎息、命卦、人元司令；
- **分柱（五柱十字，可选）**：10 分钟一分柱、时上起分法、真太阳时前提；
- 口径选项：早晚子时、年柱换年（立春 vs 元旦）、节气换月、虚岁/周岁、真太阳时开关——这些 App 都做成了设置，我们应做成 `gua_bazi` 的参数与 `hints`。

### 2. 前端数据契约（草案）

```json
{
  "meta": { "name": "", "gender": "男/女", "solar": "", "lunar": "", "zhenTaiyang": "",
            "region": "", "shengxiao": "", "jieqi": "", "xingzuo": "", "xingxiu": "",
            "taiYuan": "", "mingGong": "", "shenGong": "", "taiXi": "", "mingGua": "",
            "rizhu": "甲木", "yinyang": "偏阳", "wangsui": "从强", "geju": "正官格",
            "tongdang": 50, "yidang": 50, "wuxingEnergy": {"木":0.24,...}, "wuxingCount": {...},
            "dayun": {"qiyun": "...", "jiaoyun": "..."} },
  "pillars": [
    { "label": "年柱", "gan": "庚", "zhi": "午", "ganWuxing": "金", "zhiWuxing": "火",
      "shishen": "偏财", "canggan": [{"gan":"丁","shishen":"食神"}],
      "fuxing": ["食神"], "xingyun": "沐浴", "zizuo": "...", "kongwang": "...",
      "nayin": "路旁土", "shensha": ["..."], "fenzhu": null }
  ],
  "dayun": [ { "startAge": 5, "ganzhi": "丙戌", "shishen": "...", "xingyun": "..." } ],
  "liunian": [ { "year": 2026, "ganzhi": "丙午", "shishen": "...", "xingyun": "..." } ],
  "liuyue": [], "liuri": [], "liushi": [], "xiaoyun": []
}
```

渲染上可复用紫微前端的思路：**DOM/CSS 网格 + data 驱动 + 显示开关 + 点击行/格出知识解析**；命盘主体是「列=四柱、行=信息层」的表格（首列固定、可横向滚动）。

### 3. 建议顺序

1. `engine/bazi.js`：四柱（已有）→ 十神/藏干/长生/空亡/纳音/五行能量 → 格局/旺衰 → 大运/流年 →（可选）分柱；用开源 bazi/lunar 库做盘例对照（同紫微 py-iztro 思路）。
2. `gua_bazi` 工具：出生时间/性别/地点/口径参数 → 契约 JSON。
3. 前端 `client/bazi-chart`：命盘表格 + 简盘 + 基础信息卡 + 合婚（可后置）；沿用 `ZiweiChart` 的 `render(data)`/`onSelect` 模式。
4. 选项与流派写进 hints：早晚子时、年柱换年、节气换月、虚岁、真太阳时、分柱。

## 六、局限

- 业务代码被爱加密保护，**算法无法从本 APK 静态提取**；以上功能与盘面来自资源与文案，不含其内部算法实现。
- `bttets` 书库/H5 资源为 1 字节占位，无法取内容。
- 若要对照其算法细节，需在 Android 设备/模拟器上脱壳（Frida/FART 等）——成本高，暂不建议；用通行子平法 + 开源库校盘更可控。

## 七、参考文件清单

- `docs/reference/wenzhen-bazi/fragment_bz_mingpan.xml`（命盘）
- `fragment_jianhuapan_view.xml`（简盘）、`fragment_bzxipan.xml`（细盘）、`fragment_base_info_pan.xml`（基础信息）
- `activity_set_base_pan_show.xml`（显示开关）、`activity_bz_hehun_view.xml`（合婚）
- `strings.xml`（文案/五柱规则说明）、`colors.xml`（配色）、`AndroidManifest.xml`（125 个 activity 清单）
## 八、前端原型（已完成，2026-11-07）

按本参考的细盘版式，已做出零依赖前端原型：`client/bazi-chart/`（index.html + azi.css + azi.js + selftest.html + preview.png）。

- 主表列 日期 / 流月 / 流年 / 大运 / 年柱 / 月柱 / 日柱 / 时柱；行 主星 / 天干 / 地支 / 藏干 / 星运 / 自坐 / 空亡 / 纳音 / 神煞；
- 默认四柱 + 当前大运/流年/流月（示例盘：2019 乙卯大运、2026 丙午年、辛丑月，与参考截图一致）；
- 大运/流年/流月三条选择带可交互切换，其余大运、流年、流月点开查看；
- 另加独立「合婚」页（示例数据）；
- 对外 API：BaziChart.render/getState/selectDayun/selectLiunian/selectLiuyue/onSelect；
- 自检 selftest.html 18 项全过。

下一步：把 azi.js 内置的示例计算迁到 lib/engine/bazi.js + gua_bazi，用开源 bazi/lunar 库校盘后，前端改为 BaziChart.render(engineResult)。


