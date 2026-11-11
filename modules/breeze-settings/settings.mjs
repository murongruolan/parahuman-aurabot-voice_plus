// Settings live in cfg.ext['breeze-settings']; core cfg.voice is untouched.
const FORMATS = ['wav', 'wav_24000', 'mp3', 'mp3_24000_64', 'mp3_24000_96', 'mp3_24000_128', 'mp3_24000_160']
export const DEFAULTS = Object.freeze({
  provider: 'builtin', apiKey: '', voiceId: '', modelId: 'breeze-tts-2',
  languageCode: '', instructions: '', guidanceScale: 1, speed: 1, volume: 1,
  speakerBoost: false, outputFormat: 'wav', timeoutSeconds: 300, fallback: true,
  retryCount: 2, retryDelaySeconds: 1,
})
export const SETTINGS = [
  { key: 'provider', label: '语音提供方', type: 'select', options: [
    { value: 'builtin', label: '原有语音引擎（保持原行为）' },
    { value: 'breezeblue', label: 'BreezeBlue 远程 API' },
  ], hint: '只影响语音合成；本地接口若启用仍优先。Breeze 失败可回退上方原有引擎。' },
  { key: 'apiKey', label: 'Breeze API Key', type: 'password', placeholder: 'brz_…', hint: '保存后不回显；仅向 api.breeze.blue 发送。不要填入普通请求头或日志。' },
  { key: 'voiceId', label: 'Voice ID', type: 'text', placeholder: 'voc_…', hint: '可在下方获取音色列表，选好后点底部「保存设置」。' },
  { key: 'modelId', label: '模型 ID', type: 'text', placeholder: 'breeze-tts-2', hint: '默认 breeze-tts-2；留空让平台自动选择。' },
  { key: 'languageCode', label: '语言代码', type: 'text', placeholder: '留空自动识别，或 zh / en', hint: '两位 ISO 639-1 代码。' },
  { key: 'instructions', label: '表演指令', type: 'textarea', placeholder: '自然、温柔地说话，像在和朋友聊天。', hint: '与要念的文字使用相同语言；支持平台的 [笑]、[叹气] 等正文标签。本扩展不修改聊天提示词。' },
  { key: 'guidanceScale', label: '指令引导强度', type: 'number', min: 1, max: 10, step: 0.1, hint: '默认 1；值越高越偏向指令，先小幅调整。' },
  { key: 'speed', label: '语速倍率', type: 'number', min: 0.5, max: 2, step: 0.05, hint: '默认 1，0.5–2；不使用原引擎的 rate / pitch 字段。' },
  { key: 'volume', label: '音量倍率', type: 'number', min: 0.01, max: 2, step: 0.05, hint: '默认 1，超过 1 可能削波。' },
  { key: 'speakerBoost', label: '增强参考音色相似度', type: 'switch', hint: '指令非空且引导强度 >1 时平台忽略此项；否则启用时引导强度按 1 处理。' },
  { key: 'outputFormat', label: '输出格式', type: 'select', options: FORMATS, hint: '推荐 WAV；支持 MP3。只接收真实音频，不把 JSON 错误当 PCM。' },
  { key: 'timeoutSeconds', label: '请求超时（秒）', type: 'number', min: 10, max: 600, step: 10, hint: '默认 300，包含排队；超时不自动重复提交付费请求。' },
  { key: 'fallback', label: 'Breeze 失败时回退原语音引擎', type: 'switch', hint: '默认开。关闭后让宿主按原逻辑处理语音失败；下方直连试听始终不会回退掩盖问题。' },
]
