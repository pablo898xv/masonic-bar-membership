import { publicAdminUser } from '@/lib/admin-user'
import { adminUsersCollection, type AdminUser } from '@/lib/db'
import { decryptMemberField, encryptMemberField } from '@/lib/member-pii'
import { consumeBackupCode, verifyTotpCode } from '@/lib/totp'

export function userHasTotp(user: Pick<AdminUser, 'totpEnabled' | 'totpSecret'>) {
  return Boolean(user.totpEnabled && user.totpSecret)
}

export function readTotpSecret(stored?: string) {
  if (!stored) return ''
  return decryptMemberField(stored)
}

export function storeTotpSecret(secret: string) {
  return encryptMemberField(secret)
}

export async function verifyUserSecondFactor(user: AdminUser, code: string) {
  const trimmed = (code || '').trim()
  if (trimmed.length < 6) return { ok: false as const }

  const secret = readTotpSecret(user.totpSecret)
  if (secret && verifyTotpCode(secret, trimmed)) return { ok: true as const }

  const remaining = consumeBackupCode(user.totpBackupHashes, trimmed)
  if (!remaining) return { ok: false as const }

  await adminUsersCollection.update(user.id, { totpBackupHashes: remaining })
  return { ok: true as const }
}

export function loginUserResponse(user: AdminUser) {
  return { user: publicAdminUser(user) }
}
