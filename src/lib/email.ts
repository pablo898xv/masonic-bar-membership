import nodemailer from 'nodemailer'

/**
 * Email Service Module
 * 
 * Handles sending emails for the membership system including:
 * - Renewal reminder emails
 * - Welcome emails
 * - Payment confirmation emails
 * 
 * Configuration required:
 * - SMTP_HOST: SMTP server hostname
 * - SMTP_PORT: SMTP server port
 * - SMTP_USER: SMTP username
 * - SMTP_PASS: SMTP password
 * - EMAIL_FROM: From address for emails
 */

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null

  constructor() {
    if (this.isConfigured()) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      })
    }
  }

  isConfigured(): boolean {
    return !!(
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
    )
  }

  async sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured() || !this.transporter) {
      console.log('Email not configured. Would send:', {
        to: options.to,
        subject: options.subject,
      })
      return { success: true }
    }

    try {
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'Masonic Hall Bar <noreply@masonichall.bar>',
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      })
      return { success: true }
    } catch (error: any) {
      console.error('Failed to send email:', error)
      return { success: false, error: error.message }
    }
  }

  async sendRenewalReminder(params: {
    memberName: string
    memberEmail: string
    cardNumber: number
    expiryDate: Date
    subscriptionName: string
    renewalUrl: string
  }): Promise<{ success: boolean; error?: string }> {
    const { memberName, memberEmail, cardNumber, expiryDate, subscriptionName, renewalUrl } = params
    
    const formattedDate = expiryDate.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })

    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Membership Renewal Reminder</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Masonic Hall Bar</h1>
    <p style="color: rgba(255,255,255,0.8); margin: 10px 0 0 0;">Membership Renewal Reminder</p>
  </div>
  
  <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e9ecef; border-top: none;">
    <p style="margin-top: 0;">Dear ${memberName},</p>
    
    <p>We wanted to remind you that your membership at the Masonic Hall Bar will be expiring soon.</p>
    
    <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #f0ad4e;">
      <p style="margin: 0 0 10px 0; font-weight: 600; color: #856404;">Your membership expires in ${daysUntilExpiry} days</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #666;">Card Number:</td>
          <td style="padding: 8px 0; font-weight: 600; text-align: right;">${cardNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Current Plan:</td>
          <td style="padding: 8px 0; font-weight: 600; text-align: right;">${subscriptionName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Expiry Date:</td>
          <td style="padding: 8px 0; font-weight: 600; text-align: right;">${formattedDate}</td>
        </tr>
      </table>
    </div>
    
    <p>To continue enjoying member discounts and benefits at the bar, please renew your membership before the expiry date.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${renewalUrl}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Renew My Membership</a>
    </div>
    
    <p style="color: #666; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="color: #2563eb; font-size: 14px; word-break: break-all;">${renewalUrl}</p>
    
    <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">
    
    <p style="color: #666; font-size: 14px; margin-bottom: 0;">
      If you have any questions, please speak to the bar manager.<br>
      Thank you for being a valued member!
    </p>
  </div>
  
  <div style="background: #1e3a5f; padding: 20px; text-align: center; border-radius: 0 0 12px 12px;">
    <p style="color: rgba(255,255,255,0.7); margin: 0; font-size: 12px;">
      Masonic Hall Bar<br>
      This is an automated reminder email.
    </p>
  </div>
</body>
</html>
`

    const text = `
Masonic Hall Bar - Membership Renewal Reminder

Dear ${memberName},

We wanted to remind you that your membership at the Masonic Hall Bar will be expiring soon.

Your membership expires in ${daysUntilExpiry} days

Card Number: ${cardNumber}
Current Plan: ${subscriptionName}
Expiry Date: ${formattedDate}

To continue enjoying member discounts and benefits at the bar, please renew your membership before the expiry date.

Renew your membership here: ${renewalUrl}

If you have any questions, please speak to the bar manager.

Thank you for being a valued member!

Masonic Hall Bar
`

    return this.sendEmail({
      to: memberEmail,
      subject: `Your Masonic Hall Bar membership expires in ${daysUntilExpiry} days`,
      html,
      text,
    })
  }

  async sendWelcomeEmail(params: {
    memberName: string
    memberEmail: string
    cardNumber: number
    cardType: 'QR_CODE' | 'PHYSICAL_CARD'
    subscriptionName: string
    expiryDate: Date
    qrCodeUrl?: string
  }): Promise<{ success: boolean; error?: string }> {
    const { memberName, memberEmail, cardNumber, cardType, subscriptionName, expiryDate, qrCodeUrl } = params

    const formattedDate = expiryDate.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })

    const cardTypeText = cardType === 'QR_CODE' 
      ? 'Your digital membership card is ready to use immediately.'
      : 'Your physical membership card is being prepared and will be available for collection at the bar.'

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Masonic Hall Bar</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to Masonic Hall Bar!</h1>
    <p style="color: rgba(255,255,255,0.8); margin: 10px 0 0 0;">Your membership is now active</p>
  </div>
  
  <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e9ecef; border-top: none;">
    <p style="margin-top: 0;">Dear ${memberName},</p>
    
    <p>Thank you for becoming a member of the Masonic Hall Bar! ${cardTypeText}</p>
    
    <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #28a745;">
      <p style="margin: 0 0 10px 0; font-weight: 600; color: #155724;">Membership Details</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #666;">Card Number:</td>
          <td style="padding: 8px 0; font-weight: 600; text-align: right;">${cardNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Membership Plan:</td>
          <td style="padding: 8px 0; font-weight: 600; text-align: right;">${subscriptionName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Valid Until:</td>
          <td style="padding: 8px 0; font-weight: 600; text-align: right;">${formattedDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Card Type:</td>
          <td style="padding: 8px 0; font-weight: 600; text-align: right;">${cardType === 'QR_CODE' ? 'Digital QR Code' : 'Physical Card'}</td>
        </tr>
      </table>
    </div>
    
    ${cardType === 'QR_CODE' && qrCodeUrl ? `
    <div style="text-align: center; margin: 30px 0;">
      <a href="${qrCodeUrl}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">View Your Digital Card</a>
    </div>
    ` : ''}
    
    <p>Simply present your membership card at the bar to receive your member discounts.</p>
    
    <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">
    
    <p style="color: #666; font-size: 14px; margin-bottom: 0;">
      We look forward to seeing you at the bar!<br>
      Masonic Hall Bar
    </p>
  </div>
  
  <div style="background: #1e3a5f; padding: 20px; text-align: center; border-radius: 0 0 12px 12px;">
    <p style="color: rgba(255,255,255,0.7); margin: 0; font-size: 12px;">
      Masonic Hall Bar<br>
      This is an automated email.
    </p>
  </div>
</body>
</html>
`

    const text = `
Welcome to Masonic Hall Bar!

Dear ${memberName},

Thank you for becoming a member of the Masonic Hall Bar! ${cardTypeText}

Membership Details:
- Card Number: ${cardNumber}
- Membership Plan: ${subscriptionName}
- Valid Until: ${formattedDate}
- Card Type: ${cardType === 'QR_CODE' ? 'Digital QR Code' : 'Physical Card'}

${cardType === 'QR_CODE' && qrCodeUrl ? `View your digital card here: ${qrCodeUrl}` : ''}

Simply present your membership card at the bar to receive your member discounts.

We look forward to seeing you at the bar!

Masonic Hall Bar
`

    return this.sendEmail({
      to: memberEmail,
      subject: 'Welcome to Masonic Hall Bar - Your membership is active!',
      html,
      text,
    })
  }
}

export const emailService = new EmailService()
export default emailService
