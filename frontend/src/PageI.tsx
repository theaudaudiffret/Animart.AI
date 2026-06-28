import { useRef, useState } from 'react'
import type { ArtworkSummary, Caption, VisitorProfile } from './types'

const MAX_PX = 1600
const JPEG_QUALITY = 0.85
const ONBOARDED_KEY = 'genz-museum-onboarded'

const AGE_OPTIONS = ['Child (under 12)', 'Teen (12-17)', 'Adult (18-64)', 'Senior (65+)']
const LEVEL_OPTIONS = ['Novice', 'Amateur', 'Expert']
const INTEREST_OPTIONS = ['History & context', 'Unusual anecdotes', 'Artistic technique', 'Symbolism & interpretation']
const TONE_OPTIONS = ['Playful', 'Serious']

function resizeImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, MAX_PX / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Empty canvas'))),
        'image/jpeg',
        JPEG_QUALITY,
      )
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mimeType })
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error'
type AudioMode = 'narrate' | 'immersive'

type State =
  | { status: 'onboarding' }
  | { status: 'idle' }
  | { status: 'loading'; preview: string }
  | { status: 'result'; preview: string; data: ArtworkSummary }
  | { status: 'error'; preview: string; message: string }

export default function PageI({ onArtistFound, onNewProfile, hidden }: {
  onArtistFound: (id: string) => void; onNewProfile: () => void; hidden: boolean
}) {
  const [state, setState] = useState<State>(() =>
    localStorage.getItem(ONBOARDED_KEY) ? { status: 'idle' } : { status: 'onboarding' },
  )
  const [narrLoad, setNarrLoad] = useState<LoadState>('idle')
  const [immLoad, setImmLoad] = useState<LoadState>('idle')
  const [playing, setPlaying] = useState<AudioMode | null>(null)
  const [narrProgress, setNarrProgress] = useState({ cur: 0, dur: 0 })
  const [immProgress, setImmProgress] = useState({ cur: 0, dur: 0 })
  const [captions, setCaptions] = useState<Caption[]>([])
  const [captionIndex, setCaptionIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const narrRef = useRef<HTMLAudioElement | null>(null)
  const immRef = useRef<HTMLAudioElement | null>(null)

  async function handleFile(file: File) {
    const preview = URL.createObjectURL(file)
    setState({ status: 'loading', preview })
    try {
      const blob = await resizeImage(file)
      const form = new FormData()
      form.append('file', blob, 'photo.jpg')
      const res = await fetch('/analyze', { method: 'POST', body: form })
      if (!res.ok) throw new Error(`Erreur serveur (${res.status})`)
      const data: ArtworkSummary = await res.json()
      if (data.artist_id && !data.in_session) onArtistFound(data.artist_id)
      clearAudio()
      setState({ status: 'result', preview, data })
      loadAudio('narrate', data)
    } catch (err) {
      setState({ status: 'error', preview, message: (err as Error).message })
    }
  }

  function refFor(mode: AudioMode) {
    return mode === 'narrate' ? narrRef : immRef
  }

  function setProgressFor(mode: AudioMode) {
    return mode === 'narrate' ? setNarrProgress : setImmProgress
  }

  async function loadAudio(mode: AudioMode, data: ArtworkSummary) {
    const setLoad = mode === 'narrate' ? setNarrLoad : setImmLoad
    const setProgress = setProgressFor(mode)
    setLoad('loading')
    try {
      const res = await fetch(mode === 'narrate' ? '/narrate' : '/immersive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()

      let blob: Blob
      let sceneCaptions: Caption[] = []
      if (mode === 'immersive') {
        const body: { audio_base64: string; captions: Caption[] } = await res.json()
        blob = base64ToBlob(body.audio_base64, 'audio/mpeg')
        sceneCaptions = body.captions
        setCaptions(sceneCaptions)
      } else {
        blob = await res.blob()
      }

      const audio = new Audio(URL.createObjectURL(blob))
      audio.onended = () => {
        setPlaying(null)
        setProgress((p) => ({ ...p, cur: p.dur }))
      }
      audio.onerror = () => setLoad('error')
      audio.ontimeupdate = () => {
        setProgress({ cur: audio.currentTime, dur: audio.duration || 0 })
        if (mode === 'immersive') {
          const t = audio.currentTime
          const idx = sceneCaptions.findIndex((caption) => t >= caption.start && t < caption.end)
          if (idx !== -1) setCaptionIndex(idx)
        }
      }
      refFor(mode).current = audio
      setLoad('ready')
    } catch {
      setLoad('error')
    }
  }

  // Only one audio plays at a time: starting one always pauses the other.
  function play(mode: AudioMode) {
    const other = mode === 'narrate' ? immRef : narrRef
    other.current?.pause()
    const audio = refFor(mode).current
    if (!audio) return
    if (audio.ended) audio.currentTime = 0
    audio.play()
    setPlaying(mode)
  }

  function toggle(mode: AudioMode) {
    if (playing === mode) {
      refFor(mode).current?.pause()
      setPlaying(null)
    } else {
      play(mode)
    }
  }

  // Manual trigger: pause the narrator, load the immersive scene, then play it.
  async function startImmersive(data: ArtworkSummary) {
    narrRef.current?.pause()
    setPlaying(null)
    await loadAudio('immersive', data)
    play('immersive')
  }

  function restart(mode: AudioMode) {
    const audio = refFor(mode).current
    if (!audio) return
    audio.currentTime = 0
    setProgressFor(mode)((p) => ({ ...p, cur: 0 }))
    play(mode)
  }

  function seek(mode: AudioMode, fraction: number) {
    const audio = refFor(mode).current
    if (!audio || !audio.duration) return
    const cur = fraction * audio.duration
    audio.currentTime = cur
    setProgressFor(mode)({ cur, dur: audio.duration })
  }

  function clearAudio() {
    narrRef.current?.pause()
    immRef.current?.pause()
    narrRef.current = null
    immRef.current = null
    setNarrLoad('idle')
    setImmLoad('idle')
    setPlaying(null)
    setNarrProgress({ cur: 0, dur: 0 })
    setImmProgress({ cur: 0, dur: 0 })
    setCaptions([])
    setCaptionIndex(0)
  }

  function reset() {
    clearAudio()
    setState({ status: 'idle' })
    if (inputRef.current) inputRef.current.value = ''
  }

  async function newProfile() {
    if (!confirm('Archive the current visit and create a new profile?')) return
    try {
      await fetch('/new-profile', { method: 'POST' })
    } finally {
      clearAudio()
      onNewProfile()
      localStorage.removeItem(ONBOARDED_KEY)
      setState({ status: 'onboarding' })
    }
  }

  return (
    <div style={{ ...s.page, display: hidden ? 'none' : 'flex' }}>
      <h1 style={s.h1}>Scan an artwork</h1>

      {state.status === 'onboarding' && (
        <Onboarding onDone={() => { localStorage.setItem(ONBOARDED_KEY, '1'); setState({ status: 'idle' }) }} />
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />

      {state.status === 'idle' && (
        <div style={s.idleWrap}>
          <button style={s.cameraBtn} onClick={() => inputRef.current?.click()}>
            <svg width="28" height="24" viewBox="0 0 28 24" fill="none">
              <path d="M9.5 4.5L8 7H3a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 3 22h22a1.5 1.5 0 0 0 1.5-1.5v-12A1.5 1.5 0 0 0 25 7h-5l-1.5-2.5z" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" fill="none"/>
              <circle cx="14" cy="14" r="4.5" stroke="#fff" strokeWidth="1.6"/>
              <circle cx="22.5" cy="9.5" r="1" fill="#fff"/>
            </svg>
          </button>
          <span style={s.cameraLabel}>Take a photo</span>
          <button style={s.btnSecondary} onClick={newProfile}>New profile</button>
        </div>
      )}

      {state.status !== 'idle' && state.status !== 'onboarding' && (
        <img src={state.preview} alt="" style={s.preview} />
      )}

      {state.status === 'loading' && (
        <div style={s.spinnerWrap}>
          <div style={s.spinner} />
          <span style={s.dim}>Analyzing…</span>
        </div>
      )}

      {state.status === 'error' && (
        <>
          <p style={s.error}>{state.message}</p>
          <button style={s.btn} onClick={reset}>Try again</button>
        </>
      )}

      {state.status === 'result' && (
        <Result
          data={state.data}
          onReset={reset}
          narrLoad={narrLoad}
          immLoad={immLoad}
          playing={playing}
          narrProgress={narrProgress}
          immProgress={immProgress}
          onToggle={toggle}
          onRestart={restart}
          onSeek={seek}
          onImmersiveLoad={() => startImmersive(state.data)}
          captions={captions}
          captionIndex={captionIndex}
        />
      )}
    </div>
  )
}

function Onboarding({ onDone }: { onDone: () => void }) {
  const [ageRange, setAgeRange] = useState<string | null>(null)
  const [level, setLevel] = useState<string | null>(null)
  const [interests, setInterests] = useState<string[]>([])
  const [tone, setTone] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const canSubmit = ageRange !== null && level !== null && tone !== null && !submitting

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    const profile: VisitorProfile = { age_range: ageRange!, level: level!, interests, tone: tone! }
    try {
      await fetch('/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) })
    } finally {
      onDone()
    }
  }

  return (
    <div style={s.col}>
      <p style={s.dim}>A few questions to tailor the guide to you.</p>
      <Choice label="Your age" options={AGE_OPTIONS} value={ageRange} onChange={setAgeRange} />
      <Choice label="Your art level" options={LEVEL_OPTIONS} value={level} onChange={setLevel} />
      <MultiChoice label="What interests you" options={INTEREST_OPTIONS} values={interests}
        onToggle={(i) => setInterests((p) => p.includes(i) ? p.filter((x) => x !== i) : [...p, i])} />
      <Choice label="Your preferred tone" options={TONE_OPTIONS} value={tone} onChange={setTone} />
      <button style={{ ...s.submitBtn, opacity: canSubmit ? 1 : 0.45 }} disabled={!canSubmit} onClick={submit}>
        {submitting ? 'Preparing…' : 'Start the visit'}
      </button>
    </div>
  )
}

function Choice({ label, options, value, onChange }: {
  label: string; options: string[]; value: string | null; onChange: (v: string) => void
}) {
  return (
    <div style={s.group}>
      <div style={s.groupLabel}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {options.map((opt) => (
          <button key={opt} type="button"
            style={{ ...s.chip, ...(value === opt ? s.chipOn : {}) }}
            onClick={() => onChange(opt)}>{opt}</button>
        ))}
      </div>
    </div>
  )
}

function MultiChoice({ label, options, values, onToggle }: {
  label: string; options: string[]; values: string[]; onToggle: (v: string) => void
}) {
  return (
    <div style={s.group}>
      <div style={s.groupLabel}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {options.map((opt) => (
          <button key={opt} type="button"
            style={{ ...s.chip, ...(values.includes(opt) ? s.chipOn : {}) }}
            onClick={() => onToggle(opt)}>{opt}</button>
        ))}
      </div>
    </div>
  )
}

const AUDIO_COLOR: Record<AudioMode, string> = {
  narrate: '#2563eb',   // blue
  immersive: '#ea580c', // orange
}

function fmtTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const r = Math.floor(sec % 60)
  return `${m}:${r.toString().padStart(2, '0')}`
}

function Scrubber({ frac, onSeek }: { frac: number; onSeek: (fraction: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const seeking = useRef(false)
  function fractionAt(clientX: number) {
    const el = trackRef.current
    if (!el) return 0
    const r = el.getBoundingClientRect()
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width))
  }
  return (
    <div
      ref={trackRef}
      style={s.scrubTrack}
      onPointerDown={(e) => { seeking.current = true; e.currentTarget.setPointerCapture(e.pointerId); onSeek(fractionAt(e.clientX)) }}
      onPointerMove={(e) => { if (seeking.current) onSeek(fractionAt(e.clientX)) }}
      onPointerUp={(e) => { seeking.current = false; e.currentTarget.releasePointerCapture(e.pointerId) }}
    >
      <div style={{ ...s.scrubFill, width: `${frac * 100}%` }} />
      <div style={{ ...s.scrubKnob, left: `${frac * 100}%` }} />
    </div>
  )
}

// WhatsApp-style player row — play/pause, seek bar, time, restart.
function PlayerRow({ num, color, playing, cur, dur, onToggle, onRestart, onSeek }: {
  num: number
  color: string
  playing: boolean
  cur: number
  dur: number
  onToggle: () => void
  onRestart: () => void
  onSeek: (fraction: number) => void
}) {
  const frac = dur ? cur / dur : 0
  return (
    <div style={{ ...s.playerRow, background: color }}>
      <span style={s.audioBtnNum}>{num}</span>
      <button style={s.playerIcon} onClick={onToggle}>{playing ? '⏸' : '▶'}</button>
      <Scrubber frac={frac} onSeek={onSeek} />
      <span style={s.playerTime}>{fmtTime(cur)}</span>
      <button style={s.playerIcon} onClick={onRestart} title="Restart">↺</button>
    </div>
  )
}

// Button 1 (blue): the narrator player, or a disabled label while loading.
function NarratorPlayer({ load, playing, cur, dur, onToggle, onRestart, onSeek }: {
  load: LoadState
  playing: boolean
  cur: number
  dur: number
  onToggle: () => void
  onRestart: () => void
  onSeek: (fraction: number) => void
}) {
  if (load !== 'ready') {
    const label = load === 'loading' ? 'Loading narrator…'
      : load === 'error' ? 'Narration unavailable' : 'Narrator'
    return (
      <div style={{ ...s.audioBtn, background: AUDIO_COLOR.narrate, opacity: 0.55, cursor: 'default' }}>
        <span style={s.audioBtnNum}>1</span>{label}
      </div>
    )
  }
  return (
    <PlayerRow num={1} color={AUDIO_COLOR.narrate} playing={playing} cur={cur} dur={dur}
      onToggle={onToggle} onRestart={onRestart} onSeek={onSeek} />
  )
}

// Button 2 (orange): unlocks once the narrator is ready; tapping it loads the
// scene (if needed) and plays it. Once loaded it becomes a full player.
function ImmersivePlayer({ load, narrReady, playing, cur, dur, onToggle, onRestart, onSeek, onLoad }: {
  load: LoadState
  narrReady: boolean
  playing: boolean
  cur: number
  dur: number
  onToggle: () => void
  onRestart: () => void
  onSeek: (fraction: number) => void
  onLoad: () => void
}) {
  if (load === 'ready') {
    return (
      <PlayerRow num={2} color={AUDIO_COLOR.immersive} playing={playing} cur={cur} dur={dur}
        onToggle={onToggle} onRestart={onRestart} onSeek={onSeek} />
    )
  }
  const enabled = (load === 'idle' || load === 'error') && narrReady
  const label = load === 'loading' ? 'Creating the scene…'
    : load === 'error' ? 'Scene unavailable' : 'Immersive scene'
  return (
    <button
      style={{ ...s.audioBtn, background: AUDIO_COLOR.immersive, opacity: enabled ? 1 : 0.55, cursor: enabled ? 'pointer' : 'default' }}
      disabled={!enabled}
      onClick={enabled ? onLoad : undefined}
    >
      <span style={s.audioBtnNum}>2</span>
      {label}
    </button>
  )
}

function Result({
  data, onReset, narrLoad, immLoad, playing, narrProgress, immProgress, onToggle, onRestart, onSeek, onImmersiveLoad,
  captions, captionIndex,
}: {
  data: ArtworkSummary
  onReset: () => void
  narrLoad: LoadState
  immLoad: LoadState
  playing: AudioMode | null
  narrProgress: { cur: number; dur: number }
  immProgress: { cur: number; dur: number }
  onToggle: (mode: AudioMode) => void
  onRestart: (mode: AudioMode) => void
  onSeek: (mode: AudioMode, fraction: number) => void
  onImmersiveLoad: () => void
  captions: Caption[]
  captionIndex: number
}) {
  return (
    <div style={s.col}>
      <div style={s.audioChoice}>
        <NarratorPlayer
          load={narrLoad}
          playing={playing === 'narrate'}
          cur={narrProgress.cur}
          dur={narrProgress.dur}
          onToggle={() => onToggle('narrate')}
          onRestart={() => onRestart('narrate')}
          onSeek={(f) => onSeek('narrate', f)}
        />
        <ImmersivePlayer
          load={immLoad}
          narrReady={narrLoad === 'ready'}
          playing={playing === 'immersive'}
          cur={immProgress.cur}
          dur={immProgress.dur}
          onToggle={() => onToggle('immersive')}
          onRestart={() => onRestart('immersive')}
          onSeek={(f) => onSeek('immersive', f)}
          onLoad={onImmersiveLoad}
        />
      </div>
      {captions.length > 0 && (
        <Card label="Dialogue">
          <div style={s.captionsText}>
            {captions.map((caption, index) => (
              <span key={`${caption.start}-${index}`} style={index === captionIndex ? s.captionActive : s.captionWord}>
                {caption.text}{' '}
              </span>
            ))}
          </div>
        </Card>
      )}
      <Card label="Title" value={data.titre_probable ?? '—'} large />
      <Card label="Artist" value={data.artiste_probable ?? '—'} large />
      <Card label="Style" value={data.style} />
      {data.epoque && <Card label="Period" value={data.epoque} />}
      {data.technique && <Card label="Technique" value={data.technique} />}
      <Card label="Description" value={data.description} />
      <Card label="Mood" value={data.ambiance} />
      <Card label="Subjects"><Chips items={data.sujets} /></Card>
      <Card label="Dominant colors">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 2 }}>
          {data.couleurs_dominantes.map((c) => (
            <span key={c} style={{ ...s.dot, background: c.toLowerCase(), border: '1px solid rgba(0,0,0,.1)' }} />
          ))}
        </div>
      </Card>
      <button style={{ ...s.btn, marginTop: 4 }} onClick={onReset}>New photo</button>
    </div>
  )
}

function Card({ label, value, large, children }: {
  label: string; value?: string; large?: boolean; children?: React.ReactNode
}) {
  return (
    <div style={s.card}>
      <div style={s.cardLabel}>{label}</div>
      {value !== undefined && <div style={large ? s.cardLg : s.cardVal}>{value}</div>}
      {children}
    </div>
  )
}

function Chips({ items }: { items: string[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map((t) => <span key={t} style={s.chip}>{t}</span>)}
    </div>
  )
}

const PLAYFAIR = "'Playfair Display', Georgia, serif"
const SANS = "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif"

const s = {
  page: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '1.5rem', padding: '2rem 1.2rem 1rem', width: '100%', maxWidth: 500, margin: '0 auto' },
  col: { width: '100%', display: 'flex', flexDirection: 'column' as const, gap: '1rem' },
  h1: { fontFamily: PLAYFAIR, fontSize: '1.6rem', fontWeight: 400, letterSpacing: '.01em', color: '#1c1812' },

  idleWrap: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '1rem', paddingTop: '1.5rem' },
  cameraBtn: {
    width: 80, height: 80, borderRadius: '50%',
    background: 'linear-gradient(135deg, #c9a84c, #a67c2a)',
    border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', boxShadow: '0 4px 20px rgba(166,124,42,.35)',
  },
  cameraLabel: { fontFamily: SANS, fontSize: '.65rem', letterSpacing: '.15em', textTransform: 'uppercase' as const, color: '#1c1812', opacity: 0.45 },
  btn: { background: '#1c1812', color: '#f7f4ef', border: 'none', borderRadius: 8, padding: '.85rem 2rem', fontSize: '.88rem', fontWeight: 600, letterSpacing: '.04em', cursor: 'pointer', width: '100%', maxWidth: 320, fontFamily: SANS },
  btnSecondary: { background: 'none', color: '#1c1812', border: 'none', fontSize: '.75rem', opacity: 0.35, cursor: 'pointer', textDecoration: 'underline' as const, fontFamily: SANS },
  audioChoice: { display: 'flex', flexDirection: 'column' as const, gap: 8, width: '100%' },
  audioBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, border: 'none', borderRadius: 8, padding: '.7rem 1.4rem', fontSize: '.82rem', fontWeight: 600, letterSpacing: '.05em', color: '#fff', cursor: 'pointer', width: '100%', textAlign: 'center' as const, fontFamily: SANS, transition: 'opacity .15s', boxShadow: '0 1px 4px rgba(0,0,0,.12)' },
  audioBtnNum: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,.25)', fontSize: '.72rem', fontWeight: 700, flexShrink: 0 },
  playerRow: { display: 'flex', alignItems: 'center', gap: 10, borderRadius: 8, padding: '.55rem .9rem', width: '100%', color: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.12)' },
  playerIcon: { background: 'rgba(255,255,255,.22)', border: 'none', color: '#fff', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', fontSize: '.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: SANS },
  playerTime: { fontFamily: SANS, fontSize: '.68rem', fontVariantNumeric: 'tabular-nums' as const, opacity: 0.85, flexShrink: 0, minWidth: 30, textAlign: 'right' as const },
  scrubTrack: { position: 'relative' as const, flex: 1, height: 16, display: 'flex', alignItems: 'center', cursor: 'pointer', touchAction: 'none' as const, background: 'linear-gradient(rgba(255,255,255,.3),rgba(255,255,255,.3)) center/100% 4px no-repeat' },
  scrubFill: { position: 'absolute' as const, left: 0, top: '50%', height: 4, borderRadius: 2, background: '#fff', transform: 'translateY(-50%)' },
  scrubKnob: { position: 'absolute' as const, top: '50%', width: 12, height: 12, borderRadius: '50%', background: '#fff', transform: 'translate(-50%,-50%)', boxShadow: '0 1px 3px rgba(0,0,0,.3)' },
  preview: { width: '100%', borderRadius: 10, objectFit: 'cover' as const, aspectRatio: '4/3' as const, boxShadow: '0 2px 16px rgba(0,0,0,.1)' },
  spinnerWrap: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 14 },
  spinner: { width: 40, height: 40, border: '3px solid #e4ddd3', borderTopColor: '#c9a84c', borderRadius: '50%', animation: 'spin .8s linear infinite' },
  dim: { opacity: 0.45, fontSize: '.88rem', fontFamily: SANS, color: '#1c1812' },
  error: { color: '#c0392b', textAlign: 'center' as const, fontSize: '.9rem', fontFamily: SANS },

  card: { background: '#ffffff', border: '1px solid #e8e2d8', borderRadius: 10, padding: '1rem 1.2rem', boxShadow: '0 1px 4px rgba(0,0,0,.05)' },
  cardLabel: { fontFamily: PLAYFAIR, fontStyle: 'italic', fontSize: '.65rem', letterSpacing: '.1em', color: '#1c1812', opacity: 0.38, marginBottom: 5 },
  cardVal: { fontSize: '.95rem', lineHeight: 1.6, fontFamily: SANS, color: '#1c1812' },
  cardLg: { fontFamily: PLAYFAIR, fontSize: '1.25rem', fontWeight: 400, lineHeight: 1.35, color: '#1c1812' },
  captionsText: { fontSize: '.95rem', lineHeight: 1.75, fontFamily: SANS },
  captionWord: { opacity: 0.35 },
  captionActive: { opacity: 1, color: '#a67c2a', fontWeight: 600 },

  group: { display: 'flex', flexDirection: 'column' as const, gap: 10 },
  groupLabel: { fontFamily: PLAYFAIR, fontStyle: 'italic', fontSize: '.7rem', letterSpacing: '.06em', color: '#1c1812', opacity: 0.5 },

  chip: { background: '#f0ece4', color: '#1c1812', border: '1px solid #e4ddd3', borderRadius: 6, padding: '5px 12px', fontSize: '.82rem', cursor: 'pointer', fontFamily: SANS },
  chipOn: { background: '#1c1812', color: '#f7f4ef', border: '1px solid #1c1812' },

  submitBtn: { width: '100%', background: '#1c1812', color: '#f7f4ef', border: 'none', borderRadius: 8, padding: '.9rem', fontSize: '.88rem', letterSpacing: '.06em', fontWeight: 600, cursor: 'pointer', fontFamily: SANS },

  dot: { width: 18, height: 18, borderRadius: '50%', flexShrink: 0, display: 'inline-block' },
} as const
