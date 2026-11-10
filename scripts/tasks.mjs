import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { spawn } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const artifacts = join(root, 'artifacts')
mkdirSync(artifacts, { recursive: true })

async function runNode(args, { cwd = root, log = 'test.log' } = {}) {
  const scratch = join(artifacts, 'scratch')
  mkdirSync(scratch, { recursive: true })
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...process.env, TEMP: scratch, TMP: scratch, TMPDIR: scratch,
      AURABOT_DATA_DIR: join(artifacts, 'isolated-aurabot-data'),
      DSH_HOME: join(artifacts, 'isolated-dsh') },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  })
  let output = ''
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output += chunk.toString() })
  const code = await new Promise((ok, fail) => { child.on('error', fail); child.on('close', ok) })
  writeFileSync(join(artifacts, log), output)
  console.log(output.split(/\r?\n/).slice(-28).join('\n'))
  console.log(`Full log: ${join(artifacts, log)}`)
  if (code !== 0) process.exitCode = code || 1
}

const task = process.argv[2]
if (task === 'upstream-test') {
  await runNode(['--test', 'test/**/*.test.js'], { cwd: join(root, 'upstream'), log: 'upstream-test.log' })
} else if (task === 'test') {
  await runNode(['--test', 'test/*.test.mjs'], { log: 'module-test.log' })
} else if (task === 'docs') {
  await import('./fetch-docs.mjs')
} else if (task === 'clone') {
  await import('./clone-builtin.mjs')
} else if (task === 'live') {
  await import('./live.mjs')
} else if (task === 'split-ui') {
  await import('./split-ui.mjs')
} else if (task === 'release-test') {
  await runNode(['--test', 'test/release.check.mjs'], { log: 'release-test.log' })
} else if (task === 'package') {
  await import('./package.mjs')
} else if (task === 'browser-deps') {
  await import('./browser-deps.mjs')
} else if (task === 'browser') {
  await import('./browser-smoke.mjs')
} else if (task === 'verify') {
  await import('./verify.mjs')
} else {
  console.error('Usage: node scripts/tasks.mjs <test|upstream-test|clone|live|package|verify>')
  process.exitCode = 1
}
