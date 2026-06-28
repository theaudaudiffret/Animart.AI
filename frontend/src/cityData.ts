export interface Era {
  id: string
  label: string
}

export const ERAS: Era[] = [
  { id: 'ancient',        label: 'Ancient (before 500)' },
  { id: 'medieval',       label: 'Medieval (500–1400)' },
  { id: 'renaissance',    label: 'Renaissance (1400–1600)' },
  { id: 'baroque',        label: 'Baroque (1600–1750)' },
  { id: 'neoclassical',   label: 'Neoclassical (1750–1850)' },
  { id: 'impressionism',  label: 'Impressionism (1848–1910)' },
  { id: 'modern',         label: 'Modern (1910–1970)' },
  { id: 'contemporary',   label: 'Contemporary (1970–present)' },
]

export interface FeaturedArtist {
  name: string
  id?: string // matches data.ts artist ids where applicable
}

export interface CityMuseum {
  id: string
  name: string
  bookingUrl: string
  eras: string[] // era ids
  featuredArtists: FeaturedArtist[]
}

export interface City {
  id: string
  name: string
  country: string
  museums: CityMuseum[]
}

export const CITIES: City[] = [
  {
    id: 'paris',
    name: 'Paris',
    country: 'France',
    museums: [
      {
        id: 'louvre',
        name: 'Musée du Louvre',
        bookingUrl: 'https://ticket.louvre.fr',
        eras: ['ancient', 'medieval', 'renaissance', 'baroque', 'neoclassical'],
        featuredArtists: [
          { name: 'Léonard de Vinci',   id: 'leonard-de-vinci' },
          { name: 'Raphaël',            id: 'raphael' },
          { name: 'Vermeer',            id: 'vermeer' },
          { name: 'Rembrandt',          id: 'rembrandt' },
          { name: 'Caravage',           id: 'caravage' },
          { name: 'Jacques-Louis David',id: 'david' },
          { name: 'Ingres',             id: 'ingres' },
          { name: 'Delacroix',          id: 'delacroix' },
        ],
      },
      {
        id: 'orsay',
        name: "Musée d'Orsay",
        bookingUrl: 'https://billetterie.musee-orsay.fr',
        eras: ['neoclassical', 'impressionism'],
        featuredArtists: [
          { name: 'Claude Monet',      id: 'monet' },
          { name: 'Edgar Degas',       id: 'degas' },
          { name: 'Auguste Renoir',    id: 'renoir' },
          { name: 'Vincent van Gogh',  id: 'van-gogh' },
          { name: 'Paul Gauguin',      id: 'gauguin' },
          { name: 'Paul Cézanne',      id: 'cezanne' },
          { name: 'Édouard Manet',     id: 'manet' },
          { name: 'Georges Seurat',    id: 'seurat' },
        ],
      },
      {
        id: 'pompidou',
        name: 'Centre Pompidou',
        bookingUrl: 'https://billetterie.centrepompidou.fr',
        eras: ['modern', 'contemporary'],
        featuredArtists: [
          { name: 'Henri Matisse',     id: 'matisse' },
          { name: 'Wassily Kandinsky', id: 'kandinsky' },
          { name: 'Pablo Picasso' },
          { name: 'Marcel Duchamp',    id: 'duchamp' },
          { name: 'Joan Miró',         id: 'miro' },
          { name: 'Alberto Giacometti',id: 'giacometti' },
          { name: 'Yves Klein',        id: 'klein-yves' },
        ],
      },
      {
        id: 'orangerie',
        name: "Musée de l'Orangerie",
        bookingUrl: 'https://billetterie.musee-orangerie.fr',
        eras: ['impressionism', 'modern'],
        featuredArtists: [
          { name: 'Claude Monet',      id: 'monet-nlg' },
          { name: 'Amedeo Modigliani', id: 'modigliani' },
          { name: 'Pablo Picasso',     id: 'picasso-org' },
          { name: 'Henri Rousseau',    id: 'rousseau-h' },
          { name: 'André Derain',      id: 'derain' },
          { name: 'Chaïm Soutine',    id: 'soutine' },
        ],
      },
      {
        id: 'musee-rodin',
        name: 'Musée Rodin',
        bookingUrl: 'https://www.musee-rodin.fr',
        eras: ['impressionism'],
        featuredArtists: [
          { name: 'Auguste Rodin' },
          { name: 'Camille Claudel' },
        ],
      },
      {
        id: 'quai-branly',
        name: 'Musée du Quai Branly',
        bookingUrl: 'https://www.quaibranly.fr/fr/billetterie',
        eras: ['ancient', 'medieval', 'modern', 'contemporary'],
        featuredArtists: [
          { name: 'Arts premiers (Afrique)' },
          { name: 'Arts premiers (Océanie)' },
          { name: 'Arts premiers (Amériques)' },
        ],
      },
    ],
  },
  {
    id: 'london',
    name: 'London',
    country: 'United Kingdom',
    museums: [
      {
        id: 'national-gallery',
        name: 'National Gallery',
        bookingUrl: 'https://www.nationalgallery.org.uk/visit',
        eras: ['medieval', 'renaissance', 'baroque', 'neoclassical', 'impressionism'],
        featuredArtists: [
          { name: 'Jan van Eyck' },
          { name: 'Leonardo da Vinci' },
          { name: 'Caravaggio' },
          { name: 'Rembrandt van Rijn' },
          { name: 'J.M.W. Turner' },
          { name: 'Vincent van Gogh' },
          { name: 'Claude Monet' },
        ],
      },
      {
        id: 'tate-modern',
        name: 'Tate Modern',
        bookingUrl: 'https://www.tate.org.uk/visit/tate-modern',
        eras: ['modern', 'contemporary'],
        featuredArtists: [
          { name: 'Pablo Picasso' },
          { name: 'Salvador Dalí' },
          { name: 'Andy Warhol' },
          { name: 'Mark Rothko' },
          { name: 'Louise Bourgeois' },
          { name: 'Damien Hirst' },
        ],
      },
      {
        id: 'british-museum',
        name: 'British Museum',
        bookingUrl: 'https://www.britishmuseum.org/visit',
        eras: ['ancient', 'medieval'],
        featuredArtists: [
          { name: 'Elgin Marbles (Ancient Greece)' },
          { name: 'Rosetta Stone (Ancient Egypt)' },
          { name: 'Lewis Chessmen (Medieval)' },
        ],
      },
      {
        id: 'victoria-albert',
        name: 'Victoria & Albert Museum',
        bookingUrl: 'https://www.vam.ac.uk/info/admission-tickets',
        eras: ['medieval', 'renaissance', 'baroque', 'neoclassical', 'modern'],
        featuredArtists: [
          { name: 'Raphael' },
          { name: 'Constable' },
          { name: 'William Morris' },
          { name: 'Aubrey Beardsley' },
        ],
      },
    ],
  },
  {
    id: 'amsterdam',
    name: 'Amsterdam',
    country: 'Netherlands',
    museums: [
      {
        id: 'rijksmuseum',
        name: 'Rijksmuseum',
        bookingUrl: 'https://www.rijksmuseum.nl/en/tickets',
        eras: ['medieval', 'renaissance', 'baroque', 'neoclassical'],
        featuredArtists: [
          { name: 'Rembrandt van Rijn' },
          { name: 'Johannes Vermeer' },
          { name: 'Frans Hals' },
          { name: 'Jan Steen' },
          { name: 'Jacob van Ruisdael' },
        ],
      },
      {
        id: 'van-gogh-museum',
        name: 'Van Gogh Museum',
        bookingUrl: 'https://www.vangoghmuseum.nl/en/plan-your-visit/tickets',
        eras: ['impressionism'],
        featuredArtists: [
          { name: 'Vincent van Gogh', id: 'van-gogh' },
          { name: 'Paul Gauguin',     id: 'gauguin' },
          { name: 'Georges Seurat' },
          { name: 'Émile Bernard' },
        ],
      },
      {
        id: 'stedelijk',
        name: 'Stedelijk Museum',
        bookingUrl: 'https://www.stedelijk.nl/en/visit/tickets',
        eras: ['modern', 'contemporary'],
        featuredArtists: [
          { name: 'Wassily Kandinsky' },
          { name: 'Kazimir Malevich' },
          { name: 'Piet Mondrian' },
          { name: 'Roy Lichtenstein' },
          { name: 'Karel Appel' },
        ],
      },
    ],
  },
  {
    id: 'madrid',
    name: 'Madrid',
    country: 'Spain',
    museums: [
      {
        id: 'prado',
        name: 'Museo del Prado',
        bookingUrl: 'https://www.museodelprado.es/en/visit-the-prado/admission-tickets',
        eras: ['medieval', 'renaissance', 'baroque', 'neoclassical'],
        featuredArtists: [
          { name: 'Francisco Goya' },
          { name: 'Diego Velázquez' },
          { name: 'El Greco' },
          { name: 'Hieronymus Bosch' },
          { name: 'Peter Paul Rubens' },
          { name: 'Raphael' },
          { name: 'Titian' },
        ],
      },
      {
        id: 'reina-sofia',
        name: 'Museo Reina Sofía',
        bookingUrl: 'https://www.museoreinasofia.es/en/visit/admission',
        eras: ['modern', 'contemporary'],
        featuredArtists: [
          { name: 'Pablo Picasso' },
          { name: 'Salvador Dalí' },
          { name: 'Joan Miró' },
          { name: 'Juan Gris' },
          { name: 'Eduardo Chillida' },
        ],
      },
      {
        id: 'thyssen',
        name: 'Museo Thyssen-Bornemisza',
        bookingUrl: 'https://www.museothyssen.org/en/visit/admission',
        eras: ['medieval', 'renaissance', 'baroque', 'neoclassical', 'impressionism', 'modern', 'contemporary'],
        featuredArtists: [
          { name: 'Hans Holbein the Younger' },
          { name: 'Jan van Eyck' },
          { name: 'Caravaggio' },
          { name: 'Edward Hopper' },
          { name: 'Georgia O\'Keeffe' },
          { name: 'Francis Bacon' },
        ],
      },
    ],
  },
  {
    id: 'florence',
    name: 'Florence',
    country: 'Italy',
    museums: [
      {
        id: 'uffizi',
        name: 'Galleria degli Uffizi',
        bookingUrl: 'https://www.uffizi.it/en/tickets',
        eras: ['medieval', 'renaissance', 'baroque'],
        featuredArtists: [
          { name: 'Sandro Botticelli' },
          { name: 'Leonardo da Vinci' },
          { name: 'Michelangelo' },
          { name: 'Raphael' },
          { name: 'Caravaggio' },
          { name: 'Titian' },
          { name: 'Giotto' },
        ],
      },
      {
        id: 'accademia',
        name: "Galleria dell'Accademia",
        bookingUrl: 'https://www.galleriaaccademiafirenze.it/en/tickets',
        eras: ['medieval', 'renaissance'],
        featuredArtists: [
          { name: 'Michelangelo' },
          { name: 'Botticelli' },
          { name: 'Domenico Ghirlandaio' },
          { name: 'Filippino Lippi' },
        ],
      },
      {
        id: 'palazzo-pitti',
        name: 'Palazzo Pitti',
        bookingUrl: 'https://www.uffizi.it/en/palazzopitti/tickets',
        eras: ['renaissance', 'baroque', 'neoclassical'],
        featuredArtists: [
          { name: 'Raphael' },
          { name: 'Rubens' },
          { name: 'Titian' },
          { name: 'Caravaggio' },
        ],
      },
    ],
  },
  {
    id: 'new-york',
    name: 'New York',
    country: 'United States',
    museums: [
      {
        id: 'met',
        name: 'The Metropolitan Museum of Art',
        bookingUrl: 'https://www.metmuseum.org/visit/plan-your-visit',
        eras: ['ancient', 'medieval', 'renaissance', 'baroque', 'neoclassical', 'impressionism', 'modern', 'contemporary'],
        featuredArtists: [
          { name: 'Rembrandt' },
          { name: 'Johannes Vermeer' },
          { name: 'Edgar Degas' },
          { name: 'Claude Monet' },
          { name: 'Winslow Homer' },
          { name: 'Cy Twombly' },
        ],
      },
      {
        id: 'moma',
        name: 'MoMA',
        bookingUrl: 'https://www.moma.org/visit/tickets',
        eras: ['modern', 'contemporary'],
        featuredArtists: [
          { name: 'Pablo Picasso' },
          { name: 'Vincent van Gogh' },
          { name: 'Jackson Pollock' },
          { name: 'Andy Warhol' },
          { name: 'Frida Kahlo' },
          { name: 'Salvador Dalí' },
          { name: 'Henri Matisse' },
        ],
      },
      {
        id: 'guggenheim',
        name: 'Solomon R. Guggenheim Museum',
        bookingUrl: 'https://www.guggenheim.org/plan-your-visit/tickets',
        eras: ['modern', 'contemporary'],
        featuredArtists: [
          { name: 'Wassily Kandinsky' },
          { name: 'Paul Klee' },
          { name: 'Marc Chagall' },
          { name: 'Alexander Calder' },
          { name: 'Jeff Koons' },
        ],
      },
      {
        id: 'whitney',
        name: 'Whitney Museum of American Art',
        bookingUrl: 'https://whitney.org/visit/tickets',
        eras: ['modern', 'contemporary'],
        featuredArtists: [
          { name: 'Edward Hopper' },
          { name: 'Georgia O\'Keeffe' },
          { name: 'Jean-Michel Basquiat', id: 'basquiat' },
          { name: 'Jasper Johns' },
          { name: 'Louise Bourgeois' },
        ],
      },
    ],
  },
  {
    id: 'rome',
    name: 'Rome',
    country: 'Italy',
    museums: [
      {
        id: 'vatican-museums',
        name: 'Vatican Museums',
        bookingUrl: 'https://www.museivaticani.va/content/museivaticani/en/visit-the-museums/tickets.html',
        eras: ['ancient', 'medieval', 'renaissance', 'baroque'],
        featuredArtists: [
          { name: 'Michelangelo' },
          { name: 'Raphael' },
          { name: 'Leonardo da Vinci' },
          { name: 'Caravaggio' },
          { name: 'Pinturicchio' },
        ],
      },
      {
        id: 'borghese',
        name: 'Galleria Borghese',
        bookingUrl: 'https://borghese.gallery/visit/tickets.html',
        eras: ['baroque', 'neoclassical'],
        featuredArtists: [
          { name: 'Gian Lorenzo Bernini' },
          { name: 'Caravaggio' },
          { name: 'Titian' },
          { name: 'Raphael' },
          { name: 'Antonio Canova' },
        ],
      },
      {
        id: 'capitoline',
        name: 'Musei Capitolini',
        bookingUrl: 'https://www.museicapitolini.org/en/visit/tickets',
        eras: ['ancient', 'medieval', 'renaissance'],
        featuredArtists: [
          { name: 'Marcus Aurelius (sculpture)' },
          { name: 'Caravaggio' },
          { name: 'Pietro da Cortona' },
        ],
      },
    ],
  },
]
