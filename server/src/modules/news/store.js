import { setTimeout as delay } from 'node:timers/promises'
import { newsModels } from './models.js'
import { NewsError } from './policy.js'

export function createNewsStore(database, { now = Date.now } = {}) {
  const { Cache, Quota } = newsModels(database)
  return {
    read: (cacheKey) => Cache.findOne({ cacheKey }).maxTimeMS(1500).lean().exec(),
    write: (edition) =>
      Cache.findOneAndUpdate(
        { cacheKey: edition.cacheKey },
        { $set: edition },
        { upsert: true, runValidators: true, returnDocument: 'after' },
      )
        .maxTimeMS(1500)
        .lean()
        .exec(),
    cleanup: () =>
      Cache.deleteMany({ expiresAt: { $lte: new Date(now()) } })
        .maxTimeMS(1500)
        .exec(),
    async reserve() {
      // a shared pacing record carries the start gap across utc days and process restarts
      for (let attempt = 0; attempt < 6; attempt++) {
        const time = now()
        const day = new Date(time).toISOString().slice(0, 10)
        const tomorrow = Date.parse(`${day}T00:00:00Z`) + 86400000
        for (const id of [day, 'guardian-pacing']) {
          try {
            await Quota.updateOne(
              { _id: id },
              {
                $setOnInsert: {
                  used: 0,
                  nextRequestAt: new Date(0),
                  expiresAt: new Date(tomorrow + 2 * 86400000),
                },
              },
              { upsert: true },
            ).maxTimeMS(1500)
          } catch (error) {
            if (error.code !== 11000) throw error
          }
        }
        const quota = await Quota.findById(day).maxTimeMS(1500).lean()
        if (quota.used >= 450)
          throw new NewsError(
            'NEWS_DAILY_LIMIT',
            'Today’s news connection allowance is resting. Please return tomorrow.',
            tomorrow,
          )
        const slot = await Quota.findOneAndUpdate(
          { _id: 'guardian-pacing', nextRequestAt: { $lte: new Date(time) } },
          {
            $set: {
              nextRequestAt: new Date(time + 1100),
              expiresAt: new Date(tomorrow + 2 * 86400000),
            },
          },
          { returnDocument: 'after' },
        )
          .maxTimeMS(1500)
          .lean()
        if (slot) {
          const claimed = await Quota.findOneAndUpdate(
            { _id: day, used: { $lt: 450 } },
            { $inc: { used: 1 } },
            { returnDocument: 'after' },
          )
            .maxTimeMS(1500)
            .lean()
          if (claimed) return
          throw new NewsError(
            'NEWS_DAILY_LIMIT',
            'Today’s news connection allowance is resting. Please return tomorrow.',
            tomorrow,
          )
        }
        const pacing = await Quota.findById('guardian-pacing').maxTimeMS(1500).lean()
        await delay(Math.max(1, Math.min(1100, new Date(pacing?.nextRequestAt).getTime() - now())))
      }
      throw new NewsError(
        'NEWS_BUSY',
        'The news desk is busy. Please try again shortly.',
        now() + 60000,
      )
    },
  }
}
