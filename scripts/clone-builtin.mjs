import { mkdirSync, cpSync, readdirSync, existsSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const isolated = join(root, 'artifacts', 'official-fork')
process.env.AURABOT_DATA_DIR = isolated
const { createModules } = await import('../upstream/src/core/modules.js')
const { default: voice } = await import('../upstream/src/modules/voice/index.js')
let config = { modules: {}, ext: {} }
const log = { info() {}, warn() {}, debug() {}, error() {} }
const mods = createModules({ ctx: {}, core: {}, getConfig: () => config,
  setConfig: value => (config = value), logger: { child: () => log }, version: '1.2.0', builtins: [voice] })
const result = mods.fork('voice')
if (!result.ok) throw new Error(result.message)
const target = join(root, 'modules', 'voice')
mkdirSync(target, { recursive: true })
for (const name of ['index.mjs', 'tts.js', 'rvc.js']) {
  if (existsSync(join(target, name))) throw new Error(`Refuse to overwrite ${name}`)
  cpSync(join(result.dir, name), join(target, name))
}
writeFileSync(join(root, 'artifacts', 'fork-config.json'), JSON.stringify(config, null, 2))
mods.dispose()
console.log('Official fork created; index.mjs + tts.js + rvc.js copied to modules/voice. Originals preserved in artifacts/official-fork.')
