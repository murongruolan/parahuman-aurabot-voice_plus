# 开发进度 / 当前状态

更新：2026-11-11。**1.1.0 开发与本地验证完成，发行包已生成；目标机器安装与 QQ 验收未进行。**

## 状态分层

| 部分 | 状态 |
|---|---|
| 1.0.0 Breeze/QQ 链路 | 用户在目标机器确认可用；发行包保留 |
| 1.0.0 回归 | 上游 1220 通过/3 跳过；扩展基线 106 通过；发行检查 2 通过 |
| 1.1.0 三态后端与配置保存 | 已实现并测试 |
| 1.1.0 独立「增强语音」控制台 | 已重写、编译、测试、真实浏览器验证 |
| 1.1.0 扩展回归 | **121 通过 / 0 失败 / 0 跳过**（`artifacts/module-test.log`） |
| 1.1.0 浏览器验证 | 通过；浅/深色、窄屏、三态、错误截图已查看 |
| 1.1.0 发行包 | `dist/aurabot-breezeblue-voice-1.1.0.zip`，未覆盖 1.0.0 |
| 1.1.0 目标机器安装 | **未进行，不可宣称已完成** |
| 目标 QQ 链路（1.1.0） | **未验证**；目前仍是 1.0.0 |

## 已写改动

- `modules/breeze-settings/control.mjs`：三态、实际状态、字段白名单、revision、脱敏。
- `modules/breeze-settings/access.mjs`：独立控制台访问保护。
- `modules/breeze-settings/index.mjs`：独立导航页、密码字段登记、console/status/save/mode/test。
- `modules/breeze-settings/panel.js`：两栏控制台；保存/撤销/revision、就近试听、音色列表、高级折叠、窄屏与主题变量。
- `test/control.test.mjs`、`test/loader.test.mjs`、`test/panel.test.mjs`：后端/加载器/新页面回归。
- `scripts/browser-smoke.mjs`：未修改宿主客户端下的独立导航与三态验证。
- `scripts/package.mjs`、`test/release.check.mjs`：1.1.0 版本与新增文件白名单；成品三态/试听检查。
- 版本与文档：根包、两个模块、使用说明、测试报告、README、WORKLOG、需求清单统一到 1.1.0。

## 下一步（仅剩用户侧）

1. 在目标机器备份并移出 1.0.0 的 `voice` / `breeze-settings`，复制 1.1.0 两个目录（见《使用说明.md》第 2 节）。
2. 打开独立「增强语音」页，确认原配置读回，选择「增强语音」。
3. 试听确认 engine 为 `breezeblue`，再用 QQ 发一句短语音。
4. 若验收失败，切回「官方语音」或恢复 1.0.0 备份。

## 不变约束

- 不改宿主源码、不做 DOM 注入；保留官方用户模块机制。
- `voice` 为合成入口；`breeze-settings` 为独立页面且沿用 1.0.0 配置 ID。
- 增强/官方/关闭互斥；官方加载失败回退机制仍保留，显示实际状态。
- 不安装开发电脑 DSH、不改其配置；测试仅用隔离 fixture。
- 不清除用户 Key/Voice ID/原引擎设置；不提交 .private、音频、运行产物。
- 第二阶段动态提示词、Modal、自定义引擎和情绪路由只记录，不提前实现。
- 1.1.0 未经目标机器验收前，不覆盖 1.0.0 发行包，不称“升级完成”。
