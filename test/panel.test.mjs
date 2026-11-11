import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../modules/breeze-settings/panel.js', import.meta.url), 'utf8')
const flush = async () => { for (let i = 0; i < 4; i += 1) await Promise.resolve() }
const DEFAULT_ROUTING = { calm: 'breezeblue', playful: 'breezeblue', down: 'breezeblue', angry: 'breezeblue', excited: 'breezeblue', proud: 'breezeblue', whiny: 'breezeblue', lazy: 'breezeblue' }

const snapshot = (over = {}) => ({
  ok: true, revision: 'rev-1', requestedMode: 'enhanced', actualMode: 'enhanced', running: 'user',
  fallback: false, safeMode: false, moduleError: '', enhancedAvailable: true,
  settings: { provider: 'breezeblue', apiKey: '', apiKeySet: true, voiceId: 'voc_saved', speed: 1, volume: 1,
    modelId: 'm1', languageCode: '', instructions: '', guidanceScale: 1, outputFormat: 'wav', timeoutSeconds: 60,
    speakerBoost: false, fallback: true, retryCount: 2, retryDelaySeconds: 1,
    emotion: { routing: { ...DEFAULT_ROUTING }, endpoints: [], templates: [] } },
  original: { engine: 'auto', voice: 'zh-CN-XiaoyiNeural', rate: '+0%', pitch: '+0Hz',
    http: { headers: '', headersSet: false, method: 'GET', urlTemplate: '', body: '' },
    cosyvoice: { url: '', mode: 'sft', spkId: '', instruct: '', sampleRate: 24000 },
    gptsovits: { url: '', refAudio: '', promptText: '' } },
  localTtsActive: false, rvcVoice: '',
  ...over,
})

function mount(call) {
  const state = [], refs = [], effects = [], cleanups = [], toasts = [], reloads = [], listeners = new Map()
  const timers = new Map()
  let pos = 0, refPos = 0, initial = true, timerId = 0
  const React = {
    useState(value) { const n = pos++; if (!(n in state)) state[n] = value; return [state[n], next => { state[n] = typeof next === 'function' ? next(state[n]) : next }] },
    useRef(value) { const n = refPos++; if (!(n in refs)) refs[n] = { current: value }; return refs[n] },
    useEffect(work) { if (initial) effects.push(work) },
  }
  const h = (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity).filter(x => x !== null && x !== false && x !== undefined) })
  const saved = { window: globalThis.window, setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval }
  globalThis.window = {
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name),
  }
  globalThis.setInterval = fn => { const id = ++timerId; timers.set(id, fn); return id }
  globalThis.clearInterval = id => timers.delete(id)
  const C = new Function('React', 'h', 'ui', 'call', source)(React, h, { Card: 'Card', Btn: 'Btn' }, call)
  const props = { toast: x => toasts.push(x), reload: () => reloads.push(true) }
  const render = () => { pos = 0; refPos = 0; const tree = C(props); initial = false; while (effects.length) cleanups.push(effects.shift()() || null); return tree }
  const walk = tree => [tree, ...(tree && typeof tree === 'object' ? tree.children.flatMap(walk) : [])]
  const find = predicate => walk(render()).find(x => x && typeof x === 'object' && predicate(x))
  const all = predicate => walk(render()).filter(x => x && typeof x === 'object' && predicate(x))
  const cleanup = () => { while (cleanups.length) cleanups.pop()?.() }
  const restore = () => { Object.assign(globalThis, saved) }
  return { render, find, all, effects, toasts, reloads, listeners, timers, cleanup, restore, state }
}

const byText = (m, tag, text) => m.find(x => x.type === tag && x.children.includes(text))
const field = (m, label) => m.find(x => x.props['aria-label'] === label)
const modeButton = (m, title) => m.find(x => x.props.role === 'radio' && x.children.some(c => c?.children?.includes(title)))

async function mounted(over = {}) {
  const calls = []
  const m = mount(async (path, body) => {
    calls.push({ path, body })
    if (path === '/console/status') return snapshot(over)
    if (path === '/console/mode') return snapshot({ ...over, requestedMode: body.mode, actualMode: body.mode })
    return { ok: true }
  })
  m.render()
  await flush()
  m.render()
  return { m, calls }
}

