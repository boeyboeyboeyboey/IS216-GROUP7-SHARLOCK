import { Schema } from 'mongoose'

const cohortSchema = new Schema(
  {
    institutionId: {
      type: Schema.Types.ObjectId,
      ref: 'Institution',
      required: true,
      immutable: true,
    },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    term: { type: String, required: true, trim: true, minlength: 1, maxlength: 50 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', required: true },
    adminRevision: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
      validate: Number.isSafeInteger,
    },
    recoveryRevision: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
      validate: Number.isSafeInteger,
      select: false,
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
cohortSchema.index({ institutionId: 1, name: 1, term: 1 }, { unique: true })

export function cohortModel(database) {
  if (!database || typeof database.model !== 'function' || !database.models) {
    throw new TypeError('A connected Mongoose database is required.')
  }
  return database.models.Cohort || database.model('Cohort', cohortSchema, 'cohorts')
}
