export interface VisitorProfile {
  age_range: string
  level: string
  interests: string[]
  tone: string
}

export interface Caption {
  text: string
  start: number
  end: number
}

export interface SceneCharacter {
  name_or_role: string
  presence: 'visible' | 'implied' | 'off_scene'
  connection_to_moment: string
}

export interface ArtworkSummary {
  titre_probable: string | null
  artiste_probable: string | null
  style: string
  epoque: string | null
  technique: string | null
  description: string
  depicted_moment: string | null
  narrative_context: string | null
  scene_characters: SceneCharacter[]
  couleurs_dominantes: string[]
  ambiance: string
  sujets: string[]
  artist_id: string | null
  from_cache: boolean
  in_session: boolean
  _key: string
}