test('panel compiles and mounts with actual mode, no paid or speak call, remount cleanup', async () => {
  const { m, calls } = await mounted()
  assert.equal(m.render().type, 'div')
  assert.equal(m.find(x => x.type === 'h2').children[0], '让每句话，有自己的声音')
  assert.equal(m.find(x => x.props.role === 'status').children[0], '当前：增强语音')
  assert.deepEqual(calls.map(c => c.path), ['/console/status', '/breeze/status'])
  assert.ok(m.timers.size === 1)
  assert.ok(m.listeners.has('beforeunload'))
  const timer = [...m.timers.values()][0]
  timer()
  await flush()
  assert.deepEqual(calls.map(c => c.path), ['/console/status', '/breeze/status', '/console/status', '/breeze/status'])
  m.cleanup()
  assert.equal(m.timers.size, 0)
  assert.equal(m.listeners.has('beforeunload'), false)
  m.restore()
})

test('three-state selection is exclusive; dirty edits block mode switch and preview', async () => {
  const { m, calls } = await mounted()
  await modeButton(m, '官方语音').props.onClick()
  await flush()
  assert.deepEqual(calls.find(c => c.path === '/console/mode').body, { revision: 'rev-1', mode: 'official' })
  assert.ok(m.toasts.includes('已切换为官方语音'))
  assert.ok(m.reloads.length > 0)

  field(m, '原有语音引擎').props.onChange({ target: { value: 'windows' } })
  const buttons = m.all(x => x.props.role === 'radio')
  assert.equal(buttons.length, 3)
  assert.ok(buttons.every(x => x.props.disabled === true))
  assert.equal(byText(m, 'button', '生成试听').props.disabled, true)
  const modeCalls = calls.filter(c => c.path === '/console/mode').length
  await modeButton(m, '增强语音').props.onClick()
  await flush()
  assert.equal(calls.filter(c => c.path === '/console/mode').length, modeCalls)
  assert.match(m.find(x => x.props.role === 'alert').children[0], /请先保存/)
  m.restore()
})

test('enhanced mode disabled without user voice module; off state blocks preview', async () => {
  const missing = await mounted({ enhancedAvailable: false })
  assert.equal(modeButton(missing.m, '增强语音').props.disabled, true)
  missing.m.restore()
  const off = await mounted({ requestedMode: 'off', actualMode: 'off' })
  assert.equal(modeButton(off.m, '关闭语音').props['aria-checked'], true)
  assert.equal(byText(off.m, 'button', '生成试听').props.disabled, true)
  off.m.restore()
})

test('local edits stay local, blank key is not dirty, save sends revision and clears draft', async () => {
  const saved = snapshot({ revision: 'rev-2', settings: { ...snapshot().settings, speed: 0.8 } })
  const calls = []
  const m = mount(async (path, body) => {
    calls.push({ path, body })
    if (path === '/console/status') return snapshot()
    if (path === '/console/save') return saved
    return { ok: true }
  })
  m.render(); await flush(); m.render()
  field(m, 'Breeze API Key').props.onChange({ target: { value: '' } })
  assert.equal(byText(m, 'button', '保存配置').props.disabled, true)
  field(m, '语速倍率').props.onChange({ target: { value: '0.8' } })
  assert.match(m.find(x => x.props['aria-live'] === 'polite').children[0], /未保存/)
  assert.equal(byText(m, 'button', '保存配置').props.disabled, false)
  await byText(m, 'button', '保存配置').props.onClick()
  await flush()
  const save = calls.find(c => c.path === '/console/save')
  assert.equal(save.body.revision, 'rev-1')
  assert.deepEqual(save.body.settings, { speed: 0.8 })
  assert.deepEqual(save.body.original, {})
  assert.equal(m.toasts.at(-1), '语音设置已保存')
  assert.equal(byText(m, 'button', '保存配置').props.disabled, true)
  assert.equal(m.find(x => x.props.role === 'status').children[0], '当前：增强语音')
  m.restore()
})

test('original engine edits save as a partial patch and keep unrelated configuration', async () => {
  const calls = []
  const m = mount(async (path, body) => {
    calls.push({ path, body })
    if (path === '/console/status') return snapshot()
    if (path === '/console/save') return snapshot({ revision: 'rev-2', original: { ...snapshot().original, engine: 'windows' } })
    return { ok: true }
  })
  m.render(); await flush(); m.render()
  await byText(m, 'button', '原有引擎').props.onClick()
  const engineRow = m.all(x => x.props.className === 'vp-info').find(x => x.children[0]?.children?.[0] === '生效引擎')
  assert.equal(engineRow.children[1].children[0], '远程 Breeze', 'side panel shows the saved engine, not the unsaved tab')
  field(m, '原有语音引擎').props.onChange({ target: { value: 'windows' } })
  await byText(m, 'button', '保存配置').props.onClick()
  await flush()
  assert.deepEqual(calls.find(c => c.path === '/console/save').body.original, { engine: 'windows' })
  m.restore()
})

