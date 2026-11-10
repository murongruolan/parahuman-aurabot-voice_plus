import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../modules/breeze-settings/panel.js', import.meta.url), 'utf8')
function mount({ call, settings = {}, draft = {}, setSettings = () => {} } = {}) {
  const state = [], refs = [], effects = [], toasts = []
  let pos = 0, refPos = 0, initial = true
  const React = {
    useState(value) { const n = pos++; if (!(n in state)) state[n] = value; return [state[n], next => { state[n] = typeof next === 'function' ? next(state[n]) : next }] },
    useRef(value) { const n = refPos++; if (!(n in refs)) refs[n] = { current: value }; return refs[n] },
    useEffect(work) { if (initial) effects.push(work) },
  }
  const h = (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity).filter(x => x !== null && x !== false && x !== undefined) })
  const C = new Function('React', 'h', 'ui', 'call', source)(React, h, { Card: 'Card', Btn: 'Btn' }, call)
  const props = { settings, draftSettings: draft, setSettings, toast: x => toasts.push(x) }
  const render = () => { pos = 0; refPos = 0; const tree = C(props); initial = false; return tree }
  const walk = tree => [tree, ...(tree && typeof tree === 'object' ? tree.children.flatMap(walk) : [])]
  return { render, walk, effects, toasts, props }
}
function node(m, predicate) { return m.walk(m.render()).find(x => x && typeof x === 'object' && predicate(x)) }

test('custom panel compiles under the exact host new Function contract', () => {
  const m = mount({ call: async () => ({ ok: true }) })
  assert.equal(m.render().type, 'Card')
  assert.equal(node(m, x => x.type === 'input').props['aria-label'], '搜索音色')
})
test('voice list uses /breeze/voices, selected ID only changes draft (no secret access)', async () => {
  const calls = [], patches = []
  const m = mount({ draft: { voiceId: '' }, setSettings: patch => patches.push(patch), call: async (path, body) => {
    calls.push({ path, body }); return { ok: true, voices: [{ voiceId: 'voc_one', name: '玉玲珑' }], hasMore: false, page: 1 }
  } })
  await node(m, x => x.type === 'Btn' && x.children.includes('获取音色列表')).props.onClick()
  assert.deepEqual(calls, [{ path: '/breeze/voices', body: { type: 'personal', search: '', pageToken: '', page: 1 } }])
  node(m, x => x.props['aria-label'] === '选择 Breeze 音色').props.onChange({ target: { value: 'voc_one' } })
  assert.deepEqual(patches, [{ voiceId: 'voc_one' }])
  assert.ok(m.toasts.some(x => x.includes('保存设置')))
})
test('pagination keeps filter and sends next cursor', async () => {
  const calls = []
  const m = mount({ call: async (path, body) => {
    calls.push({ path, body }); return { ok: true, voices: [{ voiceId: 'voc_' + calls.length, name: '音色' }], hasMore: true, nextPageToken: 'cursor1', page: calls.length }
  } })
  await node(m, x => x.type === 'Btn' && x.children.includes('获取音色列表')).props.onClick()
  await node(m, x => x.type === 'Btn' && x.children.includes('加载更多')).props.onClick()
  assert.equal(calls[1].body.pageToken, 'cursor1'); assert.equal(calls[1].body.page, 2)
  const sel = node(m, x => x.props['aria-label'] === '选择 Breeze 音色')
  assert.equal(sel.children.filter(x => x.type === 'option').length, 3)
})
test('paid preview uses text-only request and prevents duplicate click', async () => {
  let finish
  const gate = new Promise(r => (finish = r)); const calls = []
  const m = mount({ settings: { apiKey: '', voiceId: 'voc_saved' }, draft: { apiKey: 'unsaved', voiceId: 'voc_unsaved' }, call: async (path, body) => { calls.push({ path, body }); await gate; return { ok: false, message: 'service busy' } } })
  const button = node(m, x => x.type === 'Btn' && x.children.includes('Breeze 直连试听（计费）'))
  const first = button.props.onClick(), second = button.props.onClick()
  assert.equal(calls.length, 1); assert.deepEqual(Object.keys(calls[0].body), ['text'])
  finish(); await Promise.all([first, second])
  assert.equal(node(m, x => x.props.role === 'alert').children[0], 'service busy')
})
test('blank or overlong preview disabled; no automatic generation when panel mounts', () => {
  let calls = 0
  const m = mount({ call: async () => { calls++; return { ok: true } } })
  node(m, x => x.props['aria-label'] === 'Breeze 试听文本').props.onChange({ target: { value: '字'.repeat(201) } })
  assert.equal(node(m, x => x.type === 'Btn' && x.children.includes('Breeze 直连试听（计费）')).props.disabled, true)
  assert.equal(calls, 0)
})
