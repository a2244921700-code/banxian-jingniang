# 半仙·鲸娘（Banxian Jingniang）

本地运行的 DSH（DeepSeek Harness）术数 Agent：易占六门（梅花、六爻、奇门、大六壬、太乙）与命理三科（八字、紫微、七政四余）。内置纯 ESM 排盘引擎、古籍知识库检索、卦案记忆与前端可视化原型。

**本仓库已转为公开仓库，仅用于个人研习、文化研究与技术学习；作者不建议、也不授权任何商业用途。** 详见 [NOTICE.md](NOTICE.md)。

## 目录

```
dsh-guashi-agent/   DSH bundle：preset、工具、排盘引擎、skills、测试
client/             前端原型：八字 / 紫薇 / 奇门九宫盘
plugins/            DSH 右侧栏插件 guashi-chart-panel（八字 / 紫薇 / 奇门自动打开）
知识库/             古籍原文与编者整理（仅上传 .md 文本；来源见各文件头与 _目录.md）
docs/               架构、规则、规划、参考分析
tools/              知识库抓取与索引脚本
AGENTS.md           工作区 Agent 约定
NOTICE.md           非商业使用与版权声明
```

知识库中只上传可直接阅读的 `.md` 文本；`_META/` 机读清单、`资料归档/` 现代书籍与扫描件、`卦案/` 个人卦案记录、从商业 App 提取的布局参考副本（`docs/reference/bazi-app/`、`docs/reference/congzhen-qimen/`）仍保留在本机，不进入公开仓库。

## 快速开始

需要 Node.js ≥ 24（纯 ESM，无第三方运行时依赖）：

```powershell
cd dsh-guashi-agent
node test/engine.test.mjs
node test/engine-qimen.test.mjs
# 共七套 152 项
```

前端直接双击：

- `client/bazi-chart/index.html`
- `client/ziwei-chart/index.html`
- `client/qimen-chart/index.html`

规则说明见 `docs/ENGINE-RULES.md`（按需查对应小节）；架构见 `docs/ARCHITECTURE.md`。

## 默认流派

- 奇门：**时家 + 转盘 + 拆补法 + 中五寄坤二**（Agent 默认）；
- 八字：立春换年、节气换月、23:00 子时换日；
- 紫微（界面名「紫薇命盘」）：农历年干四化、闰月前半月算上月/后半月算下月；
- 六壬：月将按中气换将。

实验性扩展（飞盘/括囊、茅山/阴盘/分家/刻家、多局、命运局等）均带 `meta.experimental` 标记，不能当权威盘。

## 知识库来源与授权

- 古籍原文多属公有领域；各文件头注明抓取/整理来源（如殆知阁、中文维基文库等）。
- 维基文库转录部分依其来源页的 CC BY-SA 4.0 等许可使用；转录/整理内容仅作个人研习。
- 编者整理的导读、目录、校订说明版权归本仓库整理者；现代书籍摘要/研究资料仅作个人研习。
- **任何商业使用均需自行取得相应权利人（古籍整理者、平台、现代作者/出版社）许可；作者不建议商用。**

## 边界

- 本仓库不传播 APK、不绕过商业软件授权；
- 排盘算法按公开规则与自有知识库独立实现；
- 内容不构成医疗、法律、投资建议。
