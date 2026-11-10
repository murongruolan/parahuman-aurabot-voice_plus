// Full, UNMODIFIED Aurabot client renders the two shipped modules through the real loader.
// Host/QQ services and provider transport are isolated fixtures. No install into real DSH, no paid calls.
import { createServer } from 'node:http'
import { mkdirSync, mkdtempSync, cpSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const artifacts = join(root, 'artifacts', 'browser')
mkdirSync(artifacts, { recursive: true })
const fixture = mkdtempSync(join(artifacts, 'isolated-'))
process.env.AURABOT_DATA_DIR = fixture
process.env.DSH_HOME = join(fixture, 'dsh')
for (const id of ['voice', 'breeze-settings']) cpSync(join(root, 'modules', id), join(fixture, 'modules', id), { recursive: true })
const { createModules } = await import('../upstream/src/core/modules.js')
const { normalize, publicConfig, mergeFromPanel } = await import('../upstream/src/core/config.js')
const { default: builtin } = await import('../upstream/src/modules/voice/index.js')
const { DEFAULTS } = await import('../modules/breeze-settings/settings.mjs')
let cfg = normalize({ setupDone: true, botQQ: '123456789', ownerQQ: '234567890', voice: { enabled: true, engine: 'windows' }, ext: { 'breeze-settings': { ...DEFAULTS } } })
const silent = { info() {}, warn() {}, error() {}, debug() {} }
const readBody = async req => {
  let body = ''; for await (const part of req) { body += part.toString('utf8'); if (body.length > 50000) throw new Error('Request too large') }
  return body ? JSON.parse(body) : {}
}
const core = { local: { active: () => false }, http: { body: readBody }, hub: {}, onebot: {} }
const mods = createModules({ ctx: { get: () => null }, core, getConfig: () => cfg, setConfig: value => (cfg = value),
  logger: { child: () => silent }, version: '1.2.0', builtins: [builtin] })
core.modules = mods
await mods.boot()
assert.equal(mods.running('voice'), 'user')
assert.equal(mods.running('breeze-settings'), 'user')
const ledger = JSON.parse(readFileSync(join(root, 'artifacts/live/spending-ledger.json'), 'utf8'))
const realWav = readFileSync(ledger.runs.find(r => r.format === 'wav' && r.status === 'passed').file)
const originalFetch = globalThis.fetch
const requests = []
let rejectTts = false
globalThis.fetch = async (url, init) => {
  const u = new URL(url)
  assert.equal(u.origin, 'https://api.breeze.blue', 'Fixture only permits the known mock provider')
  requests.push({ pathname: u.pathname, method: init.method, body: init.body ? JSON.parse(init.body) : null })
  if (u.pathname === '/v1/voices') return new Response(JSON.stringify({ voices: [{ voice_id: 'voc_browser', name: '玉玲珑 · 测试音色', voice_type: 'personal', origin: 'cloned' }], has_more: false, total: 1, page: 1 }), { headers: { 'content-type': 'application/json' } })
  if (rejectTts) return new Response(JSON.stringify({ code: 'rate_limit', detail: 'test limit' }), { status: 429, headers: { 'content-type': 'application/json' } })
  return new Response(realWav, { headers: { 'content-type': 'audio/wav' } })
}
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Aurabot — Unmodified Client Integration</title>
<style>body{margin:0;font:14px system-ui,sans-serif;background:#f5f6f9;color:#202b3d}#fixture-note{padding:10px 20px;background:#eef3fa;color:#304563}</style>
<div id="fixture-note">隔离验证环境 · 未修改的 Aurabot 1.2.0 客户端 · 未连接 QQ · 测试音频不计费</div><div id="root"></div>
<script src="/react.js"></script><script src="/react-dom.js"></script><script>
localStorage.setItem('aurabot.tab','voice');
localStorage.setItem('aurabot.persona-tab-v2','1');
window.__ModuleLoader__={load({factory}){const ex=factory(name=>{if(name==='react')return React;throw new Error('Unexpected require '+name)});ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(ex.AurabotPage));}};
</script><script src="/host-client.js"></script></html>`
const state = () => ({ ok: true, config: publicConfig(cfg), modules: mods.status(), version: '1.2.0', personas: [],
  onebot: { state: 'disconnected', login: null }, mood: { label: '平静' }, snowluma: { installed: false, running: false }, voice: { edgeInstalled: false }, avatar: { at: 0 } })
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1'), path = url.pathname
    if (path === '/') { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(html); return }
    if (path === '/react.js' || path === '/react-dom.js') {
      const relative = path === '/react.js' ? 'react/umd/react.production.min.js' : 'react-dom/umd/react-dom.production.min.js'
      res.setHeader('content-type', 'text/javascript'); res.end(readFileSync(join(root, 'node_modules', relative))); return
    }
    if (path === '/host-client.js') { res.setHeader('content-type', 'text/javascript; charset=utf-8'); res.end(readFileSync(join(root, 'upstream/client/client.js'))); return }
    if (path === '/aurabot/api/modules/panel') {
      const source = mods.panelSource(url.searchParams.get('id'))
      if (!source) { res.writeHead(404); res.end(); return }
      res.setHeader('content-type', 'text/javascript; charset=utf-8'); res.end(source); return
    }
    if (path === '/aurabot/api/avatar') { res.setHeader('content-type', 'image/svg+xml'); res.end('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="16" fill="#324d70"/></svg>'); return }
    if (path === '/favicon.ico') { res.writeHead(204); res.end(); return }
    let result
    if (path === '/aurabot/api/state') result = state()
    else if (path === '/aurabot/api/save') { cfg = mergeFromPanel(cfg, await readBody(req)); result = state() }
    else if (mods.hasRoute(path)) result = await mods.handle(path, req, res)
    else { res.writeHead(404); res.end(); return }
    res.setHeader('content-type', 'application/json; charset=utf-8'); res.end(JSON.stringify(result))
  } catch (error) { res.writeHead(500); res.end(JSON.stringify({ ok: false, message: error.message })) }
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
let browser
try {
  browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true })
  const page = await browser.newPage({ viewport: { width: 1180, height: 1000 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`http://127.0.0.1:${server.address().port}`)
  await page.getByRole('heading', { name: 'BreezeBlue 语音设置', exact: true }).waitFor()
  const row = label => page.locator('.ab-row').filter({ has: page.locator('.ab-label b').filter({ hasText: new RegExp('^' + label + '$') }) })
  await row('Breeze API Key').locator('input').fill('brz_browser_fixture_only')
  await page.getByRole('button', { name: '保存设置', exact: true }).click()
  await row('Breeze API Key').getByPlaceholder('已保存（不改就留空）').waitFor()
  await page.getByRole('button', { name: '获取音色列表', exact: true }).click()
  await page.getByLabel('选择 Breeze 音色').selectOption('voc_browser')
  await row('语音提供方').getByRole('combobox').click()
  await page.getByRole('option', { name: 'BreezeBlue 远程 API' }).click()
  await page.getByRole('button', { name: '保存设置', exact: true }).click()
  await page.waitForFunction(() => !document.querySelector('.ab-savebar'))
  await page.getByLabel('Breeze 试听文本').fill('浏览器集成验证，不调用远程计费。')
  await page.getByRole('button', { name: 'Breeze 直连试听（计费）', exact: true }).click()
  const preview = page.locator('audio[src^="blob:"]')
  await preview.waitFor()
  await page.waitForFunction(() => document.querySelector('audio[src^="blob:"]')?.readyState >= 1)
  const duration = await preview.evaluate(el => el.duration)
  assert.ok(duration > 0)
  await row('语速倍率').locator('input').fill('0.95')
  await page.getByRole('button', { name: '保存设置', exact: true }).click()
  assert.equal(await preview.evaluate(async el => (await fetch(el.src)).ok), true)
  await page.getByRole('heading', { name: 'BreezeBlue · 音色与直连试听' }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: join(artifacts, 'panel-success.png'), fullPage: true })
  rejectTts = true
  await page.getByRole('button', { name: 'Breeze 直连试听（计费）', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: '429' }).waitFor()
  await page.screenshot({ path: join(artifacts, 'panel-error.png'), fullPage: true })
  assert.deepEqual(errors, [])
  assert.equal(requests.filter(r => r.method === 'POST').length, 2)
  assert.equal(cfg.ext['breeze-settings'].voiceId, 'voc_browser'); assert.equal(cfg.ext['breeze-settings'].provider, 'breezeblue')
  assert.equal(cfg.ext['breeze-settings'].apiKey, 'brz_browser_fixture_only')
  const report = { status: 'passed', checks: ['UNMODIFIED upstream client/client.js mounted', 'actual hasUi/ExtPage/ExtPanel path', 'two modules real loader', 'save/masked key', 'list/select voice', 'provider selection', 'audio metadata', 'saved settings retain preview URL', '429 visible/no fallback', 'no page errors'], audioDuration: duration, noPaidCalls: true, noLocalDshInstall: true }
  writeFileSync(join(artifacts, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} finally {
  await browser?.close(); mods.dispose(); globalThis.fetch = originalFetch
  await new Promise(r => server.close(r))
}
