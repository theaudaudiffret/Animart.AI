import { useEffect, useRef, useState } from 'react'
import { MUSEUMS, getArtistById } from './data'

interface LibraryItem {
  phash: string
  titre: string | null
  artiste: string | null
  artist_id: string | null
  has_photo: boolean
  has_audio: boolean
  audio_mode: 'narrate' | 'immersive' | null
}

interface ArtworkDetail {
  description?: string
  epoque?: string | null
  technique?: string | null
}

export default function PageBiblio() {
  const [items, setItems] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [playingPhash, setPlayingPhash] = useState<string | null>(null)
  const [isLoadingAudio, setIsLoadingAudio] = useState(false)
  const [modal, setModal] = useState<LibraryItem | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    fetch('/library')
      .then((r) => r.json())
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function handlePlay(item: LibraryItem) {
    if (playingPhash === item.phash) {
      audioRef.current?.pause()
      setPlayingPhash(null)
      return
    }
    audioRef.current?.pause()
    setPlayingPhash(item.phash)
    setIsLoadingAudio(true)
    const endpoint = item.audio_mode === 'immersive' ? '/immersive-audio' : '/audio'
    const audio = new Audio(`${endpoint}/${item.phash}`)
    audioRef.current = audio
    audio.oncanplaythrough = () => setIsLoadingAudio(false)
    audio.onended = () => setPlayingPhash(null)
    audio.onerror = () => { setPlayingPhash(null); setIsLoadingAudio(false) }
    audio.play().catch(() => { setPlayingPhash(null); setIsLoadingAudio(false) })
  }

  function handleClose() {
    audioRef.current?.pause()
    setPlayingPhash(null)
    setModal(null)
  }

  if (loading) {
    return (
      <div style={s.page}>
        <h1 style={s.h1}>Library</h1>
        <div style={s.spinner} />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div style={s.page}>
        <h1 style={s.h1}>Library</h1>
        <p style={s.empty}>No artworks scanned yet.</p>
      </div>
    )
  }

  // Grouper par musée
  const museumGroups = MUSEUMS
    .map((m) => ({
      museum: m,
      items: items.filter((item) => getArtistById(item.artist_id || '')?.museum.id === m.id),
    }))
    .filter((g) => g.items.length > 0)

  const unknownItems = items.filter(
    (item) => !getArtistById(item.artist_id || ''),
  )

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Library</h1>
      <p style={s.sub}>{items.length} artwork{items.length > 1 ? 's' : ''}</p>

      {museumGroups.map(({ museum, items: groupItems }) => (
        <div key={museum.id} style={s.section}>
          <div style={s.sectionHeader}>
            <span style={{ ...s.sectionDot, background: museum.color }} />
            <span style={{ ...s.sectionName, color: museum.color }}>{museum.name}</span>
            <span style={s.sectionCount}>{groupItems.length}</span>
          </div>
          <div style={s.list}>
            {groupItems.map((item) => (
              <ArtworkRow
                key={item.phash}
                item={item}
                active={playingPhash === item.phash}
                isLoadingAudio={isLoadingAudio}
                accentColor={museum.color}
                onPlay={handlePlay}
                onClick={() => setModal(item)}
              />
            ))}
          </div>
        </div>
      ))}

      {unknownItems.length > 0 && (
        <div style={s.section}>
          <div style={s.sectionHeader}>
            <span style={{ ...s.sectionDot, background: '#c0b8af' }} />
            <span style={{ ...s.sectionName, color: '#8a8078' }}>Other</span>
            <span style={s.sectionCount}>{unknownItems.length}</span>
          </div>
          <div style={s.list}>
            {unknownItems.map((item) => (
              <ArtworkRow
                key={item.phash}
                item={item}
                active={playingPhash === item.phash}
                isLoadingAudio={isLoadingAudio}
                accentColor="#8a8078"
                onPlay={handlePlay}
                onClick={() => setModal(item)}
              />
            ))}
          </div>
        </div>
      )}

      {modal && (
        <ArtworkModal
          item={modal}
          playing={playingPhash === modal.phash}
          isLoadingAudio={isLoadingAudio}
          onPlay={handlePlay}
          onClose={handleClose}
        />
      )}
    </div>
  )
}

