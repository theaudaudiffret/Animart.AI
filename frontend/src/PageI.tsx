import { useRef, useState } from 'react'
import type { ArtworkSummary, Caption } from './types'
import { api, type Me } from './api'

const MAX_PX = 1600
const JPEG_QUALITY = 0.85

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

type LoadState = 'idle' | 'loading' | 'ready' | 'error'
type AudioMode = 'narrate' | 'immersive'

type State =
  | { status: 'idle' }
  | { status: 'loading'; preview: string }
  | { status: 'result'; preview: string; data: ArtworkSummary }
  | { status: 'error'; preview: string; message: string }

export default function PageI({ me, onArtistFound, onSignOut, hidden }: {
  me: Me
  onArtistFound: (id: string, scans: number | null) => void
  onSignOut: () => void
  hidden: boolean
}) {
  const [state, setState] = useState<State>({ status: 'idle' })
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
      const res = await api('/analyze', { method: 'POST', body: form })
      const data: ArtworkSummary = await res.json()
      if (data.artist_id) onArtistFound(data.artist_id, data.artist_scans)
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
      const res = await api(mode === 'narrate' ? '/narrate' : '/immersive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      // Les deux endpoints renvoient l'URL CDN de l'audio (servi par Supabase Storage,
      // pas streamé par le backend) ; l'immersif ajoute les captions.
      const body: { audio_url: string; captions?: Caption[] } = await res.json()
      let sceneCaptions: Caption[] = []
      if (mode === 'immersive') {
        sceneCaptions = body.captions ?? []
        setCaptions(sceneCaptions)
      }

      const audio = new Audio(body.audio_url)
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

  return (
    <div style={{ ...s.page, display: hidden ? 'none' : 'flex' }}>
      {state.status !== 'idle' && <h1 style={s.h1}>Scan an artwork</h1>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />

      {state.status === 'idle' && (
        <Idle me={me} onShoot={() => inputRef.current?.click()} onSignOut={onSignOut} />
      )}

      {state.status !== 'idle' && <img src={state.preview} alt="" style={s.preview} />}

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

// Idle/home screen: greeting, the planned journey, the big shoot button, and
// the sign-out link.
function Idle({ me, onShoot, onSignOut }: {
  me: Me
  onShoot: () => void
  onSignOut: () => void
}) {
  const journey = me.journey
  return (
    <div style={s.idleWrap}>
      <div style={s.greeting}>
        <span style={s.greetingHi}>Hi {me.name || 'there'}</span>
        <span style={s.greetingSub}>Ready to explore?</span>
      </div>

      {journey && (
        <div style={s.journeyCard}>
          <span style={s.journeyLabel}>Your visit</span>
          <span style={s.journeyMuseum}>{journey.museumName}</span>
          <span style={s.journeyCity}>{journey.cityName}</span>
          {journey.museumBookingUrl && (
            <button
              style={s.journeyBook}
              onClick={() => window.open(journey.museumBookingUrl, '_blank', 'noopener,noreferrer')}>
              Book tickets ↗
            </button>
          )}
        </div>
      )}

      <div style={s.shootBlock}>
        <button style={s.cameraBtn} onClick={onShoot}>
          <svg width="28" height="24" viewBox="0 0 28 24" fill="none">
            <path d="M9.5 4.5L8 7H3a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 3 22h22a1.5 1.5 0 0 0 1.5-1.5v-12A1.5 1.5 0 0 0 25 7h-5l-1.5-2.5z" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" fill="none"/>
            <circle cx="14" cy="14" r="4.5" stroke="#fff" strokeWidth="1.6"/>
            <circle cx="22.5" cy="9.5" r="1" fill="#fff"/>
          </svg>
        </button>
        <span style={s.cameraLabel}>Take a photo</span>
        <span style={s.cameraHint}>Point at any artwork — we'll identify it and narrate a commentary.</span>
      </div>

      <div style={s.profileFooter}>
        <button style={s.linkBtn} onClick={onSignOut}>Sign out</button>
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
  const dragging = useRef(false)
  // While dragging, show the finger position and ignore live playback updates,
  // which would otherwise snap the bar back on every timeupdate. Commit on release.
  const [dragFrac, setDragFrac] = useState<number | null>(null)
  function fractionAt(clientX: number) {
    const el = trackRef.current
    if (!el) return 0
    const r = el.getBoundingClientRect()
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width))
  }
  const shown = dragFrac ?? frac
  return (
    <div
      ref={trackRef}
      style={s.scrubTrack}
      onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); setDragFrac(fractionAt(e.clientX)) }}
      onPointerMove={(e) => { if (dragging.current) setDragFrac(fractionAt(e.clientX)) }}
      onPointerUp={(e) => { if (dragging.current) { dragging.current = false; onSeek(fractionAt(e.clientX)); setDragFrac(null) } e.currentTarget.releasePointerCapture(e.pointerId) }}
    >
      <div style={{ ...s.scrubFill, width: `${shown * 100}%` }} />
      <div style={{ ...s.scrubKnob, left: `${shown * 100}%` }} />
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

  idleWrap: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: '1.6rem', minHeight: '70vh', width: '100%' },
  greeting: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 2 },
  greetingHi: { fontFamily: PLAYFAIR, fontStyle: 'italic' as const, fontSize: '2rem', fontWeight: 400, color: '#8a5a2b' },
  greetingSub: { fontFamily: SANS, fontSize: '.78rem', letterSpacing: '.06em', color: '#1c1812', opacity: 0.4 },

  journeyCard: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 3, background: '#ffffff', border: '1px solid #e8e2d8', borderRadius: 12, padding: '1rem 1.4rem', boxShadow: '0 1px 4px rgba(0,0,0,.05)', maxWidth: 360, width: '100%' },
  journeyLabel: { fontFamily: PLAYFAIR, fontStyle: 'italic' as const, fontSize: '.62rem', letterSpacing: '.12em', textTransform: 'uppercase' as const, color: '#a67c2a' },
  journeyMuseum: { fontFamily: PLAYFAIR, fontSize: '1.15rem', color: '#1c1812', textAlign: 'center' as const },
  journeyCity: { fontFamily: SANS, fontSize: '.72rem', color: '#1c1812', opacity: 0.45 },
  journeyBook: { marginTop: 8, background: 'none', color: '#a67c2a', border: '1px solid #d8c79a', borderRadius: 7, padding: '6px 14px', fontSize: '.74rem', fontWeight: 600, letterSpacing: '.03em', cursor: 'pointer', fontFamily: SANS },

  shootBlock: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '.8rem' },
  cameraBtn: {
    width: 80, height: 80, borderRadius: '50%',
    background: 'linear-gradient(135deg, #c9a84c, #a67c2a)',
    border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', boxShadow: '0 4px 20px rgba(166,124,42,.35)',
  },
  cameraLabel: { fontFamily: SANS, fontSize: '.65rem', letterSpacing: '.15em', textTransform: 'uppercase' as const, color: '#1c1812', opacity: 0.45 },
  cameraHint: { fontFamily: SANS, fontSize: '.74rem', color: '#1c1812', opacity: 0.4, textAlign: 'center' as const, maxWidth: 260, lineHeight: 1.5 },

  profileFooter: { display: 'flex', alignItems: 'center', gap: 8 },
  linkBtn: { background: 'none', color: '#1c1812', border: 'none', fontSize: '.74rem', opacity: 0.4, cursor: 'pointer', textDecoration: 'underline' as const, fontFamily: SANS, padding: 0 },

  btn: { background: '#1c1812', color: '#f7f4ef', border: 'none', borderRadius: 8, padding: '.85rem 2rem', fontSize: '.88rem', fontWeight: 600, letterSpacing: '.04em', cursor: 'pointer', width: '100%', maxWidth: 320, fontFamily: SANS },
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

  chip: { background: '#f0ece4', color: '#1c1812', border: '1px solid #e4ddd3', borderRadius: 6, padding: '5px 12px', fontSize: '.82rem', cursor: 'pointer', fontFamily: SANS },
  dot: { width: 18, height: 18, borderRadius: '50%', flexShrink: 0, display: 'inline-block' },
} as const
