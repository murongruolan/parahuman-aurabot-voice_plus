import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const original = 'E:/System_TEMP/companion-voice/dsh-aurabot-qq'
const files = spawnSync('git', ['-C', original, 'ls-files', '-z'], { encoding: 'utf8' })
assert.equal(files.status, 0, files.stderr)
const changes = files.stdout.split('\0').filter(Boolean).filter(p => !readFileSync(join(original, p)).equals(readFileSync(join(root, 'upstream', p))))
assert.deepEqual(changes, [], 'Original source and test snapshot diverged')
const status = spawnSync('git', ['-C', original, 'status', '--porcelain'], { encoding: 'utf8' })
assert.equal(status.status, 0); assert.equal(status.stdout.trim(), '', 'Original working tree changed')
for (const name of ['tts.js', 'rvc.js']) assert.ok(readFileSync(join(root, 'modules/voice', name)).equals(readFileSync(join(root, 'artifacts/official-fork/modules/voice', name))), `${name} differs from official fork`)
const report = { sourceCommit: '1057a861e4e96aa2fe050000d238280a7901b9dc', originalClean: true, snapshotMatches: true, originalFiles: files.stdout.split('\0').filter(Boolean).length,
  preservedHelpers: ['tts.js', 'rvc.js'], audio: [] }
const ledger = JSON.parse(readFileSync(join(root, 'artifacts/live/spending-ledger.json'), 'utf8'))
const ffprobe = 'F:/FFMpeg/bin/ffprobe.exe', ffmpeg = 'F:/FFMpeg/bin/ffmpeg.exe'
assert.ok(existsSync(ffprobe) && existsSync(ffmpeg), 'ffprobe/ffmpeg unavailable')
for (const run of ledger.runs.filter(r => r.status === 'passed')) {
  const probe = spawnSync(ffprobe, ['-v', 'error', '-show_entries', 'stream=codec_name,sample_rate,channels:format=duration,size', '-of', 'json', run.file], { encoding: 'utf8', timeout: 30000, windowsHide: true })
  assert.equal(probe.status, 0, probe.stderr)
  const info = JSON.parse(probe.stdout)
  assert.ok(Number(info.format.duration) > 0)
  const decode = spawnSync(ffmpeg, ['-v', 'error', '-i', run.file, '-f', 'null', '-'], { encoding: 'utf8', timeout: 30000, windowsHide: true })
  assert.equal(decode.status, 0, decode.stderr)
  report.audio.push({ requestedFormat: run.format, ...info, decodes: true })
}
writeFileSync(join(root, 'artifacts/verification.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
