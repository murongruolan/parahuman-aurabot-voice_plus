import { mkdirSync, existsSync, copyFileSync, writeFileSync, readFileSync, readdirSync, lstatSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const name = 'aurabot-breezeblue-voice-1.3.0'
const dist = join(root, 'dist'), release = join(dist, name)
mkdirSync(dist, { recursive: true })
// Regeneration is deliberately refused. Inspect an older output before moving it aside.
assert.ok(!existsSync(release) && !existsSync(release + '.zip'), 'Release already exists; inspect before replacing it.')
const moduleFiles = {
  voice: ['index.mjs', 'tts.js', 'rvc.js', 'breezeblue.mjs', 'emotion.mjs', 'access.mjs', 'package.json', 'module.json', 'README.md', 'LICENSE'],
  'breeze-settings': ['index.mjs', 'settings.mjs', 'panel.js', 'access.mjs', 'control.mjs', 'package.json', 'module.json', 'README.md', 'LICENSE'],
}
const moduleLog = readFileSync(join(root, 'artifacts/module-test.log'), 'utf8')
assert.match(moduleLog, /# fail 0\b/)
assert.match(moduleLog, /# cancelled 0\b/)
const browser = JSON.parse(readFileSync(join(root, 'artifacts/browser/report.json'), 'utf8'))
assert.equal(browser.status, 'passed')
const verification = JSON.parse(readFileSync(join(root, 'artifacts/verification.json'), 'utf8'))
assert.equal(verification.originalClean, true)
const sha = data => createHash('sha256').update(data).digest('hex')
const manifest = { id: 'aurabot-breezeblue-voice', version: '1.3.0', baseCommit: verification.sourceCommit, modules: [] }
const inspectText = (buf, path) => {
  if (/brz_[A-Za-z0-9_-]{12,}/.test(buf.toString('utf8'))) throw new Error('Possible credential in release input: ' + path)
}
for (const [id, files] of Object.entries(moduleFiles)) {
  const mod = { id, files: [] }
  for (const path of files) {
    const file = join(root, 'modules', id, path)
    assert.ok(lstatSync(file).isFile() && !lstatSync(file).isSymbolicLink())
    const bytes = readFileSync(file); inspectText(bytes, id + '/' + path)
    mod.files.push({ path, bytes: bytes.length, sha256: sha(bytes) })
  }
  manifest.modules.push(mod)
}
for (const path of ['scripts/install.mjs']) inspectText(readFileSync(join(root, path)), path)
for (const [id, files] of Object.entries(moduleFiles)) {
  mkdirSync(join(release, id), { recursive: true })
  for (const file of files) copyFileSync(join(root, 'modules', id, file), join(release, id, file))
}
copyFileSync(join(root, 'scripts/install.mjs'), join(release, 'install.mjs'))
writeFileSync(join(release, 'MODULE-FILES.sha256.json'), JSON.stringify(manifest, null, 2))
mkdirSync(join(release, '试听样本'))
const ledger = JSON.parse(readFileSync(join(root, 'artifacts/live/spending-ledger.json'), 'utf8'))
for (const format of ['wav', 'mp3']) {
  const run = ledger.runs.find(r => r.format === format && r.status === 'passed')
  assert.ok(run)
  const sampleName = format === 'wav' ? '玉玲珑-早上好.wav' : '玉玲珑-连接成功.mp3'
  copyFileSync(run.file, join(release, '试听样本', sampleName))
}
writeFileSync(join(release, '先读我.txt'), '在目标 DSH 机器上安装，不在开发电脑安装。\n\n1. 全新安装：把 voice 和 breeze-settings 两个文件夹放到目标 Aurabot 用户 modules 目录；已有同名目录不要直接覆盖。\n2. 从旧版本升级：先在「增强语音」页切回官方语音，把旧 voice / breeze-settings 备份并移出 modules，再放入本包两个目录。配置在 DSH 配置里，不会被模块文件替换清除。\n3. 打开独立导航页「增强语音」；三态选择「增强语音」，在「远程 Breeze」或「情绪引擎」里配置并保存。\n4. 本次音色：voc_xrszxupbkdfa（玉玲珑）。Key 不在发行包里，需要自行填写。\n5. 本包未改整个 DSH 插件；遇到问题可切回「官方语音」，旧版本发行包仍保留。\n\ninstall.mjs 是可选工具，不带 --install 只检查；它默认拒绝覆盖已有模块，升级请按上面第 2 步手动备份。\n目标机器 QQ 通路需最后验证；详细说明与测试证据见私有仓库 README 与仓库外文档备份。\n')
const releaseHashes = []
function inspectDirectory(directory, prefix = '') {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    assert.ok(!entry.isSymbolicLink())
    const path = prefix + entry.name, full = join(directory, entry.name)
    if (entry.isDirectory()) inspectDirectory(full, path + '/')
    else {
      const bytes = readFileSync(full)
      if (!/\.(wav|mp3)$/.test(path)) inspectText(bytes, path)
      releaseHashes.push(`${sha(bytes)}  ${path}`)
    }
  }
}
inspectDirectory(release)
writeFileSync(join(release, 'SHA256SUMS.txt'), releaseHashes.join('\n') + '\n')
const zipPath = release + '.zip'
const python = 'import pathlib,sys,zipfile; src=pathlib.Path(sys.argv[1]); out=pathlib.Path(sys.argv[2]); z=zipfile.ZipFile(out,"x",compression=zipfile.ZIP_DEFLATED,compresslevel=6); [z.write(p,p.relative_to(src).as_posix()) for p in sorted(src.rglob("*")) if p.is_file()]; z.close(); z=zipfile.ZipFile(out); bad=z.testzip(); print("ZIP entries:",len(z.infolist()),"integrity:",bad or "OK"); assert bad is None'
const result = spawnSync('python', ['-I', '-c', python, release, zipPath], { cwd: root, encoding: 'utf8', timeout: 60000, windowsHide: true })
assert.equal(result.status, 0, result.stderr)
writeFileSync(zipPath + '.sha256', `${sha(readFileSync(zipPath))}  ${name}.zip\n`)
console.log(result.stdout.trim())
console.log('Release folder: ' + release)
console.log('Release ZIP: ' + zipPath)
console.log('ZIP bytes: ' + readFileSync(zipPath).length)
console.log('Modules: ' + manifest.modules.length + '; files: ' + manifest.modules.reduce((n, m) => n + m.files.length, 0) + '; no credentials/dependencies/test data in modules.')
