export const LEVELS = ['Unknown', 'Novice', 'Initiate', 'Art Lover', 'Connoisseur', 'Expert']
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

export interface Museum {
  id: string
  name: string
  location: string
  theme: string
  color: string
  icon: string
  artists: Artist[]
}

export const MUSEUMS: Museum[] = [
  {
    id: 'louvre',
    name: 'Musée du Louvre',
    location: '1st arr.',
    theme: 'Old Masters · Antiquity–19th c.',
    color: '#C9A84C',
    icon: '🏛️',
    artists: [
      { id: 'leonard-de-vinci', name: 'Léonard de Vinci',    dates: '1452–1519', known_for: 'La Joconde',                    portrait: PORTRAIT('leonard-de-vinci') },
      { id: 'raphael',          name: 'Raphaël',              dates: '1483–1520', known_for: 'La Belle Jardinière',           portrait: PORTRAIT('raphael') },
      { id: 'vermeer',          name: 'Vermeer',              dates: '1632–1675', known_for: 'La Dentellière',               portrait: PORTRAIT('vermeer') },
      { id: 'rembrandt',        name: 'Rembrandt',            dates: '1606–1669', known_for: 'Bethsabée au bain',            portrait: PORTRAIT('rembrandt') },
      { id: 'rubens',           name: 'Rubens',               dates: '1577–1640', known_for: 'Cycle de Marie de Médicis',    portrait: PORTRAIT('rubens') },
      { id: 'caravage',         name: 'Caravage',             dates: '1571–1610', known_for: 'La Mort de la Vierge',         portrait: PORTRAIT('caravage') },
      { id: 'poussin',          name: 'Nicolas Poussin',      dates: '1594–1665', known_for: 'Les Bergers d\'Arcadie',       portrait: PORTRAIT('poussin') },
      { id: 'david',            name: 'Jacques-Louis David',  dates: '1748–1825', known_for: 'Le Sacre de Napoléon',         portrait: PORTRAIT('david') },
      { id: 'ingres',           name: 'Ingres',               dates: '1780–1867', known_for: 'La Grande Odalisque',          portrait: PORTRAIT('ingres') },
      { id: 'delacroix',        name: 'Delacroix',            dates: '1798–1863', known_for: 'Les Femmes d\'Alger',          portrait: PORTRAIT('delacroix') },
    ],
  },
  {
    id: 'orsay',
    name: 'Musée d\'Orsay',
    location: '7th arr.',
    theme: 'Impressionism · 1848–1914',
    color: '#4E8A6E',
    icon: '🌿',
    artists: [
      { id: 'manet',            name: 'Édouard Manet',        dates: '1832–1883', known_for: 'Olympia',                      portrait: PORTRAIT('manet') },
      { id: 'monet',            name: 'Claude Monet',         dates: '1840–1926', known_for: 'La Gare Saint-Lazare',         portrait: PORTRAIT('monet') },
      { id: 'renoir',           name: 'Auguste Renoir',       dates: '1841–1919', known_for: 'Bal du moulin de la Galette',  portrait: PORTRAIT('renoir') },
      { id: 'degas',            name: 'Edgar Degas',          dates: '1834–1917', known_for: 'La Petite Danseuse',           portrait: PORTRAIT('degas') },
      { id: 'van-gogh',         name: 'Vincent van Gogh',     dates: '1853–1890', known_for: 'La Nuit étoilée sur le Rhône', portrait: PORTRAIT('van-gogh') },
      { id: 'gauguin',          name: 'Paul Gauguin',         dates: '1848–1903', known_for: 'Arearea',                      portrait: PORTRAIT('gauguin') },
      { id: 'cezanne',          name: 'Paul Cézanne',         dates: '1839–1906', known_for: 'Les Joueurs de cartes',        portrait: PORTRAIT('cezanne') },
      { id: 'seurat',           name: 'Georges Seurat',       dates: '1859–1891', known_for: 'Le Cirque',                    portrait: PORTRAIT('seurat') },
      { id: 'courbet',          name: 'Gustave Courbet',      dates: '1819–1877', known_for: 'L\'Atelier du peintre',        portrait: PORTRAIT('courbet') },
      { id: 'toulouse-lautrec', name: 'Toulouse-Lautrec',     dates: '1864–1901', known_for: 'La Clownesse assise',          portrait: PORTRAIT('toulouse-lautrec') },
    ],
  },
  {
    id: 'pompidou',
    name: 'Centre Pompidou',
    location: '4th arr.',
    theme: 'Modern & contemporary art · 20th c.',
    color: '#D44C31',
    icon: '🎨',
    artists: [
      { id: 'matisse',          name: 'Henri Matisse',        dates: '1869–1954', known_for: 'La Tristesse du roi',          portrait: PORTRAIT('matisse') },
      { id: 'kandinsky',        name: 'Wassily Kandinsky',    dates: '1866–1944', known_for: 'Avec l\'Arc noir',             portrait: PORTRAIT('kandinsky') },
      { id: 'braque',           name: 'Georges Braque',       dates: '1882–1963', known_for: 'Le Viaduc à l\'Estaque',       portrait: PORTRAIT('braque') },
      { id: 'leger',            name: 'Fernand Léger',        dates: '1881–1955', known_for: 'La Partie de cartes',          portrait: PORTRAIT('leger') },
      { id: 'duchamp',          name: 'Marcel Duchamp',       dates: '1887–1968', known_for: 'La Boîte-en-valise',           portrait: PORTRAIT('duchamp') },
      { id: 'delaunay-r',       name: 'Robert Delaunay',      dates: '1885–1941', known_for: 'La Ville de Paris',            portrait: PORTRAIT('delaunay-r') },
      { id: 'brancusi',         name: 'Constantin Brancusi',  dates: '1876–1957', known_for: 'La Muse endormie',             portrait: PORTRAIT('brancusi') },
      { id: 'klein-yves',       name: 'Yves Klein',           dates: '1928–1962', known_for: 'Anthropométrie ANT 82',        portrait: PORTRAIT('klein-yves') },
      { id: 'miro',             name: 'Joan Miró',            dates: '1893–1983', known_for: 'L\'Étoile matinale',           portrait: PORTRAIT('miro') },
      { id: 'giacometti',       name: 'Alberto Giacometti',   dates: '1901–1966', known_for: 'L\'Homme qui marche I',        portrait: PORTRAIT('giacometti') },
    ],
  },
  {
    id: 'orangerie',
    name: 'Musée de l\'Orangerie',
    location: '1st arr. · Tuileries',
    theme: 'School of Paris · Monet\'s Water Lilies',
    color: '#9B7A52',
    icon: '🌊',
    artists: [
      { id: 'monet-nlg',        name: 'Claude Monet',         dates: '1840–1926', known_for: 'Les Nymphéas (salles ovales)', portrait: PORTRAIT('monet-nlg') },
      { id: 'modigliani',       name: 'Amedeo Modigliani',    dates: '1884–1920', known_for: 'Portrait de Paul Guillaume',   portrait: PORTRAIT('modigliani') },
      { id: 'soutine',          name: 'Chaïm Soutine',        dates: '1893–1943', known_for: 'La Pâtissière',               portrait: PORTRAIT('soutine') },
      { id: 'derain',           name: 'André Derain',         dates: '1880–1954', known_for: 'Arlequin et Pierrot',         portrait: PORTRAIT('derain') },
      { id: 'utrillo',          name: 'Maurice Utrillo',      dates: '1883–1955', known_for: 'La Rue Norvins',              portrait: PORTRAIT('utrillo') },
      { id: 'laurencin',        name: 'Marie Laurencin',      dates: '1883–1956', known_for: 'Groupe de femmes',            portrait: PORTRAIT('laurencin') },
      { id: 'vlaminck',         name: 'Maurice de Vlaminck',  dates: '1876–1958', known_for: 'La Maison à Chatou',          portrait: PORTRAIT('vlaminck') },
      { id: 'rousseau-h',       name: 'Henri Rousseau',       dates: '1844–1910', known_for: 'La Carriole du père Juniet',  portrait: PORTRAIT('rousseau-h') },
      { id: 'picasso-org',      name: 'Pablo Picasso',        dates: '1881–1973', known_for: 'Grande Baigneuse (coll. Guillaume)', portrait: PORTRAIT('picasso-org') },
      { id: 'sisley',           name: 'Alfred Sisley',        dates: '1839–1899', known_for: 'L\'Inondation à Port-Marly',  portrait: PORTRAIT('sisley') },
    ],
  },
  {
    id: 'fondation-louis-vuitton',
    name: 'Fondation Louis Vuitton',
    location: '16th arr. · Bois de Boulogne',
    theme: 'Contemporary art · 21st c.',
    color: '#4A6FA5',
    icon: '✨',
    artists: [
      { id: 'basquiat',         name: 'Jean-Michel Basquiat', dates: '1960–1988', known_for: 'Untitled (1982)',              portrait: PORTRAIT('basquiat') },
      { id: 'rothko',           name: 'Mark Rothko',          dates: '1903–1970', known_for: 'No. 14, 1960',                portrait: PORTRAIT('rothko') },
      { id: 'richter',          name: 'Gerhard Richter',      dates: '1932–',     known_for: 'Lesende',                     portrait: PORTRAIT('richter') },
      { id: 'hockney',          name: 'David Hockney',        dates: '1937–',     known_for: 'A Bigger Splash',             portrait: PORTRAIT('hockney') },
      { id: 'boltanski',        name: 'Christian Boltanski',  dates: '1944–2021', known_for: 'Les Archives du cœur',        portrait: PORTRAIT('boltanski') },
      { id: 'koons',            name: 'Jeff Koons',           dates: '1955–',     known_for: 'Balloon Dog (Blue)',          portrait: PORTRAIT('koons') },
      { id: 'kapoor',           name: 'Anish Kapoor',         dates: '1954–',     known_for: 'Non-Object (Spire)',          portrait: PORTRAIT('kapoor') },
      { id: 'kelly-e',          name: 'Ellsworth Kelly',      dates: '1923–2015', known_for: 'Blue Green Red',              portrait: PORTRAIT('kelly-e') },
      { id: 'turrell',          name: 'James Turrell',        dates: '1943–',     known_for: 'Mushroom (lumière)',          portrait: PORTRAIT('turrell') },
      { id: 'prince-r',         name: 'Richard Prince',       dates: '1949–',     known_for: 'Nurse Paintings',             portrait: PORTRAIT('prince-r') },
    ],
  },
]

export function getLevel(scans: number): string {
  return LEVELS[Math.min(scans, MAX_SCANS)]
}

export function getArtistById(id: string): { artist: Artist; museum: Museum } | null {
  for (const m of MUSEUMS) {
    const a = m.artists.find((a) => a.id === id)
    if (a) return { artist: a, museum: m }
  }
  return null
}

export function museumProgress(museumId: string, scans: Record<string, number>): number {
  const m = MUSEUMS.find((m) => m.id === museumId)
  if (!m) return 0
  const total = m.artists.reduce((sum, a) => sum + Math.min(scans[a.id] ?? 0, MAX_SCANS), 0)
  return total / (m.artists.length * MAX_SCANS)
}
