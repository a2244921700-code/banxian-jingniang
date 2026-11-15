# 奇门客户端 · 规划（v0.1）

- 更新：2026-11-07
- 目标：把「半仙·鲸娘」的奇门从文字盘面升级为**可看、可切换、可交给前端渲染**的九宫客户端；引擎继续放在 `dsh-guashi-agent/lib/engine/qimen.js`。
- 参考：`docs/REF-CONGZHEN-QIMEN.md`（从真奇门 2.9.1 反编译分析）。

## 当前进度

| 项 | 状态 |
|---|---|
| 引擎：转盘 + 拆补/置闰 | ✅ 原有 |
| 引擎：寄宫、早晚子时、置闰天数、暗干 5 法、门/星旺衰、旬首、穿壬四层 | ✅ |
| 工具 `gua_qimen` 参数透传 | ✅ |
| 前端 `client/qimen-chart/` 九宫盘（设置面板、多局标签、穿壬、暗干/旺衰、点宫详情、命运局） | ✅ 原型 |
| 自检 | ✅ `selftest.html` 11 项；引擎 qimen 27 项 |
| 飞盘 / 括囊 | ✅ 实验（hints/meta 标未校核） |
| 茅山 / 阴盘 / 分家阳盘 / 刻家阴盘 | ✅ 实验 |
| 暗干 5 法 | ✅（后 4 法实验） |
| 穿壬、年/月/日家多局、山向/罗盘/套玄空 | ✅ 实验/占位，前端已展示 |
| 命运局 | ✅ 实验（原局+10 步大运；前端命运局标签） |\n| 套八字、案例库、AI 提示词 | ⏸ 按作者要求不做 |
| 把 `gua_qimen` 输出接到前端/右侧栏 | ✅ 快照写入 `latest.json`，侧栏插件新增奇门九宫盘视图，排盘后自动打开 |

## 规则说明\n\n逐条排盘规则、公式与实验/未校核边界见 `docs/ENGINE-RULES.md`。\n\n## 数据契约（与前端同构）

```js
{
  input: { datetime, solarTerm, fourPillars: {year,month,day,hour}, dayKong, hourKong },
  ju: { yinYang, number, yuan, solarTerm, futou, method },
  zhiFu, zhiShi, xunShou, kongWang, maXing,
  palaces: [{ index, gua, direction, element, diPanGan, tianPanGan,
              star, door, shen, anGan, starElement, doorElement,
              starWangShuai, doorWangShuai, kong, ma, notes }],
  settings: { juMethod, panMethod, jiGong, lateZi, anGanMode, zhirunDays }
}
```

## 下一步建议

1. **P1 盘式**：飞盘/括囊（先用公开规则实现，再找可对照基准盘校核；未验证前标「实验」）；
2. **P1 起局**：茅山、阴盘、分家阳盘、刻家阴盘；
3. **P2 盘面增强**：其余 4 种暗干、穿壬（地盘地支/月将/神将/建星）、八节/正五行旺衰细分；
4. **P2 多局**：年/月/日家、山向/罗盘/套玄空；命运局/套八字复用 `engine/bazi.js`；
5. **P3 集成**：`gua_qimen` 写快照，复用 `guashi-chart-panel` 右侧栏插件模式，自动打开「奇门盘」标签。

## 边界

- 引擎只出盘面与客观字段；用神、格局、克应、应期由 `guashi-qimen` 技能判断。
- 未实现的盘式要在 `hints` 说明，不可默默按转盘冒充。



