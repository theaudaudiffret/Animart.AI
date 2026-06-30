import { useState } from 'react'
import { signIn, signUp } from './api'

// Connexion / inscription email + mot de passe (Supabase Auth). À la réussite,
// onAuthStateChange (dans App) prend le relais pour la navigation.
export default function Auth({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const canSubmit = email.trim() !== '' && password.length >= 6 && !busy

  async function submit() {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'signup') {
        const signedIn = await signUp(email.trim(), password)
        if (!signedIn) {
          // Confirmation d'email requise : pas de session, on bascule en connexion.
          setNotice('Check your inbox to confirm your email, then sign in.')
          setMode('signin')
        }
      } else {
        await signIn(email.trim(), password)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={s.page}>
      <button style={s.back} onClick={onBack}>← Back</button>

      <div style={s.hero}>
        <h1 style={s.title}>Animart.ai</h1>
        <p style={s.tagline}>{mode === 'signin' ? 'Welcome back' : 'Create your account'}</p>
      </div>

      <div style={s.form}>
        <input
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={s.input}
        />
        <input
          type="password"
          placeholder="Password (min. 6 characters)"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          style={s.input}
        />

        {error && <p style={s.error}>{error}</p>}
        {notice && <p style={s.notice}>{notice}</p>}

        <button style={{ ...s.primaryBtn, opacity: canSubmit ? 1 : 0.45 }} disabled={!canSubmit} onClick={submit}>
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>

        <button
          style={s.switchBtn}
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setNotice(null) }}
        >
          {mode === 'signin' ? "No account yet? Create one" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}

const PLAYFAIR = "'Playfair Display', Georgia, serif"
const SANS = "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif"

const s = {
  page: { width: '100%', maxWidth: 440, margin: '0 auto', padding: '2.5rem 1.4rem', display: 'flex', flexDirection: 'column' as const, gap: '1.6rem', minHeight: '100vh', justifyContent: 'center' },
  back: { position: 'absolute' as const, top: 18, left: 18, background: 'none', border: 'none', color: '#1c1812', opacity: 0.45, fontSize: '.82rem', cursor: 'pointer', fontFamily: SANS, letterSpacing: '.04em' },

  hero: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 8, textAlign: 'center' as const },
  title: { fontFamily: PLAYFAIR, fontStyle: 'italic' as const, fontSize: '2.6rem', fontWeight: 400, color: '#8a5a2b', margin: 0 },
  tagline: { fontFamily: PLAYFAIR, fontSize: '.95rem', color: '#1c1812', opacity: 0.5, margin: 0 },

  form: { display: 'flex', flexDirection: 'column' as const, gap: 12 },
  input: { width: '100%', background: '#ffffff', border: '1px solid #e4ddd3', borderRadius: 8, padding: '12px 14px', fontSize: '.92rem', fontFamily: SANS, color: '#1c1812', outline: 'none', boxSizing: 'border-box' as const },
  error: { color: '#c0392b', fontSize: '.8rem', fontFamily: SANS, margin: 0, textAlign: 'center' as const },
  notice: { color: '#4E8A6E', fontSize: '.8rem', fontFamily: SANS, margin: 0, textAlign: 'center' as const },

  primaryBtn: { width: '100%', background: 'linear-gradient(135deg, #c9a84c, #a67c2a)', color: '#fff', border: 'none', borderRadius: 10, padding: '1rem', fontSize: '.95rem', letterSpacing: '.04em', fontWeight: 600, cursor: 'pointer', fontFamily: SANS, boxShadow: '0 4px 16px rgba(166,124,42,.3)' },
  switchBtn: { background: 'none', border: 'none', color: '#1c1812', opacity: 0.5, fontSize: '.8rem', cursor: 'pointer', fontFamily: SANS, marginTop: 2, textDecoration: 'underline' as const },
} as const
