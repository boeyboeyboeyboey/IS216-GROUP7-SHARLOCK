import { Schema } from 'mongoose'

const inlineSchema = new Schema(
  {
    type: { type: String, enum: ['text', 'link', 'break'], required: true },
    text: { type: String, maxlength: 16000 },
    href: { type: String, maxlength: 4096 },
  },
  { _id: false },
)
const articleSchema = new Schema(
  {
    id: { type: String, required: true, maxlength: 1000 },
    title: { type: String, required: true, maxlength: 2000 },
    url: { type: String, required: true, maxlength: 4096 },
    publishedAt: { type: String, required: true },
    excerpt: [inlineSchema],
    byline: [inlineSchema],
    copyright: { type: String, maxlength: 1000 },
  },
  { _id: false },
)
const cacheSchema = new Schema(
  {
    cacheKey: { type: String, required: true, unique: true },
    version: { type: Number, required: true },
    section: { type: String, enum: ['cybersecurity', 'technology'], required: true },
    range: { type: String, enum: ['week', 'month'], required: true },
    dateKey: { type: String, required: true },
    window: { from: String, to: String },
    articles: { type: [articleSchema], validate: (items) => items.length <= 50 },
    fetchedAt: { type: Date, required: true },
    freshUntil: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    partial: { type: Boolean, required: true },
  },
  { versionKey: false, autoIndex: false },
)
cacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
const quotaSchema = new Schema(
  {
    _id: String,
    used: { type: Number, required: true },
    nextRequestAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false, autoIndex: false },
)
quotaSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export function newsModels(database) {
  // bind feature models to the existing connection rather than mongoose's default connection
  return {
    Cache: database.models.NewsCache || database.model('NewsCache', cacheSchema, 'news_cache'),
    Quota: database.models.NewsQuota || database.model('NewsQuota', quotaSchema, 'news_quota'),
  }
}

export async function initializeNewsStorage(database) {
  const models = newsModels(database)
  for (const model of Object.values(models)) {
    await model.createCollection()
    await model.createIndexes()
  }
  await models.Cache.deleteMany({ expiresAt: { $lte: new Date() } })
}
