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
    if (prev >= MAX_SCANS) return // déjà expert

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

      {/* Toast notification */}
      {toast && (
        <div style={{ ...s.toast, borderColor: toast.color }}>
          <span style={{ color: toast.color, fontWeight: 700 }}>
            {toast.isNew ? '🎨 Découverte !' : '⬆️ Progression'}
          </span>
          <div style={s.toastText}>
            <span style={{ fontWeight: 600 }}>{toast.artistName}</span>
            <span style={{ fontSize: '.72rem', opacity: 0.5 }}>{toast.museumName}</span>
          </div>
          <span style={{ ...s.toastLevel, background: toast.color + '22', color: toast.color }}>
            {toast.level}
          </span>
        </div>
      )}

      {/* Tab bar */}
      <nav style={s.tabBar}>
        <TabBtn icon="📷" label="Scanner" active={tab === 'camera'} onClick={() => setTab('camera')} />
        <TabBtn icon="📚" label="Bibliothèque" active={tab === 'library'} onClick={() => setTab('library')} />
        <TabBtn icon="🏆" label="Collection" active={tab === 'achievements'} onClick={() => setTab('achievements')} />
      </nav>
    </div>
  )
}

function TabBtn({ icon, label, active, onClick }: {
  icon: string; label: string; active: boolean; onClick: () => void
}) {
  return (
    <button style={{ ...s.tabBtn, opacity: active ? 1 : 0.45 }} onClick={onClick}>
      <span style={s.tabIcon}>{icon}</span>
      <span style={{ ...s.tabLabel, fontWeight: active ? 700 : 400 }}>{label}</span>
    </button>
  )
}

const s = {
  root: {
    minHeight: '100vh',
    background: '#0f0f0f',
    color: '#f0f0f0',
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
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
    background: '#1a1a1a',
    border: '1px solid',
    borderRadius: 14,
    padding: '10px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: '.85rem',
    zIndex: 100,
    boxShadow: '0 4px 24px rgba(0,0,0,.6)',
    maxWidth: 'calc(100vw - 32px)',
  },
  toastText: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 1,
  },
  toastLevel: {
    padding: '2px 10px',
    borderRadius: 20,
    fontSize: '.75rem',
    fontWeight: 600,
  },
  tabBar: {
    position: 'fixed' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: 72,
    background: '#141414',
    borderTop: '1px solid #222',
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    zIndex: 50,
  },
  tabBtn: {
    background: 'none',
    border: 'none',
    color: '#f0f0f0',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 3,
    padding: '8px 24px',
  },
  tabIcon: { fontSize: '1.4rem' },
  tabLabel: { fontSize: '.65rem', letterSpacing: '.05em' },
} as const
