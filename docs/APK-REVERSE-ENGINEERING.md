# APK 解包与反编译：可复用操作手册

> 2026-11 实战总结。两次对象：**Adobe AIR 应用**（文墨天机，`base.apk`）与**爱加密加固的原生 Android 应用**（问真八字，`问真八字.apk`）。
> 目的：以后遇到 .apk，能在 10 分钟内判断「值不值得解、能解出什么、用什么工具、产出什么」。
> 范围：个人研习与互操作参考；不复制、不分发他人的代码、素材与书籍内容。

## 一、先分类：看 zip 结构，别急着上工具

```powershell
# 最快侦察：不解压，直接看条目
python -c "import zipfile; z=zipfile.ZipFile(r'C:\path\app.apk'); names=z.namelist(); print(len(names)); print(names[:30])"
```

| 类型 | 关键条目 | 判据 | 工具 |
|---|---|---|---|
| **Adobe AIR** | `assets/META-INF/AIR/application.xml`、`assets/*.swf` | 有 AIR 声明 | 解压 + **FFDec**（JPEXS） |
| 普通原生 Android | `classes.dex`、`res/`、`AndroidManifest.xml`、`lib/` | dex 多、res 正常 | **apktool** + **jadx** |
| **加固**（爱加密/易盾/乐固/梆梆/360） | `assets/ijiami.dat`、`libijmDataEncryption_*.so`、`.jgapp`、`libjiagu*.so`、`libDexHelper*.so`、`com.secneo.*` | 见下 | apktool 只能解资源；代码需脱壳 |
| Unity | `libunity.so`、`assets/bin/Data/` | 常见游戏 | AssetRipper/Il2CppDumper 等（不在本手册范围） |
| Flutter | `libflutter.so`、`assets/flutter_assets/` | — | Blutter（超出范围） |
| React Native | `assets/index.android.bundle` | — | metro 反编译（超出范围） |

**加固特征速查**：
- 清单里 `android:name="s.h.e.l.l.S"` → 爱加密？
- `assets/ijiami.dat` + `libijmDataEncryption*.so` → 爱加密
- `libjiagu.so` / `libjiagu_art.so` → 360 加固
- `libDexHelper.so` / `libDexHelper-x86.so` → 梆梆
- `libshell*.so` / `assets/*.bin` + `com.secneo` → 腾讯乐固/易盾
- `raw/libnativesoHelper_*.ogg`（体积异常大，非音频）→ 爱加密加密载荷
- `classes.dex` 只有几 MB 但 APK 几十 MB，且 dex 字符串里只剩 `Landroid/...`、`DexFile`、`loadLibrary` 等壳代码 → 加固

**加固 APK 的预期**：
- `apktool d` 仍能解出**资源**（布局、字符串、颜色、drawable、manifest、activity 列表）；
- `jadx` 只能解出**壳**（几万个类里只有几十个是业务类），真实 dex 在加密载荷/native 层，静态拿不到算法；
- 很多 assets 被替换成 **1 字节占位**（如 `bttets/books/**` 全 1B），内容不在包内或需运行时解密；
- 这时把目标改成「**UI/功能参考**」而不是「抄代码」，能交付八成价值。

## 二、工具安装（本机已有则跳过）

约定目录：`D:\DSH\reverse\tools\`

| 工具 | 版本 | 用途 | 下载 |
|---|---|---|---|
| JDK 21 | 已有 | apktool/jadx/FFDec 依赖 | `C:\Program Files\Microsoft\jdk-21.0.13.21-hotspot\bin\java.exe` |
| apktool | 3.0.3 jar | 解资源、manifest、smali（不反编译 Java） | GitHub `iBotPeaches/Apktool` releases → `apktool_3.0.3.jar` |
| jadx | 1.5.6 | dex → Java（壳/普通包） | GitHub `skylot/jadx` releases → `jadx-1.5.6.zip` |
| FFDec | 26.4.0 | AIR/SWF 反编译（脚本+素材） | `D:\DSH\reverse\tools\ffdec` |

**下载加速**（GitHub 直连 SSL 偶发失败）：

```powershell
# 用镜像前缀；大小与官方 release 对得上即可
curl.exe -L --retry 5 -o D:\DSH\reverse\tools\apktool_3.0.3.jar `
  "https://github.boki.moe/https://github.com/iBotPeaches/Apktool/releases/download/v3.0.3/apktool_3.0.3.jar"
```

查最新版本：`https://api.github.com/repos/<owner>/<repo>/releases/latest`（可用 web_fetch）。

