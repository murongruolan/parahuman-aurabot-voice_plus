// Development-only tools, isolated from the user's DSH installation.
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = ['--prefix', root, 'install', '--save-dev', '--ignore-scripts', '--no-audit', '--no-fund', 'react@18.3.1', 'react-dom@18.3.1', 'playwright-core@1.56.1']
import { existsSync } from 'node:fs'
const bundledCli = resolve(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')
const command = existsSync(bundledCli) ? process.execPath : 'npm'
const parameters = existsSync(bundledCli) ? [bundledCli, ...args] : args
const result = spawnSync(command, parameters, { cwd: root, encoding: 'utf8', timeout: 180000, windowsHide: true })
console.log(result.stdout || '')
if (result.stderr) console.error(result.stderr)
if (result.error) console.error(result.error.message)
process.exitCode = result.status ?? 1
