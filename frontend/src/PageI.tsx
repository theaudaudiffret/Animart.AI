import { useRef, useState } from 'react'
import type { ArtworkSummary, JourneyPlan, VisitorProfile } from './types'
import { CITIES, ERAS } from './cityData'

const MAX_PX = 1600
const JPEG_QUALITY = 0.85
const ONBOARDED_KEY = 'genz-museum-onboarded'
const JOURNEY_KEY = 'genz-museum-journey'

const AGE_OPTIONS = ['Child (under 12)', 'Teen (12–17)', 'Adult (18–64)', 'Senior (65+)']
const LEVEL_OPTIONS = ['Novice', 'Enthusiast', 'Expert']
const INTEREST_OPTIONS = ['History & context', 'Fun anecdotes', 'Artistic technique', 'Symbolism & meaning']
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
        (blob) => (blob ? resolve(blob) : reject(new Error('Canvas vide'))),
        'image/jpeg',
        JPEG_QUALITY,
      )
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

type NarrateState = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'done' | 'error'

type State =
  | { status: 'onboarding' }
  | { status: 'city-selection' }
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
      if (data.artist_id && !data.in_session) onArtistFound(data.artist_id)
      setNarrateState('idle')
      setState({ status: 'result', preview, data })
      prefetchAudio(data)
    } catch (err) {
      setState({ status: 'error', preview, message: (err as Error).message })
    }
  }

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

  function toggleAudio() {
    if (!audioRef.current) return
    if (narrateState === 'playing') {
      audioRef.current.pause()
      setNarrateState('paused')
    } else {
      if (narrateState === 'done') audioRef.current.currentTime = 0
      audioRef.current.play()
      setNarrateState('playing')
    }
  }

  function reset() {
    audioRef.current?.pause()
    audioRef.current = null
    setNarrateState('idle')
    setState({ status: 'idle' })
    if (inputRef.current) inputRef.current.value = ''
  }

  async function newProfile() {
    if (!confirm('Archiver la visite actuelle et créer un nouveau profil ?')) return
    try {
      await fetch('/new-profile', { method: 'POST' })
    } finally {
      onNewProfile()
      localStorage.removeItem(ONBOARDED_KEY)
      localStorage.removeItem(JOURNEY_KEY)
      setState({ status: 'onboarding' })
    }
  }

  return (
    <div style={{ ...s.page, display: hidden ? 'none' : 'flex' }}>
      {state.status !== 'onboarding' && <h1 style={s.h1}>Scanner une œuvre</h1>}

      {state.status === 'onboarding' && (
        <Onboarding onDone={() => setState({ status: 'city-selection' })} />
      )}

      {state.status === 'city-selection' && (
        <CitySelection onDone={(plan) => {
          localStorage.setItem(ONBOARDED_KEY, '1')
          localStorage.setItem(JOURNEY_KEY, JSON.stringify(plan))
          setState({ status: 'idle' })
        }} />
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
          <span style={s.cameraLabel}>Photographier</span>
          <button style={s.btnSecondary} onClick={newProfile}>Nouveau profil</button>
        </div>
      )}

      {state.status !== 'idle' && state.status !== 'onboarding' && state.status !== 'city-selection' && (
        <img src={state.preview} alt="" style={s.preview} />
      )}

      {state.status === 'loading' && (
        <div style={s.spinnerWrap}>
          <div style={s.spinner} />
          <span style={s.dim}>Analyse en cours…</span>
        </div>
      )}

      {state.status === 'error' && (
        <>
          <p style={s.error}>{state.message}</p>
          <button style={s.btn} onClick={reset}>Réessayer</button>
        </>
      )}

      {state.status === 'result' && (
        <Result data={state.data} onReset={reset} narrateState={narrateState} onPlay={toggleAudio} />
      )}
    </div>
  )
}

