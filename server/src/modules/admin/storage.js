import { userModel } from '../../models/User.js'
import { initializeAuditStorage } from '../audit/storage.js'
import { bootstrapStateModel } from './model.js'

async function ensureCollection(database, name, model) {
  try {
    await database.db.createCollection(name)
  } catch (error) {
    if (error?.code !== 48 && error?.codeName !== 'NamespaceExists') throw error
  }
  await model.createIndexes()
}

export async function initializeBootstrapStorage(database) {
  if (!database?.db || database.readyState !== 1) {
    throw new TypeError('A connected Mongoose database is required.')
  }
  await ensureCollection(database, 'users', userModel(database))
  await initializeAuditStorage(database)
  await ensureCollection(database, 'admin_bootstrap_state', bootstrapStateModel(database))
}
