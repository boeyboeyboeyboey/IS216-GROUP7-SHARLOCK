// frontend display metadata is separate from server permissions
export const TOWN_SIZE = { width: 1120, height: 800 }
export const BUILDING_TYPES = ['cottage', 'library', 'office', 'hut', 'shed', 'newsstand']

export function defineGameCatalog(entries) {
  const ids = new Set()
  for (const game of entries) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(game.id) || ids.has(game.id))
      throw new Error('Game IDs must be stable and unique.')
    ids.add(game.id)
    if (!game.name?.trim() || !game.description?.trim())
      throw new Error('Every game needs a name and description.')
    if (!Number.isInteger(game.difficulty) || game.difficulty < 1 || game.difficulty > 3)
      throw new Error('Difficulty must be an integer from 1 to 3.')
    if (
      !Array.isArray(game.backgroundKnowledge) ||
      !game.backgroundKnowledge.length ||
      game.backgroundKnowledge.some((topic) => typeof topic !== 'string' || !topic.trim())
    )
      throw new Error('List the background knowledge for every game.')
    if (!game.route?.startsWith('/games/') || game.route.includes('://'))
      throw new Error('Games need a local /games/ route.')
    if (game.activation !== undefined && game.activation !== 'direct')
      throw new Error('Choose a supported building activation.')
    if (!BUILDING_TYPES.includes(game.building?.type))
      throw new Error('Choose a supported pixel building type.')
    const { x, y } = game.building
    if (
      ![x, y].every(Number.isInteger) ||
      x < 0 ||
      y < 0 ||
      x > TOWN_SIZE.width - 192 ||
      y > TOWN_SIZE.height - 200
    )
      throw new Error('Place the entire building inside the town.')
  }
  return entries
}

export const gameCatalog = defineGameCatalog([
  {
    id: 'integrity-detective',
    name: 'Integrity detective',
    description: 'Inspect a message and find the clues that reveal tampering.',
    difficulty: 1,
    backgroundKnowledge: ['Data integrity', 'Hashing'],
    route: '/games/integrity-detective',
    isPreview: true,
    duration: '5 min',
    icon: 'shield',
    building: { type: 'cottage', x: 112, y: 112 },
  },
  {
    id: 'mini-ctf',
    name: 'The hidden key',
    description: 'Uncover a secret message in a bite-sized cryptography challenge.',
    difficulty: 2,
    backgroundKnowledge: ['Encryption', 'Keys and ciphers'],
    route: '/games/mini-ctf',
    isPreview: true,
    duration: '8 min',
    icon: 'key',
    building: { type: 'library', x: 480, y: 64 },
  },
  {
    id: 'access-control',
    name: 'Access granted?',
    description: 'Give each person just enough access to get the job done.',
    difficulty: 1,
    backgroundKnowledge: ['Authentication', 'Least privilege'],
    route: '/games/access-control',
    isPreview: true,
    duration: '6 min',
    icon: 'lock',
    building: { type: 'office', x: 832, y: 128 },
  },
  {
    id: 'threat-briefing',
    name: 'The daily briefing',
    description: 'Read The Sharlock Gazette for recent cybersecurity and technology stories.',
    difficulty: 1,
    backgroundKnowledge: ['Common cyber threats', 'Risk awareness'],
    route: '/games/threat-briefing',
    isPreview: false,
    duration: '5 min',
    icon: 'news',
    activation: 'direct',
    building: { type: 'newsstand', x: 144, y: 480 },
  },
  {
    id: 'red-blue',
    name: 'Think like a defender',
    description: 'Match attacks to defences in a Red vs. Blue card battle.',
    difficulty: 3,
    backgroundKnowledge: ['Attack types', 'Security controls'],
    route: '/games/red-blue',
    isPreview: true,
    duration: '10 min',
    icon: 'trophy',
    building: { type: 'shed', x: 720, y: 496 },
  },
])
