# 交接入口：Voice Plus 1.1.0 未完成

更新：2026-11-11。**用户因剩余额度不足，明确要求暂停功能开发，先记录状态、补文档、提交推送。不要把此检查点当作已交付版本。**

## 1. 从哪里接

- 私有仓库：`git@github.com:murongruolan/parahuman-aurabot-voice_plus.git`（已验证私有，通过 SSH 推送）。
- 当前交接分支：`handoff/voice-plus-1.1-wip`。
- 可用基线：提交 **`889d522`**；远端 `work/voice-plus-console` 保留这份基线。这个分支是空仓第一次推送后 GitHub 自动指定的默认分支，所以 WIP 另建分支，不污染基线。
- 本机开发目录：`D:\.claude_work\aurabot-breezeblue-voice`。
- 已交付 1.0.0 ZIP：`dist\aurabot-breezeblue-voice-1.0.0.zip`（本地文件，被 Git 忽略）。
- **用户已在另一台 DSH 机器安装 1.0.0，并确认可以收到 QQ 语音。** 本机 DSH 不是安装目标。

先读本文件 → `docs/PROGRESS.md` → `docs/DESIGN.md`，再看下面列出的改动。`WORKLOG.md`、根目录的使用说明/测试报告大部分是 1.0.0 历史，不要当作当前 WIP 的验收记录。

## 2. 用户确认的目标与红线

第一阶段：在不修改宿主源码的前提下，做官方 voice 的增强版与**独立、紧凑、美观的控制台**。三种状态互斥：

| 界面选择 | modules.voice.enabled | modules.voice.useBuiltin | voice.enabled |
|---|---|---|---|
| 增强语音 | true | false | true |
| 官方语音 | true | true | true |
| 关闭语音 | false | 保留 | false |

宿主固定调用 `use('voice').speak()`，必须保留 `voice` 同名替换入口，不能随便改为新ID。官方加载失败自动回退内置的机制必须保留；页面显示期望与实际状态，不能假报增强已生效。

配套页面继续使用 `breeze-settings` ID，保留 `ext['breeze-settings']` 中已保存的 Key、Voice ID 等。显示名改为“增强语音”、删除 `tab:'voice'`，宿主就会生成独立导航页。它不依赖 voice 始终开启：即使语音关闭，控制台仍须可用。

- **不改/安装本机 DSH，不改原缓存里的上游源码，不改其他负责人的插件或 Modal。** 测试全部使用 artifacts 内独立数据根。
- 不做 DOM 注入，不修改宿主引擎枚举。独立页面可自行设计引擎 tabs。
- 保留已跑通的 Breeze、原引擎、本地 TTS 优先、RVC、ASR；不要重写这些已有功能。
- 第二阶段只有路线：动态表演指令/提示词、Modal及自定义推理、情绪路由。**本轮不实施。**
- 用户授权阶段性 commit/push 到指定私有仓库；不公开发布、不创建公开 PR。提交结尾按约定加 `Co-Authored-By: Claude Code <noreply@anthropic.com>`。
- 用户希望省额度：不要再启动额外 agent，不要无必要重做研究或重复付费合成。

## 3. 已完成和最后一次测试的准确边界

### 1.0.0 已验证基线

- 原上游完整回归：1220 pass / 0 fail / 3 skipped（共1223）。
- 扩展回归：106 pass；发行安装/加载2项 pass。
- 真实 Breeze：用户指定音色 `voc_xrszxupbkdfa`（玉玲珑），WAV/MP3各一次，合计25字符。可解码且用户已确认目标 QQ 链路能用。
- 未修改的上游 `client/client.js` + 真 React + 真实 loader，在隔离 Edge 中交互通过。

### 1.1.0 后端已写并测试

以下改动在**重写新 panel 之前**执行 `node scripts/tasks.mjs test`，结果 **116 pass / 0 fail / 0 skipped**。日志仍在 `artifacts/module-test.log`。

- `modules/breeze-settings/control.mjs`（新增）：三态映射；读取实际/期望运行态；白名单字段保存；配置 revision 防覆盖；隐藏 Key/HTTP headers；保留不相关配置。
- `modules/breeze-settings/access.mjs`（新增）：本机 socket、Host、Origin、方法和反代头保护。
- `modules/breeze-settings/index.mjs`（修改）：独立页、版本1.1.0、不再生成自动表单；通过 `api.lib('core/config.js').registerSecretField` 保留密码脱敏；以下路由在 voice 为官方或关闭时仍存活：
  - `GET /aurabot/api/ext/breeze-settings/console/status`
  - `POST .../console/save`：`{revision, settings:增量, original:增量}`
  - `POST .../console/mode`：`{revision, mode:'enhanced'|'official'|'off'}`
  - `POST .../console/test`：`{revision, text}`，当前实际运行的 voice.speak；最多200字符，关语音时拒绝；不自动重试。
- `test/control.test.mjs`（新增）：参数、模式、脱敏、revision、访问保护。
- `test/loader.test.mjs`（修改）：独立 tab、模式循环/关闭重开、配置保留、防旧revision覆盖和实际试听。

### 最后一笔代码：新页面草稿，**未验证**

`modules/breeze-settings/panel.js` **刚刚全量重写后，用户要求暂停**。此后没有语法检查、单测或浏览器回归；不能套用之前116项通过的结果！

草稿内容：独立标题/实际状态；增强/官方/关闭互斥选择；远程Breeze/原有引擎 tabs；两栏基本配置+就近试听；音色搜索；高级设置折叠；原引擎参数；自有保存/撤销/revision；局部作用域CSS与窄屏断点。

