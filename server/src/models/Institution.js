import { Schema } from 'mongoose'

const institutionSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 64,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      unique: true,
    },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', required: true },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: 'throw',
    autoIndex: false,
    autoCreate: false,
  },
)

export function institutionModel(database) {
  if (!database || typeof database.model !== 'function' || !database.models) {
    throw new TypeError('A connected Mongoose database is required.')
  }
  return (
    database.models.Institution || database.model('Institution', institutionSchema, 'institutions')
  )
}
