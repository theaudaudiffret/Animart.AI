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
}