test('voice picker uses saved key, pagination cursors, and is gated by enhanced mode', async () => {
  const calls = []
  let page = 0
  const m = mount(async (path, body) => {
    calls.push({ path, body })
    if (path === '/console/status') return snapshot()
    if (path === '/breeze/voices') {
      page += 1
      return { ok: true, voices: [{ voiceId: 'voc_' + page, name: '音色' + page }], hasMore: page === 1, nextPageToken: 'cursor1', page }
    }
    return { ok: true }
  })
  m.render(); await flush(); m.render()
  await byText(m, 'button', '选择已保存音色').props.onClick()
  await byText(m, 'button', '获取音色列表').props.onClick()
  await flush(); m.render()
  await byText(m, 'button', '加载更多').props.onClick()
  await flush(); m.render()
  const list = calls.filter(c => c.path === '/breeze/voices').map(c => c.body)
  assert.deepEqual(list, [
    { type: 'personal', search: '', page: 1, pageToken: '' },
    { type: 'personal', search: '', page: 2, pageToken: 'cursor1' },
  ])
  const select = field(m, '选择 Breeze 音色')
  const options = select.children.filter(x => x.type === 'option')
  assert.equal(options.length, 4)
  assert.ok(options.some(x => x.props.value === 'voc_saved'))
  assert.ok(options.some(x => x.props.value === 'voc_2'))
  m.restore()

  const gated = await mounted({ settings: { ...snapshot().settings, apiKeySet: false } })
  await byText(gated.m, 'button', '选择已保存音色').props.onClick()
  assert.equal(byText(gated.m, 'button', '获取音色列表').props.disabled, true)
  gated.m.restore()
})

test('preview sends one revision-checked request, renders returned engine, and never auto-bills', async () => {
  let finish
  const gate = new Promise(resolve => { finish = resolve })
  const calls = []
  const m = mount(async (path, body) => {
    calls.push({ path, body })
    if (path === '/console/status') return snapshot()
    if (path === '/console/test') { await gate; return { ok: true, engine: 'breezeblue', mime: 'audio/wav', data: Buffer.from('RIFFxxxx').toString('base64') } }
    return { ok: true }
  })
  m.render(); await flush(); m.render()
  assert.equal(calls.filter(c => c.path === '/console/test').length, 0)
  assert.equal(field(m, '试听文本').props.value, '你好，今天也要照顾好自己。')
  const button = byText(m, 'button', '生成试听')
  const first = button.props.onClick()
  const second = button.props.onClick()
  await flush()
  assert.equal(calls.filter(c => c.path === '/console/test').length, 1)
  assert.deepEqual(calls.find(c => c.path === '/console/test').body, { revision: 'rev-1', text: '你好，今天也要照顾好自己。' })
  finish(); await Promise.all([first, second]); await flush(); m.render()
  assert.equal(m.find(x => x.type === 'audio').props.src.startsWith('blob:'), true)
  const engineHint = m.find(x => x.props.className === 'vp-hint' && typeof x.children[0] === 'string' && x.children[0].startsWith('本次实际引擎'))
  assert.match(engineHint.children[0], /breezeblue/)
  assert.ok(m.toasts.some(x => x.includes('合成成功')))
  m.restore()
})

test('failed preview surfaces the error without clearing the draft text', async () => {
  const m = mount(async (path, body) => {
    if (path === '/console/status') return snapshot()
    if (path === '/console/test') return { ok: false, message: 'service busy' }
    return { ok: true }
  })
  m.render(); await flush(); m.render()
  field(m, '试听文本').props.onChange({ target: { value: '只合成这一次。' } })
  await byText(m, 'button', '生成试听').props.onClick()
  await flush(); m.render()
  assert.equal(m.find(x => x.props.role === 'alert').children[0], 'service busy')
  assert.equal(field(m, '试听文本').props.value, '只合成这一次。')
  m.restore()
})

test('failed save surfaces the conflict and keeps the local draft', async () => {
  const m = mount(async (path, body) => {
    if (path === '/console/status') return snapshot()
    if (path === '/console/save') return { ok: false, message: '配置已在其他页面变更。请刷新后重新编辑，避免覆盖。' }
    return { ok: true }
  })
  m.render(); await flush(); m.render()
  field(m, '语速倍率').props.onChange({ target: { value: '0.7' } })
  await byText(m, 'button', '保存配置').props.onClick()
  await flush(); m.render()
  assert.match(m.find(x => x.props.role === 'alert').children[0], /配置已在其他页面变更/)
  assert.equal(byText(m, 'button', '保存配置').props.disabled, false)
  assert.match(m.find(x => x.props['aria-live'] === 'polite').children[0], /未保存/)
  assert.equal(field(m, '语速倍率').props.value, 0.7)
  m.restore()
})

