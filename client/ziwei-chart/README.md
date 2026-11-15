# 紫薇命盘 · 前端原型（v0.1）

「半仙·鲸娘」客户端的第一步：**零依赖、双击可开**的紫薇命盘页面。
后面 `gua_ziwei` 引擎输出同构 JSON，直接 `ZiweiChart.render(data)` 即可刷新。

## 打开方式

双击 `index.html`（或拖进浏览器）。不需要服务器、不需要构建。

## 目录

```
index.html     入口（顶栏按钮 / 盘面 / 详情栏）
chart.css      样式：浅色纸面 + 墨色主题，4×4 网格盘面
chart.js       渲染、交互、示例盘数据、对外 API
preview.png    渲染截图（验收用）
```

## 盘面版式

- 4×4 网格，中宫 2×2 放命盘信息（姓名/性别/农历/四柱/五行局/命主身主/大限/流年/四化汇总）。
- 12 宫位置：`巳午未申 / 辰□ □酉 / 卯□ □戌 / 寅丑子亥`；环序 `寅丑子亥戌酉申未午巳辰卯`。
- 每宫：宫名 + 地支、大限/流年、主星（庙旺 + 四化角标）、辅星、神煞。
- 四化四色：禄（绿）权（蓝）科（金）忌（红）；庙旺平陷有独立颜色。

## 数据契约

```js
{
  meta: {
    name, gender, birthSolar, birthLunar, fourPillars,
    wuxingJu, mingZhu, shenZhu, shenGongZhi, daxian, liunian, note
  },
  palaces: [
    {
      zhi: '午',                 // 地支，必填，唯一
      name: '命宫',              // 宫名
      isMing: true, isShen: false,
      daxian: '6-15', liunian: '流年命宫' | '',
      stars: [{ name: '紫微', bright: '庙', sihua: '权' }],
      aux:   [{ name: '文昌' }],
      sha:   ['擎羊']
    }
    // ... 共 12 项
  ]
}
```

- `bright`：庙 / 旺 / 得 / 利 / 平 / 陷（缺省则不画角标）。
- `sihua`：禄 / 权 / 科 / 忌。
- `palaces` 按 `zhi` 落位，与数组顺序无关；重复地支会报错。

## 对外 API（给 Agent / 外部脚本用）

```js
ZiweiChart.render(data)        // 重绘
ZiweiChart.getData()           // 当前数据
ZiweiChart.setTheme('dark')    // 'light' | 'dark'
ZiweiChart.toggle('sha', false)     // 隐藏神煞；toggle('sihua', true) 显示四化
ZiweiChart.focus('午')         // 选中宫位并展开详情
ZiweiChart.onSelect = p => {...}    // 点击宫位回调
window.addEventListener('ziwei:select', e => console.log(e.detail))
```

示例：在控制台 `ZiweiChart.focus('午')` 会高亮命宫并显示详情。

## 当前状态

- ✅ 12 宫布局、中宫信息、四化/庙旺/神煞、详情栏、主题/显隐切换、对外 API。
- ⬜ 数据来自示例盘；等 `lib/engine/ziwei.js` + `gua_ziwei` 完成后替换。
- 设计参考：文墨天机（颜色与盘面结构）、`docs/PLAN-ZIWEI-CLIENT.md`。

## 验收记录

见 `preview.png`（1440×1200 无头浏览器截图，2026-11-07）。


