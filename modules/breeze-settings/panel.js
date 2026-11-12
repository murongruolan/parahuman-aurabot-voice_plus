// Self-contained official user-module panel. Scoped CSS only; no host DOM changes.
// 1.4.1：情绪引擎单页 —— 引擎配置（上）+ 情绪路由（下）+ 提示词预览；图标为内嵌 SVG，不依赖外部库。
const ICON_PATHS = {
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  sliders: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
}
const icon = n => ({ dangerouslySetInnerHTML: { __html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15" aria-hidden="true">' + (ICON_PATHS[n] || '') + '</svg>' } })
const css = `
.vp{--vp-line:#dce3eb;--vp-card:#fff;--vp-text:#253247;--vp-muted:#69768a;--vp-accent:#317096;color:var(--vp-text);grid-column:1/-1;max-width:980px;width:100%;margin:0 auto;font-size:14px;line-height:1.55;position:relative}
.vp *{box-sizing:border-box}.vp h2,.vp h3,.vp p{margin:0}.vp button,.vp input,.vp textarea,.vp select{font:inherit}
.vp button{cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;flex:none;white-space:nowrap}
.vp button:disabled{opacity:.45;cursor:not-allowed}
.vp :focus-visible{outline:2px solid #7fb3ee;outline-offset:1px}
.vp .icon{display:inline-flex}.vp .icon svg{width:15px;height:15px}
.vp-head{display:flex;justify-content:space-between;align-items:center;gap:14px;margin:4px 0 2px}
.vp-head h2{font-size:22px;letter-spacing:-.4px}.vp-sub{color:var(--vp-muted);font-size:13px;margin-top:4px}
.vp-badge{border:1px solid var(--vp-line);border-radius:20px;padding:5px 12px;white-space:nowrap;font-size:12px;background:var(--vp-card)}
.vp-card{background:var(--vp-card);border:1px solid var(--vp-line);border-radius:14px;padding:18px 20px;margin-top:16px}
.vp-h3{display:flex;align-items:center;gap:10px;margin-bottom:4px}.vp-h3 h3{font-size:16px;flex:none}
.vp-hint{color:var(--vp-muted);font-size:12px;margin:6px 0 0}
.vp-btn{border:1px solid var(--vp-line);background:var(--vp-card);color:var(--vp-text);border-radius:8px;padding:7px 13px;font-size:14px}
.vp-btn:hover{border-color:#b9c6d6}.vp-btn.primary{background:var(--vp-accent);color:#fff;border-color:var(--vp-accent)}
.vp-btn.small{padding:5px 10px;font-size:12px}.vp-btn.ghost{background:transparent;border-color:transparent;color:var(--vp-muted)}
.vp-btn.danger{color:#b3454f}.vp-btn:disabled{opacity:.45;cursor:not-allowed}
.vp-input,.vp-select,.vp-textarea{width:100%;border:1px solid var(--vp-line);border-radius:8px;padding:8px 10px;font:inherit;color:var(--vp-text);background:#fff;min-width:0}
.vp-textarea{min-height:64px;resize:vertical}
.vp-input:focus,.vp-select:focus,.vp-textarea:focus{outline:2px solid #7fb3ee;outline-offset:1px}
.vp-label{display:block;font-size:12px;color:#4a5871;margin:10px 0 4px}
.vp-check{display:flex;align-items:center;gap:8px;font-size:13px;margin-top:12px;cursor:pointer}
.vp-table-wrap{overflow-x:auto}
.vp-table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}
.vp-table th{text-align:left;color:var(--vp-muted);font-weight:400;padding:8px 10px;border-bottom:1px solid var(--vp-line);white-space:nowrap}
.vp-table td{padding:10px;border-bottom:1px solid #eef1f6;vertical-align:middle}
.vp-table tr:last-child td{border-bottom:0}
.vp-badge2{display:inline-block;border-radius:6px;padding:2px 8px;font-size:12px;background:#eef3fa;color:var(--vp-accent);white-space:nowrap}
.vp-badge2.gray{background:#f0f2f6;color:var(--vp-muted)}.vp-badge2.green{background:#e8f4ec;color:#237a3c}
.vp-emo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;margin-top:12px}
.vp-emo-card{border:1px solid var(--vp-line);border-radius:12px;padding:12px 14px;background:#fbfcfe}
.vp-emo-top{display:flex;align-items:baseline;gap:8px}.vp-emo-top b{font-size:15px}
.vp-emo-code{color:#9aa7b8;font-size:12px;font-family:ui-monospace,Consolas,monospace}
.vp-emo-off{color:#b3454f;font-size:12px;margin-left:auto}
.vp-emo-fields{margin-top:8px;display:grid;gap:8px}
.vp-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.vp-row>*{min-width:0}
.vp-tabs-wrap{display:flex;align-items:center;gap:6px;flex:1;min-width:0}
.vp-tabs-label{flex:none;color:var(--vp-muted);font-size:13px}
.vp-tabs{display:flex;gap:6px;overflow-x:auto;min-width:0;padding-bottom:2px;scrollbar-width:thin}
.vp-tab2{flex:none;border:1px solid var(--vp-line);background:var(--vp-card);border-radius:16px;padding:4px 12px;font-size:12px;color:#4a5871}
.vp-tab2.on{background:var(--vp-accent);color:#fff;border-color:var(--vp-accent)}
.vp-hint-row{display:flex;align-items:center;gap:10px;margin-top:10px;flex-wrap:wrap}
.vp-hint-row .grow{flex:1 1 60px}.vp-hint-row .vp-hint{margin:0}
.vp-rail{position:absolute;right:14px;top:100px;display:flex;flex-direction:column;gap:10px;z-index:5}
.vp-rail button{display:flex;flex-direction:column;align-items:center;gap:4px;width:64px;padding:10px 4px;border:1px solid var(--vp-line);border-radius:12px;background:var(--vp-card);font-size:12px;color:var(--vp-text)}
.vp-rail button:hover{border-color:var(--vp-accent);color:var(--vp-accent)}
.vp-mask{position:absolute;inset:0;background:rgba(37,50,71,.42);border-radius:14px;display:flex;align-items:flex-start;justify-content:center;padding:40px 12px;z-index:20}
.vp-modal{background:var(--vp-card);border-radius:14px;padding:18px 20px;width:440px;max-width:100%;max-height:540px;overflow:auto;box-shadow:0 18px 50px rgba(0,0,0,.18)}
.vp-modal h3{margin:0;font-size:16px}.vp-modal .acts{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
.vp-voice-row{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--vp-line);border-radius:8px;margin-top:8px;font-size:13px}
.vp-st-row{display:grid;grid-template-columns:1fr 110px auto;gap:8px;align-items:center;margin-top:8px}
.vp-toast{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);background:#2b3648;color:#fff;border-radius:10px;padding:9px 16px;font-size:13px;z-index:40;box-shadow:0 8px 24px rgba(0,0,0,.25)}
.vp-note{padding:10px 13px;border-radius:10px;border:1px solid var(--vp-line);margin:12px 0 0;font-size:12px;background:#f6f8fb}
.vp-note.err{border-color:#e3b9bf;background:#fbeef0;color:#b3454f}
.vp-note.warn{border-color:#a17a3660;color:#8a6414}
.vp-pp{margin:12px 0 0;background:#f6f8fb;border:1px solid var(--vp-line);border-radius:10px;padding:12px 14px;font-size:12px;line-height:1.7;color:#3c4a63;overflow:auto;font-family:ui-monospace,Consolas,monospace;white-space:pre-wrap}
.vp-spin{width:24px;height:24px;border:3px solid var(--vp-line);border-top-color:var(--vp-accent);border-radius:50%;margin:28px auto 10px;animation:vp141spin .8s linear infinite}
@keyframes vp141spin{to{transform:rotate(360deg)}}
.vp-err{background:#fbeef0;border:1px solid #e3b9bf;color:#b3454f;border-radius:10px;padding:10px 12px;font-size:13px;margin-top:10px}
.vp-refbox{border:1px dashed #c3d2e2;border-radius:10px;padding:10px 12px;display:grid;gap:8px;background:#fff}
@media (max-width:760px){
  .vp-rail{position:static;flex-direction:row;justify-content:center;margin:14px auto 0}
  .vp-modal{width:100%}.vp-emo-grid{grid-template-columns:1fr}
}
`
const cssNode = () => h('style', null, css)
const seedEmotions = () => [['平静', 'calm'], ['俏皮', 'playful'], ['失落', 'down'], ['生气', 'angry'], ['兴奋', 'excited'], ['得意', 'proud'], ['娇嗔', 'whiny'], ['慵懒', 'lazy']].map(([name, code]) => ({ name, code, builtin: true, engine: null, instructions: '', strength: 'model', ref: { mode: 'none', path: '', text: '', param: '' } }))
const seedStrengths = () => [{ id: 'l1', name: '轻度', value: 2, builtin: true }, { id: 's1', name: '标准', value: 4, builtin: true }, { id: 'h1', name: '强烈', value: 6, builtin: true }]

const PINYIN = { 平静:'calm', 俏皮:'playful', 失落:'down', 生气:'angry', 兴奋:'excited', 得意:'proud', 娇嗔:'whiny', 慵懒:'lazy',
  傲娇:'aojiao', 慌张:'panic', 惊讶:'surprised', 害羞:'shy', 委屈:'wronged', 感动:'moved', 疑惑:'confused', 无语:'speechless', 悲伤:'sad', 恐惧:'fear', 温柔:'gentle' }

return function VoicePlusPanel({ toast, reload }) {
  const { useState, useEffect, useRef } = React
  const [snap, setSnap] = useState(null)
  const [S, setS] = useState(null)
  const [view, setView] = useState('live')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)
  const [fallbackInfo, setFallbackInfo] = useState(null)
  const [breaker, setBreaker] = useState(0)
  const [preview, setPreview] = useState(null)
  const live = useRef(false), locked = useRef(false), dirtyRef = useRef(false)

  const dirty = !!(snap && S) && JSON.stringify(S) !== JSON.stringify(snap)
  dirtyRef.current = dirty

  useEffect(() => {
    live.current = true
    const refresh = () => {
      if (locked.current) return
      call('/console/status').then(r => {
        if (!live.current || locked.current) return
        setSnap(r)
        setS(previous => previous || reconcile(null, r))
      }).catch(() => { if (live.current) setError('读不到控制台，请确认配套模块已启用。') })
      call('/breeze/status').then(r => {
        if (!live.current || !r || r.ok === false) return
        setBreaker(Number(r.breakerUntil) || 0)
        setFallbackInfo(r.lastFallback || null)
      }).catch(() => {})
    }
    refresh()
    const timer = setInterval(refresh, 3000)
    return () => { live.current = false; clearInterval(timer) }
  }, [])

  // 视图状态：live = 页面正在编辑的配置；预设 tab 应用后会写入 live。
  const viewRef = useRef('live')
  function reconcile(previous, r) {
    const seed = { engines: r.engines || [], emotions: r.emotions || seedEmotions(), strengths: r.strengths || seedStrengths(), presets: r.presets || [], advanced: r.advanced || {} }
    return previous ? previous : seed
  }
  function setRoute(patch) { setS(s => ({ ...s, ...patch })) }
  function applyView(target) {
    if (target === view) return
    if (view !== 'live') { const p = (S.presets || []).find(x => x.name === view); if (p && JSON.stringify(S.emotions) !== JSON.stringify(p.route.emotions)) toast('预设「' + view + '」的修改未保存，已还原为预设内容') }
    setView(target)
    if (target !== 'live') { const p = (S.presets || []).find(x => x.name === target); if (p) setRoute({ emotions: clone(p.route.emotions), strengths: clone(p.route.strengths) }) }
    setS(s => ({ ...s }))
  }
  function clone(v){ return JSON.parse(JSON.stringify(v)) }

  async function action(label, work) {
    if (locked.current) return
    locked.current = true; setBusy(label); setError('')
    try { await work() } catch (e) { if (live.current) setError(String(e.message || '操作失败')) }
    finally { locked.current = false; if (live.current) setBusy('') }
  }
  async function checked(path, body) { const r = await call(path, body); if (r.ok === false) throw new Error(r.message || '操作未完成'); return r }
  function saveAll() {
    action('save', async () => {
      const r = await checked('/console/save', { revision: snap.revision, ...clone(S) })
      if (!live.current) return
      setSnap(r); setS(reconcile(clone(S), r)); viewRef.current = view
      toast('语音设置已保存'); reload?.()
    })
  }
  function switchView(target) {
    if (target === view) return
    if (view !== 'live') { const p = (S.presets || []).find(x => x.name === view); if (p && (JSON.stringify(S.emotions) !== JSON.stringify(p.route.emotions) || JSON.stringify(S.strengths) !== JSON.stringify(p.route.strengths))) toast('预设「' + view + '」的修改未保存，已还原为预设内容') }
    setView(target); viewRef.current = target
    if (target !== 'live') { const p = (S.presets || []).find(x => x.name === target); if (p) setRoute({ emotions: clone(p.route.emotions), strengths: clone(p.route.strengths) }) }
  }
  function savePreset(mode) {
    setModal({ kind: 'preset-name', mode, name: mode === 'modify' ? view : '' })
  }
  function presetOk() {
    const name = (modal.name || '').trim()
    if (!name){ toast('请填写预设名称'); return }
    const route = clone({ emotions: S.emotions, strengths: S.strengths })
    if (modal.mode === 'save'){
      if ((S.presets || []).some(p => p.name === name)){ toast('已有同名预设，换个名字或选它后点「修改预设」'); return }
      setRoute({ presets: [...(S.presets || []), { name, route }] }); setView(name); viewRef.current = name; setModal(null); toast('预设「' + name + '」已保存')
    } else {
      setRoute({ presets: (S.presets || []).map(p => p.name === view ? { name, route } : p) }); setView(name); viewRef.current = name; setModal(null); toast('预设「' + name + '」已更新')
    }
  }
  function delPreset() {
    setRoute({ presets: (S.presets || []).filter(p => p.name !== view) }); setView('live'); viewRef.current = 'live'; setModal(null); toast('预设已删除')
  }

  const engines = S ? S.engines : []
  const emotions = S ? S.emotions : []
  const strengths = S ? S.strengths : []
  const presets = S ? S.presets : []
  const attached = emotions.filter(e => e.engine)
  const breezeOn = engines.some(e => e.type === 'breeze' && e.promptTags !== false)
  function engineName(id){ const e = engines.find(x => x.id === id); return e ? e.name : null }
  function attachCount(id){ return emotions.filter(e => e.engine === id).length }
  function isBreezeEmo(e){ const eng = engines.find(x => x.id === e.engine); return !!(eng && eng.type === 'breeze') }
  function isGptEmo(e){ const eng = engines.find(x => x.id === e.engine); return !!(eng && eng.type === 'gptsovits') }

  const btn = (label, onClick, options = {}) => h('button', { type: 'button', className: 'vp-btn' + (options.className ? ' ' + options.className : ''), disabled: Boolean(busy) || options.disabled, onClick, ...options.extra }, options.icon ? h('span', { className: 'icon', ...icon(options.icon) }) : null, label)
  const field = (label, value, onChange, options = {}) => h('label', { className: 'vp-field' }, h('span', { className: 'vp-label', style: { margin: '0 0 4px' } }, label),
    options.area ? h('textarea', { className: 'vp-textarea', value: value ?? '', disabled: Boolean(busy), placeholder: options.placeholder, onChange: e => onChange(e.target.value) })
      : h('input', { className: 'vp-input', type: options.type || 'text', value: value ?? '', disabled: Boolean(busy), placeholder: options.placeholder, min: options.min, max: options.max, onChange: e => options.type === 'number' ? onChange(e.target.value === '' ? '' : Number(e.target.value)) : onChange(e.target.value) }))
  const select = (label, value, onChange, options, extra = {}) => h('label', { className: 'vp-field' }, h('span', { className: 'vp-label', style: { margin: '0 0 4px' } }, label),
    h('select', { className: 'vp-select', value: value ?? '', disabled: Boolean(busy) || extra.disabled, onChange: e => onChange(e.target.value) }, options))

  function renderEngineTable() {
    return h('div', { className: 'vp-card' },
      h('div', { className: 'vp-h3' }, h('h3', null, '引擎配置'), btn('新增引擎', () => setModal({ kind: 'engine', draft: null }), { className: 'primary', icon: 'plus' })),
      h('p', { className: 'vp-hint' }, '情绪标记是 Breeze 专属能力，开关直接标在类型上；挂载数 = 情绪路由里使用该引擎的情绪数量。'),
      h('div', { className: 'vp-table-wrap' }, h('table', { className: 'vp-table' },
        h('thead', null, h('tr', null, ['名称', '引擎类型', '挂载数', '添加时间', ''].map((t, i) => h('th', { key: i, style: i === 4 ? { textAlign: 'right' } : null }, t)))),
        h('tbody', null, engines.length ? engines.map(e => h('tr', { key: e.id },
          h('td', null, h('b', null, e.name)),
          h('td', null, h('span', { className: 'vp-badge2' + (e.type === 'breeze' ? '' : ' gray') }, e.type === 'breeze' ? (e.promptTags ? 'Breeze·情绪开' : 'Breeze·情绪关') : 'GPT-SoVITS')),
          h('td', null, String(attachCount(e.id))),
          h('td', { style: { color: 'var(--vp-muted)' } }, e.addedAt || ''),
          h('td', { style: { textAlign: 'right', whiteSpace: 'nowrap' } },
            btn('修改', () => setModal({ kind: 'engine', draft: { ...clone(e), __edit: true } }), { className: 'small' }), ' ',
            btn('删除', () => setModal({ kind: 'confirm-del-engine', id: e.id }), { className: 'small danger' })))) : h('tr', null, h('td', { colSpan: 5, style: { color: 'var(--vp-muted)' } }, '还没有引擎，点上方「新增引擎」开始。'))))),
      h('p', { className: 'vp-hint', style: { display: engines.length ? 'none' : 'block' } }, '还没有引擎。点右上角「新增引擎」，第一个引擎会自动接管全部情绪。'))
  }

  function renderEngineModal() {
    const d = modal.draft || {}
    const breeze = d.type === 'breeze'
    return h('div', { className: 'vp-modal' }, h('h3', null, d.__edit ? '修改引擎' : '新增引擎'),
      field('引擎名称', d.name, v => setModal(m => ({ ...m, draft: { ...d, name: v } })), { placeholder: '例如 玉玲珑 / 沈妙-GPT' }),
      select('引擎类型', d.type, v => setModal(m => ({ ...m, draft: { ...d, type: v, base: v === 'breeze' ? 'https://api.breeze.blue/v1' : 'http://127.0.0.1:9880' } })), [h('option', { value: 'breeze' }, 'Breeze'), h('option', { value: 'gptsovits' }, 'GPT-SoVITS')]),
      field('服务地址', d.base, v => setModal(m => ({ ...m, draft: { ...d, base: v } }))),
      field('API Key（可留空）', d.apiKey, v => setModal(m => ({ ...m, draft: { ...d, apiKey: v } })), { type: 'password', placeholder: '留空 = 不使用鉴权' }),
      breeze ? field('Voice ID', d.voiceId, v => setModal(m => ({ ...m, draft: { ...d, voiceId: v } })), { placeholder: 'voc_…' }) : null,
      breeze ? h('div', { className: 'vp-row' }, btn('选择音色', () => setModal(m => ({ kind: 'voice-picker', draft: m.draft, query: '', loading: true, voices: null, failed: false })), { className: 'small' })) : null,
      breeze ? h('label', { className: 'vp-check' }, h('input', { type: 'checkbox', checked: d.promptTags !== false, onChange: e => setModal(m => ({ ...m, draft: { ...d, promptTags: e.target.checked } })) }), ' 情绪标记提示词（教模型写这个引擎的情绪与行内标签）') : null,
      !breeze ? h('p', { className: 'vp-hint' }, 'GPT-SoVITS：推理参数在服务端配置；本插件把文本与情绪代号发给服务地址，情绪卡片里可按情绪配参考。') : null,
      h('div', { className: 'acts' }, btn('取消', () => setModal(null)), btn('保存', saveEngine, { className: 'primary' })))
  }
  function saveEngine() {
    const d = modal.draft
    if (!d.name.trim()){ toast('请填写引擎名称'); return }
    if (!/^https?:\/\//.test(d.base.trim())){ toast('服务地址需以 http(s):// 开头'); return }
    if (d.type === 'breeze' && !d.voiceId.trim()){ toast('Breeze 引擎需要 Voice ID'); return }
    const first = engines.length === 0
    const entry = { ...clone(d), name: d.name.trim(), base: d.base.trim(), addedAt: d.addedAt || now() }
    setRoute({ engines: d.__edit ? engines.map(x => x.id === entry.id ? entry : x) : [...engines, entry] })
    if (first) setRoute({ emotions: emotions.map(e => ({ ...e, engine: entry.id })) })
    setModal(null); renderIcons(); toast(first ? '引擎已添加，全部情绪默认挂载到它' : '引擎已保存')
  }
  function delEngineYes(id){
    setRoute({ engines: engines.filter(x => x.id !== id), emotions: emotions.map(e => e.engine === id ? { ...e, engine: null, instructions: '' } : e) })
    setModal(null); renderIcons(); toast('引擎已删除')
  }
  function renderVoicePicker() {
    if (modal.voices) {
      const q = (modal.query || '').trim()
      const list = modal.voices.filter(v => !q || v.name.indexOf(q) >= 0)
      return h('div', null, field('搜索音色名称…', modal.query, v => setModal(m => ({ ...m, query: v }))),
        h('div', null, list.length ? list.map(v => h('div', { className: 'vp-voice-row', key: v.voiceId },
          h('span', null, v.name + ' ', h('span', { className: 'vp-emo-code' }, v.voiceId), ' ', h('span', { className: 'vp-badge2' + (v.origin === 'cloned' ? '' : ' gray') }, v.origin === 'cloned' ? '我的音色' : '平台')),
          btn('选择', () => { setModal(m => ({ ...m, kind: 'engine', voices: null, draft: { ...m.draft, voiceId: v.voiceId } })) }, { className: 'small primary' }))) : h('p', { className: 'vp-hint' }, '没有匹配的音色')))
    }
    if (modal.failed) {
      return h('div', null, h('div', { className: 'vp-err' }, '音色列表拉取失败：请检查「服务地址」与「API Key」（私有部署请确认服务可达），然后重试。'),
        h('div', { className: 'acts', style: { justifyContent: 'space-between' } }, btn('重试', () => setModal(m => ({ ...m, failed: false, loading: true }))), btn('取消', () => setModal(null))))
    }
    // 模拟加载态：真实环境里列表从 Breeze 服务拉取
    setTimeout(() => setModal(m => m && m.kind === 'voice-picker' ? { ...m, loading: false, voices: [], failed: true, failMsg: '音色列表拉取失败：请检查「服务地址」与「API Key」（私有部署请确认服务可达），然后重试。' } : m), 10)
    return h('div', null, h('div', { className: 'vp-spin' }), h('p', { className: 'vp-hint', style: { textAlign: 'center' } }, '正在拉取音色列表…'))
  }

  function renderEmotionCards() {
    return h('div', { className: 'vp-emo-grid' }, emotions.map(e => {
      const breeze = isBreezeEmo(e), gpt = isGptEmo(e)
      const ref = e.ref || { mode: 'none', path: '', text: '', param: '' }
      const stOff = breeze && !String(e.instructions || '').trim()
      const stOpts = [h('option', { value: 'model' }, '模型自选')].concat(strengths.map(a => h('option', { value: a.id, key: a.id }, a.name + ' ' + a.value)))
      if (typeof e.strength === 'number') stOpts.push(h('option', { value: String(e.strength), selected: true }, '自定义'))
      const refOpts = [h('option', { value: 'none' }, '不使用参考'), h('option', { value: 'path' }, '路径'), h('option', { value: 'param' }, '参数')]
      return h('div', { className: 'vp-emo-card', key: e.code },
        h('div', { className: 'vp-emo-top' }, h('b', null, e.name), h('span', { className: 'vp-emo-code' }, e.code),
          e.builtin ? null : btn('删除', () => { setRoute({ emotions: emotions.filter(x => x.code !== e.code) }); toast('情绪已删除') }, { className: 'small ghost danger' }),
          e.engine ? null : h('span', { className: 'vp-emo-off' }, '未进入提示词')),
        h('div', { className: 'emo-fields vp-emo-fields' },
          h('div', { className: 'vp-row' }, h('span', { className: 'vp-label', style: { margin: 0, minWidth: '52px' } }, '引擎'),
            select('', e.engine || '', v => setRoute({ emotions: emotions.map(x => x.code === e.code ? { ...x, engine: v || null, instructions: v ? x.instructions : '', ref: v ? x.ref : { mode: 'none', path: '', text: '', param: '' } } : x) }), [h('option', { value: '' }, '不使用')].concat(engines.map(en => h('option', { value: en.id, key: en.id }, en.name))))),
          breeze ? field('指令', e.instructions, v => setRoute({ emotions: emotions.map(x => x.code === e.code ? { ...x, instructions: v } : x) }), { area: true, placeholder: '留空 = 纯文本模式（推荐）' }) : null,
          gpt ? h('div', { className: 'vp-refbox' },
            h('div', { className: 'vp-row' }, h('span', { className: 'vp-label', style: { margin: 0, minWidth: '64px' } }, '参考配置'),
              select('', ref.mode, v => setRoute({ emotions: emotions.map(x => x.code === e.code ? { ...x, ref: { ...x.ref, mode: v, param: v === 'param' && !x.ref.param ? e.code : x.ref.param } } : x) }), refOpts)),
            ref.mode === 'path' ? field('音频路径', ref.path, v => setRoute({ emotions: emotions.map(x => x.code === e.code ? { ...x, ref: { ...x.ref, path: v } } : x) }), { placeholder: '例如 D:/refs/' + e.code + '.wav' }) : null,
            ref.mode === 'path' ? field('音频文字', ref.text, v => setRoute({ emotions: emotions.map(x => x.code === e.code ? { ...x, ref: { ...x.ref, text: v } } : x) }), { placeholder: '参考音频说的是什么' }) : null,
            ref.mode === 'param' ? field('参数', ref.param || e.code, v => setRoute({ emotions: emotions.map(x => x.code === e.code ? { ...x, ref: { ...x.ref, param: v } } : x) })) : null) : null,
          h('div', { className: 'vp-row' }, h('span', { className: 'vp-label', style: { margin: 0, minWidth: '52px' } }, '强度'),
            stOff ? h('span', { className: 'vp-hint', style: { margin: 0 } }, '纯文本模式：guidance 恒 1.0，音色相似度增强生效')
              : select('', typeof e.strength === 'number' ? String(e.strength) : e.strength, v => setRoute({ emotions: emotions.map(x => x.code === e.code ? { ...x, strength: v === '__custom' ? 4 : v === 'model' ? 'model' : v } : x) }), stOpts),
            typeof e.strength === 'number' ? field('', e.strength, v => setRoute({ emotions: emotions.map(x => x.code === e.code ? { ...x, strength: Number(v) || 1 } : x) }), { type: 'number', min: 1, max: 10 }) : null)))
    }))
  }
  function renderPrompt() {
    const lines = ['- 写 <voice>…</voice> 里的语音内容时，句子之间用中文标点（，。！？）分隔，不要只靠空格分开几句话。']
    if (attached.length) lines.push('- 语音可带情绪标记：<voice> 开头写 [情绪:强度]。可选情绪：' + attached.map(e => e.code + ' ' + e.name).join(' / ') + '；强度：' + (strengths.length ? strengths.map(a => a.name).join('/') : 'L 轻 / M 标准 / H 强烈') + '，或由你自己判断。没有情绪就不写标记。')
    if (breezeOn) lines.push('- 需要副语言时在句中或句尾加 [whisper 气声] / [cry 哭腔] / [laugh 笑腔] / [sigh 叹气]，也可以直接用 Breeze 行内标签如 [笑] [叹气] [耳语] [哭声]。')
    if (!attached.length) lines.push('-（没有挂载引擎的情绪：本条情绪标记规则整体不注入）')
    return h('div', { className: 'vp-card' }, h('div', { className: 'vp-h3' }, h('h3', null, '提示词预览'), h('span', { className: 'vp-hint', style: { margin: 0 } }, '随上面的配置实时变化；未挂引擎的情绪不会出现在这里')), h('pre', { className: 'vp-pp' }, lines.join('\n')))
  }
  function renderStrengthModal() {
    return h('div', { className: 'vp-modal' }, h('h3', null, '强度'), h('p', { className: 'vp-hint' }, '情绪卡片选「模型自选」时，模型写的强度按这里的档位换算 guidance；仅在填了指令的 Breeze 引擎上生效。'),
      h('div', null, strengths.map(a => h('div', { className: 'vp-st-row', key: a.id },
        h('input', { className: 'vp-input', value: a.name, readOnly: a.builtin, style: a.builtin ? { background: '#f0f2f6' } : null, onChange: e => setRoute({ strengths: strengths.map(x => x.id === a.id ? { ...x, name: e.target.value } : x) }) }),
        h('input', { className: 'vp-input', type: 'number', min: 1, max: 10, value: a.value, onChange: e => setRoute({ strengths: strengths.map(x => x.id === a.id ? { ...x, value: Math.max(1, Math.min(10, Number(e.target.value) || 1)) } : x) }) }),
        a.builtin ? h('span', { className: 'vp-badge2 gray' }, '默认') : btn('删除', () => { setRoute({ strengths: strengths.filter(x => x.id !== a.id), emotions: emotions.map(e => e.strength === a.id ? { ...e, strength: 'model' } : e) }); toast('强度档已删除，用到它的情绪已回落「模型自选」') }, { className: 'small danger' })))),
      h('div', { className: 'acts', style: { justifyContent: 'space-between' } }, btn('添加自定义', () => setRoute({ strengths: [...strengths, { id: 'c' + Date.now(), name: '自定义 ' + (strengths.length + 1), value: 4, builtin: false }] }), { icon: 'plus' }), btn('完成', () => setModal(null), { className: 'primary' })))
  }
  function renderPreviewModal() {
    return h('div', { className: 'vp-modal', style: { width: '520px' } }, h('h3', null, '试听'), h('p', { className: 'vp-hint' }, '使用当前配置的实际合成路径；远程合成会计费，不自动重试。'),
      field('试听文本', preview.text, v => setPreview(p => ({ ...p, text: v })), { area: true }),
      field('情绪标记（可选，按提示词格式写）', preview.tag, v => setPreview(p => ({ ...p, tag: v })), { placeholder: '例如 [excited:H] 或 [laugh]' }),
      h('div', { className: 'acts', style: { justifyContent: 'flex-start' } }, btn('生成试听', doPreview, { className: 'primary', disabled: Boolean(preview.busy) }), h('span', { className: 'vp-hint', style: { margin: 0 } }, preview.msg || '')),
      preview.out || null)
  }
  async function doPreview() {
    const text = (preview.text || '').trim()
    if (!text){ toast('请填写试听文本'); return }
    setPreview(p => ({ ...p, busy: true, msg: '合成中，请稍候…', out: null }))
    try {
      const r = await checked('/console/test', { text, tag: preview.tag || '', revision: snap.revision })
      if (!live.current) return
      const mime = r.mime === 'audio/ogg' ? 'ogg' : r.mime === 'audio/mpeg' ? 'mp3' : 'wav'
      setPreview(p => ({ ...p, busy: false, msg: '', out: h('div', { className: 'player' }, h('audio', { controls: true, src: 'data:' + r.mime + ';base64,' + r.data, style: { width: '100%', marginTop: '10px' } }), h('p', { className: 'vp-hint' }, '本次实际引擎：' + r.engine)) }))
      toast('合成成功 · ' + r.engine)
    } catch (e) {
      setPreview(p => ({ ...p, busy: false, msg: '' }))
      setError(String(e.message || '试听失败'))
    }
  }
  function now(){ const d = new Date(); function p(n){ return (n < 10 ? '0' : '') + n }; return d.getFullYear() + '-' + p(d.getMonth()+1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) }


  if (!snap || !S) return h('div', { className: 'vp' }, cssNode(), h('p', { className: 'vp-hint' }, error || '正在读取语音设置…'))
  const tabList = [h('button', { type: 'button', className: 'vp-tab2' + (view === 'live' ? ' on' : ''), key: 'live', onClick: () => switchView('live') }, '当前')].concat(presets.map(p => h('button', { type: 'button', className: 'vp-tab2' + (view === p.name ? ' on' : ''), key: p.name, onClick: () => switchView(p.name) }, p.name)))

  return h('div', { className: 'vp' }, cssNode(),
    error ? h('div', { className: 'vp-note err', role: 'alert' }, error) : null,
    h('div', { className: 'vp-head' }, h('div', null, h('h2', null, '让每句话，有自己的声音'), h('div', { className: 'vp-sub' }, '增强语音 · 情绪引擎 / 引擎与情绪路由都在这一页')), h('span', { className: 'vp-badge' }, '当前：增强语音')),
    h('div', { className: 'vp-rail' },
      btn('试听', () => setPreview({ text: '你好，今天也要照顾好自己。', tag: '', msg: '', out: null }), { icon: 'play' }),
      btn('强度', () => setModal({ kind: 'strength' }), { icon: 'sliders' })),
    renderEngineTable(),
    h('section', { className: 'vp-card' },
      h('div', { className: 'vp-h3' }, h('h3', null, '情绪路由'),
        h('div', { className: 'vp-tabs-wrap' }, h('span', { className: 'vp-tabs-label' }, '预设：'), h('div', { className: 'vp-tabs' }, tabList)),
        btn('添加情绪', () => setModal({ kind: 'add-emo', name: '', code: '' }), { icon: 'plus' })),
      h('div', { className: 'hint-row' }, h('span', { className: 'vp-hint' }, '每种情绪单独配置；「不使用」引擎的情绪不会进入提示词。'), h('span', { className: 'grow' }),
        btn(view === 'live' ? '保存预设' : '修改预设', () => savePreset(view === 'live' ? 'save' : 'modify'), { className: 'small primary' }),
        h('button', { type: 'button', className: 'vp-btn small danger', style: { display: view === 'live' ? 'none' : '' }, onClick: () => setModal({ kind: 'confirm-del-preset' }) }, '删除预设')),
      h('div', { className: 'vp-emo-grid' }, renderEmotionCards())),
    renderPrompt(),
    breaker && Date.now() < breaker ? h('div', { className: 'vp-note warn' }, 'Breeze 额度熔断中（连续 402×3）：Breeze 腿暂停，约 ' + Math.ceil((breaker - Date.now()) / 60000) + ' 分钟后自动恢复。') : null,
    fallbackInfo ? h('div', { className: 'vp-note warn' }, '上次远程语音回退：' + new Date(fallbackInfo.at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) + ' · ' + fallbackInfo.reason) : null,
    modal ? h('div', { className: 'vp-mask', onClick: ev => { if (ev.target === ev.currentTarget) setModal(null) } },
      modal.kind === 'engine' ? renderEngineModal() : modal.kind === 'voice-picker' ? renderVoicePicker() : modal.kind === 'strength' ? renderStrengthModal() : modal.kind === 'preview' ? renderPreviewModal() : modal.kind === 'add-emo' ? renderAddEmo() : modal.kind === 'preset-name' ? renderPresetName() : modal.kind === 'confirm-del-engine' ? renderConfirm('删除引擎', '删除「' + engineName(modal.id) + '」后，它挂载的 ' + attachCount(modal.id) + ' 个情绪会变为「不使用」（不进入提示词）。确定删除？', () => delEngineYes(modal.id)) : modal.kind === 'confirm-del-preset' ? renderConfirm('删除预设', '删除预设「' + view + '」？只影响这套预设，页面正在显示的配置和引擎列表都不会变。', () => delPreset()) : null) : null,
)
function renderAddEmo(){
  return h('div', { className: 'vp-modal' }, h('h3', null, '添加情绪'),
    field('情绪名称', modal.name, v => setModal(m => { const name = v.trim(); m.name = v; m.code = PINYIN[name] || (name ? 'emo' + (emotions.length + 1) : '') }), { placeholder: '例如 傲娇 / 慌张' }),
    field('情绪代号（发给 LLM 的标记，小写英文）', modal.code, v => setModal(m => ({ ...m, code: v })), { placeholder: '自动生成，可修改' }),
    h('p', { className: 'vp-hint' }, '新情绪默认「不使用」，挂上引擎后才会进入提示词。'),
    h('div', { className: 'acts' }, btn('取消', () => setModal(null)), btn('保存', saveEmotion, { className: 'primary' })))
}
function renderPresetName(){
  return h('div', { className: 'vp-modal' }, h('h3', null, modal.mode === 'save' ? '保存为预设' : '修改预设'),
    h('p', { className: 'vp-hint' }, modal.mode === 'save' ? '会把当前的情绪路由（每种情绪的引擎、指令、强度）与强度档位存为一套预设；引擎列表不在预设里。' : '会把当前情绪路由与强度档位写回这套预设；改名字就是另存一套。'),
    field('预设名称', modal.name || '', v => setModal(m => ({ ...m, name: v })), { placeholder: '例如 玉玲珑 / 沈妙安静版' }),
    h('div', { className: 'acts' }, btn('取消', () => setModal(null)), btn('确定', presetOk, { className: 'primary' })))
}
function renderConfirm(title, text, onYes){
  return h('div', { className: 'vp-modal' }, h('h3', null, title), h('p', { className: 'vp-hint', style: { fontSize: '13px', marginTop: '8px' } }, text),
    h('div', { className: 'acts' }, btn('取消', () => setModal(null)), btn('确认删除', () => { onYes() }, { className: 'danger' })))
}
}
