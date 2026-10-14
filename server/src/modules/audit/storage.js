import { auditEventModel } from './model.js'

function alreadyExists(error) {
  return error?.code === 48 || error?.codeName === 'NamespaceExists'
}

async function createCollection(database) {
  try {
    await database.db.createCollection('audit_events')
  } catch (error) {
    if (!alreadyExists(error)) throw error
  }
}

export async function initializeAuditStorage(database) {
  if (!database?.db || database.readyState !== 1) {
    throw new TypeError('A connected Mongoose database is required.')
  }
  const AuditEvent = auditEventModel(database)
  await createCollection(database)
  await AuditEvent.createIndexes()
}
