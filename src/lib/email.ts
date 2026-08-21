import nodemailer from 'nodemailer'
import { decodeTenantPng } from './branding'
import { AppSettings, getAppSettings } from './settings'

/**
 * Email Service Module
 *
 * Handles sending emails for the membership system including:
 * - Renewal reminder emails
 * - Welcome emails
 * - Digital card emails
 *
 * Subjects and bodies are edited in platform settings. Merge fields match SMS:
 * {{tenant_name}}, {{member_name}}, {{card_number}}, {{plan}}, {{expiry}},
 * {{days}}, {{renewal_url}}, {{card_url}}, {{card_type}}, {{card_type_text}}
 */

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  attachments?: Array<{
    filename: string
    content: Buffer
    contentType: string
    cid: string
    contentDisposition?: 'inline' | 'attachment'
  }>
}

export type EmailMergeFields = {
  tenant_name?: string
  member_name?: string
  card_number?: string | number
  plan?: string
  expiry?: string
  days?: string | number
  renewal_url?: string
  card_url?: string
  card_type?: string
  card_type_text?: string
}

type EmailKind = 'welcome' | 'renewal' | 'renewalConfirm' | 'digitalCard'

function mergeEmailTemplate(template: string, fields: EmailMergeFields) {
  return template
    .replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key: string) => {
      const value = fields[key as keyof EmailMergeFields]
      return value == null ? '' : String(value)
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function emailBodyToHtml(body: string) {
  const linked = escapeHtml(body).replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#2563eb;word-break:break-all;">$1</a>'
  )
  return linked
    .split(/\n{2,}/)
    .map((para) => `<p style="margin:0 0 16px 0;">${para.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

function wrapMemberEmail(bodyHtml: string, title: string, brandName: string, hasLogo: boolean) {
  const logo = hasLogo
    ? `<img src="cid:venue-logo" alt="${escapeHtml(brandName)}" width="160" style="max-height:64px;width:auto;max-width:160px;height:auto;margin:0 auto 14px;display:block;background:#ffffff;padding:8px 12px;border-radius:8px;" />`
    : ''
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
    ${logo}
    <h1 style="color: white; margin: 0; font-size: 24px;">${escapeHtml(brandName)}</h1>
    <p style="color: rgba(255,255,255,0.8); margin: 10px 0 0 0;">${escapeHtml(title)}</p>
  </div>
  <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e9ecef; border-top: none;">
    ${bodyHtml}
  </div>
  <div style="background: #1e3a5f; padding: 20px; text-align: center; border-radius: 0 0 12px 12px;">
    <p style="color: rgba(255,255,255,0.7); margin: 0; font-size: 12px;">
      ${escapeHtml(brandName)}<br>
      This is an automated email.
    </p>
  </div>
</body>
</html>`
}

function formatDate(value: Date) {
  return value.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function cardTypeCopy(cardType: 'QR_CODE' | 'PHYSICAL_CARD' | 'BOTH') {
  if (cardType === 'QR_CODE') {
    return {
      label: 'Digital QR Code',
      text: 'Your digital membership card is ready to use immediately.',
    }
  }
  if (cardType === 'BOTH') {
    return {
      label: 'Digital QR and Physical Card',
      text: 'You can use your digital membership card now, and a physical card can also be issued at the bar.',
    }
  }
  return {
    label: 'Physical Card',
    text: 'Your physical membership card is being prepared and will be available for collection at the bar.',
  }
}

function templatesFor(settings: AppSettings, kind: EmailKind) {
  if (kind === 'welcome') {
    return {
      subject: settings.emailWelcomeSubject,
      body: settings.emailWelcomeTemplate,
      title: 'Your membership is now active',
    }
  }
  if (kind === 'renewal') {
    return {
      subject: settings.emailRenewalSubject,
      body: settings.emailRenewalTemplate,
      title: 'Membership renewal reminder',
    }
  }
  if (kind === 'renewalConfirm') {
    return {
      subject: settings.emailRenewalConfirmSubject,
      body: settings.emailRenewalConfirmTemplate,
      title: 'Membership renewed',
    }
  }
  return {
    subject: settings.emailDigitalCardSubject,
    body: settings.emailDigitalCardTemplate,
    title: 'Your digital card',
  }
}

class EmailService {
  private async transporter() {
    const settings = await getAppSettings()
    if (!settings.smtpHost) return null

    return nodemailer.createTransport({
      host: settings.smtpHost,
      port: parseInt(settings.smtpPort || '587', 10),
      secure: settings.smtpSecure === 'true',
      ...(settings.smtpUser
        ? {
            auth: {
              user: settings.smtpUser,
              pass: settings.smtpPass,
            },
          }
        : {}),
    })
  }

  async isConfigured(): Promise<boolean> {
    const settings = await getAppSettings()
    return Boolean(settings.smtpHost)
  }

  async sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
    const settings = await getAppSettings()
    const transporter = await this.transporter()
    if (!settings.smtpHost || !transporter) {
      console.log('Email not configured. Would send:', {
        to: options.to,
        subject: options.subject,
      })
      return { success: true }
    }

    try {
      await transporter.sendMail({
        from: settings.emailFrom || 'Membership Manager <noreply@masonichall.bar>',
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
      })
      return { success: true }
    } catch (error: any) {
      console.error('Failed to send email:', error)
      return { success: false, error: error.message }
    }
  }

  private async sendTemplated(
    kind: EmailKind,
    to: string,
    fields: EmailMergeFields,
    logoPng?: string
  ): Promise<{ success: boolean; error?: string }> {
    const settings = await getAppSettings()
    const templates = templatesFor(settings, kind)
    const subject = mergeEmailTemplate(templates.subject, fields)
    const text = mergeEmailTemplate(templates.body, fields)
    if (!subject || !text) {
      return { success: false, error: 'The email template is empty' }
    }
    const brandName = fields.tenant_name || 'Membership Manager'
    const logo = decodeTenantPng(logoPng)
    return this.sendEmail({
      to,
      subject,
      text,
      html: wrapMemberEmail(emailBodyToHtml(text), templates.title, brandName, Boolean(logo)),
      attachments: logo
        ? [
            {
              filename: 'logo.png',
              content: logo,
              contentType: 'image/png',
              cid: 'venue-logo',
              contentDisposition: 'inline',
            },
          ]
        : undefined,
    })
  }

  async sendRenewalReminder(params: {
    memberName: string
    memberEmail: string
    cardNumber: number
    expiryDate: Date
    subscriptionName: string
    renewalUrl: string
    tenantName?: string
    logoPng?: string
  }): Promise<{ success: boolean; error?: string }> {
    const daysUntilExpiry = Math.ceil((params.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return this.sendTemplated(
      'renewal',
      params.memberEmail,
      {
        tenant_name: params.tenantName || 'Membership Manager',
        member_name: params.memberName,
        card_number: params.cardNumber,
        plan: params.subscriptionName,
        expiry: formatDate(params.expiryDate),
        days: daysUntilExpiry,
        renewal_url: params.renewalUrl,
      },
      params.logoPng
    )
  }

  async sendRenewalConfirmation(params: {
    memberName: string
    memberEmail: string
    cardNumber: number
    subscriptionName: string
    expiryDate: Date
    tenantName?: string
    logoPng?: string
  }): Promise<{ success: boolean; error?: string }> {
    return this.sendTemplated(
      'renewalConfirm',
      params.memberEmail,
      {
        tenant_name: params.tenantName || 'Membership Manager',
        member_name: params.memberName,
        card_number: params.cardNumber,
        plan: params.subscriptionName,
        expiry: formatDate(params.expiryDate),
      },
      params.logoPng
    )
  }

  async sendWelcomeEmail(params: {
    memberName: string
    memberEmail: string
    cardNumber: number
    cardType: 'QR_CODE' | 'PHYSICAL_CARD' | 'BOTH'
    subscriptionName: string
    expiryDate: Date
    qrCodeUrl?: string
    tenantName?: string
    logoPng?: string
  }): Promise<{ success: boolean; error?: string }> {
    const copy = cardTypeCopy(params.cardType)
    return this.sendTemplated(
      'welcome',
      params.memberEmail,
      {
        tenant_name: params.tenantName || 'Membership Manager',
        member_name: params.memberName,
        card_number: params.cardNumber,
        plan: params.subscriptionName,
        expiry: formatDate(params.expiryDate),
        card_url: params.qrCodeUrl || '',
        card_type: copy.label,
        card_type_text: copy.text,
      },
      params.logoPng
    )
  }

  async sendDigitalCardEmail(params: {
    memberName: string
    memberEmail: string
    cardNumber: number
    qrCodeUrl: string
    tenantName?: string
    logoPng?: string
  }): Promise<{ success: boolean; error?: string }> {
    return this.sendTemplated(
      'digitalCard',
      params.memberEmail,
      {
        tenant_name: params.tenantName || 'Membership Manager',
        member_name: params.memberName,
        card_number: params.cardNumber,
        card_url: params.qrCodeUrl,
      },
      params.logoPng
    )
  }
}

export const emailService = new EmailService()
export default emailService
