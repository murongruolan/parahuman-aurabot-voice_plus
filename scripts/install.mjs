// Explicit-target installer for the OTHER machine. No default DSH path, no automatic activation.
import { existsSync, lstatSync, readdirSync, readFileSync, mkdirSync, copyFileSync, renameSync, rmSync, realpathSync } from 'node:fs'
import { join, dirname, resolve, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash, randomUUID } from 'node:crypto'

const IDS = ['voice', 'breeze-settings']
function assertAbsent(path, id) {
  try { lstatSync(path); throw new Error(`A user ${id} module already exists. Nothing was overwritten. Back it up and move it OUTSIDE modules first.`) }
  catch (error) { if (error.code !== 'ENOENT') throw error }
}
export function install({ packageDir, modulesDir, apply = false }) {
  if (!modulesDir || !isAbsolute(modulesDir)) throw new Error('Supply an absolute --modules path from the TARGET DSH Installed Modules page.')
  const manifestPath = join(packageDir, 'MODULE-FILES.sha256.json')
  if (!existsSync(manifestPath)) throw new Error('Package manifest is missing. Extract the complete release folder first.')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (manifest.id !== 'aurabot-breezeblue-voice' || !Array.isArray(manifest.modules) || manifest.modules.length !== 2) throw new Error('Invalid package manifest.')
  if (new Set(manifest.modules.map(x => x.id)).size !== 2 || manifest.modules.some(x => !IDS.includes(x.id))) throw new Error('Unexpected module IDs.')
  const targetRoot = realpathSync(modulesDir)
  if (!lstatSync(targetRoot).isDirectory()) throw new Error('The target modules directory does not exist.')
  if (!existsSync(join(targetRoot, 'API.md')) || !existsSync(join(targetRoot, 'aurabot.d.ts'))) {
    throw new Error('This does not look like an Aurabot user modules directory (API.md + aurabot.d.ts required). Open Aurabot once and copy its modules path.')
  }
  let count = 0
  for (const mod of manifest.modules) {
    const source = join(packageDir, mod.id)
    assertAbsent(join(targetRoot, mod.id), mod.id)
    if (!lstatSync(source).isDirectory() || lstatSync(source).isSymbolicLink()) throw new Error('Unexpected module source directory.')
    if (!Array.isArray(mod.files) || !mod.files.length) throw new Error('Module file manifest missing.')
    const names = new Set()
    for (const { path, sha256 } of mod.files) {
      if (typeof path !== 'string' || !/^[A-Za-z0-9_.-]+$/.test(path) || path === '.' || path === '..' || names.has(path) || !/^[a-f0-9]{64}$/.test(sha256)) throw new Error('Unsafe manifest entry.')
      names.add(path)
      const from = join(source, path)
      if (!lstatSync(from).isFile() || lstatSync(from).isSymbolicLink()) throw new Error('The module contains an unexpected file or symlink.')
      const hash = createHash('sha256').update(readFileSync(from)).digest('hex')
      if (hash !== sha256) throw new Error(`Package checksum mismatch: ${mod.id}/${path}. Nothing installed.`)
    }
    if (!names.has('index.mjs') || !names.has('package.json')) throw new Error('Module entry is missing.')
    if (readdirSync(source).some(name => !names.has(name))) throw new Error(`Unexpected files in ${mod.id}/. Use a fresh release extraction, without config or cache files.`)
    count += names.size
  }
  const targets = IDS.map(id => join(targetRoot, id))
  if (!apply) return { ok: true, mode: 'check-only', files: count, targets, message: 'Checks passed. No files were installed. Add --install to copy both modules.' }
  const staging = join(targetRoot, '_breezeblue-staging-' + randomUUID())
  mkdirSync(staging)
  const installed = []
  try {
    for (const mod of manifest.modules) {
      mkdirSync(join(staging, mod.id))
      for (const { path } of mod.files) copyFileSync(join(packageDir, mod.id, path), join(staging, mod.id, path))
    }
    // Activate UI first. Voice defaults to the old engine until the companion is present/configured.
    for (const id of ['breeze-settings', 'voice']) {
      const target = join(targetRoot, id)
      assertAbsent(target, id)
      renameSync(join(staging, id), target)
      installed.push(id)
    }
  } catch (error) {
    // Roll back only directories this invocation created; leave an existing user's directory untouched.
    for (const id of installed.reverse()) renameSync(join(targetRoot, id), join(staging, id))
    throw error
  } finally {
    if (existsSync(staging)) rmSync(staging, { recursive: true })
  }
  return { ok: true, mode: 'installed', files: count, targets,
    message: 'Both modules copied. Open Aurabot > Installed, enable breeze-settings and choose your voice version, then configure Breeze in Voice. Existing config was not changed.' }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2)
    const i = args.indexOf('--modules')
    if (i < 0 || !args[i + 1]) throw new Error('Usage: node install.mjs --modules "ABSOLUTE_TARGET_AURABOT_MODULES_DIR" [--install]\nWithout --install: checks only. Run on the intended target machine, NOT on the development PC.')
    const allowed = new Set(['--modules', args[i + 1], '--install'])
    if (args.some(a => !allowed.has(a))) throw new Error('Unknown argument.')
    console.log(JSON.stringify(install({ packageDir: dirname(fileURLToPath(import.meta.url)), modulesDir: args[i + 1], apply: args.includes('--install') }), null, 2))
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