function Onboarding({ onDone }: { onDone: () => void }) {
  const [visitorName, setVisitorName] = useState('')
  const [ageRange, setAgeRange] = useState<string | null>(null)
  const [level, setLevel] = useState<string | null>(null)
  const [interests, setInterests] = useState<string[]>([])
  const [tone, setTone] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const canSubmit = visitorName.trim() !== '' && ageRange !== null && level !== null && tone !== null && !submitting

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    const profile: VisitorProfile = { name: visitorName.trim(), age_range: ageRange!, level: level!, interests, tone: tone! }
    try {
      await fetch('/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) })
    } finally {
      onDone()
    }
  }

  return (
    <div style={s.col}>
      <div style={s.welcomeHero}>
        <h1 style={s.welcomeTitle}>Paris Museums</h1>
        <p style={s.welcomeTagline}>Your personal audio guide</p>
        <p style={s.welcomeSubtitle}>Tell us a bit about yourself so we can tailor your visit.</p>
      </div>

      <div style={s.group}>
        <div style={s.groupLabel}>What should we call you?</div>
        <input
          type="text"
          placeholder="Your name"
          value={visitorName}
          onChange={(e) => setVisitorName(e.target.value)}
          style={s.nameInput}
        />
      </div>

      <Choice label="Your age" options={AGE_OPTIONS} value={ageRange} onChange={setAgeRange} />
      <Choice label="Your art level" options={LEVEL_OPTIONS} value={level} onChange={setLevel} />
      <MultiChoice label="What interests you" options={INTEREST_OPTIONS} values={interests}
        onToggle={(i) => setInterests((p) => p.includes(i) ? p.filter((x) => x !== i) : [...p, i])} />
      <Choice label="Your preferred tone" options={TONE_OPTIONS} value={tone} onChange={setTone} />
      <button style={{ ...s.submitBtn, opacity: canSubmit ? 1 : 0.45, width: '100%' }} disabled={!canSubmit} onClick={submit}>
        {submitting ? 'Getting ready…' : 'Next →'}
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
      <div style={s.chipRow}>
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
      <div style={s.chipRow}>
        {options.map((opt) => (
          <button key={opt} type="button"
            style={{ ...s.chip, ...(values.includes(opt) ? s.chipOn : {}) }}
            onClick={() => onToggle(opt)}>{opt}</button>
        ))}
      </div>
    </div>
  )
}

const NARRATE_LABEL: Record<string, string> = {
  loading: 'Chargement…',
  ready: '▷  Écouter',
  playing: '⏸  Pause',
  paused: '▷  Reprendre',
  done: '↺  Réécouter',
  error: 'Narration indisponible',
}

const NARRATE_ACTIVE = new Set(['ready', 'playing', 'paused', 'done'])

function Result({ data, onReset, narrateState, onPlay }: {
  data: ArtworkSummary; onReset: () => void; narrateState: NarrateState; onPlay: () => void
}) {
  const canTap = NARRATE_ACTIVE.has(narrateState)
  return (
    <div style={s.col}>
      {narrateState !== 'idle' && (
        <button
          style={{
            ...s.audioBtn,
            opacity: canTap ? 1 : 0.45,
            color: canTap ? '#a67c2a' : '#1c1812',
            borderColor: canTap ? '#c9a84c66' : '#e4ddd3',
          }}
          disabled={!canTap}
          onClick={onPlay}
        >
          {NARRATE_LABEL[narrateState]}
        </button>
      )}
      <Card label="Titre" value={data.titre_probable ?? '—'} large />
      <Card label="Artiste" value={data.artiste_probable ?? '—'} large />
      <Card label="Style" value={data.style} />
      {data.epoque && <Card label="Époque" value={data.epoque} />}
      {data.technique && <Card label="Technique" value={data.technique} />}
      <Card label="Description" value={data.description} />
      <Card label="Ambiance" value={data.ambiance} />
      <Card label="Sujets"><Chips items={data.sujets} /></Card>
      <Card label="Couleurs dominantes">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 2 }}>
          {data.couleurs_dominantes.map((c) => (
            <span key={c} style={{ ...s.dot, background: c.toLowerCase(), border: '1px solid rgba(0,0,0,.1)' }} />
          ))}
        </div>
      </Card>
      <button style={{ ...s.btn, marginTop: 4 }} onClick={onReset}>Nouvelle photo</button>
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

const FILTER_TYPES = [
  { id: 'museum' as const, label: 'A specific museum' },
  { id: 'artist' as const, label: 'An artist I love' },
  { id: 'era'   as const, label: 'An art period' },
]

type FilterType = 'museum' | 'artist' | 'era'

