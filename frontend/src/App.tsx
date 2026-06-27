import { useRef, useState } from 'react'
import type { ArtworkSummary, VisitorProfile } from './types'

const MAX_PX = 1600
const JPEG_QUALITY = 0.85
const PROFILE_DONE_KEY = 'genz-museum-profile-done'

const AGE_OPTIONS = ['Enfant (-12 ans)', 'Ado (12-17 ans)', 'Adulte (18-64 ans)', 'Senior (65 ans et +)']
const LEVEL_OPTIONS = ['Novice', 'Amateur', 'Expert']
const INTEREST_OPTIONS = ['Histoire et contexte', 'Anecdotes insolites', 'Technique artistique', 'Symbolisme et interprétation']
const TONE_OPTIONS = ['Ludique et accessible', 'Équilibré', 'Sérieux et académique']

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
        (blob) => blob ? resolve(blob) : reject(new Error('Canvas vide')),
        'image/jpeg',
        JPEG_QUALITY,
      )
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

type NarrateState = 'idle' | 'loading' | 'ready' | 'playing' | 'done' | 'error'

type State =
  | { status: 'onboarding' }
  | { status: 'idle' }
  | { status: 'loading'; preview: string }
  | { status: 'result'; preview: string; data: ArtworkSummary }
  | { status: 'error'; preview: string; message: string }

