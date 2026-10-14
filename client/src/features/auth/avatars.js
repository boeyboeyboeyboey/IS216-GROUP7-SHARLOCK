import { avatarPresets } from '../../../../server/src/modules/auth/avatars.js'

export { avatarPresets }

const presetById = new Map(avatarPresets.map((preset) => [preset.id, preset]))

export function avatarFor(id) {
  return presetById.get(id) || presetById.get('mint')
}
