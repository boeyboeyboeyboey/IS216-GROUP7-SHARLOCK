import { passwordResetModel } from './model.js'

export async function initializeRecoveryStorage(database) {
  if (!database?.db || database.readyState !== 1)
    throw new TypeError('A connected Mongoose database is required.')
  try {
    await database.db.createCollection('password_resets')
  } catch (error) {
    if (error?.code !== 48 && error?.codeName !== 'NamespaceExists') throw error
  }
  await passwordResetModel(database).createIndexes()
}
