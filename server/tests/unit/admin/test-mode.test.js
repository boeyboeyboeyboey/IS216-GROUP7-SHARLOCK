import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createStandalone, createReplicaSet } = vi.hoisted(() => ({
  createStandalone: vi.fn(),
  createReplicaSet: vi.fn(),
}))

vi.mock('mongodb-memory-server-core', () => ({
  MongoMemoryServer: { create: createStandalone },
  MongoMemoryReplSet: { create: createReplicaSet },
}))

import {
  mongoBinary,
  parseTestRunnerArguments,
  startMongo,
  startMongoReplicaSet,
} from '../../../../scripts/lib/mongodb.js'

describe('test database mode', () => {
  beforeEach(() => {
    createStandalone.mockReset()
    createReplicaSet.mockReset()
  })

  it('preserves existing standalone arguments and leaves ordinary test flags untouched', () => {
    expect(
      parseTestRunnerArguments([
        'integration',
        'server/tests/integration/auth/auth.test.js',
        '--no-file-parallelism',
      ]),
    ).toEqual({
      suite: 'integration',
      extraArgs: ['server/tests/integration/auth/auth.test.js', '--no-file-parallelism'],
      replicaSet: false,
    })
    expect(
      parseTestRunnerArguments(['e2e', '--project=chromium', 'tests/e2e/portal.spec.js']),
    ).toEqual({
      suite: 'e2e',
      extraArgs: ['--project=chromium', 'tests/e2e/portal.spec.js'],
      replicaSet: false,
    })
  })

  it('consumes the opt-in replica-set flag only for integration tests', () => {
    expect(
      parseTestRunnerArguments(['integration', '--replica-set', 'server/tests/admin.test.js']),
    ).toEqual({
      suite: 'integration',
      extraArgs: ['server/tests/admin.test.js'],
      replicaSet: true,
    })
    expect(() => parseTestRunnerArguments(['e2e', '--replica-set'])).toThrow(
      '--replica-set is available only for integration tests.',
    )
    expect(() =>
      parseTestRunnerArguments(['integration', '--replica-set', '--replica-set']),
    ).toThrow('Use --replica-set at most once.')
  })

  it('rejects missing and unsupported suite names before starting a database', () => {
    expect(() => parseTestRunnerArguments([])).toThrow('Choose integration or e2e.')
    expect(() => parseTestRunnerArguments(['unit'])).toThrow('Choose integration or e2e.')
    expect(createStandalone).not.toHaveBeenCalled()
    expect(createReplicaSet).not.toHaveBeenCalled()
  })

  it('keeps the default standalone Mongo constructor and pinned binary unchanged', async () => {
    const server = { stop: vi.fn() }
    createStandalone.mockResolvedValue(server)

    await expect(startMongo({ dbName: 'sharlock_local_test' })).resolves.toBe(server)
    expect(createStandalone).toHaveBeenCalledWith({
      binary: mongoBinary,
      instance: { ip: '127.0.0.1', dbName: 'sharlock_local_test' },
    })
    expect(mongoBinary.version).toBe('8.2.6')
    expect(createReplicaSet).not.toHaveBeenCalled()
  })

  it('starts one loopback wiredTiger replica member with the pinned binary', async () => {
    const replicaSet = { stop: vi.fn() }
    createReplicaSet.mockResolvedValue(replicaSet)

    await expect(startMongoReplicaSet()).resolves.toBe(replicaSet)
    expect(createReplicaSet).toHaveBeenCalledWith({
      binary: mongoBinary,
      replSet: { count: 1, ip: '127.0.0.1', storageEngine: 'wiredTiger' },
    })
    expect(mongoBinary.version).toBe('8.2.6')
    expect(createStandalone).not.toHaveBeenCalled()
  })
})