## 三、原生 Android：标准流程

### 1. 解包资源（apktool）

```powershell
$java = 'C:\Program Files\Microsoft\jdk-21.0.13.21-hotspot\bin\java.exe'
$jar  = 'D:\DSH\reverse\tools\apktool_3.0.3.jar'
& $java -Xmx4g -jar $jar d 'C:\path\app.apk' -o 'D:\DSH\reverse\<name>\apktool' -f
```

- 输出：`AndroidManifest.xml`（明文）、`res/layout`、`res/values/strings.xml`、`res/values/colors.xml`、`assets/`、`lib/`、`apktool.yml`（含 versionCode/versionName/minSdk/targetSdk）。
- 常见 warning `Unresolved resource reference` 可忽略；资源混淆（AndResGuard）时名字会是 `res/-0.png` 之类，但 apktool 能还原出 layout/string 资源表。
- 86 MB / 3000+ 资源大约 8 秒。

### 2. 反编译代码（jadx）

```powershell
$env:Path = 'C:\Program Files\Microsoft\jdk-21.0.13.21-hotspot\bin;' + $env:Path
& 'D:\DSH\reverse\tools\jadx\bin\jadx.bat' -d 'D:\DSH\reverse\<name>\jadx' --no-res --no-debug-info 'C:\path\app.apk'
```

- `--no-res` 跳过资源（apktool 已经解过），只出代码。
- 判断是否加固：看输出文件数。普通包几千~几万文件；壳只出 `R.java`、`StubApp`、`DexLoader`、`s/h/e/l/l/S.java` 等几个。
- 如果 `jadx` 报内存不足：`set JAVA_OPTS=-Xmx8g` 或改 `jadx.bat` 里的 `DEFAULT_JVM_OPTS`。
- 多 dex 的包 jadx 会自动处理；`classes2.dex` 不用手动合并。

### 3. 从资源反推 UI / 功能（加固包的主战场）

1. 列出全部 activity：`Select-String AndroidManifest.xml -Pattern '<activity'`，125 个 activity 就是 125 条功能线索。
2. 列出关键 layout：`Get-ChildItem res/layout -File | Where-Object Name -match 'main|pan|home|birth|book'`。
3. 从 layout 提内容排布：`android:id`（业务槽位）+ `android:text`（默认文案/示例盘）+ `TableRow`/`LinearLayout` 层级。
4. 从 `strings.xml` 挖功能名词、说明文档、开关文案；从 `colors.xml` 取品牌色与五行/宫位配色。
5. 自定义 View 的类名（`<com.xxx.view.Yyy>`）会泄露绘制结构（表格、滚动同步、盘面）。
6. 输出一份「UI 规范 + 功能地图」，比抄代码更安全、更可维护。

### 4. 产出模板

```
1. App 身份：应用名/包名/versionName/versionCode/minSdk/targetSdk/大小/dex 数
2. 保护状态：普通 / 加固类型 / 壳特征 / 代码是否可得 / assets 是否被占位
3. 反编译产物路径：apktool 目录、jadx 目录、解压目录
4. 功能地图：activity 列表 → 分组（排盘/合婚/书库/设置/用户…）
5. UI 排布：关键 layout 的表结构/字段/行顺序/配色/字号
6. 数据/算法可获得性：能拿到的（资源、字符串、颜色、布局）；拿不到的（业务 dex、加密 assets）
7. 对自家项目的启示：数据契约草案、可参考的交互，不复制代码/素材
8. 限制与后续：需不需要脱壳（设备/模拟器 + Frida/FART），成本与风险
```

## 四、加固包：不要硬啃代码，改用资源+文案

以「问真八字」2.8.3（`com.wzwh.bzpaipan`，86.78 MB，爱加密）为例：

- `apktool` 8 秒解完：453 个 layout、125 个 activity、strings/colors 全可读；
- `jadx` 只出 6 个文件（`s.h.e.l.l.S`、`napiapzb...DtcLoader`、`R`）→ 壳；
- `assets/bttets/` 698 个文件全 1 字节；书库/H5 内容不在包内；
- 结论：**前端排布可完整参考，排盘算法不可静态提取**。算法按通行子平法自研，用开源 `lunar_python` 校盘。

如果确实需要算法：
1. 找同版本**未加固**渠道包（应用宝/各商店/厂商渠道有时不同）；
2. 模拟器 + Frida/FART dump dex（成本高，注意法律与授权）；
3. 放弃代码、以公开规则 + 开源库实现（推荐，尤其做自己的产品）。

