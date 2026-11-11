# BreezeBlue 用户语音模块开发记录

> 2026-11-11 续接完成并已交付：1.1.0 独立「增强语音」控制台、三态切换、配置保存与试听通过 121 项扩展回归和真实 Edge + 未修改宿主客户端验证；目标机器已安装 1.1.0，用户确认 QQ 语音与控制台试听正常。1.0.0 保留作回滚。以下保留 1.0.0 与 WIP 阶段历史。

目标：基于 dsh-aurabot-qq 内置 voice 模块复制扩展，添加 BreezeBlue 远程 TTS；不修改缓存中的上游源码；交付可安装包、中文使用说明、回归与真实 API 验证。

开发根目录：`D:\.claude_work\aurabot-breezeblue-voice`。
上游快照：`upstream`，250 个 Git 跟踪文件，来源 `1057a861e4e96aa2fe050000d238280a7901b9dc`（插件 1.2.0）。
文档：用户 Downloads 下 breezeblue1.md、breezeblue2.md；补充音色列表官方文档在 research/downloads 的独立目录。

设计：同名 `voice` 用户模块，保留内置接口；模块设置独立选 provider=builtin/breezeblue，默认 builtin；不改核心 voice.engine 的枚举；保持本地 tts 优先级；Breeze 成功沿用 RVC 后处理，失败可按设置回退原引擎；保留全部 ASR/安装/试听入口。新增独立设置表单、音色列表和直接 Breeze 试听，不插入情绪提示词、不修改消息解析。

认证：xi-api-key；固定官方 https://api.breeze.blue/v1；POST text-to-speech/{voice_id}?output_format=...&delivery=sync；不自动重试付费合成；验证长度/参数、限制响应大小、拒绝非音频/重定向；不输出或打包密钥。

任务入口：`node scripts/tasks.mjs ...`。测试/缓存均隔离到 artifacts，不能污染用户 DSH 配置。

已完成：
- 已读用户接口文档、官方模块 API、内置 voice/index.js、tts.js、rvc.js。
- 原上游 git status 干净；只复制了只读开发快照。
- 上游完整基线：1223 tests，1220 pass，0 fail，3 skipped；artifacts/upstream-test.log。
- 项目级工具授权已补有限目录读写/固定任务入口/官方域名，没有关闭权限检查。

进行中：实现、离线/loader/面板回归、少量 live 合成与媒体验证、打包/安装指引。

边界：目标为另一台机器的 DSH。用户明确：本机 DSH 只可参考结构与实验，不可安装扩展；不写本机 DSH 的 modules/config。所有实验必须在 artifacts 的独立数据根运行。交付便携目录/ZIP及目标机器安装说明，不覆盖已有用户 voice 模块。不承诺真实 QQ 已发出，直到在目标宿主中实际验证。用户允许限额 300 内 API 调用；当前两次成功合成，共25字符，WAV+MP3。认证与音色列表也通过；密钥仅保存在开发根 .private 内，不得入包、日志或文档。

进展补充：官方 fork 已生成 index.mjs/tts.js/rvc.js；tts.js 与 rvc.js 保持字节一致。新增81项测试全通过（之前失败因测试把 song.status 写为 async，已修正替身）；音色 voc_xrszxupbkdfa（玉玲珑）成功 WAV 5.377s/MP3 4.940s。待最后媒体解码校验、浏览器交互、安装包与说明、最终回归。

## 1.1.0 续接完成（2026-11-11）

- 新 `modules/breeze-settings/panel.js` 已按宿主 `new Function` 契约编译，并在真实 Edge + 未修改 `upstream/client/client.js` 中通过独立导航页加载。
- 后端 `control.mjs`（三态/白名单/revision/脱敏）、`access.mjs`（回环+Host+Origin+方法）、`index.mjs`（独立页 + `/console/status|save|mode|test`）完成。
- 测试：扩展回归 121 通过 / 0 失败；浏览器浅色、深色、700px 窄屏、官方、关闭、错误截图均已实际查看；无 pageerror。
- 发行脚本：1.1.0 新目录名，不覆盖 1.0.0；`breeze-settings` 白名单加入 `access.mjs`、`control.mjs`；发行检查覆盖三态 API 与成品试听。
- 文档：使用说明、测试报告、模块 README、版本字段统一到 1.1.0；升级步骤要求先备份并移出 1.0.0 两个目录。
- 保留：新的付费 Breeze 调用未发生（仍为 1.0.0 阶段的 2 次/25 字符）。1.1.0 目标机器安装与 QQ 验收已于当日由用户完成。

## 1.1.1 续接（2026-11-11）

- 目标机器 1.1.0 验收通过；目标机日志确认 10:27:37 一次 `BreezeBlue 失败：无法连接 Breeze 官方 API…`（NETWORK_ERROR，非超时、未计费）触发聊天静默回退，听感像"配置失效"。
- 按用户选择实现「控制台展示最近回退」：voice 模块在回退时记录 `lastFallback = { at, reason }`（脱敏、截断 120 字），`/breeze/status` 返回；面板每 5 秒轮询与手动刷新时在增强模式读取，侧栏以 warn 注展示时间+原因；官方/关闭不请求该路由。
- 回归 124 项通过；浏览器验证无回归。

## 1.1.2 续接（2026-11-11）

- 用户建议：为瞬时网络波动加自动重试（高级设置可改，默认 2 次/1 秒），并要求日志写清错误原因。
- 实现：`speak` 路径新增 `speakBreeze`——仅 `NETWORK_ERROR`（无任何 HTTP 响应的连接级失败）按 `retryCount`（整数 0–5，默认 2）与 `retryDelaySeconds`（0–10，默认 1）重试；HTTP 状态/超时/ABORTED 不重试；直连 `/breeze/test` 保持不重试。NETWORK_ERROR 文案带安全化 Node 错误码（如 `ECONNRESET`），重试每步记日志 `重试 1/2…`。
- 配置侧：settings DEFAULTS、白名单校验（整数/范围）、面板高级设置两个字段、浏览器验证保存。
- 回归 130 项通过；浏览器验证通过（429 不重试由请求计数证明）。

## 1.2.0 续接（2026-11-11，第二阶段第一项）

- 用户报告：语音文本常无标点、只用空格分句（"你好 吃了吗 干什么呢"），Breeze 直读无句读。先勘察：模型自己没写标点（宿主提示词只教放 `<voice>`，personas.js:103）；reply.js stripMarkdown 与 faces.js:77 tidySpeech 只去标签/合并空格，不删标点；本模块 speak 原样透传。
- 用户决定：版本 1.2.0，方案**仅提示词侧**。实现：`api.rule` 注册规则"`<voice>` 内句子用中文标点（，。！？）分隔，不要只靠空格"，对 private/social 两种规则都生效；不修改宿主源码、不动合成文本。
- 合成侧自动补标点（仅当整句无任何标点且含空格分句时按 吗/呢/吧→？其余→。 补）已评估，作为模型不遵守时的备用方案，未启用。
- 回归 131 项通过。
