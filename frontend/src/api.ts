// Per-user profile identity + a fetch wrapper that tags every request with it.
// The active profile id lives in localStorage and is sent as X-Profile-Id so the
// backend can keep each visitor's library, progress and persona isolated.

import type { JourneyPlan } from './types'

const PROFILE_ID_KEY = 'animart-profile-id'

export interface Profile {
  id: string
  name: string | null
  persona: 'serious' | 'fun' | null
  journey: JourneyPlan | null
  library_count: number
}

export interface Me {
  id: string | null
  name: string | null
  persona: 'serious' | 'fun' | null
  journey: JourneyPlan | null
  progress: Record<string, number>
  library_count: number
}

export function getProfileId(): string | null {
  return localStorage.getItem(PROFILE_ID_KEY)
}

export function setProfileId(id: string): void {
  localStorage.setItem(PROFILE_ID_KEY, id)
}

export function newProfileId(): string {
  const rand = Math.random().toString(36).slice(2, 10)
  const id = `p-${Date.now().toString(36)}${rand}`
  setProfileId(id)
  return id
}

// fetch with the active profile id attached. Throws on non-2xx.
export async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  const id = getProfileId()
  if (id) headers.set('X-Profile-Id', id)
  const res = await fetch(path, { ...init, headers })
  if (!res.ok) throw new Error(`Server error (${res.status})`)
  return res
}

// <img>/Audio src can't send headers — the persona goes in the query instead.
export function assetUrl(path: string, persona: string | null): string {
  return persona ? `${path}?persona=${encodeURIComponent(persona)}` : path
}

export async function fetchProfiles(): Promise<Profile[]> {
  try {
    return await (await fetch('/profiles')).json()
  } catch {
    return []
  }
}

export async function fetchMe(): Promise<Me | null> {
  try {
    const me: Me = await (await api('/me')).json()
    return me.id ? me : null
  } catch {
    return null
  }
}
