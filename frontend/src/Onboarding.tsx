import { useState } from 'react'
import type { JourneyPlan, VisitorProfile } from './types'
import { CITIES, ERAS } from './cityData'
import { api } from './api'

const AGE_OPTIONS = ['Child (under 12)', 'Teen (12-17)', 'Adult (18-64)', 'Senior (65+)']
const LEVEL_OPTIONS = ['Novice', 'Amateur', 'Expert']
const INTEREST_OPTIONS = ['History & context', 'Unusual anecdotes', 'Artistic technique', 'Symbolism & interpretation']
const TONE_OPTIONS = ['Playful', 'Serious']

// Two-step profile creation: the questionnaire (saved to /profile) then the
// journey planner (saved to /journey). onComplete fires once both are stored.
export default function OnboardingFlow({ onComplete, onBack }: {
  onComplete: () => void
  onBack: () => void
}) {
  const [step, setStep] = useState<'questionnaire' | 'journey'>('questionnaire')

  return step === 'questionnaire' ? (
    <Questionnaire onDone={() => setStep('journey')} onBack={onBack} />
  ) : (
    <CitySelection onDone={onComplete} onBack={() => setStep('questionnaire')} />
  )
}

function Questionnaire({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
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
      await api('/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) })
      onDone()
    } catch {
      setSubmitting(false)
    }
  }

  return (
    <div style={s.col}>
      <button style={s.back} onClick={onBack}>← Back</button>
      <div style={s.welcomeHero}>
        <div style={s.stepTag}>Step 1 of 2 · Your profile</div>
        <h1 style={s.welcomeTitle}>Tell us about you</h1>
        <p style={s.welcomeSubtitle}>We tailor every commentary to your taste.</p>
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
      <button style={{ ...s.submitBtn, opacity: canSubmit ? 1 : 0.45 }} disabled={!canSubmit} onClick={submit}>
        {submitting ? 'Saving…' : 'Next →'}
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

const FILTER_TYPES = [
  { id: 'museum' as const, label: 'A specific museum' },
  { id: 'artist' as const, label: 'An artist I love' },
  { id: 'era'   as const, label: 'An art period' },
]

type FilterType = 'museum' | 'artist' | 'era'

function CitySelection({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [cityId, setCityId] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<FilterType | null>(null)
  const [museumId, setMuseumId] = useState<string | null>(null)
  const [selectedArtists, setSelectedArtists] = useState<Array<{ name: string; id?: string }>>([])
  const [selectedEraIds, setSelectedEraIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

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

  async function finish() {
    if (!city || !recommendation) return
    const eraLabel = selectedEraIds.length
      ? selectedEraIds.map((id) => ERAS.find((e) => e.id === id)?.label).filter(Boolean).join(', ')
      : undefined
    const artistNames = selectedArtists.length ? selectedArtists.map((a) => a.name).join(', ') : undefined
    const primaryArtistId = selectedArtists.length === 1 ? selectedArtists[0].id : undefined
    const plan: JourneyPlan = {
      cityId: city.id,
      cityName: city.name,
      museumId: recommendation.id,
      museumName: recommendation.name,
      museumBookingUrl: recommendation.bookingUrl,
      artist: artistNames,
      artistId: primaryArtistId,
      era: eraLabel,
    }
    setSaving(true)
    try {
      await api('/journey', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(plan) })
      onDone()
    } catch {
      setSaving(false)
    }
  }

  return (
    <div style={s.col}>
      <button style={s.back} onClick={onBack}>← Back</button>
      <div style={s.welcomeHero}>
        <div style={s.stepTag}>Step 2 of 2 · Your visit</div>
        <h1 style={s.welcomeTitle}>Plan your visit</h1>
        <p style={s.welcomeSubtitle}>We'll point you to the best museum for your taste.</p>
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
            <button style={{ ...s.submitBtn, width: 'auto', opacity: saving ? 0.5 : 1 }} disabled={saving} onClick={finish}>
              {saving ? 'Starting…' : 'Start the journey →'}
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
  col: { width: '100%', maxWidth: 500, margin: '0 auto', padding: '2rem 1.2rem 1rem', display: 'flex', flexDirection: 'column' as const, gap: '1rem' },
  back: { alignSelf: 'flex-start', background: 'none', border: 'none', color: '#1c1812', opacity: 0.45, fontSize: '.82rem', cursor: 'pointer', padding: 0, fontFamily: SANS, letterSpacing: '.04em' },

  welcomeHero: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 6, paddingBottom: 8, borderBottom: '1px solid #e8e2d8', marginBottom: 4 },
  stepTag: { fontFamily: SANS, fontSize: '.6rem', letterSpacing: '.16em', textTransform: 'uppercase' as const, color: '#a67c2a', fontWeight: 600 },
  welcomeTitle: { fontFamily: PLAYFAIR, fontSize: '2rem', fontWeight: 400, color: '#1c1812', margin: 0, letterSpacing: '.01em' },
  welcomeSubtitle: { fontFamily: SANS, fontSize: '.8rem', color: '#1c1812', opacity: 0.45, margin: 0, textAlign: 'center' as const },

  nameInput: { width: '100%', background: '#ffffff', border: '1px solid #e4ddd3', borderRadius: 8, padding: '10px 14px', fontSize: '.9rem', fontFamily: SANS, color: '#1c1812', outline: 'none', boxSizing: 'border-box' as const },

  group: { display: 'flex', flexDirection: 'column' as const, gap: 10 },
  groupLabel: { fontFamily: PLAYFAIR, fontStyle: 'italic', fontSize: '.7rem', letterSpacing: '.06em', color: '#1c1812', opacity: 0.5 },

  chip: { background: '#f0ece4', color: '#1c1812', border: '1px solid #e4ddd3', borderRadius: 6, padding: '5px 12px', fontSize: '.82rem', cursor: 'pointer', fontFamily: SANS },
  chipOn: { background: '#1c1812', color: '#f7f4ef', border: '1px solid #1c1812' },
  chipRow: { display: 'flex', flexWrap: 'wrap' as const, gap: 7 },

  submitBtn: { width: '100%', background: '#1c1812', color: '#f7f4ef', border: 'none', borderRadius: 8, padding: '.9rem', fontSize: '.88rem', letterSpacing: '.06em', fontWeight: 600, cursor: 'pointer', fontFamily: SANS },
  bookBtn: { flex: 1, background: 'none', color: '#1c1812', border: '1.5px solid #1c1812', borderRadius: 8, padding: '.9rem', fontSize: '.88rem', letterSpacing: '.03em', fontWeight: 500, cursor: 'pointer', fontFamily: SANS },
  ctaRow: { display: 'flex', gap: 10, marginTop: 8 },

  card: { background: '#ffffff', border: '1px solid #e8e2d8', borderRadius: 10, padding: '1rem 1.2rem', boxShadow: '0 1px 4px rgba(0,0,0,.05)' },
  cardLabel: { fontFamily: PLAYFAIR, fontStyle: 'italic', fontSize: '.65rem', letterSpacing: '.1em', color: '#1c1812', opacity: 0.38, marginBottom: 5 },
  cardVal: { fontSize: '.95rem', lineHeight: 1.6, fontFamily: SANS, color: '#1c1812' },
  cardLg: { fontFamily: PLAYFAIR, fontSize: '1.25rem', fontWeight: 400, lineHeight: 1.35, color: '#1c1812' },
} as const
