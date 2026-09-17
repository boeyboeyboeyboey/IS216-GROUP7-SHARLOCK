import { fileURLToPath } from 'node:url'
import { MongoMemoryServer } from 'mongodb-memory-server-core'

export const mongoBinary = {
  version: '8.2.6',
  downloadDir: fileURLToPath(new URL('../../.cache/mongodb', import.meta.url)),
  checkMD5: true,
}

export function startMongo(instance = {}) {
  return MongoMemoryServer.create({
    binary: mongoBinary,
    instance: { ip: '127.0.0.1', ...instance },
  })
}