function CitySelection({ onDone }: { onDone: (plan: JourneyPlan) => void }) {
  const [cityId, setCityId] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<FilterType | null>(null)
  const [museumId, setMuseumId] = useState<string | null>(null)
  const [selectedArtists, setSelectedArtists] = useState<Array<{ name: string; id?: string }>>([])
  const [selectedEraIds, setSelectedEraIds] = useState<string[]>([])

  const city = CITIES.find((c) => c.id === cityId) ?? null

  const cityArtists = city
    ? Array.from(
        new Map(city.museums.flatMap((m) => m.featuredArtists).map((a) => [a.name, a])).values(),
      )
    : []

  const cityEras = city
    ? ERAS.filter((e) => city.museums.some((m) => m.eras.includes(e.id)))
    : []

  const recommendation = (() => {
    if (!city) return null
    if (filterType === 'museum' && museumId)
      return city.museums.find((m) => m.id === museumId) ?? null
    if (filterType === 'artist' && selectedArtists.length > 0) {
      const scored = city.museums
        .map((m) => ({
          museum: m,
          score: selectedArtists.filter((a) => m.featuredArtists.some((fa) => fa.name === a.name)).length,
        }))
        .filter((x) => x.score > 0)
      if (!scored.length) return null
      return scored.sort((a, b) => b.score - a.score)[0].museum
    }
    if (filterType === 'era' && selectedEraIds.length > 0) {
      const scored = city.museums
        .map((m) => ({
          museum: m,
          score: selectedEraIds.filter((eid) => m.eras.includes(eid)).length,
        }))
        .filter((x) => x.score > 0)
      if (!scored.length) return null
      return scored.sort((a, b) => b.score - a.score)[0].museum
    }
    return null
  })()

  function selectCity(id: string) {
    setCityId(id)
    setFilterType(null)
    setMuseumId(null)
    setSelectedArtists([])
    setSelectedEraIds([])
  }

  function selectFilterType(type: FilterType) {
    setFilterType(type)
    setMuseumId(null)
    setSelectedArtists([])
    setSelectedEraIds([])
  }

  function toggleArtist(a: { name: string; id?: string }) {
    setSelectedArtists((prev) =>
      prev.some((x) => x.name === a.name) ? prev.filter((x) => x.name !== a.name) : [...prev, a],
    )
  }

  function toggleEra(id: string) {
    setSelectedEraIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function finish() {
    if (!city || !recommendation) return
    const eraLabel = selectedEraIds.length
      ? selectedEraIds.map((id) => ERAS.find((e) => e.id === id)?.label).filter(Boolean).join(', ')
      : undefined
    const artistNames = selectedArtists.length ? selectedArtists.map((a) => a.name).join(', ') : undefined
    const primaryArtistId = selectedArtists.length === 1 ? selectedArtists[0].id : undefined
    onDone({
      cityId: city.id,
      cityName: city.name,
      museumId: recommendation.id,
      museumName: recommendation.name,
      museumBookingUrl: recommendation.bookingUrl,
      artist: artistNames,
      artistId: primaryArtistId,
      era: eraLabel,
    })
  }

  return (
    <div style={s.col}>
      <div style={s.welcomeHero}>
        <h1 style={s.welcomeTitle}>Plan your visit</h1>
        <p style={s.welcomeTagline}>Where are you exploring?</p>
      </div>

      <div style={s.group}>
        <div style={s.groupLabel}>Choose a city</div>
        <div style={s.chipRow}>
          {CITIES.map((c) => (
            <button key={c.id} type="button"
              style={{ ...s.chip, ...(cityId === c.id ? s.chipOn : {}) }}
              onClick={() => selectCity(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {city && (
        <div style={s.group}>
          <div style={s.groupLabel}>What guides your visit?</div>
          <div style={s.chipRow}>
            {FILTER_TYPES.map((ft) => (
              <button key={ft.id} type="button"
                style={{ ...s.chip, ...(filterType === ft.id ? s.chipOn : {}) }}
                onClick={() => selectFilterType(ft.id)}>
                {ft.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {filterType === 'museum' && city && (
        <div style={s.group}>
          <div style={s.groupLabel}>Pick a museum</div>
          <div style={s.chipRow}>
            {city.museums.map((m) => (
              <button key={m.id} type="button"
                style={{ ...s.chip, ...(museumId === m.id ? s.chipOn : {}) }}
                onClick={() => setMuseumId((prev) => (prev === m.id ? null : m.id))}>
                {m.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {filterType === 'artist' && city && (
        <div style={s.group}>
          <div style={s.groupLabel}>Pick one or more artists</div>
          <div style={s.chipRow}>
            {cityArtists.map((a) => (
              <button key={a.name} type="button"
                style={{ ...s.chip, ...(selectedArtists.some((x) => x.name === a.name) ? s.chipOn : {}) }}
                onClick={() => toggleArtist(a)}>
                {a.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {filterType === 'era' && city && (
        <div style={s.group}>
          <div style={s.groupLabel}>Pick one or more eras</div>
          <div style={s.chipRow}>
            {cityEras.map((e) => (
              <button key={e.id} type="button"
                style={{ ...s.chip, ...(selectedEraIds.includes(e.id) ? s.chipOn : {}) }}
                onClick={() => toggleEra(e.id)}>
                {e.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {recommendation && (
        <>
          <div style={s.card}>
            <div style={s.cardLabel}>Our recommendation</div>
            <div style={s.cardLg}>{recommendation.name}</div>
            <div style={{ ...s.cardVal, opacity: 0.55, marginTop: 4 }}>
              Best match for your choices
            </div>
          </div>
          <div style={s.ctaRow}>
            <button
              style={s.bookBtn}
              onClick={() => window.open(recommendation.bookingUrl, '_blank', 'noopener,noreferrer')}>
              Book tickets ↗
            </button>
            <button style={{ ...s.submitBtn, width: 'auto' }} onClick={finish}>
              Start the journey →
            </button>
          </div>
        </>
      )}
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
  audioBtn: { background: '#ffffff', border: '1px solid', borderRadius: 8, padding: '.65rem 1.4rem', fontSize: '.82rem', letterSpacing: '.05em', cursor: 'pointer', width: '100%', textAlign: 'center' as const, fontFamily: SANS, transition: 'color .15s, border-color .15s', boxShadow: '0 1px 4px rgba(0,0,0,.06)' },
  preview: { width: '100%', borderRadius: 10, objectFit: 'cover' as const, aspectRatio: '4/3' as const, boxShadow: '0 2px 16px rgba(0,0,0,.1)' },
  spinnerWrap: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 14 },
  spinner: { width: 40, height: 40, border: '3px solid #e4ddd3', borderTopColor: '#c9a84c', borderRadius: '50%', animation: 'spin .8s linear infinite' },
  dim: { opacity: 0.45, fontSize: '.88rem', fontFamily: SANS, color: '#1c1812' },
  error: { color: '#c0392b', textAlign: 'center' as const, fontSize: '.9rem', fontFamily: SANS },

  card: { background: '#ffffff', border: '1px solid #e8e2d8', borderRadius: 10, padding: '1rem 1.2rem', boxShadow: '0 1px 4px rgba(0,0,0,.05)' },
  cardLabel: { fontFamily: PLAYFAIR, fontStyle: 'italic', fontSize: '.65rem', letterSpacing: '.1em', color: '#1c1812', opacity: 0.38, marginBottom: 5 },
  cardVal: { fontSize: '.95rem', lineHeight: 1.6, fontFamily: SANS, color: '#1c1812' },
  cardLg: { fontFamily: PLAYFAIR, fontSize: '1.25rem', fontWeight: 400, lineHeight: 1.35, color: '#1c1812' },

  welcomeHero: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 6, paddingBottom: 8, borderBottom: '1px solid #e8e2d8', marginBottom: 4 },
  welcomeTitle: { fontFamily: PLAYFAIR, fontSize: '2rem', fontWeight: 400, color: '#1c1812', margin: 0, letterSpacing: '.01em' },
  welcomeTagline: { fontFamily: PLAYFAIR, fontStyle: 'italic', fontSize: '.88rem', color: '#a67c2a', margin: 0 },
  welcomeSubtitle: { fontFamily: SANS, fontSize: '.8rem', color: '#1c1812', opacity: 0.45, margin: 0, textAlign: 'center' as const },

  nameInput: { width: '100%', background: '#ffffff', border: '1px solid #e4ddd3', borderRadius: 8, padding: '10px 14px', fontSize: '.9rem', fontFamily: SANS, color: '#1c1812', outline: 'none', boxSizing: 'border-box' as const },

  group: { display: 'flex', flexDirection: 'column' as const, gap: 10 },
  groupLabel: { fontFamily: PLAYFAIR, fontStyle: 'italic', fontSize: '.7rem', letterSpacing: '.06em', color: '#1c1812', opacity: 0.5 },

  chip: { background: '#f0ece4', color: '#1c1812', border: '1px solid #e4ddd3', borderRadius: 6, padding: '5px 12px', fontSize: '.82rem', cursor: 'pointer', fontFamily: SANS },
  chipOn: { background: '#1c1812', color: '#f7f4ef', border: '1px solid #1c1812' },
  chipRow: { display: 'flex', flexWrap: 'wrap' as const, gap: 7 },

  submitBtn: { flex: 1, background: '#1c1812', color: '#f7f4ef', border: 'none', borderRadius: 8, padding: '.9rem', fontSize: '.88rem', letterSpacing: '.06em', fontWeight: 600, cursor: 'pointer', fontFamily: SANS },
  bookBtn: { flex: 1, background: 'none', color: '#1c1812', border: '1.5px solid #1c1812', borderRadius: 8, padding: '.9rem', fontSize: '.88rem', letterSpacing: '.03em', fontWeight: 500, cursor: 'pointer', fontFamily: SANS },
  ctaRow: { display: 'flex', gap: 10, marginTop: 8 },
  filterDivider: { fontFamily: PLAYFAIR, fontStyle: 'italic', fontSize: '.75rem', color: '#1c1812', opacity: 0.35, textAlign: 'center' as const, borderTop: '1px solid #e8e2d8', paddingTop: 12, marginTop: 4 },

  dot: { width: 18, height: 18, borderRadius: '50%', flexShrink: 0, display: 'inline-block' },
} as const
