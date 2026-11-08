# 命盘快照（chart-panel）

`gua_bazi` / `gua_ziwei` 每次排完盘，会把最新盘面写入本目录的 `latest.json`，供 DSH 的「命盘侧栏」插件读取并自动打开右侧栏。

格式：

```json
{
  "type": "bazi | ziwei",
  "at": "ISO 时间",
  "chart": { "...": "对应引擎输出（meta + pillars/dayun 或 meta + palaces）" }
}
```

- 全局只保留**最新一盘**，最后一盘覆盖上一盘；
- 写盘失败不影响工具返回；
- 插件只读该文件，不参与排盘。
