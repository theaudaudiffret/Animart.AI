import { useState } from 'react'
import { MUSEUMS, MAX_SCANS, getLevel, museumProgress } from './data'

const PROGRESS_KEY = 'genz-museum-progress'

function getProgress(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}') }
  catch { return {} }
}

// ─── Ring SVG ────────────────────────────────────────────────────────────────

function Ring({ progress, size, color, bg = '#e4ddd3' }: {
  progress: number; size: number; color: string; bg?: string
}) {
  const stroke = 4
  const r = (size - stroke * 2) / 2
  const circ = 2 * Math.PI * r
  const cx = size / 2
  return (
    <svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)', zIndex: 2 }}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke={bg} strokeWidth={stroke} />
      {progress > 0 && (
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${circ}`} strokeDashoffset={`${circ * (1 - progress)}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset .6s ease' }} />
      )}
    </svg>
  )
}

// ─── Museum list ──────────────────────────────────────────────────────────────

export default function PageII() {
  const [selectedMuseum, setSelectedMuseum] = useState<string | null>(null)
  const scans = getProgress()

  if (selectedMuseum) {
    const museum = MUSEUMS.find((m) => m.id === selectedMuseum)!
    return <MuseumDetail museum={museum} scans={scans} onBack={() => setSelectedMuseum(null)} />
  }

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Collection</h1>
      <p style={s.sub}>Scan artworks to unlock artists</p>

      <div style={s.museumList}>
        {MUSEUMS.map((m, i) => {
          const prog = museumProgress(m.id, scans)
          const unlockedCount = m.artists.filter((a) => (scans[a.id] ?? 0) > 0).length
          const totalScans = m.artists.reduce((sum, a) => sum + Math.min(scans[a.id] ?? 0, MAX_SCANS), 0)
          const isLast = i === MUSEUMS.length - 1
          const initials = m.id.slice(0, 2).toUpperCase()

          return (
            <div key={m.id} style={s.row}>
              <div style={s.connectorCol}>
                <button
                  style={{ ...s.node, borderColor: prog > 0 ? m.color : '#e4ddd3' }}
                  onClick={() => setSelectedMuseum(m.id)}
                >
                  <Ring progress={prog} size={68} color={m.color} />
                  <div style={s.nodeInner}>
                    <span style={{ ...s.nodeInitials, color: prog > 0 ? m.color : '#c0b8af' }}>
                      {initials}
                    </span>
                    <span style={{ ...s.nodePct, color: prog > 0 ? m.color : '#c0b8af' }}>
                      {Math.round(prog * 100)}%
                    </span>
                  </div>
                </button>
                {!isLast && <div style={{ ...s.line, background: prog > 0 ? m.color + '55' : '#e4ddd3' }} />}
              </div>

              <button style={s.museumCard} onClick={() => setSelectedMuseum(m.id)}>
                <div style={{ ...s.museumName, color: prog > 0 ? m.color : '#1c1812' }}>{m.name}</div>
                <div style={s.museumLocation}>{m.location}</div>
                <div style={s.museumTheme}>{m.theme}</div>
                <div style={s.museumStats}>
                  {unlockedCount > 0
                    ? `${unlockedCount}/${m.artists.length} artists · ${totalScans} scan${totalScans !== 1 ? 's' : ''}`
                    : `${m.artists.length} artists to discover`}
                </div>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Museum Detail ─────────────────────────────────────────────────────────────

function MuseumDetail({ museum, scans, onBack }: {
  museum: typeof MUSEUMS[0]
  scans: Record<string, number>
  onBack: () => void
}) {
  const prog = museumProgress(museum.id, scans)
  const unlockedCount = museum.artists.filter((a) => (scans[a.id] ?? 0) > 0).length

  return (
    <div style={s.page}>
      <button style={s.back} onClick={onBack}>↩ Back</button>

      <div>
        <h2 style={{ ...s.h1, color: museum.color }}>{museum.name}</h2>
        <p style={s.sub}>{museum.location} · {museum.theme}</p>
      </div>

      <div style={s.progressWrap}>
        <div style={s.progressTrack}>
          <div style={{ ...s.progressFill, width: `${prog * 100}%`, background: museum.color }} />
        </div>
        <div style={s.progressMeta}>
          <span style={{ color: museum.color }}>{Math.round(prog * 100)}% explored</span>
          <span style={s.progressSub}>{unlockedCount}/{museum.artists.length} artists unlocked</span>
        </div>
      </div>

      <div style={s.artistGrid}>
        {museum.artists.map((artist) => {
          const n = Math.min(scans[artist.id] ?? 0, MAX_SCANS)
          const unlocked = n > 0

          return (
            <div key={artist.id} style={{
              ...s.artistCard,
              border: `1px solid ${unlocked ? museum.color + '55' : '#e8e2d8'}`,
            }}>
              <div style={{ position: 'relative', width: 80, height: 80 }}>
                <Ring progress={n / MAX_SCANS} size={80} color={museum.color} />
                <div style={{
                  ...s.avatarWrap,
                  opacity: unlocked ? 1 : 0.3,
                }}>
                  <img
                    src={artist.portrait}
                    alt={artist.name}
                    style={s.portrait}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      const sib = e.currentTarget.nextElementSibling as HTMLElement | null
                      if (sib) sib.style.display = 'flex'
                    }}
                  />
                  <div style={{ ...s.initialsWrap, display: 'none', color: unlocked ? museum.color : '#c0b8af' }}>
                    {artist.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                  </div>
                </div>
              </div>

              <div style={{ ...s.artistName, color: unlocked ? '#1c1812' : '#c0b8af' }}>{artist.name}</div>
              <div style={s.artistDates}>{artist.dates}</div>

              <div style={{
                ...s.levelBadge,
                background: unlocked ? museum.color + '18' : '#f0ece4',
                color: unlocked ? museum.color : '#c0b8af',
                borderColor: unlocked ? museum.color + '44' : '#e4ddd3',
              }}>
                {n === MAX_SCANS ? '✦ ' : ''}{getLevel(n)}
              </div>

              {n > 0 && n < MAX_SCANS && (
                <div style={s.dots}>
                  {Array.from({ length: MAX_SCANS }).map((_, i) => (
                    <span key={i} style={{ ...s.dot, background: i < n ? museum.color : '#e4ddd3' }} />
                  ))}
                </div>
              )}

              <div style={{ ...s.knownFor, color: unlocked ? '#8a8078' : '#c0b8af' }}>{artist.known_for}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const PLAYFAIR = "'Playfair Display', Georgia, serif"
const SANS = "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif"

const s = {
  page: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '1.5rem', padding: '2rem 1.2rem 1rem', width: '100%', maxWidth: 500, margin: '0 auto', color: '#1c1812' },
  h1: { fontFamily: PLAYFAIR, fontSize: '1.5rem', fontWeight: 400, margin: 0, color: '#1c1812' },
  sub: { fontFamily: SANS, fontSize: '.75rem', color: '#1c1812', opacity: 0.4, margin: 0 },
  back: { alignSelf: 'flex-start', background: 'none', border: 'none', color: '#1c1812', opacity: 0.45, fontSize: '.82rem', cursor: 'pointer', padding: 0, fontFamily: SANS, letterSpacing: '.04em' },

  museumList: { width: '100%', display: 'flex', flexDirection: 'column' as const },
  row: { display: 'flex', alignItems: 'flex-start', gap: 14 },
  connectorCol: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', flexShrink: 0 },
  node: { position: 'relative' as const, width: 68, height: 68, borderRadius: '50%', background: '#f7f4ef', border: '1px solid', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },
  nodeInner: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 1, position: 'relative' as const, zIndex: 3 },
  nodeInitials: { fontSize: '.65rem', fontWeight: 700, letterSpacing: '.05em', fontFamily: SANS },
  nodePct: { fontSize: '.55rem', fontWeight: 600, fontFamily: SANS },
  line: { width: 1, height: 28, marginTop: 4, marginBottom: 4 },

  museumCard: { flex: 1, background: '#ffffff', border: '1px solid #e8e2d8', borderRadius: 10, padding: '.9rem 1rem', cursor: 'pointer', textAlign: 'left' as const, marginBottom: 8, boxShadow: '0 1px 4px rgba(0,0,0,.05)' },
  museumName: { fontFamily: PLAYFAIR, fontSize: '1rem', fontWeight: 400, marginBottom: 3 },
  museumLocation: { fontFamily: SANS, fontSize: '.68rem', color: '#1c1812', opacity: 0.45, letterSpacing: '.03em', marginBottom: 2 },
  museumTheme: { fontFamily: SANS, fontSize: '.68rem', color: '#1c1812', opacity: 0.3, marginBottom: 5 },
  museumStats: { fontFamily: SANS, fontSize: '.65rem', color: '#1c1812', opacity: 0.3 },

  progressWrap: { width: '100%', display: 'flex', flexDirection: 'column' as const, gap: 6 },
  progressTrack: { height: 3, background: '#e4ddd3', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2, transition: 'width .6s ease' },
  progressMeta: { display: 'flex', justifyContent: 'space-between', fontSize: '.7rem', fontFamily: SANS },
  progressSub: { color: '#1c1812', opacity: 0.4 },

  artistGrid: { width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  artistCard: { background: '#ffffff', borderRadius: 10, padding: '1rem .75rem', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 5, boxShadow: '0 1px 4px rgba(0,0,0,.05)' },
  avatarWrap: { position: 'absolute' as const, inset: 6, borderRadius: '50%', overflow: 'hidden', background: '#f0ece4' },
  portrait: { width: '100%', height: '100%', objectFit: 'cover' as const, display: 'block' },
  initialsWrap: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 700, fontFamily: SANS },
  artistName: { fontFamily: PLAYFAIR, fontStyle: 'italic', fontSize: '.85rem', fontWeight: 400, textAlign: 'center' as const, marginTop: 2, lineHeight: 1.3 },
  artistDates: { fontFamily: SANS, fontSize: '.6rem', color: '#1c1812', opacity: 0.25 },
  levelBadge: { fontFamily: SANS, fontSize: '.6rem', fontWeight: 600, padding: '3px 8px', borderRadius: 5, border: '1px solid', marginTop: 2, letterSpacing: '.03em' },
  dots: { display: 'flex', gap: 3, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: '50%' },
  knownFor: { fontFamily: SANS, fontSize: '.6rem', textAlign: 'center' as const, fontStyle: 'italic', lineHeight: 1.4, marginTop: 2 },
} as const
