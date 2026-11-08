# 半仙·鲸娘（Banxian Jingniang）

本地运行的 DSH（DeepSeek Harness）术数 Agent：易占六门（梅花、六爻、奇门、大六壬、太乙）与命理三科（八字、紫微、七政四余）。内置纯 ESM 排盘引擎、古籍知识库检索、卦案记忆与前端可视化原型。

> 这是**私有仓库**，仅作个人研习与开发使用；不构成医疗、法律、投资建议。

## 目录

```
dsh-guashi-agent/   DSH bundle：preset、工具、排盘引擎、skills、测试
client/             前端原型：八字 / 紫薇 / 奇门九宫盘
plugins/            DSH 右侧栏插件 guashi-chart-panel（八字 / 紫薇 / 奇门自动打开）
docs/               架构、规则、规划、APK 参考分析
tools/              知识库抓取与索引脚本
AGENTS.md           工作区 Agent 约定
```

未上传（保持本地）：`知识库/` 古籍正文、`资料归档/` 现代书籍与扫描件、`卦案/` 个人卦案记录，以及从商业 App 提取的布局参考副本 `docs/reference/bazi-app/`、`docs/reference/congzhen-qimen/`。这些内容受版权或个人隐私约束，不进入仓库。

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

## 版权与边界

- 古籍原文、现代书籍、商业 App 资源不在本仓库；
- 排盘算法按公开规则与自有知识库独立实现；
- 不传播 APK、不绕过商业软件授权。
