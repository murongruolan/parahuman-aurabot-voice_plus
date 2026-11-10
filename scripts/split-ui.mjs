import { cpSync, renameSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
for (const name of ['panel.js', 'settings.mjs']) {
  const from = join(root, 'modules/voice', name), to = join(root, 'modules/breeze-settings', name)
  if (existsSync(to)) throw new Error('Target exists; inspect first: ' + to)
  const content = readFileSync(from, 'utf8')
  renameSync(from, to)
  if (name === 'settings.mjs') {
    const defaults = readFileSync(join(root, 'modules/voice/breezeblue.mjs'), 'utf8').match(/export const DEFAULTS = Object\.freeze\((\{[\s\S]*?\})\)/)[1]
    const formats = readFileSync(join(root, 'modules/voice/breezeblue.mjs'), 'utf8').match(/export const FORMATS = (\[[^\n]+\])/)[1]
    writeFileSync(to, content.replace("// Settings live in cfg.ext.voice; the core cfg.voice engine enum stays untouched.\nimport { DEFAULTS, FORMATS } from './breezeblue.mjs'\nexport { DEFAULTS }", `// Settings live in cfg.ext['breeze-settings']; core cfg.voice is untouched.\nconst FORMATS = ${formats}\nexport const DEFAULTS = Object.freeze(${defaults})`))
  }
}
console.log('Moved panel and settings into visible companion module; runtime/API remains in voice.')
