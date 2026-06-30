const STEPS = [
  { glyph: '⊙', title: 'Photograph', text: 'Point your camera at any artwork.' },
  { glyph: '♪', title: 'Listen', text: 'Get a commentary tuned to your taste.' },
  { glyph: '◈', title: 'Collect', text: 'Unlock artists and fill your library.' },
]

// First screen: brand + how-it-works, then sign in / create an account.
export default function Landing({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <div style={s.page}>
      <div style={s.hero}>
        <h1 style={s.title}>Animart.ai</h1>
        <p style={s.tagline}>Your personal audio guide for the world's museums</p>
      </div>

      <div style={s.steps}>
        {STEPS.map((step, i) => (
          <div key={step.title} style={s.step}>
            <span style={s.stepGlyph}>{step.glyph}</span>
            <div style={s.stepText}>
              <span style={s.stepTitle}>{i + 1}. {step.title}</span>
              <span style={s.stepSub}>{step.text}</span>
            </div>
          </div>
        ))}
      </div>

      <button style={s.primaryBtn} onClick={onGetStarted}>Get started →</button>
    </div>
  )
}

const PLAYFAIR = "'Playfair Display', Georgia, serif"
const SANS = "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif"

const s = {
  page: { width: '100%', maxWidth: 500, margin: '0 auto', padding: '3rem 1.4rem 2rem', display: 'flex', flexDirection: 'column' as const, gap: '1.6rem', minHeight: '100vh', justifyContent: 'center' },
  hero: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 8, textAlign: 'center' as const },
  title: { fontFamily: PLAYFAIR, fontStyle: 'italic' as const, fontSize: '3rem', fontWeight: 400, color: '#8a5a2b', margin: 0, textShadow: '0 1px 2px rgba(138,90,43,.12)' },
  tagline: { fontFamily: PLAYFAIR, fontSize: '.95rem', color: '#1c1812', opacity: 0.5, margin: 0, lineHeight: 1.4, maxWidth: 280 },

  steps: { display: 'flex', flexDirection: 'column' as const, gap: 12, background: '#ffffff', border: '1px solid #e8e2d8', borderRadius: 12, padding: '1.2rem 1.3rem', boxShadow: '0 1px 4px rgba(0,0,0,.05)' },
  step: { display: 'flex', alignItems: 'center', gap: 14 },
  stepGlyph: { fontSize: '1.2rem', color: '#a67c2a', width: 26, textAlign: 'center' as const, flexShrink: 0 },
  stepText: { display: 'flex', flexDirection: 'column' as const, gap: 1 },
  stepTitle: { fontFamily: SANS, fontSize: '.85rem', fontWeight: 600, color: '#1c1812' },
  stepSub: { fontFamily: SANS, fontSize: '.74rem', color: '#1c1812', opacity: 0.5 },

  primaryBtn: { width: '100%', background: 'linear-gradient(135deg, #c9a84c, #a67c2a)', color: '#fff', border: 'none', borderRadius: 10, padding: '1rem', fontSize: '.95rem', letterSpacing: '.04em', fontWeight: 600, cursor: 'pointer', fontFamily: SANS, boxShadow: '0 4px 16px rgba(166,124,42,.3)' },
} as const
