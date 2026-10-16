import { Schema } from 'mongoose'

const instructorAssignmentSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
    cohortId: {
      type: Schema.Types.ObjectId,
      ref: 'Cohort',
      required: true,
      immutable: true,
    },
    status: { type: String, enum: ['active', 'removed'], default: 'active', required: true },
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
instructorAssignmentSchema.index({ userId: 1, cohortId: 1 }, { unique: true })

export function instructorAssignmentModel(database) {
  if (!database || typeof database.model !== 'function' || !database.models) {
    throw new TypeError('A connected Mongoose database is required.')
  }
  return (
    database.models.InstructorAssignment ||
    database.model('InstructorAssignment', instructorAssignmentSchema, 'instructor_assignments')
  )
}
