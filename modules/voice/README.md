# 语音 · BreezeBlue 用户扩展

本目录来自 Aurabot 1.2.0 内置 `voice` 的官方复制机制；新增 BreezeBlue 远程 TTS，保留旧引擎、本地 TTS 优先、RVC 和 ASR。

**请将 `voice` 与发行包中的 `breeze-settings` 两个目录一起放到目标机器的 Aurabot 用户 modules 目录，不是 `src/modules`。已有同名模块不要直接覆盖。**

宿主 1.2.0 隐藏同名内置替换版的自定义设置，所以配对的 `breeze-settings` 负责提供独立的「增强语音」控制台；它不注册聊天钩子，也不改提示词或聊天逻辑。

安装后：
1. 「已安装」中 voice 选择用户版本，breeze-settings 启用。
2. 打开独立导航页「增强语音」，选择「增强语音」；在「远程 Breeze」填写 Key、Voice ID，保存。
3. 在目标机器本地/远程桌面内打开 localhost 面板试听。音色参考 `voc_xrszxupbkdfa`（玉玲珑），Key 不在包里。

默认提供方仍是原引擎，避免仅安装就计费。两个模块不需要 npm install、Python 或 GPU；Node >=22.13.0。

## 保留与新增

- `tts.js`、`rvc.js` 与官方 fork 产物字节一致；原 TTS 引擎/ASR/变声逻辑保留。
- Breeze 的参数、WAV/MP3、音色查询、错误脱敏、超时和不自动重试在 `breezeblue.mjs`。
- Breeze 失败默认回退原引擎，可关闭；页面试听走实际配置的合成路径并显示真实返回引擎。
- 新增控制台、查询/试听和原试听接口有本机访问保护，不支持公网反代试听；QQ 内部 speak 调用不受限。
- 不改提示词，不解析新的情绪标签，不覆盖原来的其他语音扩展。

配置在 `config.ext["breeze-settings"]`，旧配置在 `config.voice`。Key 按密码字段脱敏，但磁盘配置不是加密保险库。发布包不含 Key。

恢复：在「增强语音」页选择「官方语音」，或「已安装」选择用内置的。选择「关闭语音」是停用，不是恢复官方版。

详细安装、参数、限制和验证范围见发行包根《使用说明.md》《测试报告.md》。
