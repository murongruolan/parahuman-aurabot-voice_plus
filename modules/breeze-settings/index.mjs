import { DEFAULTS, SETTINGS } from './settings.mjs'

// Separate ID is intentional: Aurabot 1.2.0 does not render settings/panels for builtin replacements.
// This module registers no chat hooks, commands, TTS pipeline or paid API calls.
export default {
  id: 'breeze-settings',
  name: 'BreezeBlue 语音设置',
  version: '1.0.0',
  api: 1,
  description: '为配套的用户 voice 模块提供 Breeze 配置、音色选择和直连试听；不修改其他设置。',
  tab: 'voice',
  defaults: DEFAULTS,
  settings: SETTINGS,
  panel: 'panel.js',
  setup() { return {} },
}