## 五、AIR 包（FFDec）

```powershell
# 1) 解压 APK（AIR 应用就是个 zip）
python -c "import zipfile; zipfile.ZipFile(r'C:\path\app.apk').extractall(r'D:\DSH\reverse\<name>\apk')"

# 2) 反编译 SWF 脚本
& 'D:\DSH\reverse\tools\ffdec\ffdec.bat' -export script 'D:\DSH\reverse\<name>\scripts' 'D:\DSH\reverse\<name>\apk\assets\App.swf'
# 3) 导出素材
& '...\ffdec.bat' -export asset 'D:\DSH\reverse\<name>\assets_out' '<path>\App.swf'
```

- 输出 `scripts/` 下是 `.as` 文件（Haxe/OpenFL 会编译成非常多的 `K*` 类名，可读性差但结构清楚）；
- 中文文案常被加密进 `StrPoolData.bin`（AES/自定义解密 + 动态属性），**不要花太多时间攻字符串池**，先用资源里的图片/布局/类名反推；
- 关键类看名字：星表、盘面绘制、UI 框架、主控；`-export script` 后 grep 类名/字段名；
- 素材导出可用于分析配色、图标、盘面底图；**不可直接分发**。

## 六、常见坑

| 坑 | 现象 | 处理 |
|---|---|---|
| JSON 带 BOM | `package.json` 安装报 `Unexpected token '﻿'` | 用 Python/UTF8 no BOM 重写；批量 strip `\xef\xbb\xbf` |
| `apktool` 资源引用告警 | `Unresolved resource reference` | 正常，忽略 |
| 中文路径/文件名 | jar/命令行参数乱码 | PowerShell 用引号 + UTF8 控制台；工作目录尽量 ASCII |
| GitHub SSL EOF | 下载失败 | 用 `github.boki.moe` 镜像或 `web_fetch` 取 release URL |
| Edge 无头截图失败 | `--headless=new` 无输出 | 用旧 `--headless` + `--virtual-time-budget` + `Start-Process` 等 6–10 秒 |
| asar 里的文件 shell 读不到 | `ls/cat/node` 失败 | 用 DSH 的 `read` 工具直接读绝对路径（Host 能读 asar） |
| 加固 assets 全 1B | 解出来全是 1 字节 | 记为「内容不可得」，不要反复尝试 |
| 多 dex | jadx 只解了部分 | jadx 默认全解；检查 `classes*.dex` 数量 |
| 资源混淆 | `res/-0.png` 之类 | 用 `resources.arsc`/apktool 解码结果，不按文件名猜 |

## 七、法律与边界

- 只做**个人研习/互操作/兼容**；不复制代码、素材、字体、书籍正文到自己的产品；
- 不绕过付费/会员/DRM；不传播破解包；
- 引用 UI 版式只取「结构与交互」，配色/图标重新设计；文档注明参考来源；
- 加固应用不要公开传播脱壳方法与工具链细节。

## 九、探测脚本（先跑这个）

C:\Users\22449\.dsh\skills\apk-reverse\scripts\probe_apk.py

`powershell
 = 'C:\Users\22449\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe'
&  'C:\Users\22449\.dsh\skills\apk-reverse\scripts\probe_apk.py' 'C:\path\app.apk'
`

输出 JSON：顶层目录、dex 体积、swf、native、assets/res 数量、1 字节占位统计、框架/加固标记（air/ijiami/jiagu360/bangcle/legu/unity/flutter/react-native）与 hints。
## 八、本机已解案例（索引）

| 案例 | 类型 | 产物 | 结论 |
|---|---|---|---|
| 文墨天机 `base.apk`（com.ziwei001.zwmobilepro 2.5.26） | AIR/FFDec | `D:\DSH\reverse\wmtj\`（980 AS3、assets） | 盘面结构/配色/星表思路可参考；字符串池加密未破 |
| 问真八字 2.8.3（com.wzwh.bzpaipan） | 爱加密加固 | `D:\DSH\reverse\wzbf\apktool`、`jadx` | 453 布局/125 activity 可参考；算法不可静态取；bttets 全 1B |
| 从真奇门 2.9.1（cn.congzhen.CongZhenQiMenAndroid） | 普通原生（未加固） | D:\DSH\reverse\congzhen\apktool、jadx | 255 layout/45 activity/5731 源文件；九宫盘面、起局方式、暗干/穿壬/多局可参考 |

---

配套 skill：`C:\Users\22449\.dsh\skills\apk-reverse\SKILL.md`（含 references 与探测脚本）。


