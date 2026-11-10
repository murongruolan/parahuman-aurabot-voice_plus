# ParaHuman · Aurabot Voice Plus

基于 Aurabot 官方 `voice` 复制机制的用户语音增强模块。**不修改宿主源码，不在开发电脑 DSH 安装。**

## 当前状态

- **1.0.0 基线**：Breeze API/目标机器 QQ 发语音已由用户确认可用。
- **1.1.0 进行中**：独立「增强语音」控制台，增强 / 官方 / 关闭三态互斥，按引擎切换配置。
- 第二阶段（动态表演指令、Modal/自定义推理、情绪路由）仅记录，未开始。

最新接续点见 [开发进度](docs/PROGRESS.md)；约束与路线见 [开发设计](docs/DESIGN.md)。

## 目录

- `modules/voice`：官方同名替换入口；保留内置 TTS/RVC/ASR 能力。
- `modules/breeze-settings`：独立控制台，沿用 ID 以兼容 1.0.0 已保存配置。
- `test`：离线契约、实际 loader、面板、访问保护和安装测试。
- `scripts`：开发、测试、打包工具。
- `upstream`：本机只读上游测试快照（忽略，不上传）。基准 `aureth-labs/dsh-aurabot-qq@1057a861e4e96aa2fe050000d238280a7901b9dc`。
- `dist` / `artifacts` / `.private`：分别为本地发行包、验证产物、私密测试配置，**不上传**。

运行：`node scripts/tasks.mjs test`。完整复现说明见 [开发说明](开发说明.md)。

## 安全与发布

真实 API Key、私密配置、音频、运行缓存不进入 Git；真实接口测试为人工选择，不在普通回归中计费。原宿主更新可能影响内部 lib，按明确版本验收。两份模块必须配套使用；生产安装由用户在目标机器进行。

仓库：`git@github.com:murongruolan/parahuman-aurabot-voice_plus.git`（私有，SSH 推送）。
