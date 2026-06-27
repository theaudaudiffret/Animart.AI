export const LEVELS = ['Inconnu', 'Novice', 'Initié', 'Amateur d\'art', 'Connaisseur', 'Expert']
export const SCANS_PER_LEVEL = 1
export const MAX_SCANS = LEVELS.length - 1 // 5

export interface Artist {
  id: string
  name: string
  dates: string
  known_for: string
}

export interface Movement {
  id: string
  name: string
  period: string
  color: string
  artists: Artist[]
}

export const MOVEMENTS: Movement[] = [
  {
    id: 'renaissance-italienne',
    name: 'Renaissance italienne',
    period: '1400 – 1550',
    color: '#D4A853',
    artists: [
      { id: 'leonard-de-vinci', name: 'Léonard de Vinci', dates: '1452–1519', known_for: 'La Joconde' },
      { id: 'raphael',          name: 'Raphaël',           dates: '1483–1520', known_for: 'La Belle Jardinière' },
      { id: 'titien',           name: 'Titien',             dates: '1490–1576', known_for: 'Le Concert champêtre' },
      { id: 'veronese',         name: 'Véronèse',           dates: '1528–1588', known_for: 'Les Noces de Cana' },
      { id: 'fra-angelico',     name: 'Fra Angelico',       dates: '1395–1455', known_for: 'Le Couronnement de la Vierge' },
    ],
  },
  {
    id: 'baroque-flamand',
    name: 'Baroque flamand & hollandais',
    period: '1600 – 1680',
    color: '#7B6CA8',
    artists: [
      { id: 'rembrandt', name: 'Rembrandt',  dates: '1606–1669', known_for: 'Bethsabée au bain' },
      { id: 'rubens',    name: 'Rubens',     dates: '1577–1640', known_for: 'Henri IV et Marie de Médicis' },
      { id: 'vermeer',   name: 'Vermeer',    dates: '1632–1675', known_for: 'La Dentellière' },
      { id: 'van-dyck',  name: 'Van Dyck',   dates: '1599–1641', known_for: 'Charles Ier d\'Angleterre' },
      { id: 'jordaens',  name: 'Jordaens',   dates: '1593–1678', known_for: 'Les Quatre Évangélistes' },
    ],
  },
  {
    id: 'baroque-classicisme',
    name: 'Baroque & Classicisme',
    period: '1600 – 1720',
    color: '#C06B4A',
    artists: [
      { id: 'caravage',           name: 'Caravage',             dates: '1571–1610', known_for: 'La Mort de la Vierge' },
      { id: 'poussin',            name: 'Nicolas Poussin',       dates: '1594–1665', known_for: 'Les Bergers d\'Arcadie' },
      { id: 'georges-de-la-tour', name: 'Georges de La Tour',    dates: '1593–1652', known_for: 'Saint Joseph charpentier' },
      { id: 'champaigne',         name: 'Philippe de Champaigne',dates: '1602–1674', known_for: 'Ex-Voto de 1662' },
      { id: 'claude-lorrain',     name: 'Claude Lorrain',        dates: '1600–1682', known_for: 'Port de mer au soleil couchant' },
    ],
  },
  {
    id: 'rococo-lumieres',
    name: 'Rococo & Lumières',
    period: '1700 – 1790',
    color: '#5B9E8A',
    artists: [
      { id: 'watteau',       name: 'Watteau',          dates: '1684–1721', known_for: 'Pèlerinage à l\'île de Cythère' },
      { id: 'fragonard',     name: 'Fragonard',        dates: '1732–1806', known_for: 'Le Verrou' },
      { id: 'boucher',       name: 'Boucher',          dates: '1703–1770', known_for: 'Diane sortant du bain' },
      { id: 'chardin',       name: 'Chardin',          dates: '1699–1779', known_for: 'La Raie' },
      { id: 'vigee-le-brun', name: 'Vigée Le Brun',   dates: '1755–1842', known_for: 'Marie-Antoinette à la rose' },
    ],
  },
  {
    id: 'neoclassicisme-romantisme',
    name: 'Néoclassicisme & Romantisme',
    period: '1780 – 1850',
    color: '#4A7BC0',
    artists: [
      { id: 'david',     name: 'Jacques-Louis David', dates: '1748–1825', known_for: 'Le Sacre de Napoléon' },
      { id: 'ingres',    name: 'Ingres',              dates: '1780–1867', known_for: 'La Grande Odalisque' },
      { id: 'delacroix', name: 'Delacroix',           dates: '1798–1863', known_for: 'La Liberté guidant le peuple' },
      { id: 'gericault', name: 'Géricault',           dates: '1791–1824', known_for: 'Le Radeau de la Méduse' },
      { id: 'gros',      name: 'Antoine-Jean Gros',   dates: '1771–1835', known_for: 'Bonaparte au pont d\'Arcole' },
    ],
  },
]

export function getLevel(scans: number): string {
  return LEVELS[Math.min(scans, MAX_SCANS)]
}

export function getArtistById(id: string): { artist: Artist; movement: Movement } | null {
  for (const m of MOVEMENTS) {
    const a = m.artists.find((a) => a.id === id)
    if (a) return { artist: a, movement: m }
  }
  return null
}

export function movementProgress(movementId: string, scans: Record<string, number>): number {
  const m = MOVEMENTS.find((m) => m.id === movementId)
  if (!m) return 0
  const total = m.artists.reduce((sum, a) => sum + Math.min(scans[a.id] ?? 0, MAX_SCANS), 0)
  return total / (m.artists.length * MAX_SCANS)
}
