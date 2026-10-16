import { fileURLToPath } from 'node:url'
import { MongoMemoryReplSet, MongoMemoryServer } from 'mongodb-memory-server-core'

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

export function startMongoReplicaSet() {
  return MongoMemoryReplSet.create({
    binary: mongoBinary,
    replSet: {
      count: 1,
      ip: '127.0.0.1',
      storageEngine: 'wiredTiger',
    },
  })
}

export function parseTestRunnerArguments(argv) {
  const [suite, ...args] = argv
  if (!['integration', 'e2e'].includes(suite)) throw new Error('Choose integration or e2e.')

  const replicaSetFlags = args.filter((argument) => argument === '--replica-set').length
  if (replicaSetFlags > 1) throw new Error('Use --replica-set at most once.')

  return {
    suite,
    extraArgs: args.filter((argument) => argument !== '--replica-set'),
    replicaSet: replicaSetFlags === 1,
  }
}
