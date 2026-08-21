import { z } from 'zod'

export const memberSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone number must be at least 10 characters'),
})

export const memberUpdateSchema = memberSchema.partial()

export const subscriptionPlanSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  durationYears: z.number().int().min(1, 'Duration must be at least 1 year'),
  price: z.number().min(0, 'Price must be positive'),
  currency: z.string().default('GBP'),
  isActive: z.boolean().default(true),
})

export const partnerIssueSchema = z.object({
  member: memberSchema,
  subscriptionPlanId: z.string().min(1, 'Subscription plan ID is required'),
  cardNumber: z.number().int().positive().optional(),
  createCardNumber: z.boolean().optional(),
  cardType: z.enum(['QR_CODE', 'PHYSICAL_CARD', 'BOTH']).optional(),
  notifications: z
    .object({
      email: z.boolean().optional(),
      sms: z.boolean().optional(),
    })
    .optional(),
  returnCardUrl: z.boolean().optional(),
})

export const membershipPurchaseSchema = z.object({
  memberId: z.string().min(1, 'Member ID is required'),
  subscriptionPlanId: z.string().min(1, 'Subscription plan ID is required'),
  cardType: z.enum(['QR_CODE', 'PHYSICAL_CARD', 'BOTH']),
  paymentMethod: z.enum(['CARD', 'OPEN_BANKING', 'CASH', 'IN_PERSON', 'COMPLIMENTARY']).optional(),
  adminIssued: z.boolean().optional(),
})

export const cardNumberImportSchema = z.object({
  startNumber: z.number().int().min(1, 'Start number must be positive'),
  endNumber: z.number().int().min(1, 'End number must be positive'),
  batchId: z.string().optional(),
})

export const cardIssuanceUpdateSchema = z.object({
  queueStatus: z.enum(['PENDING', 'READY_TO_ENCODE', 'ENCODED', 'ISSUED', 'SHIPPED']),
  notes: z.string().optional(),
})

export const adminLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const adminTotpVerifySchema = z.object({
  ticket: z.string().min(1),
  code: z.string().min(6, 'Enter the 6-digit code or a backup code'),
})

export const adminChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  code: z.string().optional(),
})

export const adminStaffUpdateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  email: z.string().email('Invalid email address').optional(),
  role: z.enum(['OWNER', 'ADMIN', 'MANAGER']).optional(),
  isActive: z.boolean().optional(),
  password: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().min(8, 'Password must be at least 8 characters').optional()
  ),
  disableTotp: z.boolean().optional(),
})

export const adminCreateSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['ADMIN', 'MANAGER']).default('MANAGER'),
})

export const appSettingsUpdateSchema = z.object({
  hopeMacyBaseUrl: z.string().optional(),
  hopeMacyAppId: z.string().optional(),
  hopeMacyAppSecret: z.string().optional(),
  hopeMacyMaxAmount: z.string().optional(),
  stripePublishableKey: z.string().optional(),
  stripeSecretKey: z.string().optional(),
  stripeWebhookSecret: z.string().optional(),
  bankAccountName: z.string().optional(),
  bankSortCode: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.string().optional(),
  smtpSecure: z.enum(['true', 'false']).optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  emailFrom: z.string().optional(),
  passTypeIdentifier: z.string().optional(),
  teamIdentifier: z.string().optional(),
  passCertificatePath: z.string().optional(),
  passCertificatePassword: z.string().optional(),
  googleWalletIssuerId: z.string().optional(),
  googleWalletClassSuffix: z.string().optional(),
  googleWalletServiceAccountPath: z.string().optional(),
  googleWalletServiceAccountJson: z.string().optional(),
  googleWalletLogoUrl: z.string().optional(),
  twilioAccountSid: z.string().optional(),
  twilioAuthToken: z.string().optional(),
  twilioFromNumber: z.string().optional(),
  twilioLogFallback: z.enum(['true', 'false']).optional(),
  creditsPerSms: z.string().optional(),
  smsWelcomeEnabled: z.enum(['true', 'false']).optional(),
  smsRenewalEnabled: z.enum(['true', 'false']).optional(),
  smsDigitalCardEnabled: z.enum(['true', 'false']).optional(),
  smsWelcomeTemplate: z.string().optional(),
  smsRenewalTemplate: z.string().optional(),
  smsDigitalCardTemplate: z.string().optional(),
  emailWelcomeSubject: z.string().optional(),
  emailWelcomeTemplate: z.string().optional(),
  emailRenewalSubject: z.string().optional(),
  emailRenewalTemplate: z.string().optional(),
  emailRenewalConfirmSubject: z.string().optional(),
  emailRenewalConfirmTemplate: z.string().optional(),
  emailDigitalCardSubject: z.string().optional(),
  emailDigitalCardTemplate: z.string().optional(),
})

export type MemberInput = z.infer<typeof memberSchema>
export type MemberUpdateInput = z.infer<typeof memberUpdateSchema>
export type SubscriptionPlanInput = z.infer<typeof subscriptionPlanSchema>
export type MembershipPurchaseInput = z.infer<typeof membershipPurchaseSchema>
export type CardNumberImportInput = z.infer<typeof cardNumberImportSchema>
export type CardIssuanceUpdateInput = z.infer<typeof cardIssuanceUpdateSchema>
export type AdminLoginInput = z.infer<typeof adminLoginSchema>
export type AdminCreateInput = z.infer<typeof adminCreateSchema>
