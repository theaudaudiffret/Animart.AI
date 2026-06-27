export interface VisitorProfile {
  age_range: string
  level: string
  interests: string[]
  tone: string
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
}
