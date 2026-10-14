import { Schema } from 'mongoose'

export const bootstrapStateId = 'first-admin'

const bootstrapStateSchema = new Schema(
  {
    _id: { type: String, required: true, enum: [bootstrapStateId] },
    userId: { type: Schema.Types.ObjectId, required: true, immutable: true },
    createdAt: { type: Date, required: true, immutable: true },
  },
  { versionKey: false, strict: 'throw', autoIndex: false, autoCreate: false },
)

export function bootstrapStateModel(database) {
  if (!database || typeof database.model !== 'function' || !database.models) {
    throw new TypeError('A connected Mongoose database is required.')
  }
  return (
    database.models.BootstrapState ||
    database.model('BootstrapState', bootstrapStateSchema, 'admin_bootstrap_state')
  )
}
