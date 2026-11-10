# BreezeBlue 用户语音模块开发记录

> 2026-11-11：用户要求因额度不足暂停1.1.0实现，保存当前WIP。**请从 `docs/HANDOVER.md` 接续**，分支 `handoff/voice-plus-1.1-wip`。1.0.0基线 `889d522` 已推送并由用户在目标QQ验证；1.1.0后端测试116项通过发生在新面板重写之前，新面板尚未验证。以下为早期工作记录，不是当前WIP完成证明。

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
