import { useState } from 'react'
import PageI from './PageI'
import PageII from './PageII'
import PageBiblio from './PageBiblio'
import { getArtistById, getLevel, MAX_SCANS } from './data'

const PROGRESS_KEY = 'genz-museum-progress'

function getProgress(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}') }
  catch { return {} }
}

type Tab = 'camera' | 'achievements' | 'library'

interface Toast {
  artistName: string
  museumName: string
  level: string
  isNew: boolean
  color: string
}

export default function App() {
  const [tab, setTab] = useState<Tab>('camera')
  const [toast, setToast] = useState<Toast | null>(null)
  const [toastTimer, setToastTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  function handleArtistFound(artistId: string) {
    const found = getArtistById(artistId)
    if (!found) return

    const prog = getProgress()
    const prev = prog[artistId] ?? 0
    if (prev >= MAX_SCANS) return

    const next = Math.min(prev + 1, MAX_SCANS)
    prog[artistId] = next
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(prog))

    if (toastTimer) clearTimeout(toastTimer)
    setToast({
      artistName: found.artist.name,
      museumName: found.museum.name,
      level: getLevel(next),
      isNew: prev === 0,
      color: found.museum.color,
    })
    setToastTimer(setTimeout(() => setToast(null), 3500))
  }

  return (
    <div style={s.root}>
      <div style={s.scrollArea}>
        <PageI hidden={tab !== 'camera'} onArtistFound={handleArtistFound} onNewProfile={() => localStorage.removeItem(PROGRESS_KEY)} />
        {tab === 'achievements' && <PageII />}
        {tab === 'library' && <PageBiblio />}
      </div>

      {toast && (
        <div style={{ ...s.toast, borderColor: toast.color }}>
          <span style={{ color: toast.color, fontFamily: "'Playfair Display', Georgia, serif", fontStyle: 'italic', fontSize: '.82rem' }}>
            {toast.isNew ? '◆ Discovery' : '↑ Progress'}
          </span>
          <div style={s.toastText}>
            <span style={{ fontWeight: 600, color: '#1c1812' }}>{toast.artistName}</span>
            <span style={{ fontSize: '.7rem', color: '#1c1812', opacity: 0.45 }}>{toast.museumName}</span>
          </div>
          <span style={{ ...s.toastLevel, background: toast.color + '22', color: toast.color }}>
            {toast.level}
          </span>
        </div>
      )}

      <nav style={s.tabBar}>
        <TabBtn glyph="⊙" label="Scan" active={tab === 'camera'} onClick={() => setTab('camera')} />
        <TabBtn glyph="◫" label="Library" active={tab === 'library'} onClick={() => setTab('library')} />
        <TabBtn glyph="◈" label="Collection" active={tab === 'achievements'} onClick={() => setTab('achievements')} />
      </nav>
    </div>
  )
}

function TabBtn({ glyph, label, active, onClick }: {
  glyph: string; label: string; active: boolean; onClick: () => void
}) {
  return (
    <button
      style={{ ...s.tabBtn, color: active ? '#a67c2a' : '#1c1812', opacity: active ? 1 : 0.35 }}
      onClick={onClick}
    >
      <span style={s.tabGlyph}>{glyph}</span>
      <span style={s.tabLabel}>{label}</span>
    </button>
  )
}

const s = {
  root: {
    minHeight: '100vh',
    background: '#f7f4ef',
    color: '#1c1812',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
    display: 'flex',
    flexDirection: 'column' as const,
    position: 'relative' as const,
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto' as const,
    paddingBottom: 80,
    display: 'flex',
    justifyContent: 'center',
  },
  toast: {
    position: 'fixed' as const,
    top: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#ffffff',
    border: '1px solid',
    borderRadius: 10,
    padding: '8px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: '.85rem',
    zIndex: 100,
    boxShadow: '0 4px 20px rgba(0,0,0,.1)',
    maxWidth: 'calc(100vw - 32px)',
  },
  toastText: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 1,
  },
  toastLevel: {
    padding: '2px 9px',
    borderRadius: 4,
    fontSize: '.7rem',
    fontWeight: 600,
    letterSpacing: '.04em',
  },
  tabBar: {
    position: 'fixed' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: 68,
    background: '#f0ece4',
    borderTop: '1px solid #ddd8ce',
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    zIndex: 50,
  },
  tabBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 4,
    padding: '8px 24px',
    transition: 'color .15s, opacity .15s',
  },
  tabGlyph: { fontSize: '1.1rem', lineHeight: 1 },
  tabLabel: {
    fontSize: '.6rem',
    letterSpacing: '.1em',
    textTransform: 'uppercase' as const,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
  },
} as const
