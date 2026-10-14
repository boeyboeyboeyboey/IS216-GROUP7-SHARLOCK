import { randomUUID } from 'node:crypto'
import { Types } from 'mongoose'
import { userModel } from '../../models/User.js'
import { parseRegistrationInput } from '../auth/policy.js'
import { hashPassword } from '../auth/password.js'
import { createAuditService } from '../audit/service.js'
import { bootstrapStateId, bootstrapStateModel } from './model.js'

export class BootstrapError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'BootstrapError'
    this.code = code
  }
}

function refused() {
  return new BootstrapError(
    'BOOTSTRAP_REFUSED',
    'Setup refused: an account or initial administrator already exists. No account was promoted.',
  )
}

export async function assertTransactionSupport(database) {
  if (!database?.db || database.readyState !== 1) {
    throw new BootstrapError('DATABASE_UNAVAILABLE', 'Connect to the selected database first.')
  }
  let topology
  try {
    topology = await database.db.admin().command({ hello: 1 }, { timeoutMS: 5000 })
  } catch {
    throw new BootstrapError('DATABASE_UNAVAILABLE', 'The selected database could not be checked.')
  }
  const replicaSet = typeof topology?.setName === 'string' && topology.setName.length > 0
  const shardedCluster = topology?.msg === 'isdbgrid'
  const minimumWireVersion = shardedCluster ? 8 : 7
  if (
    (!replicaSet && !shardedCluster) ||
    !Number.isInteger(topology?.maxWireVersion) ||
    topology.maxWireVersion < minimumWireVersion
  ) {
    throw new BootstrapError(
      'TRANSACTIONS_REQUIRED',
      'Setup needs a transaction-capable replica set or sharded cluster. Database settings were not changed.',
    )
  }
}

export function createBootstrapService(database, { now = Date.now, recordAuditEvent } = {}) {
  const User = userModel(database)
  const BootstrapState = bootstrapStateModel(database)
  const auditWriter = recordAuditEvent || createAuditService(database, { now }).recordAuditEvent

  async function bootstrap(input) {
    let parsed
    try {
      parsed = parseRegistrationInput(input)
    } catch {
      throw new BootstrapError(
        'INVALID_ACCOUNT_DETAILS',
        'Check the account details, avatar and 15–128 character password.',
      )
    }
    await assertTransactionSupport(database)
    const userId = new Types.ObjectId()
    const requestId = randomUUID()
    let session
    let result
    let cleanupFailed = false
    try {
      const passwordHash = await hashPassword(parsed.password)
      session = await database.startSession()
      result = await session.withTransaction(
        async () => {
          const completed = await BootstrapState.exists({ _id: bootstrapStateId }).session(session)
          const administrator = await User.exists({ globalRoles: 'admin' }).session(session)
          const collision = await User.exists({
            $or: [
              { emailNormalized: parsed.emailNormalized },
              { usernameNormalized: parsed.username.normalized },
            ],
          }).session(session)
          if (completed || administrator || collision) throw refused()

          const occurredAt = new Date(now())
          // the fixed guard id serializes concurrent first-admin transactions
          await BootstrapState.create([{ _id: bootstrapStateId, userId, createdAt: occurredAt }], {
            session,
          })
          await User.create(
            [
              {
                _id: userId,
                emailNormalized: parsed.emailNormalized,
                username: parsed.username.display,
                usernameNormalized: parsed.username.normalized,
                avatarId: parsed.avatarId,
                passwordHash,
                globalRoles: ['admin'],
                accountStatus: 'active',
                authVersion: 1,
                passwordChangedAt: occurredAt,
              },
            ],
            { session },
          )
          await auditWriter(
            {
              eventType: 'admin.bootstrap',
              actorKind: 'operator',
              actorId: null,
              targetId: userId.toString(),
              scopeCohortId: null,
              outcome: 'success',
              requestId,
            },
            { session },
          )
          return { id: userId.toString() }
        },
        {
          readConcern: { level: 'snapshot' },
          writeConcern: { w: 'majority' },
          maxCommitTimeMS: 5000,
          timeoutMS: 10000,
        },
      )
    } catch (error) {
      if (error instanceof BootstrapError) throw error
      if (error?.code === 11000) throw refused()
      throw new BootstrapError(
        'BOOTSTRAP_FAILED',
        'Administrator setup could not be confirmed. Request an approved state check before retrying.',
      )
    } finally {
      parsed.password = undefined
      try {
        await session?.endSession()
      } catch {
        cleanupFailed = true
      }
    }
    if (cleanupFailed) {
      throw new BootstrapError(
        'BOOTSTRAP_FAILED',
        'Setup cleanup could not be confirmed. Request an approved state check before retrying.',
      )
    }
    return result
  }

  return Object.freeze({ bootstrap })
}
