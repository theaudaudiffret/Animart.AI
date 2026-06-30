import { useEffect, useState } from 'react'
import PageI from './PageI'
import PageII from './PageII'
import PageBiblio from './PageBiblio'
import Landing from './Landing'
import Auth from './Auth'
import OnboardingFlow from './Onboarding'
import { getArtistById, getLevel, MAX_SCANS } from './data'
import { fetchMe, signOut, supabase, type Me } from './api'

type Tab = 'camera' | 'achievements' | 'library'
// 'boot' = session inconnue ; 'landing'/'auth' = non connecté ; sinon connecté.
type View = 'boot' | 'landing' | 'auth' | 'onboarding' | 'app'

interface Toast {
  artistName: string
  museumName: string
  level: string
  isNew: boolean
  color: string
}

export default function App() {
  const [view, setView] = useState<View>('boot')
  const [me, setMe] = useState<Me | null>(null)
  const [progress, setProgress] = useState<Record<string, number>>({})
  const [tab, setTab] = useState<Tab>('camera')
  const [toast, setToast] = useState<Toast | null>(null)
  const [toastTimer, setToastTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  // Source de vérité = l'état d'auth Supabase. onAuthStateChange fire aussi au montage
  // (INITIAL_SESSION). On ne fait pas d'appel Supabase async DANS le callback (deadlock
  // connu) → on diffère le chargement du profil via setTimeout.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setTimeout(loadProfile, 0)
      } else {
        setMe(null)
        setProgress({})
        setView((v) => (v === 'auth' ? 'auth' : 'landing'))
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function loadProfile() {
    const m = await fetchMe()
    setMe(m)
    if (m?.persona) {
      setProgress(m.progress || {})
      setTab('camera')
      setView('app')
    } else {
      setView('onboarding')  // connecté mais pas encore de profil
    }
  }

  async function onboardingDone() {
    await loadProfile()
  }

  function leaveToLanding() {
    void signOut()  // déclenche onAuthStateChange → 'landing'
  }

  // The /analyze response carries the artist's new quest count (or null when
  // nothing was counted), so library and progress stay in lockstep server-side.
  function handleArtistFound(artistId: string, scans: number | null) {
    if (scans == null) return
    const found = getArtistById(artistId)
    if (!found) return
    setProgress((p) => ({ ...p, [artistId]: scans }))
    if (scans > MAX_SCANS) return
    if (toastTimer) clearTimeout(toastTimer)
    setToast({
      artistName: found.artist.name,
      museumName: found.museum.name,
      level: getLevel(scans),
      isNew: scans === 1,
      color: found.museum.color,
    })
    setToastTimer(setTimeout(() => setToast(null), 3500))
  }

  if (view === 'boot') {
    return <div style={s.bootScreen}><div style={s.spinner} /></div>
  }

  if (view === 'landing') {
    return <Landing onGetStarted={() => setView('auth')} />
  }

  if (view === 'auth') {
    return <Auth onBack={() => setView('landing')} />
  }

  if (view === 'onboarding') {
    return <OnboardingFlow onComplete={onboardingDone} onBack={leaveToLanding} />
  }

  return (
    <div style={s.root}>
      <div style={s.scrollArea}>
        <PageI
          hidden={tab !== 'camera'}
          me={me!}
          onArtistFound={handleArtistFound}
          onSignOut={leaveToLanding}
        />
        {tab === 'achievements' && <PageII progress={progress} journey={me?.journey ?? null} />}
        {tab === 'library' && <PageBiblio persona={me?.persona ?? null} />}
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
  bootScreen: { minHeight: '100vh', background: '#f7f4ef', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  spinner: { width: 40, height: 40, border: '3px solid #e4ddd3', borderTopColor: '#c9a84c', borderRadius: '50%', animation: 'spin .8s linear infinite' },
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
