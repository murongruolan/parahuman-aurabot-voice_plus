// Module routes do not inherit Aurabot's admin local-only gate. Protect paid previews ourselves.
import { isIP } from 'node:net'

function loopback(value) {
  const host = String(value || '').trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/^::ffff:/, '')
  return host === '::1' || (isIP(host) === 4 && host.startsWith('127.'))
}

export function panelAccessError(req, method, security = {}) {
  const denied = { ok: false, code: 'LOCAL_PANEL_ONLY', message: 'Breeze 管理与试听接口只允许目标 DSH 机器本机直接访问。请在远程桌面内打开 localhost 面板；拒绝外部及反代请求。' }
  const address = req?.socket?.remoteAddress || req?.connection?.remoteAddress || ''
  if (!loopback(address)) return denied
  const headers = req?.headers || {}
  // A local reverse proxy is not proof that its originating caller is local.
  const normalized = String(address).replace(/^::ffff:/i, '')
  const trusted = String(security.trustedProxy || '').split(',').map(x => x.trim().replace(/^::ffff:/i, ''))
  if (trusted.includes(normalized) || ['x-forwarded-for', 'forwarded', 'x-real-ip'].some(k => headers[k])) return denied
  let target
  try {
    const host = String(headers.host || '').trim()
    target = new URL('http://' + host)
    if (!host || target.username || target.password || target.pathname !== '/' || target.search || target.hash ||
      (target.hostname !== 'localhost' && !loopback(target.hostname))) return denied
  } catch { return denied }
  if (String(req.method || '').toUpperCase() !== method) return { ok: false, code: 'METHOD_NOT_ALLOWED', message: `此接口只接受 ${method}。` }
  const site = String(headers['sec-fetch-site'] || '').toLowerCase()
  if (site && !['same-origin', 'none'].includes(site)) return denied
  if (headers.origin) {
    try {
      const origin = new URL(String(headers.origin))
      if (!['http:', 'https:'].includes(origin.protocol) || origin.host !== target.host) return denied
    } catch { return denied }
  }
  return null
}
