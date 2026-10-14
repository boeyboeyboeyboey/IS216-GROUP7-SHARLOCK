import { Schema } from 'mongoose'
import { avatarPresets } from '../modules/auth/avatars.js'

const userSchema = new Schema(
  {
    emailNormalized: { type: String, required: true, maxlength: 254, unique: true },
    username: { type: String, required: true, minlength: 3, maxlength: 24 },
    usernameNormalized: { type: String, required: true, minlength: 3, maxlength: 24, unique: true },
    avatarId: {
      type: String,
      required: true,
      enum: avatarPresets.map(({ id }) => id),
    },
    passwordHash: { type: String, required: true, select: false },
    globalRoles: {
      type: [String],
      enum: ['student', 'instructor', 'admin'],
      required: true,
      default: ['student'],
    },
    accountStatus: {
      type: String,
      enum: ['active', 'disabled'],
      required: true,
      default: 'active',
    },
    authVersion: { type: Number, required: true, min: 1, default: 1 },
    passwordChangedAt: { type: Date, required: true },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: 'throw',
    autoIndex: false,
    autoCreate: false,
  },
)

export function userModel(database) {
  if (!database || typeof database.model !== 'function' || !database.models) {
    throw new TypeError('A connected Mongoose database is required.')
  }
  return database.models.User || database.model('User', userSchema, 'users')
}
