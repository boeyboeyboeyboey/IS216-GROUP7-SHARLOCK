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
    id: 'cli-cyber-defender',
    name: 'CLI Cyber Defender',
    description: 'Contain fictional cyber incidents with commands in a simulated terminal.',
    difficulty: 2,
    backgroundKnowledge: ['IP addresses', 'Firewall rules', 'Incident containment'],
    route: '/games/cli-cyber-defender',
    isPreview: true,
    duration: '1 min + debrief',
    icon: 'shield',
    building: { type: 'cottage', x: 112, y: 112 },
  },
  {
    id: 'phishing-post-mortem',
    name: 'The Phishing Post-Mortem',
    description: 'Trace a fictional email incident and uncover the message that started it.',
    difficulty: 2,
    backgroundKnowledge: ['Sender spoofing', 'Deceptive links', 'Incident timelines'],
    route: '/games/phishing-post-mortem',
    isPreview: true,
    duration: '8 min',
    icon: 'news',
    building: { type: 'library', x: 480, y: 64 },
  },
  {
    id: 'sql-injection-arcade',
    name: 'SQL Injection Arcade',
    description: 'Solve a simulated login puzzle and learn how parameterized queries protect it.',
    difficulty: 2,
    backgroundKnowledge: ['SQL strings', 'Boolean conditions', 'Parameterized queries'],
    route: '/games/sql-injection-arcade',
    isPreview: true,
    duration: '6 min',
    icon: 'lock',
    building: { type: 'hut', x: 832, y: 128 },
  },
  {
    id: 'threat-briefing',
    name: 'The daily briefing',
    description: 'Read The Sharlock Times for recent cybersecurity and technology stories.',
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
    id: 'social-engineering-simulator',
    name: 'LLM Social Engineering Simulator',
    description:
      'Spot a fictional colleague’s pressure tactics and protect a synthetic reset code.',
    difficulty: 2,
    backgroundKnowledge: [
      'Impersonation',
      'Reset-code confidentiality',
      'Independent verification',
    ],
    route: '/games/social-engineering-simulator',
    isPreview: true,
    duration: '5 min',
    icon: 'people',
    building: { type: 'office', x: 432, y: 520 },
  },
  {
    id: 'regex-defender',
    name: 'Regex Defender',
    description: 'Catch malicious strings with patterns while keeping harmless messages safe.',
    difficulty: 3,
    backgroundKnowledge: ['Regex syntax', 'Character classes', 'False positives'],
    route: '/games/regex-defender',
    isPreview: true,
    duration: '1 min + debrief',
    icon: 'trophy',
    building: { type: 'shed', x: 720, y: 496 },
  },
])
