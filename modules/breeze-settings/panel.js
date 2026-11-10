// Aurabot custom panel function body; no build step and no third-party UI dependency.
const { useState, useEffect, useRef } = React
return function BreezePanel({ settings, draftSettings, setSettings, toast }) {
  const [status, setStatus] = useState(null)
  const [voices, setVoices] = useState([])
  const [type, setType] = useState('personal')
  const [search, setSearch] = useState('')
  const [cursor, setCursor] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [text, setText] = useState('你好，今天也要照顾好自己。')
  const [audio, setAudio] = useState(null)
  const alive = useRef(true)
  const inFlight = useRef(false)
  const audioUrl = useRef('')
  const chosen = (draftSettings || settings || {}).voiceId || ''
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; if (audioUrl.current) URL.revokeObjectURL(audioUrl.current) }
  }, [])
  useEffect(() => {
    let current = true
    call('/breeze/status').then(r => { if (current && alive.current) setStatus(r) }).catch(() => {})
    return () => { current = false }
  }, [settings?.provider, settings?.apiKeySet, settings?.voiceId])

  async function action(kind, work) {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(kind); setError('')
    try { await work() }
    catch (e) { if (alive.current) setError(String(e.message || '操作失败')) }
    finally { inFlight.current = false; if (alive.current) setBusy('') }
  }
  function resetList() { setVoices([]); setCursor(''); setPage(1); setHasMore(false) }
  function loadVoices(more = false) {
    return action('voices', async () => {
      const r = await call('/breeze/voices', { type, search, pageToken: more ? cursor : '', page: more ? page + 1 : 1 })
      if (r.ok === false) throw new Error(r.message || '读取音色失败')
      if (!alive.current) return
      setVoices(previous => {
        const all = more ? [...previous, ...(r.voices || [])] : (r.voices || [])
        return [...new Map(all.map(v => [v.voiceId, v])).values()]
      })
      setCursor(r.nextPageToken || ''); setPage(r.page || (more ? page + 1 : 1)); setHasMore(r.hasMore === true)
      if (!r.voices?.length) toast('没有匹配的音色；可切换「全部」或直接填写 Voice ID。')
    })
  }
  function preview() {
    return action('test', async () => {
      const r = await call('/breeze/test', { text })
      if (r.ok === false) throw new Error(r.message || '试听失败')
      if (!alive.current) return
      if (r.engine !== 'breezeblue' || !r.data || !['audio/wav', 'audio/mpeg'].includes(r.mime)) throw new Error('返回不是 Breeze 音频')
      const raw = atob(r.data), bytes = Uint8Array.from(raw, c => c.charCodeAt(0))
      const url = URL.createObjectURL(new Blob([bytes], { type: r.mime }))
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current)
      audioUrl.current = url
      setAudio({ url, mime: r.mime })
      toast('Breeze 合成成功，点击播放器试听。')
    })
  }

  return h(ui.Card, { title: 'BreezeBlue · 音色与直连试听', desc: '使用上方已保存的配置。不会修改模型提示词、聊天规则或其他模块。' },
    h('p', { className: 'ab-note' }, '先填 API Key 和 Voice ID 并点底部「保存设置」。选择 BreezeBlue 后聊天语音才走远程服务；安装后默认保持原引擎。'),
    status?.localTtsActive ? h('p', { className: 'ab-note warn' }, '检测到本地 TTS 接口已启用：聊天仍优先本地接口。若希望聊天使用 Breeze，请关闭「本地接口 → TTS」。此处直连试听不受其影响。') : null,
    status?.voiceEnabled === false ? h('p', { className: 'ab-note warn' }, '语音总开关当前关闭；聊天不会发语音。直连试听仍可用于配置验证。') : null,
    h('div', { className: 'ab-flex' },
      h('select', { className: 'ab-input', value: type, 'aria-label': '音色来源', disabled: Boolean(busy), onChange: e => { setType(e.target.value); resetList() } },
        h('option', { value: 'personal' }, '我的音色'), h('option', { value: 'default' }, '平台音色'), h('option', { value: 'all' }, '全部音色')),
      h('input', { className: 'ab-input', value: search, 'aria-label': '搜索音色', maxLength: 120, placeholder: '音色名称（可选）', disabled: Boolean(busy), onChange: e => { setSearch(e.target.value); resetList() } }),
      h(ui.Btn, { disabled: Boolean(busy), onClick: () => loadVoices(false) }, busy === 'voices' ? '读取中…' : '获取音色列表')),
    voices.length ? h('div', { style: { marginTop: 12 } },
      h('select', { className: 'ab-input', value: chosen, 'aria-label': '选择 Breeze 音色', disabled: Boolean(busy) || !setSettings, onChange: e => { setSettings?.({ voiceId: e.target.value }); toast('音色已填入草稿，请点底部「保存设置」。') } },
        h('option', { value: '' }, '请选择音色'),
        chosen && !voices.some(v => v.voiceId === chosen) ? h('option', { value: chosen }, '当前：' + chosen) : null,
        voices.map(v => h('option', { key: v.voiceId, value: v.voiceId }, `${v.name} · ${v.voiceId}`))),
      hasMore ? h(ui.Btn, { disabled: Boolean(busy), onClick: () => loadVoices(true) }, '加载更多') : null) : null,
    h('p', { className: 'ab-small ab-muted' }, '列表查询不合成语音。API Key 不会出现在此处或返回给浏览器。'),
    h('label', { style: { display: 'block', marginTop: 16 } }, '试听文本（最多 200 字符）',
      h('textarea', { className: 'ab-textarea', value: text, maxLength: 400, 'aria-label': 'Breeze 试听文本', onChange: e => setText(e.target.value) })),
    h('p', { className: 'ab-note' }, '每次点击会计费；使用已保存设置，直接测试 Breeze（不走本地接口、不回退其他引擎）。超时后先看平台历史，不要连续点击。'),
    h(ui.Btn, { kind: 'primary', disabled: Boolean(busy) || !text.trim() || Array.from(text).length > 200, onClick: preview }, busy === 'test' ? '合成中，请稍候…' : 'Breeze 直连试听（计费）'),
    error ? h('p', { className: 'ab-note err', role: 'alert' }, error) : null,
    audio ? h('div', { style: { marginTop: 12 } }, h('audio', { controls: true, src: audio.url, style: { width: '100%' } }),
      h('a', { href: audio.url, download: audio.mime === 'audio/wav' ? 'breeze-preview.wav' : 'breeze-preview.mp3' }, '保存试听音频')) : null)
}