function ArtworkModal({ item, playing, isLoadingAudio, onPlay, onClose }: {
  item: LibraryItem
  playing: boolean
  isLoadingAudio: boolean
  onPlay: (item: LibraryItem) => void
  onClose: () => void
}) {
  const [detail, setDetail] = useState<ArtworkDetail | null>(null)
  const accentColor = getArtistById(item.artist_id || '')?.museum.color ?? '#c9a84c'

  useEffect(() => {
    fetch(`/artwork/${item.phash}`)
      .then((r) => r.json())
      .then((d) => setDetail({ description: d.description, epoque: d.epoque, technique: d.technique }))
      .catch(() => {})
  }, [item.phash])

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <button style={s.closeBtn} onClick={onClose}>✕</button>

        {item.has_photo && (
          <img
            src={`/photos/${item.phash}`}
            alt={item.titre ?? ''}
            style={s.modalImg}
          />
        )}

        <div style={s.modalBody}>
          <h2 style={s.modalTitre}>{item.titre ?? '—'}</h2>
          <p style={s.modalArtiste}>{item.artiste ?? '—'}</p>

          {(detail?.epoque || detail?.technique) && (
            <p style={s.modalMeta}>
              {[detail.epoque, detail.technique].filter(Boolean).join(' · ')}
            </p>
          )}

          {item.has_audio && (
            <button
              style={{
                ...s.modalPlayBtn,
                background: playing ? accentColor : '#f0ece4',
                color: playing ? '#fff' : '#1c1812',
              }}
              onClick={() => onPlay(item)}
            >
              <span style={{ fontSize: '1rem' }}>
                {playing && isLoadingAudio ? '…' : playing ? '⏸' : '▷'}
              </span>
              <span style={{ fontFamily: PLAYFAIR, fontStyle: 'italic', fontSize: '.85rem' }}>
                {playing ? 'Playing' : 'Play'}
              </span>
            </button>
          )}

          {detail?.description && (
            <p style={s.modalDesc}>{detail.description}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function ArtworkRow({ item, active, isLoadingAudio, accentColor, onPlay, onClick }: {
  item: LibraryItem
  active: boolean
  isLoadingAudio: boolean
  accentColor: string
  onPlay: (item: LibraryItem) => void
  onClick: () => void
}) {
  return (
    <div
      style={{ ...s.item, borderColor: active ? accentColor + '66' : '#e8e2d8', cursor: 'pointer' }}
      onClick={onClick}
    >
      {item.has_photo
        ? <img src={`/photos/${item.phash}`} alt="" style={s.thumb} />
        : <div style={s.thumbFallback}>◆</div>}

      <div style={s.info}>
        <div style={s.titre}>{item.titre ?? '—'}</div>
        <div style={s.artiste}>{item.artiste ?? '—'}</div>
      </div>

      {item.has_audio && (
        <button
          style={{
            ...s.playBtn,
            background: active ? accentColor : 'transparent',
            border: active ? 'none' : '1px solid #e4ddd3',
          }}
          onClick={(e) => { e.stopPropagation(); onPlay(item) }}
        >
          <span style={{ color: active ? '#fff' : '#1c1812', fontSize: '.8rem', opacity: active ? 1 : 0.6 }}>
            {active && isLoadingAudio ? '…' : active ? '⏸' : '▷'}
          </span>
        </button>
      )}
    </div>
  )
}

const PLAYFAIR = "'Playfair Display', Georgia, serif"
const SANS = "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif"

const s = {
  page: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '1.5rem', padding: '2rem 1.2rem 1rem', width: '100%', maxWidth: 500, margin: '0 auto', color: '#1c1812' },
  h1: { fontFamily: PLAYFAIR, fontSize: '1.5rem', fontWeight: 400, color: '#1c1812' },
  sub: { fontFamily: SANS, fontSize: '.78rem', color: '#1c1812', opacity: 0.35, marginTop: -8 },
  empty: { fontFamily: SANS, color: '#1c1812', opacity: 0.3, fontSize: '.88rem', textAlign: 'center' as const, marginTop: '4rem' },
  spinner: { width: 32, height: 32, border: '2px solid #e4ddd3', borderTopColor: '#c9a84c', borderRadius: '50%', animation: 'spin .8s linear infinite', marginTop: '4rem' },

  section: { width: '100%', display: 'flex', flexDirection: 'column' as const, gap: 8 },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 2 },
  sectionDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  sectionName: { fontFamily: PLAYFAIR, fontSize: '.88rem', fontWeight: 400, flex: 1 },
  sectionCount: { fontFamily: SANS, fontSize: '.7rem', color: '#1c1812', opacity: 0.35 },

  list: { display: 'flex', flexDirection: 'column' as const, gap: 6 },
  item: { display: 'flex', alignItems: 'center', gap: 12, background: '#ffffff', borderRadius: 10, padding: 10, border: '1px solid', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.05)', transition: 'border-color .2s' },

  thumb: { width: 52, height: 52, objectFit: 'cover' as const, borderRadius: 7, flexShrink: 0 },
  thumbFallback: { width: 52, height: 52, background: '#f0ece4', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.9rem', flexShrink: 0, color: '#d4cdc5' },

  info: { flex: 1, minWidth: 0 },
  titre: { fontFamily: PLAYFAIR, fontSize: '.9rem', fontWeight: 400, color: '#1c1812', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  artiste: { fontFamily: SANS, fontSize: '.7rem', color: '#1c1812', opacity: 0.4, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },

  playBtn: { width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .2s, border .15s' },

  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(28,24,18,.55)', backdropFilter: 'blur(3px)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modal: { position: 'relative' as const, background: '#fff', borderRadius: '18px 18px 0 0', width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' as const, boxShadow: '0 -8px 40px rgba(0,0,0,.18)' },
  closeBtn: { position: 'absolute' as const, top: 14, right: 16, background: '#f0ece4', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', fontSize: '.75rem', color: '#1c1812', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 },

  modalImg: { width: '100%', height: 'auto', display: 'block', borderRadius: '18px 18px 0 0' },
  modalBody: { padding: '1.2rem 1.4rem 2rem', display: 'flex', flexDirection: 'column' as const, gap: '0.7rem' },
  modalTitre: { fontFamily: PLAYFAIR, fontSize: '1.25rem', fontWeight: 400, margin: 0, color: '#1c1812', lineHeight: 1.3 },
  modalArtiste: { fontFamily: SANS, fontSize: '.78rem', color: '#1c1812', opacity: 0.45, margin: 0 },
  modalMeta: { fontFamily: SANS, fontSize: '.72rem', color: '#8a8078', margin: 0, fontStyle: 'italic' },
  modalPlayBtn: { display: 'flex', alignItems: 'center', gap: 10, border: 'none', borderRadius: 10, padding: '10px 18px', cursor: 'pointer', transition: 'background .2s', alignSelf: 'flex-start' as const, marginTop: 4 },
  modalDesc: { fontFamily: SANS, fontSize: '.83rem', color: '#1c1812', opacity: 0.75, lineHeight: 1.65, margin: 0 },
} as const
