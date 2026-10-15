import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { userModel } from '../../models/User.js'
import { assertTransactionSupport } from '../admin/bootstrap.js'
import { createAuditService } from '../audit/service.js'
import { hashPassword } from '../auth/password.js'
import {
  activationLifetimeMs,
  activationObjectId,
  ActivationError,
  parseActivationInput,
} from './policy.js'
import { passwordResetModel } from './model.js'

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex')
}

export function createRecoveryService(
  database,
  { now = Date.now, clientOrigin = 'http://localhost:5173', recordAuditEvent } = {},
) {
  const User = userModel(database)
  const PasswordReset = passwordResetModel(database)
  const writeAudit = recordAuditEvent || createAuditService(database, { now }).recordAuditEvent
  const origin = new URL(clientOrigin)
  if (
    origin.origin !== clientOrigin ||
    origin.username ||
    origin.password ||
    origin.protocol !== 'http:' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)
  ) {
    throw new TypeError('A validated localhost client origin is required.')
  }

  async function issueActivation({ userId, actorId }, { session } = {}) {
    if (!session) throw new TypeError('Activation issuing requires a transaction session.')
    const targetId = activationObjectId(userId)
    const administratorId = activationObjectId(actorId)
    const administrator = await User.exists({
      _id: administratorId,
      accountStatus: 'active',
      globalRoles: 'admin',
    }).session(session)
    if (!administrator) throw new ActivationError('ACTIVATION_UNAVAILABLE', 403)
    const target = await User.findOneAndUpdate(
      { _id: targetId, accountStatus: 'disabled', globalRoles: ['instructor'] },
      { $inc: { authVersion: 1 } },
      { new: true, session, runValidators: true },
    ).select('_id authVersion')
    if (!target) throw new ActivationError()
    const occurredAt = new Date(now())
    const expiresAt = new Date(occurredAt.getTime() + activationLifetimeMs)
    const token = randomBytes(32).toString('base64url')
    await PasswordReset.updateMany(
      { userId: targetId, purpose: 'activation', consumedAt: null, revokedAt: null },
      { $set: { revokedAt: occurredAt } },
      { session },
    )
    await PasswordReset.create(
      [
        {
          userId: targetId,
          purpose: 'activation',
          tokenHash: tokenHash(token),
          authVersion: target.authVersion,
          initiatedBy: administratorId,
          scopeCohortId: null,
          createdAt: occurredAt,
          expiresAt,
        },
      ],
      { session },
    )
    await writeAudit(
      {
        eventType: 'admin.instructor.activation.issue',
        actorKind: 'user',
        actorId: administratorId,
        targetId,
        scopeCohortId: null,
        outcome: 'success',
        requestId: randomUUID(),
      },
      { session },
    )
    return {
      activationUrl: `${clientOrigin}/activate-account#token=${token}`,
      expiresAt: expiresAt.toISOString(),
    }
  }

  async function activateAccount(input) {
    const parsed = parseActivationInput(input)
    const hash = tokenHash(parsed.token)
    let session
    let cleanupFailed = false
    try {
      await assertTransactionSupport(database)
      const candidate = await PasswordReset.findOne({
        tokenHash: hash,
        purpose: 'activation',
        consumedAt: null,
        revokedAt: null,
        expiresAt: { $gt: new Date(now()) },
      })
        .select('_id')
        .lean()
      if (!candidate) throw new ActivationError()
      const passwordHash = await hashPassword(parsed.password)
      session = await database.startSession()
      await session.withTransaction(
        async () => {
          const occurredAt = new Date(now())
          const reset = await PasswordReset.findOneAndUpdate(
            {
              _id: candidate._id,
              tokenHash: hash,
              purpose: 'activation',
              consumedAt: null,
              revokedAt: null,
              expiresAt: { $gt: occurredAt },
            },
            { $set: { consumedAt: occurredAt } },
            { new: true, session },
          )
          if (!reset) throw new ActivationError()
          const target = await User.findOneAndUpdate(
            {
              _id: reset.userId,
              accountStatus: 'disabled',
              globalRoles: ['instructor'],
              authVersion: reset.authVersion,
            },
            {
              $set: { passwordHash, passwordChangedAt: occurredAt, accountStatus: 'active' },
              $inc: { authVersion: 1 },
            },
            { new: true, session, runValidators: true },
          ).select('_id')
          if (!target) throw new ActivationError()
          const userId = target._id.toString()
          await PasswordReset.updateMany(
            {
              userId,
              purpose: 'activation',
              _id: { $ne: reset._id },
              consumedAt: null,
              revokedAt: null,
            },
            { $set: { revokedAt: occurredAt } },
            { session },
          )
          await database.db
            .collection('auth_sessions')
            .deleteMany({ 'session.userId': userId }, { session })
          await writeAudit(
            {
              eventType: 'account.instructor.activate',
              actorKind: 'user',
              actorId: userId,
              targetId: userId,
              scopeCohortId: null,
              outcome: 'success',
              requestId: randomUUID(),
            },
            { session },
          )
        },
        {
          readConcern: { level: 'snapshot' },
          writeConcern: { w: 'majority' },
          maxCommitTimeMS: 5000,
          timeoutMS: 10000,
        },
      )
    } catch (error) {
      if (error instanceof ActivationError) throw error
      throw new ActivationError('ACTIVATION_FAILED', 503)
    } finally {
      parsed.password = undefined
      parsed.token = undefined
      try {
        await session?.endSession()
      } catch {
        cleanupFailed = true
      }
    }
    if (cleanupFailed) throw new ActivationError('ACTIVATION_FAILED', 503)
  }

  return Object.freeze({ issueActivation, activateAccount })
}
