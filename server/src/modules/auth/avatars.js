export const avatarPresets = Object.freeze([
  Object.freeze({
    id: 'mint',
    label: 'Mint Scarf',
    path: '/images/avatars/mint.png',
  }),
  Object.freeze({
    id: 'blue',
    label: 'Blue Cap',
    path: '/images/avatars/blue.png',
  }),
  Object.freeze({
    id: 'peach',
    label: 'Peach Bow',
    path: '/images/avatars/peach.png',
  }),
  Object.freeze({
    id: 'detective',
    label: 'Detective',
    path: '/images/avatars/detective.png',
  }),
  Object.freeze({
    id: 'reader',
    label: 'Reader',
    path: '/images/avatars/reader.png',
  }),
  Object.freeze({
    id: 'gamer',
    label: 'Gamer',
    path: '/images/avatars/gamer.png',
  }),
])

const avatarIds = new Set(avatarPresets.map(({ id }) => id))

export function isAvatarId(value) {
  return typeof value === 'string' && avatarIds.has(value)
}
