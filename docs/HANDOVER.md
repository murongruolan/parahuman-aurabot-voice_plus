# 1.1.0 交付状态与接续入口

更新：2026-11-11。**1.1.0 已在目标机器通过 QQ 链路验收；1.1.1 已实现控制台回退提示并等待用户更新目标机。第二阶段未开始。**

## 1. 仓库与分支

- 私有仓库：`git@github.com:murongruolan/parahuman-aurabot-voice_plus.git`（SSH）。
- 1.0.0 基线：提交 `889d522`，分支 `work/voice-plus-console`。
- 1.1.0 开发分支：`handoff/voice-plus-1.1-wip`（本文件所在分支）。
- 本机开发目录：`D:\.claude_work\aurabot-breezeblue-voice`。
- 1.0.0 可用 ZIP：`dist\aurabot-breezeblue-voice-1.0.0.zip`（本地，Git 忽略）。
- 1.1.0 ZIP：`dist\aurabot-breezeblue-voice-1.1.0.zip`（本地，Git 忽略）。
- **用户已在另一台 DSH 机器安装 1.0.0，并确认可以收到 QQ 语音。** 本机 DSH 不是安装目标。

先读 `docs/PROGRESS.md` → `docs/DESIGN.md`，再读根目录《使用说明.md》《测试报告.md》。

## 2. 本轮完成内容

- 独立、紧凑的「增强语音」控制台，无 `tab` 字段，宿主自动生成导航页。
- 三态互斥：增强 / 官方 / 关闭；控制台在官方与关闭状态仍可用。
- 远程 Breeze 与原有引擎 tabs；基本配置、音色搜索分页、高级折叠；就近试听。
- 保存/撤销/revision 防覆盖；Key 密码登记与空值保留；未保存草稿提醒；试听与模式切换要求先保存。
- `/console/status|save|mode|test`：本机访问保护、字段白名单、不自动重试计费请求。
- 保留原引擎、本地 TTS 优先、RVC、ASR；不修改宿主源码、不做 DOM 注入。

## 3. 验证结果（准确边界）

- 扩展回归：**121 pass / 0 fail / 0 skipped**，日志 `artifacts/module-test.log`。
- 浏览器：真实未修改 `upstream/client/client.js` + 真实 React 18 + 真实 loader；通过独立导航进入页面，验证保存/脱敏、音色、试听、三态、官方/关闭时控制台存活、仅一个 voice 运行、429 不重试；无 pageerror。
- 截图已实际查看：`artifacts/browser/panel-enhanced-light.png`、`panel-enhanced-dark.png`、`panel-enhanced-narrow.png`、`panel-official-light.png`、`panel-off-light.png`、`panel-error.png`。
- 上游完整回归沿用 1.0.0 基线（1220/0/3 skipped）；本轮未改 `upstream/`。
- 真实付费 Breeze 调用仍为 1.0.0 阶段的 2 次 / 25 字符；1.1.0 没有新增付费调用。
- **1.1.0 已在目标机器安装，QQ 语音与控制台试听经用户确认正常（2026-11-11）。**
- 用户反馈原「语音」页在增强模式下仍显示：宿主 `TAB_MODS.voice=['voice']` 只随模块运行状态显隐，官方机制无隐藏入口；已核实 `keepPanel` 未被客户端消费。采用文档注明（使用说明第 4 节）而非隐藏/DOM 注入。
- 目标机日志曾记录一次 `BreezeBlue 失败：无法连接 Breeze 官方 API…→ 回退原语音引擎`（10:27:37，NETWORK_ERROR，非超时、未计费）；1.1.1 起 voice 模块将最近一次回退（时间+脱敏原因）通过 `/breeze/status` 暴露，控制台侧栏展示。

## 4. 目标机器升级步骤

1. 在目标机器切到「官方语音」，停止生成。
2. 把旧 `voice` / `breeze-settings` 移到 modules 之外备份（不要留在 modules 里改名）。
3. 复制 1.1.0 两个模块目录，等待重载。
4. 打开独立「增强语音」页，确认 Key/Voice ID/原引擎参数读回，选择「增强语音」。
5. 试听显示 `breezeblue` 后，再用 QQ 发短语音验收。
6. 失败可切「官方语音」，或恢复 1.0.0 备份/ZIP。

详细说明见根目录《使用说明.md》。

## 5. 工程注意事项

- `panel` 是宿主 `new Function('React','h','ui','call',source)` 执行的函数体，不是普通 ESM；语法检查必须用同样方式。
- 页面路由属 `breeze-settings`，前缀 `/aurabot/api/ext/breeze-settings/console/*`；Breeze 音色查询 `/breeze/voices` 由 voice 模块注册，仅增强模式存在。
- `consoleState` 中用户模块存在字段是 `hasUser`；实际模式取 `modules.status()` 的 running，而不是仅看期望配置。
- 宿主对未变化的关闭模块可能 sync 不重启；模式 API 在必要时显式 `reload('voice')`。
- 原 `/breeze/test` 是直连不回退测试；新 `/console/test` 走实际语音路径，可能本地接管或回退，页面显示真实返回 engine。
- 宿主内部 tab 切换的草稿保护**未宣称支持**；目前只有 `beforeunload` 页面离开提醒，不修改宿主 DOM。
- 1.0.0 → 1.1.0 安装助手仍默认拒绝覆盖；升级必须先手动备份并移出旧目录。

## 6. 开发环境与凭据

开发命令从开发根或绝对路径运行：

```text
node scripts/tasks.mjs test
node scripts/tasks.mjs browser
node scripts/tasks.mjs upstream-test
node scripts/tasks.mjs verify
node scripts/tasks.mjs package
node scripts/tasks.mjs release-test
```

- `upstream/` 被 Git 忽略；新机器 clone 后需先获得指定上游源码快照（`https://github.com/aureth-labs/dsh-aurabot-qq.git`，commit `1057a861e4e96aa2fe050000d238280a7901b9dc`）。本机现成副本在 `E:\System_TEMP\companion-voice\dsh-aurabot-qq`，只读。
- `scripts/browser-smoke.mjs` 使用 `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`；换机器需调整。
- `scripts/verify.mjs` 硬编码原研究目录及 ffprobe/ffmpeg 路径；缺本地产物不代表业务失败。
- Key 只在本机 `.private/breeze.local.json`；**不要输出、复制进文档/Git 或整项目上传**。本轮无需真实 API 测试。
- `scripts/live.mjs` 账本限 4 次/200 字符；已用 2 次/25 字符，不要删除账本绕预算。
- 已授权私有 SSH 提交推送；不代表可以向其他服务上传源码、公开音频、修改生产部署或自点权限按钮。

## 7. 第二阶段（明确未做）

Breeze 每句动态 instructions、上下文提示词、Modal/自定义引擎、角色×情绪路由。仅保留兼容结构，不实现未确认协议。
