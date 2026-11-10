import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { createBreezeClient, redact } from '../modules/voice/breezeblue.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const privateFile = join(root, '.private', 'breeze.local.json')
const stored = existsSync(privateFile) ? JSON.parse(readFileSync(privateFile, 'utf8')) : {}
const config = { ...stored, apiKey: process.env.BREEZE_API_KEY || stored.apiKey || '' }
const out = join(root, 'artifacts', 'live')
mkdirSync(out, { recursive: true })
const client = createBreezeClient()
const mode = process.argv[3] || 'list'
try {
  if (mode === 'list') {
    const result = await client.voices(config, { type: 'personal' })
    writeFileSync(join(out, 'personal-voices.json'), JSON.stringify(result, null, 2))
    console.log(JSON.stringify(result, null, 2))
  } else if (mode === 'synth') {
    const voiceId = process.env.BREEZE_VOICE_ID || config.voiceId
    if (!voiceId) throw new Error('Select a voice ID in the private test config first.')
    const ledgerFile = join(out, 'spending-ledger.json')
    const ledger = existsSync(ledgerFile) ? JSON.parse(readFileSync(ledgerFile, 'utf8')) : { attempts: 0, characters: 0, runs: [] }
    const format = process.argv[4] || 'wav'
    if (!['wav', 'mp3'].includes(format)) throw new Error('Only wav or mp3 smoke tests are allowed.')
    const text = format === 'wav' ? '早上好，今天也要照顾好自己。' : '你好，语音连接成功了。'
    const characters = Array.from(text).length
    if (ledger.attempts >= 4 || ledger.characters + characters > 200) throw new Error('Local live-test budget reached: maximum 4 attempts / 200 characters; no request sent.')
    const id = randomUUID()
    const directory = join(out, id)
    mkdirSync(directory, { recursive: true })
    const run = { id, voiceId, format, characters, startedAt: new Date().toISOString(), status: 'submitted-or-interrupted' }
    ledger.attempts++
    ledger.characters += characters
    ledger.runs.push(run)
    writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2))
    const t = Date.now()
    try {
      const result = await client.synthesize(text, { ...config, outputFormat: format, timeoutSeconds: 180,
        instructions: format === 'mp3' ? '自然、温柔地说话，像在和朋友聊天。' : '', guidanceScale: 1 }, directory)
      Object.assign(run, { status: 'passed', milliseconds: Date.now() - t, file: result.file, bytes: result.bytes, mime: result.mime })
      console.log(JSON.stringify(run, null, 2))
    } catch (error) {
      Object.assign(run, { status: 'failed', code: error.code || error.name, message: redact(error.message, config.apiKey) })
      throw error
    } finally { writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2)) }
  } else throw new Error('Usage: tasks.mjs live [list|synth [wav|mp3]]')
} catch (error) {
  console.error(redact(error.message, config.apiKey))
  process.exitCode = 1
}
