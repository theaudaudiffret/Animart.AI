export const LEVELS = ['Inconnu', 'Novice', 'Initié', 'Amateur d\'art', 'Connaisseur', 'Expert']
export const SCANS_PER_LEVEL = 1
export const MAX_SCANS = LEVELS.length - 1 // 5

const PORTRAIT = (id: string) =>
  `https://api.dicebear.com/7.x/adventurer/svg?seed=${id}&backgroundColor=b6e3f4,ffd5dc,d1f4e0,c0aede`

export interface Artist {
  id: string
  name: string
  dates: string
  known_for: string
  portrait: string
}

export interface Movement {
  id: string
  name: string
  period: string
  color: string
  icon: string
  artists: Artist[]
}

export const MOVEMENTS: Movement[] = [
  {
    id: 'primitifs-flamands',
    name: 'Primitifs flamands',
    period: '1420 – 1510',
    color: '#7A8C6A',
    icon: '⛪',
    artists: [
      { id: 'jan-van-eyck',           name: 'Jan van Eyck',           dates: '1390–1441', known_for: 'La Vierge du chancelier Rolin',    portrait: PORTRAIT('jan-van-eyck') },
      { id: 'rogier-van-der-weyden',  name: 'Rogier van der Weyden',  dates: '1400–1464', known_for: 'L\'Annonciation triptyque Miraflores', portrait: PORTRAIT('rogier-van-der-weyden') },
      { id: 'hans-memling',           name: 'Hans Memling',           dates: '1430–1494', known_for: 'La Vierge à l\'Enfant',           portrait: PORTRAIT('hans-memling') },
      { id: 'dierick-bouts',          name: 'Dierick Bouts',          dates: '1410–1475', known_for: 'L\'Arrestation du Christ',         portrait: PORTRAIT('dierick-bouts') },
      { id: 'petrus-christus',        name: 'Petrus Christus',        dates: '1410–1475', known_for: 'Portrait de jeune fille',           portrait: PORTRAIT('petrus-christus') },
    ],
  },
  {
    id: 'renaissance-italienne',
    name: 'Renaissance italienne',
    period: '1400 – 1550',
    color: '#D4A853',
    icon: '🌿',
    artists: [
      { id: 'leonard-de-vinci', name: 'Léonard de Vinci', dates: '1452–1519', known_for: 'La Joconde',                    portrait: PORTRAIT('leonard-de-vinci') },
      { id: 'raphael',          name: 'Raphaël',           dates: '1483–1520', known_for: 'La Belle Jardinière',           portrait: PORTRAIT('raphael') },
      { id: 'titien',           name: 'Titien',             dates: '1490–1576', known_for: 'Le Concert champêtre',          portrait: PORTRAIT('titien') },
      { id: 'veronese',         name: 'Véronèse',           dates: '1528–1588', known_for: 'Les Noces de Cana',            portrait: PORTRAIT('veronese') },
      { id: 'fra-angelico',     name: 'Fra Angelico',       dates: '1395–1455', known_for: 'Le Couronnement de la Vierge', portrait: PORTRAIT('fra-angelico') },
    ],
  },
  {
    id: 'manierisme',
    name: 'Maniérisme',
    period: '1520 – 1600',
    color: '#9B5CA0',
    icon: '🌀',
    artists: [
      { id: 'arcimboldo',       name: 'Arcimboldo',           dates: '1526–1593', known_for: 'Les Quatre Saisons',           portrait: PORTRAIT('arcimboldo') },
      { id: 'rosso-fiorentino', name: 'Rosso Fiorentino',     dates: '1494–1540', known_for: 'Pietà de Rosso',               portrait: PORTRAIT('rosso-fiorentino') },
      { id: 'pontormo',         name: 'Pontormo',             dates: '1494–1557', known_for: 'Portrait d\'hallebardier',      portrait: PORTRAIT('pontormo') },
      { id: 'jean-clouet',      name: 'Jean Clouet',          dates: '1480–1541', known_for: 'Portrait de François Ier',      portrait: PORTRAIT('jean-clouet') },
      { id: 'primaticcio',      name: 'Primaticcio',          dates: '1504–1570', known_for: 'Ulysse et Pénélope',            portrait: PORTRAIT('primaticcio') },
    ],
  },
  {
    id: 'baroque-flamand',
    name: 'Baroque flamand & hollandais',
    period: '1600 – 1680',
    color: '#7B6CA8',
    icon: '🕯️',
    artists: [
      { id: 'rembrandt', name: 'Rembrandt',  dates: '1606–1669', known_for: 'Bethsabée au bain',                portrait: PORTRAIT('rembrandt') },
      { id: 'rubens',    name: 'Rubens',     dates: '1577–1640', known_for: 'Henri IV et Marie de Médicis',    portrait: PORTRAIT('rubens') },
      { id: 'vermeer',   name: 'Vermeer',    dates: '1632–1675', known_for: 'La Dentellière',                  portrait: PORTRAIT('vermeer') },
      { id: 'van-dyck',  name: 'Van Dyck',   dates: '1599–1641', known_for: 'Charles Ier d\'Angleterre',       portrait: PORTRAIT('van-dyck') },
      { id: 'jordaens',  name: 'Jordaens',   dates: '1593–1678', known_for: 'Les Quatre Évangélistes',         portrait: PORTRAIT('jordaens') },
    ],
  },
  {
    id: 'baroque-classicisme',
    name: 'Baroque & Classicisme',
    period: '1600 – 1720',
    color: '#C06B4A',
    icon: '🏛️',
    artists: [
      { id: 'caravage',           name: 'Caravage',              dates: '1571–1610', known_for: 'La Mort de la Vierge',          portrait: PORTRAIT('caravage') },
      { id: 'poussin',            name: 'Nicolas Poussin',        dates: '1594–1665', known_for: 'Les Bergers d\'Arcadie',        portrait: PORTRAIT('poussin') },
      { id: 'georges-de-la-tour', name: 'Georges de La Tour',     dates: '1593–1652', known_for: 'Saint Joseph charpentier',     portrait: PORTRAIT('georges-de-la-tour') },
      { id: 'champaigne',         name: 'Philippe de Champaigne', dates: '1602–1674', known_for: 'Ex-Voto de 1662',              portrait: PORTRAIT('champaigne') },
      { id: 'claude-lorrain',     name: 'Claude Lorrain',         dates: '1600–1682', known_for: 'Port de mer au soleil couchant', portrait: PORTRAIT('claude-lorrain') },
    ],
  },
  {
    id: 'art-espagnol',
    name: 'Art espagnol du Siècle d\'Or',
    period: '1580 – 1700',
    color: '#B5472B',
    icon: '🌹',
    artists: [
      { id: 'el-greco',   name: 'El Greco',   dates: '1541–1614', known_for: 'Le Christ en croix adoré par deux donateurs', portrait: PORTRAIT('el-greco') },
      { id: 'velazquez',  name: 'Velázquez',  dates: '1599–1660', known_for: 'Portrait de la reine Marianne d\'Autriche',  portrait: PORTRAIT('velazquez') },
      { id: 'zurbaran',   name: 'Zurbarán',   dates: '1598–1664', known_for: 'Saint Bonaventure sur son lit de mort',      portrait: PORTRAIT('zurbaran') },
      { id: 'murillo',    name: 'Murillo',    dates: '1617–1682', known_for: 'L\'Immaculée Conception',                    portrait: PORTRAIT('murillo') },
      { id: 'ribera',     name: 'José de Ribera', dates: '1591–1652', known_for: 'Le Pied-bot',                           portrait: PORTRAIT('ribera') },
    ],
  },
  {
    id: 'rococo-lumieres',
    name: 'Rococo & Lumières',
    period: '1700 – 1790',
    color: '#5B9E8A',
    icon: '🌸',
    artists: [
      { id: 'watteau',       name: 'Watteau',        dates: '1684–1721', known_for: 'Pèlerinage à l\'île de Cythère',  portrait: PORTRAIT('watteau') },
      { id: 'fragonard',     name: 'Fragonard',      dates: '1732–1806', known_for: 'Le Verrou',                       portrait: PORTRAIT('fragonard') },
      { id: 'boucher',       name: 'Boucher',        dates: '1703–1770', known_for: 'Diane sortant du bain',           portrait: PORTRAIT('boucher') },
      { id: 'chardin',       name: 'Chardin',        dates: '1699–1779', known_for: 'La Raie',                         portrait: PORTRAIT('chardin') },
      { id: 'vigee-le-brun', name: 'Vigée Le Brun',  dates: '1755–1842', known_for: 'Marie-Antoinette à la rose',     portrait: PORTRAIT('vigee-le-brun') },
    ],
  },
  {
    id: 'neoclassicisme-romantisme',
    name: 'Néoclassicisme & Romantisme',
    period: '1780 – 1850',
    color: '#4A7BC0',
    icon: '⚡',
    artists: [
      { id: 'david',     name: 'Jacques-Louis David', dates: '1748–1825', known_for: 'Le Sacre de Napoléon',            portrait: PORTRAIT('david') },
      { id: 'ingres',    name: 'Ingres',               dates: '1780–1867', known_for: 'La Grande Odalisque',            portrait: PORTRAIT('ingres') },
      { id: 'delacroix', name: 'Delacroix',            dates: '1798–1863', known_for: 'La Liberté guidant le peuple',   portrait: PORTRAIT('delacroix') },
      { id: 'gericault', name: 'Géricault',            dates: '1791–1824', known_for: 'Le Radeau de la Méduse',         portrait: PORTRAIT('gericault') },
      { id: 'gros',      name: 'Antoine-Jean Gros',    dates: '1771–1835', known_for: 'Bonaparte au pont d\'Arcole',    portrait: PORTRAIT('gros') },
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
