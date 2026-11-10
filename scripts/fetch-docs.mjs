import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
for (const [name, url] of [
  ['voices', 'https://docs.breezeblue.ai/api-reference/voices/list-voices.md'],
  ['balance', 'https://docs.breezeblue.ai/api-reference/account/get-balance.md'],
]) {
  const dir = join(root, 'research', 'downloads', `${name}-${randomUUID()}`)
  mkdirSync(dir, { recursive: true })
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30000), redirect: 'error' })
    const text = await response.text()
    if (!response.ok) { console.log(name, 'HTTP', response.status); continue }
    const out = join(dir, `${name}.md`)
    writeFileSync(out, text)
    console.log(name, 'saved', text.length, 'characters:', out)
  } catch (error) { console.log(name, 'fetch failed:', error.code || error.cause?.code || error.name) }
}
