export const INVITATION_CARRY_MS = 10 * 60 * 1000

function validInvitation(request, now) {
  const invitation = request.session?.classInvitation
  if (
    !invitation ||
    typeof invitation.codeHash !== 'string' ||
    !/^[a-f\d]{64}$/.test(invitation.codeHash) ||
    !Number.isSafeInteger(invitation.expiresAt) ||
    invitation.expiresAt <= now() ||
    invitation.expiresAt > now() + INVITATION_CARRY_MS
  ) {
    return null
  }
  return invitation
}

export function getPendingInvitation(request, now = Date.now) {
  return validInvitation(request, now)?.codeHash ?? null
}

export function pendingInvitationValues(request, now = Date.now) {
  const invitation = validInvitation(request, now)
  return invitation ? { classInvitation: { ...invitation } } : {}
}

export function capturePendingInvitation(request, codeHash, now = Date.now) {
  request.session.classInvitation = { codeHash, expiresAt: now() + INVITATION_CARRY_MS }
}

export function clearPendingInvitation(request) {
  if (request.session) delete request.session.classInvitation
}