test('retry settings live in advanced and save as a partial patch', async () => {
  const calls = []
  const m = mount(async (path, body) => {
    calls.push({ path, body })
    if (path === '/console/status') return snapshot()
    if (path === '/console/save') return snapshot({ revision: 'rev-2' })
    return { ok: true }
  })
  m.render(); await flush(); m.render()
  assert.equal(field(m, '重试次数').props.value, 2)
  assert.equal(field(m, '重试间隔（秒）').props.value, 1)
  field(m, '重试次数').props.onChange({ target: { value: '3' } })
  field(m, '重试间隔（秒）').props.onChange({ target: { value: '0.5' } })
  await byText(m, 'button', '保存配置').props.onClick()
  await flush()
  assert.deepEqual(calls.find(c => c.path === '/console/save').body.settings, { retryCount: 3, retryDelaySeconds: 0.5 })
  m.restore()
})

test('emotion tab edits endpoints and routing and saves the full block', async () => {
  const calls = []
  const m = mount(async (path, body) => {
    calls.push({ path, body })
    if (path === '/console/status') return snapshot()
    if (path === '/console/save') return snapshot({ revision: 'rev-2' })
    return { ok: true }
  })
  m.render(); await flush(); m.render()
  await byText(m, 'button', '情绪引擎').props.onClick()
  byText(m, 'button', '添加端点').props.onClick()
  field(m, '端点名称').props.onChange({ target: { value: '自训练' } })
  field(m, '地址模板').props.onChange({ target: { value: 'http://127.0.0.1:8000/tts?text={text}' } })
  field(m, '情绪路由 · 平静').props.onChange({ target: { value: 'e1' } })
  assert.equal(byText(m, 'button', '保存配置').props.disabled, false)
  await byText(m, 'button', '保存配置').props.onClick()
  await flush()
  const body = calls.find(c => c.path === '/console/save').body.settings
  assert.equal(body.provider, 'emotion')
  assert.equal(body.emotion.endpoints[0].name, '自训练')
  assert.equal(body.emotion.routing.calm, 'e1')
  m.restore()
})
test('emotion templates save current routing and apply it back', async () => {
  const m = mount(async path => {
    if (path === '/console/status') return snapshot()
    if (path === '/console/save') return snapshot({ revision: 'rev-2' })
    return { ok: true }
  })
  m.render(); await flush(); m.render()
  await byText(m, 'button', '情绪引擎').props.onClick()
  field(m, '情绪路由 · 生气').props.onChange({ target: { value: 'builtin' } })
  field(m, '模板名称').props.onChange({ target: { value: '生气全内置' } })
  byText(m, 'button', '保存为模板').props.onClick()
  field(m, '情绪路由 · 生气').props.onChange({ target: { value: 'breezeblue' } })
  byText(m, 'button', '应用').props.onClick()
  assert.equal(field(m, '情绪路由 · 生气').props.value, 'builtin')
  m.restore()
})

test('overlong preview text is disabled before any request', async () => {
  const { m, calls } = await mounted()
  field(m, '试听文本').props.onChange({ target: { value: '字'.repeat(201) } })
  assert.equal(byText(m, 'button', '生成试听').props.disabled, true)
  assert.equal(calls.filter(c => c.path === '/console/test').length, 0)
  m.restore()
})

test('console mirrors the last chat fallback from the voice module', async () => {
  const calls = []
  const at = 1763371657000
  const m = mount(async (path, body) => {
    calls.push({ path, body })
    if (path === '/console/status') return snapshot()
    if (path === '/breeze/status') return { ok: true, lastFallback: { at, reason: '无法连接 Breeze 官方 API，请检查网络或代理。' } }
    return { ok: true }
  })
  m.render(); await flush(); m.render()
  assert.deepEqual(calls.map(c => c.path), ['/console/status', '/breeze/status'])
  const note = m.find(x => x.props.className === 'vp-note warn' && typeof x.children[0] === 'string' && x.children[0].startsWith('上次远程语音回退'))
  assert.match(note.children[0], /无法连接/)
  m.restore()
})

test('official mode does not query the voice status route', async () => {
  const calls = []
  const m = mount(async path => {
    calls.push(path)
    if (path === '/console/status') return snapshot({ requestedMode: 'official', actualMode: 'official' })
    return { ok: true }
  })
  m.render(); await flush(); m.render()
  assert.deepEqual(calls, ['/console/status'])
  m.restore()
})
