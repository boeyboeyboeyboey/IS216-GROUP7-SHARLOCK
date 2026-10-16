import { attemptModel } from './model.js'
import { createAttemptRegistry } from './registry.js'

function alreadyExists(error) {
  return error?.code === 48 || error?.codeName === 'NamespaceExists'
}

export async function initializeAttemptStorage(database, registry = createAttemptRegistry()) {
  if (!database?.db || database.readyState !== 1) {
    throw new TypeError('A connected Mongoose database is required.')
  }
  const model = attemptModel(database, registry)
  try {
    await database.db.createCollection('game_attempts')
  } catch (error) {
    if (!alreadyExists(error)) throw error
  }
  await model.createIndexes()
}