`panel` 是宿主 `new Function('React','h','ui','call',source)` 执行的函数体，不是普通可导入ESM。新页面使用 `/console/*`，音色查询仍使用旧 `/breeze/voices`（该路由归用户voice所有，仅增强模式可用）。

## 4. 下一位应按这个顺序做（不额外扩大范围）

1. **先检查新 panel 的语法。** 只用宿主同样的 new Function 编译方式；不要将 `node --check panel.js` 的顶层 return 误报当真正宿主语法错误。
2. **更新 `test/panel.test.mjs`。** 当前仍是旧1.0.0界面的5个测试，假设根节点 Card、旧按钮和 props草稿协议。需适配新页面初始化、interval/window清理、本地增量、三态禁用、保存与试听不自动计费。不要为绿灯直接删测试。
3. **更新 `scripts/browser-smoke.mjs`。** 仍定位旧“语音”tab和自动表单。用未修改上游客户端选择独立 `ext:breeze-settings`，验证实际导航、保存、三态切换（包括关闭后重开）、官方/增强只跑其一、tab条件显示、音色选择、播放、错误显示。固定模拟provider，不发新付费调用。
4. 核实新UI边界：当前模式与未保存provider是否一致；Breeze查询使用已保存密钥；官方/关闭时不能误报/误发；缺voice、safeMode/加载失败提示；本地TTS/RVC优先级；密码空值保留；失败后不清草稿。
5. 检查自绘页面脏状态：草稿存在组件本地，beforeunload只能管页面离开，宿主内部tab切换是否应与其draft机制衔接需验证。目前**没有宣称已支持宿主tab离开保护**。不要因此擅自修改宿主DOM。
6. 跑扩展回归和浏览器浅/深色、窄屏，真正查看截图。原上游源码没有改，可沿用基线记录；如有必要再跑一次原测试。
7. **完善打包/版本/文档再发布**：见下一节。保留1.0.0可用包，不能覆盖正在使用的版本。
8. 每个已验证里程碑提交并SSH推送；标注真实测试结果。用户尚未收到1.1.0，不要称升级完成。

## 5. 仍需改的工程事项

- `scripts/package.mjs` 仍固定1.0.0和旧文件白名单；尚未包含设置模块的 `access.mjs` / `control.mjs`。**现在运行会拒绝旧版本已存在，或漏文件；不要直接发行。**
- `scripts/install.mjs` 的 manifest机制可安装两个模块，但默认拒绝覆盖已有voice/breeze-settings；1.0.0 → 1.1.0 的升级/备份步骤要明确，不要覆盖用户另做的功能。
- `test/release.check.mjs` 仍写死1.0.0路径。
- 根 package.json/package-lock、两个 module.json/package.json、voice版本和使用/测试说明尚未统一更新到1.1.0；仅新控制台 index 标了1.1.0。
- `modules/breeze-settings/settings.mjs` 仍导出旧 SETTINGS 表单元数据；新index仅用DEFAULTS。可保留或后续清理，但不必为此额外重构。
- 新 `access.mjs` 与voice目录有平行校验，打包必须包含各自文件；不要写跨模块相对import（宿主快照路径不同）。
- `consoleState` 中用户模块存在字段是 **`hasUser`**，不是 `user`；已修正。
- 宿主对未变化的关闭模块可能sync不重启，模式API已在必要时 `reload('voice')`；要保留相关回归。
- 原 `/breeze/test` 仍为直连不回退测试，新 `/console/test` 是实际语音路径，可能本地接管或回退；页面显示真实返回的engine，文档要区分。

## 6. 本机文件、复现与凭据

开发命令从开发根或绝对路径运行：

```text
node scripts/tasks.mjs test
node scripts/tasks.mjs browser
node scripts/tasks.mjs upstream-test
node scripts/tasks.mjs verify
```

- `upstream/` 被Git忽略；在新机器clone此私有仓库后需先获得指定上游源码快照。官方上游 `https://github.com/aureth-labs/dsh-aurabot-qq.git`，commit `1057a861e4e96aa2fe050000d238280a7901b9dc`。本机现成原研究副本在 `E:\System_TEMP\companion-voice\dsh-aurabot-qq`，只读。
- Node测试无需外部SDK；浏览器开发依赖记录在package-lock，可在**开发项目**运行npm ci，不要给用户DSH装包。
- `scripts/browser-smoke.mjs` 使用 `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`；换机器需调整测试路径。
- `scripts/verify.mjs` 当前硬编码原研究目录及 `F:/FFMpeg/bin/ffprobe.exe` / ffmpeg。需已有 `artifacts/official-fork` 和实际音频账本；新agent勿把缺这些本地产物当业务失败。
- 用户文档：`C:\Users\18231\Downloads\breezeblue1.md`、`breezeblue2.md`；补充文档在 `research/downloads/`（忽略）。Breeze base `https://api.breeze.blue/v1`，鉴权 `xi-api-key`。
- Key只在本机 `.private/breeze.local.json`；**不要输出、复制进文档/Git或整项目上传**。本轮无需真实API测试；外部接替agent若需要凭据应由用户安全提供。
- `scripts/live.mjs` 的账本限4次/200字符；已用2次/25字符，不要删除账本绕预算。
- 已授权私有SSH提交推送，不代表可以向其他服务上传源码、公开音频、修改生产部署或自点权限按钮。

## 7. 验收与交接状态

本次交接只完成状态保存与Git检查点。**1.1.0未完成，新页面未验证，不可用于替换目标机的1.0.0。**

继续前可用 `git status` 和 `git log -2` 确认恢复点；旧可用代码见 `889d522`。新的测试日志只代表其执行时的代码，务必对照上文“页面重写在测试之后”的时间顺序。
