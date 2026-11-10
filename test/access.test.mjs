import { test } from 'node:test'
import assert from 'node:assert/strict'
import { panelAccessError } from '../modules/voice/access.mjs'
const request = (address = '127.0.0.1', extra = {}) => ({ method: 'POST', socket: { remoteAddress: address }, headers: { host: 'localhost:5099' }, ...extra })
for (const address of ['127.0.0.1', '127.1.2.3', '::1', '::ffff:127.0.0.1']) test('local panel accepted: ' + address, () => {
  assert.equal(panelAccessError(request(address), 'POST'), null)
})
for (const address of ['', '198.51.100.9', '192.168.1.2', '::ffff:192.168.1.2', '127.evil', 'localhost']) test('non-local socket rejected: ' + address, () => {
  assert.equal(panelAccessError(request(address), 'POST').ok, false)
})
test('same-origin loopback IPv6 Host accepted', () => {
  assert.equal(panelAccessError(request('::1', { headers: { host: '[::1]:5099', origin: 'http://[::1]:5099', 'sec-fetch-site': 'same-origin' } }), 'POST'), null)
})
test('forwarded or cross-site callers never inherit local trust', () => {
  for (const headers of [
    { host: 'localhost:5099', 'x-forwarded-for': '127.0.0.1' },
    { host: 'localhost:5099', forwarded: 'for=127.0.0.1' },
    { host: 'localhost:5099', 'x-real-ip': '127.0.0.1' },
    { host: 'localhost:5099', 'sec-fetch-site': 'cross-site' },
    { host: 'localhost:5099', 'sec-fetch-site': 'same-site' },
    { host: 'localhost:5099', origin: 'http://localhost:6000' },
    { host: 'localhost:5099', origin: 'null' },
    { host: 'rebinding.example:5099' },
    { host: 'localhost:5099/hidden' },
  ]) assert.equal(panelAccessError(request('127.0.0.1', { headers }), 'POST').ok, false)
  assert.equal(panelAccessError(request(), 'POST', { trustedProxy: '127.0.0.1' }).ok, false)
})
test('read/write method mismatch rejected', () => {
  assert.equal(panelAccessError(request(), 'GET').code, 'METHOD_NOT_ALLOWED')
})
