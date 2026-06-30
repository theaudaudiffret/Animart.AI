export interface VisitorProfile {
  name: string
  age_range: string
  level: string
  interests: string[]
  tone: string
}

export interface JourneyPlan {
  cityId: string
  cityName: string
  museumId: string
  museumName: string
  museumBookingUrl: string
  artist?: string
  artistId?: string
  era?: string
}

export interface Caption {
  text: string
  start: number
  end: number
}

export interface ArtworkSummary {
  titre_probable: string | null
  artiste_probable: string | null
  style: string
  epoque: string | null
  technique: string | null
  description: string
  couleurs_dominantes: string[]
  ambiance: string
  sujets: string[]
  artist_id: string | null
  from_cache: boolean
  in_session: boolean
  artist_scans: number | null // new quest count for this artist, or null if nothing counted
  _key: string
}
