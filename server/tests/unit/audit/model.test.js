import mongoose from 'mongoose'
import { describe, expect, it } from 'vitest'
import { auditEventModel } from '../../../src/modules/audit/model.js'

describe('audit event model', () => {
  it('binds a strict model and declared indexes to the supplied connection', () => {
    const connection = mongoose.createConnection()
    const AuditEvent = auditEventModel(connection)

    expect(AuditEvent.modelName).toBe('AuditEvent')
    expect(AuditEvent.collection.collectionName).toBe('audit_events')
    expect(connection.models.AuditEvent).toBe(AuditEvent)
    expect(AuditEvent.schema.options).toMatchObject({
      strict: 'throw',
      autoCreate: false,
      autoIndex: false,
      versionKey: false,
    })
    expect(AuditEvent.schema.indexes()).toEqual([
      [{ expiresAt: 1 }, { expireAfterSeconds: 0 }],
      [{ occurredAt: -1, _id: -1 }, {}],
      [{ eventType: 1, occurredAt: -1 }, {}],
    ])
    connection.destroy()
  })

  it('rejects an invalid connection', () => {
    expect(() => auditEventModel(null)).toThrow(TypeError)
  })
})
