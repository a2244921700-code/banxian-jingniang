# 八字 / 紫薇 / 奇门命盘侧栏（guashi-chart-panel）

DSH 客户端插件：在**右侧栏**打开可交互的八字 / 紫薇 / 奇门九宫盘。

## 工作方式

1. `dsh-guashi-agent` 里的 `gua_bazi` / `gua_ziwei` / `gua_qimen` 排完盘后，把最新盘面写进共享快照：
   `D:/DSH_GuaShi/client/chart-panel/latest.json`
2. 本插件的 **Host 半区** 暴露一个只读 RPC：`status`（版本号）与 `latest`（盘面 JSON）。
3. 本插件的 **Client 半区**：
   - 在右侧栏注册 `dsh-resource://guashi-chart/**` 标签类型；
   - 一个常驻的小监听器轮询 `status`，发现快照更新就自动 `openResource` 打开右侧栏；
   - 标签页里渲染八字四柱/大运/流年/流月、紫微十二宫，或奇门九宫盘（含值符值使、八神九星八门、天地盘干、暗干、旺衰、空马）。

## 安装

```powershell
# 在 DSH 里：
plugin_manager install_bundle  D:\DSH_GuaShi\plugins\guashi-chart-panel
```

装完需要重启一次 Harness（新装 bundle 需加载 Host/Client 两半），之后**新开会话**里让鲸娘排一盘，右侧栏会自动出现「八字命盘」「紫薇命盘」或「奇门九宫盘」标签。

## 边界

- 快照是**全局最新一盘**：最后算的那盘覆盖上一盘；暂不按会话分开存。
- 八字盘面含四柱、十神、藏干、星运、空亡、纳音、神煞、大运/流年/流月；紫微盘面含十二宫、主星、四化、庙旺、大限；奇门盘面含局数/值符值使/九宫八神九星八门/天地盘干/暗干/旺衰/空马，实验盘带「实验/待校核」标记。
- 样式跟随 DSH 主题变量；未做深色主题单独配色。
- 本插件只**读**快照文件，不参与排盘计算。