export default function App() {
  const [state, setState] = useState<State>(() =>
    sessionStorage.getItem(PROFILE_DONE_KEY) ? { status: 'idle' } : { status: 'onboarding' },
  )
  const [narrateState, setNarrateState] = useState<NarrateState>('idle')
  const inputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  async function handleFile(file: File) {
    const preview = URL.createObjectURL(file)
    setState({ status: 'loading', preview })

    const blob = await resizeImage(file)
    const form = new FormData()
    form.append('file', blob, 'photo.jpg')

    try {
      const res = await fetch('/analyze', { method: 'POST', body: form })
      if (!res.ok) throw new Error(`Erreur serveur (${res.status})`)
      const data: ArtworkSummary = await res.json()
      setState({ status: 'result', preview, data })
      prefetchAudio(data)
    } catch (err) {
      setState({ status: 'error', preview, message: (err as Error).message })
    }
  }

  // Charge l'audio en arrière-plan sans le jouer — play() sera appelé par un tap utilisateur
  async function prefetchAudio(data: ArtworkSummary) {
    setNarrateState('loading')
    try {
      const res = await fetch('/narrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const audio = new Audio(URL.createObjectURL(blob))
      audio.onended = () => setNarrateState('done')
      audio.onerror = () => setNarrateState('error')
      audioRef.current = audio
      setNarrateState('ready')
    } catch {
      setNarrateState('error')
    }
  }

  // Appelé directement par un tap — contexte de geste OK pour iOS/Android
  function playAudio() {
    if (!audioRef.current) return
    audioRef.current.currentTime = 0
    audioRef.current.play()
    setNarrateState('playing')
  }

  function reset() {
    audioRef.current?.pause()
    audioRef.current = null
    setNarrateState('idle')
    setState({ status: 'idle' })
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div style={styles.root}>
      <div style={styles.container}>
        {/* Header */}
        <h1 style={styles.h1}>Analyse d'œuvre</h1>

        {/* Onboarding */}
        {state.status === 'onboarding' && (
          <Onboarding onDone={() => setState({ status: 'idle' })} />
        )}

        {/* Camera trigger — always visible */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />

        {state.status === 'idle' && (
          <button style={styles.btn} onClick={() => inputRef.current?.click()}>
            📷 Prendre une photo
          </button>
        )}

        {/* Preview */}
        {state.status !== 'idle' && state.status !== 'onboarding' && (
          <img src={state.preview} alt="photo prise" style={styles.preview} />
        )}

        {/* Spinner */}
        {state.status === 'loading' && (
          <div style={styles.spinnerWrap}>
            <div style={styles.spinner} />
            <span style={styles.hint}>Analyse en cours…</span>
          </div>
        )}

        {/* Error */}
        {state.status === 'error' && (
          <>
            <p style={styles.error}>{state.message}</p>
            <button style={styles.btn} onClick={reset}>Réessayer</button>
          </>
        )}

        {/* Result */}
        {state.status === 'result' && (
          <Result data={state.data} onReset={reset} narrateState={narrateState} onPlay={playAudio} />
        )}
      </div>
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

  function toggleInterest(item: string) {
    setInterests((prev) => (prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]))
  }

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    const profile: VisitorProfile = { age_range: ageRange!, level: level!, interests, tone: tone! }
    try {
      await fetch('/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })
    } finally {
      sessionStorage.setItem(PROFILE_DONE_KEY, '1')
      onDone()
    }
  }

  return (
    <div style={styles.resultWrap}>
      <p style={styles.hint}>Quelques questions pour adapter le guide à toi.</p>
      <Choice label="Ton âge" options={AGE_OPTIONS} value={ageRange} onChange={setAgeRange} />
      <Choice label="Ton niveau en art" options={LEVEL_OPTIONS} value={level} onChange={setLevel} />
      <MultiChoice label="Ce qui t'intéresse" options={INTEREST_OPTIONS} values={interests} onToggle={toggleInterest} />
      <Choice label="Le ton que tu préfères" options={TONE_OPTIONS} value={tone} onChange={setTone} />
      <button style={{ ...styles.btn, opacity: canSubmit ? 1 : 0.5 }} disabled={!canSubmit} onClick={submit}>
        {submitting ? 'Préparation…' : 'Commencer la visite'}
      </button>
    </div>
  )
}

function Choice({
  label, options, value, onChange,
}: {
  label: string
  options: string[]
  value: string | null
  onChange: (v: string) => void
}) {
  return (
    <div style={styles.card}>
      <div style={styles.cardLabel}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            style={{ ...styles.choice, ...(value === opt ? styles.choiceSelected : {}) }}
            onClick={() => onChange(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

function MultiChoice({
  label, options, values, onToggle,
}: {
  label: string
  options: string[]
  values: string[]
  onToggle: (v: string) => void
}) {
  return (
    <div style={styles.card}>
      <div style={styles.cardLabel}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            style={{ ...styles.choice, ...(values.includes(opt) ? styles.choiceSelected : {}) }}
            onClick={() => onToggle(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

const NARRATE_LABEL: Record<string, string> = {
  loading: '⏳ Préparation audio…',
  ready:   '🔊 Écouter le résumé',
  playing: '🔊 Lecture…',
  done:    '🔁 Réécouter',
  error:   '⚠️ Narration indisponible',
}

function Result({
  data, onReset, narrateState, onPlay,
}: {
  data: ArtworkSummary
  onReset: () => void
  narrateState: NarrateState
  onPlay: () => void
}) {
  const canTap = narrateState === 'ready' || narrateState === 'done'
  return (
    <div style={styles.resultWrap}>
      {narrateState !== 'idle' && (
        <button
          style={{ ...styles.audioBtn, opacity: canTap ? 1 : 0.5 }}
          disabled={!canTap}
          onClick={onPlay}
        >
          {NARRATE_LABEL[narrateState]}
        </button>
      )}
      <Card label="Titre probable" value={data.titre_probable ?? '—'} large />
      <Card label="Artiste probable" value={data.artiste_probable ?? '—'} large />
      <Card label="Style" value={data.style} />
      {data.epoque && <Card label="Époque" value={data.epoque} />}
      {data.technique && <Card label="Technique" value={data.technique} />}
      <Card label="Description" value={data.description} />
      <Card label="Ambiance" value={data.ambiance} />
      <Card label="Sujets">
        <Tags items={data.sujets} />
      </Card>
      <Card label="Couleurs dominantes">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {data.couleurs_dominantes.map((c) => (
            <span key={c} style={styles.colorTag}>
              <span
                style={{
                  ...styles.dot,
                  background: c.toLowerCase(),
                  border: '1px solid rgba(255,255,255,.2)',
                }}
              />
              {c}
            </span>
          ))}
        </div>
      </Card>
      <button style={{ ...styles.btn, marginTop: 8 }} onClick={onReset}>
        📷 Nouvelle photo
      </button>
    </div>
  )
}

function Card({
  label,
  value,
  large,
  children,
}: {
  label: string
  value?: string
  large?: boolean
  children?: React.ReactNode
}) {
  return (
    <div style={styles.card}>
      <div style={styles.cardLabel}>{label}</div>
      {value !== undefined && (
        <div style={large ? styles.cardValueLarge : styles.cardValue}>{value}</div>
      )}
      {children}
    </div>
  )
}

function Tags({ items }: { items: string[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map((t) => (
        <span key={t} style={styles.tag}>{t}</span>
      ))}
    </div>
  )
}

const styles = {
  root: {
    minHeight: '100vh',
    background: '#0f0f0f',
    color: '#f0f0f0',
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    display: 'flex',
    justifyContent: 'center',
  },
  container: {
    width: '100%',
    maxWidth: 500,
    padding: '2rem 1.2rem 4rem',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '1.2rem',
  },
  h1: {
    fontSize: '1.4rem',
    fontWeight: 600,
    letterSpacing: '.02em',
    marginBottom: '.5rem',
  },
  btn: {
    background: '#fff',
    color: '#111',
    border: 'none',
    borderRadius: 50,
    padding: '.85rem 2rem',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
    maxWidth: 300,
  },
  preview: {
    width: '100%',
    borderRadius: 14,
    objectFit: 'cover' as const,
    maxHeight: 340,
  },
  spinnerWrap: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 12,
  },
  spinner: {
    width: 44,
    height: 44,
    border: '4px solid #333',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin .8s linear infinite',
  },
  hint: {
    opacity: 0.5,
    fontSize: '.9rem',
  },
  error: {
    color: '#ff6b6b',
    textAlign: 'center' as const,
  },
  resultWrap: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '.75rem',
  },
  card: {
    background: '#1c1c1c',
    borderRadius: 14,
    padding: '1rem 1.2rem',
  },
  cardLabel: {
    fontSize: '.68rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '.1em',
    opacity: 0.45,
    marginBottom: 4,
  },
  cardValue: {
    fontSize: '1rem',
    lineHeight: 1.55,
  },
  cardValueLarge: {
    fontSize: '1.15rem',
    fontWeight: 600,
    lineHeight: 1.4,
  },
  audioBtn: {
    background: '#1c1c1c',
    color: '#f0f0f0',
    border: '1px solid #333',
    borderRadius: 50,
    padding: '.7rem 1.6rem',
    fontSize: '1rem',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'center' as const,
  },
  tag: {
    background: '#2a2a2a',
    borderRadius: 20,
    padding: '4px 10px',
    fontSize: '.85rem',
  },
  choice: {
    background: '#2a2a2a',
    color: '#f0f0f0',
    border: '1px solid transparent',
    borderRadius: 20,
    padding: '6px 12px',
    fontSize: '.85rem',
    cursor: 'pointer',
  },
  choiceSelected: {
    background: '#fff',
    color: '#111',
    border: '1px solid #fff',
  },
  colorTag: {
    background: '#2a2a2a',
    borderRadius: 20,
    padding: '4px 10px',
    fontSize: '.85rem',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    flexShrink: 0,
  },
} as const
