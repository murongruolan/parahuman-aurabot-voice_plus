# 开发进度 / 断线接续点

更新：2026-11-11。**按用户最新要求暂停开发，保存 WIP 并交接；不要安装当前1.1.0草稿。**

## 下一位先读

**[HANDOVER.md](HANDOVER.md)**：当前文件改动、最后测试的准确边界、剩余任务顺序、打包缺项、环境依赖和红线。

仓库：`git@github.com:murongruolan/parahuman-aurabot-voice_plus.git`（私有、SSH）。

- 已验证1.0.0基线：`889d522`，远端 `work/voice-plus-console`。
- 本次WIP检查点：`handoff/voice-plus-1.1-wip` 分支；基线分支保持不动。
- 本机开发目录：`D:\.claude_work\aurabot-breezeblue-voice`。

## 状态分层

| 部分 | 状态 |
|---|---|
| 1.0.0 Breeze/QQ链路 | 用户在目标机器确认可用 |
| 1.0.0回归 | 上游1220通过/3跳过；扩展106通过；发行检查2通过 |
| 1.1.0三态后端和配置保存 | 已实现；新页面重写前全套116通过/0失败 |
| 1.1.0独立面板 | 草稿已写，**尚未编译/测试/浏览器验证** |
| 新页面对应测试 | 旧panel测试和browser驱动尚未适配 |
| 1.1.0发行/升级文档 | 未完成；脚本和多数版本仍固定1.0.0 |
| 1.1.0目标机器安装 | 未进行，不可宣称已完成 |

最后一次绿色日志 `artifacts/module-test.log` **先于最新panel重写**，不能证明当前整树已通过。此次按用户要求只保存状态，不继续实施。

## 已写改动

- `modules/breeze-settings/control.mjs`：三态、实际状态、配置字段白名单、revision、脱敏。
- `modules/breeze-settings/access.mjs`：独立控制台访问保护。
- `modules/breeze-settings/index.mjs`：独立导航页、密码字段登记、console/status/save/mode/test。
- `modules/breeze-settings/panel.js`：新两栏控制台草稿，尚未验证。
- `test/control.test.mjs` 与 `test/loader.test.mjs`：后端/状态回归。

## 下一步（详细说明在HANDOVER）

1. 编译panel函数体；适配旧panel测试与未修改宿主客户端的browser驱动。
2. 验证关闭→官方→增强切换、保存/未保存状态、密码保留、引擎tab、试听和实际运行一致性。
3. 检查宿主内部导航时的草稿保护、浅深色/窄屏；不要为此修改宿主DOM。
4. 统一1.1.0版本及打包白名单（新增access/control）；更新目标机升级步骤，保留1.0.0。
5. 新回归、成品安装检查后才交付；每阶段提交推送。

## 不变约束

- 不改宿主源码、不做DOM注入；保留官方用户模块机制。
- `voice`为合成入口；`breeze-settings`为独立页面且沿用1.0.0配置ID。
- 增强/官方/关闭互斥；官方加载失败回退机制仍保留，显示实际状态。
- 不安装开发电脑DSH、不改其配置；测试仅用隔离fixture。
- 不清除用户Key/Voice ID/原引擎设置；不提交.private、音频、运行产物。
- 第二阶段动态提示词、Modal、自定义引擎和情绪路由只记录，不提前实现。
- 剩余额度有限，不新增agent、不重复付费API调用。下一位按明确接续点继续即可。
