import { Schema } from 'mongoose'

const enrollmentCodeSchema = new Schema(
  {
    cohortId: {
      type: Schema.Types.ObjectId,
      ref: 'Cohort',
      required: true,
      immutable: true,
    },
    codeHash: { type: String, required: true, match: /^[a-f\d]{64}$/ },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    revision: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
      validate: Number.isSafeInteger,
    },
    useCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
      validate: Number.isSafeInteger,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: 'throw',
    autoIndex: false,
    autoCreate: false,
  },
)
enrollmentCodeSchema.index({ cohortId: 1 }, { unique: true })
enrollmentCodeSchema.index({ codeHash: 1 }, { unique: true })

export function enrollmentCodeModel(database) {
  if (!database || typeof database.model !== 'function' || !database.models) {
    throw new TypeError('A connected Mongoose database is required.')
  }
  return (
    database.models.EnrollmentCode ||
    database.model('EnrollmentCode', enrollmentCodeSchema, 'enrollment_codes')
  )
}
