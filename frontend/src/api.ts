// Auth Supabase + un wrapper fetch qui attache le JWT du visiteur à chaque requête.
// Le client n'utilise Supabase QUE pour l'auth ; toutes les données passent par
// l'API FastAPI (qui vérifie le JWT et isole chaque utilisateur via la service_role).

import { createClient, type Session } from '@supabase/supabase-js'
import type { JourneyPlan } from './types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface Me {
  id: string | null
  name: string | null
  persona: 'serious' | 'fun' | null
  journey: JourneyPlan | null
  progress: Record<string, number>
  library_count: number
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession()
  return data.session
}

// Inscription. Renvoie true si une session est ouverte immédiatement (confirmation
// d'email désactivée), false s'il faut confirmer par email avant de se connecter.
export async function signUp(email: string, password: string): Promise<boolean> {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return !!data.session
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

// fetch avec le token courant attaché. Lève sur non-2xx.
export async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(path, { ...init, headers })
  if (!res.ok) throw new Error(`Server error (${res.status})`)
  return res
}

// <img>/Audio src ne peuvent pas envoyer de header — la persona va dans la query.
export function assetUrl(path: string, persona: string | null): string {
  return persona ? `${path}?persona=${encodeURIComponent(persona)}` : path
}

export async function fetchMe(): Promise<Me | null> {
  try {
    const me: Me = await (await api('/me')).json()
    return me.id ? me : null
  } catch {
    return null
  }
}
