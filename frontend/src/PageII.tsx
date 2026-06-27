import { useState } from 'react'
import { MOVEMENTS, LEVELS, MAX_SCANS, getLevel, movementProgress } from './data'

const PROGRESS_KEY = 'genz-museum-progress'

function getProgress(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}') }
  catch { return {} }
}

// ─── Ring SVG ───────────────────────────────────────────────────────────────

function Ring({ progress, size, color, bg = '#222' }: {
  progress: number; size: number; color: string; bg?: string
}) {
  const stroke = 6
  const r = (size - stroke * 2) / 2
  const circ = 2 * Math.PI * r
  const cx = size / 2
  return (
    <svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
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

// ─── Timeline ───────────────────────────────────────────────────────────────

export default function PageII() {
  const [selectedMovement, setSelectedMovement] = useState<string | null>(null)
  const scans = getProgress()

  if (selectedMovement) {
    const movement = MOVEMENTS.find((m) => m.id === selectedMovement)!
    return (
      <MovementDetail
        movement={movement}
        scans={scans}
        onBack={() => setSelectedMovement(null)}
      />
    )
  }

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Accomplissements</h1>
      <p style={s.sub}>Scanne des œuvres pour débloquer les artistes</p>

      <div style={s.timeline}>
        {MOVEMENTS.map((m, i) => {
          const prog = movementProgress(m.id, scans)
          const totalScans = m.artists.reduce((sum, a) => sum + Math.min(scans[a.id] ?? 0, MAX_SCANS), 0)
          const isLast = i === MOVEMENTS.length - 1

          return (
            <div key={m.id} style={s.timelineRow}>
              {/* Connector line */}
              <div style={s.connectorCol}>
                <button
                  style={{ ...s.node, borderColor: m.color }}
                  onClick={() => setSelectedMovement(m.id)}
                >
                  <Ring progress={prog} size={72} color={m.color} />
                  <span style={{ ...s.nodePercent, color: prog > 0 ? m.color : '#555' }}>
                    {Math.round(prog * 100)}%
                  </span>
                </button>
                {!isLast && <div style={{ ...s.line, background: m.color + '44' }} />}
              </div>

              {/* Movement info */}
              <button style={s.movementCard} onClick={() => setSelectedMovement(m.id)}>
                <div style={{ ...s.movementName, color: m.color }}>{m.name}</div>
                <div style={s.movementPeriod}>{m.period}</div>
                <div style={s.movementStats}>
                  {totalScans} scan{totalScans !== 1 ? 's' : ''} · {m.artists.filter((a) => (scans[a.id] ?? 0) > 0).length}/{m.artists.length} artistes
                </div>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Movement Detail ─────────────────────────────────────────────────────────

function MovementDetail({ movement, scans, onBack }: {
  movement: typeof MOVEMENTS[0]
  scans: Record<string, number>
  onBack: () => void
}) {
  return (
    <div style={s.page}>
      <button style={s.back} onClick={onBack}>← Retour</button>
      <h2 style={{ ...s.h1, color: movement.color }}>{movement.name}</h2>
      <p style={s.sub}>{movement.period}</p>

      <div style={s.artistGrid}>
        {movement.artists.map((artist) => {
          const n = Math.min(scans[artist.id] ?? 0, MAX_SCANS)
          const progress = n / MAX_SCANS
          const unlocked = n > 0
          const initials = artist.name.split(' ').map((w) => w[0]).slice(0, 2).join('')

          return (
            <div key={artist.id} style={s.artistCard}>
              {/* Avatar with ring */}
              <div style={{ position: 'relative', width: 80, height: 80 }}>
                <Ring progress={progress} size={80} color={movement.color} bg="#1a1a1a" />
                <div style={{
                  ...s.avatar,
                  background: unlocked ? movement.color + '22' : '#1a1a1a',
                  border: `2px solid ${unlocked ? movement.color : '#333'}`,
                }}>
                  <span style={{ ...s.initials, color: unlocked ? movement.color : '#444' }}>
                    {initials}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div style={s.artistName}>{artist.name}</div>
              <div style={s.artistDates}>{artist.dates}</div>
              <div style={{
                ...s.levelBadge,
                background: unlocked ? movement.color + '22' : '#1a1a1a',
                color: unlocked ? movement.color : '#444',
                borderColor: unlocked ? movement.color + '55' : '#2a2a2a',
              }}>
                {getLevel(n)}
              </div>
              {n > 0 && n < MAX_SCANS && (
                <div style={s.scanCount}>{n}/{MAX_SCANS} œuvres</div>
              )}
              {n === MAX_SCANS && (
                <div style={{ ...s.scanCount, color: movement.color }}>✦ Expert</div>
              )}
              <div style={s.knownFor}>{artist.known_for}</div>
            </div>
          )
        })}
      </div>

      {/* Movement progress bar */}
      <div style={s.progressSection}>
        <div style={s.progressLabel}>
          Progression du mouvement
        </div>
        <div style={s.progressTrack}>
          <div style={{
            ...s.progressFill,
            width: `${movementProgress(movement.id, scans) * 100}%`,
            background: movement.color,
          }} />
        </div>
        <div style={{ ...s.progressLabel, color: movement.color }}>
          {LEVELS.map((lvl, i) => (
            <span key={lvl} style={{ opacity: movementProgress(movement.id, scans) * MAX_SCANS * movement.artists.length >= i * movement.artists.length ? 1 : 0.3 }}>
              {lvl}{i < LEVELS.length - 1 ? ' → ' : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = {
  page: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '1rem', padding: '2rem 1.2rem 1rem', width: '100%', maxWidth: 500, margin: '0 auto' },
  h1: { fontSize: '1.4rem', fontWeight: 700, letterSpacing: '.02em' },
  sub: { fontSize: '.85rem', opacity: 0.45, marginTop: -8 },
  back: { alignSelf: 'flex-start', background: 'none', border: 'none', color: '#888', fontSize: '.9rem', cursor: 'pointer', padding: 0 },

  timeline: { width: '100%', display: 'flex', flexDirection: 'column' as const, gap: 0 },
  timelineRow: { display: 'flex', alignItems: 'flex-start', gap: 16 },
  connectorCol: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', flexShrink: 0 },
  node: { position: 'relative' as const, width: 72, height: 72, borderRadius: '50%', background: '#111', border: '2px solid', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  nodePercent: { fontSize: '.75rem', fontWeight: 700, position: 'relative' as const, zIndex: 1 },
  line: { width: 2, height: 32, marginTop: 4, marginBottom: 4 },

  movementCard: { flex: 1, background: '#1a1a1a', border: 'none', borderRadius: 14, padding: '1rem', cursor: 'pointer', textAlign: 'left' as const, marginBottom: 8 },
  movementName: { fontSize: '1rem', fontWeight: 600, marginBottom: 2 },
  movementPeriod: { fontSize: '.8rem', opacity: 0.45, marginBottom: 6 },
  movementStats: { fontSize: '.75rem', opacity: 0.35 },

  artistGrid: { width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  artistCard: { background: '#1a1a1a', borderRadius: 16, padding: '1.2rem .8rem', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 6 },
  avatar: { position: 'absolute' as const, inset: 6, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: '1.1rem', fontWeight: 700 },
  artistName: { fontSize: '.85rem', fontWeight: 600, textAlign: 'center' as const, marginTop: 4 },
  artistDates: { fontSize: '.7rem', opacity: 0.35 },
  levelBadge: { fontSize: '.7rem', fontWeight: 600, padding: '3px 10px', borderRadius: 20, border: '1px solid', marginTop: 2 },
  scanCount: { fontSize: '.65rem', opacity: 0.5 },
  knownFor: { fontSize: '.65rem', opacity: 0.3, textAlign: 'center' as const, fontStyle: 'italic' },

  progressSection: { width: '100%', marginTop: 8, display: 'flex', flexDirection: 'column' as const, gap: 8 },
  progressLabel: { fontSize: '.7rem', opacity: 0.5, flexWrap: 'wrap' as const },
  progressTrack: { height: 6, background: '#222', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, transition: 'width .6s ease' },
} as const
