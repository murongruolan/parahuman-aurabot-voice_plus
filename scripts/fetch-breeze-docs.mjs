// Research only: hydrate the Mintlify SPA thoroughly and dump page + code blocks. No API calls, no paid traffic.
import { chromium } from 'playwright-core'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const url = 'https://docs.breezeblue.ai/api-reference/text-to-speech/convert-text-to-speech'
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(3000)
  for (let i = 0; i < 30; i++) { await page.evaluate(() => window.scrollBy(0, 600)); await page.waitForTimeout(350) }
  await page.waitForTimeout(2000)
  const text = await page.evaluate(() => {
    const pre = [...document.querySelectorAll('pre')].map(x => x.innerText).join('\n\n====PRE====\n\n')
    const body = (document.querySelector('main') || document.body).innerText
    return { body: body.slice(0, 80000), pre: pre.slice(0, 40000), links: [...document.querySelectorAll('a')].map(a => ({ t: a.innerText.trim(), h: a.href })).filter(x => x.t).slice(0, 120) }
  })
  writeFileSync(join(process.cwd(), 'artifacts', 'breeze-docs.json'), JSON.stringify(text, null, 2))
  console.log('BODY CHARS:', text.body.length, 'PRE CHARS:', text.pre.length)
} finally {
  await browser.close()
}