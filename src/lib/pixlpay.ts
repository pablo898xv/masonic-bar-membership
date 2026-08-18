/**
 * Pixl Pay Integration Module
 * 
 * This module provides integration with the Pixl Pay payment platform.
 * It supports both card payments (via Dojo) and open banking payments.
 * 
 * Configuration required:
 * - PIXL_PAY_API_URL: Base URL of the Pixl Pay API
 * - PIXL_PAY_API_KEY: API key for authentication
 * - PIXL_PAY_MERCHANT_ID: Merchant ID for the Masonic Hall Bar
 */

export interface PaymentRequest {
  amount: number
  currency: string
  paymentMethod: 'CARD' | 'OPEN_BANKING'
  reference: string
  description: string
  customerEmail: string
  webhookUrl: string
  successUrl: string
  cancelUrl: string
  metadata?: Record<string, unknown>
}

export interface PaymentResponse {
  success: boolean
  paymentId: string
  paymentUrl: string
  expiresAt?: string
  metadata?: Record<string, unknown>
  error?: string
}

export interface PaymentStatus {
  transactionId: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED'
  amount: number
  currency: string
  paidAt?: string
  refundedAt?: string
  metadata?: Record<string, unknown>
}

export interface WebhookPayload {
  event: 'payment.completed' | 'payment.failed' | 'payment.refunded'
  transactionId: string
  reference: string
  amount: number
  currency: string
  timestamp: string
  signature: string
}

class PixlPayClient {
  private baseUrl: string
  private apiKey: string
  private merchantId: string
  private webhookSecret: string

  constructor() {
    this.baseUrl = process.env.PIXL_PAY_API_URL || ''
    this.apiKey = process.env.PIXL_PAY_API_KEY || ''
    this.merchantId = process.env.PIXL_PAY_MERCHANT_ID || ''
    this.webhookSecret = process.env.PIXL_PAY_WEBHOOK_SECRET || ''
  }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'X-Merchant-ID': this.merchantId,
    }
  }

  /**
   * Check if Pixl Pay is configured
   */
  isConfigured(): boolean {
    return !!(this.baseUrl && this.apiKey)
  }

  /**
   * Initiate a payment through Pixl Pay
   * 
   * For card payments, this will redirect to Dojo's payment page
   * For open banking, this will redirect to the bank selection page
   */
  async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    if (!this.isConfigured()) {
      console.warn('Pixl Pay not configured, returning mock response')
      return this.mockInitiatePayment(request)
    }

    try {
      const response = await fetch(`${this.baseUrl}/payments/initiate`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          amount: request.amount,
          currency: request.currency,
          payment_method: request.paymentMethod.toLowerCase().replace('_', '-'),
          reference: request.reference,
          description: request.description,
          customer_email: request.customerEmail,
          metadata: request.metadata,
          success_url: request.successUrl,
          cancel_url: request.cancelUrl,
          webhook_url: request.webhookUrl,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        return {
          success: false,
          paymentId: '',
          paymentUrl: '',
          error: error.message || 'Payment initiation failed',
        }
      }

      const data = await response.json()
      return {
        success: true,
        paymentId: data.payment_id || data.transaction_id,
        paymentUrl: data.payment_url || data.redirect_url,
        expiresAt: data.expires_at,
        metadata: request.metadata,
      }
    } catch (error) {
      console.error('Pixl Pay API error:', error)
      return {
        success: false,
        paymentId: '',
        paymentUrl: '',
        error: 'Failed to connect to payment provider',
      }
    }
  }

  /**
   * Check the status of a payment
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentStatus | null> {
    if (!this.isConfigured()) {
      console.warn('Pixl Pay not configured, returning mock status')
      return this.mockGetPaymentStatus(paymentId)
    }

    try {
      const response = await fetch(`${this.baseUrl}/payments/${paymentId}`, {
        method: 'GET',
        headers: this.headers,
      })

      if (!response.ok) {
        return null
      }

      const data = await response.json()
      return {
        transactionId: data.payment_id || data.transaction_id,
        status: data.status?.toUpperCase() as PaymentStatus['status'],
        amount: data.amount,
        currency: data.currency,
        paidAt: data.paid_at,
        refundedAt: data.refunded_at,
        metadata: data.metadata,
      }
    } catch (error) {
      console.error('Error checking payment status:', error)
      return null
    }
  }

  /**
   * Verify webhook payload and signature
   */
  verifyWebhook(payload: unknown, signature: string): boolean {
    if (!this.webhookSecret) {
      console.warn('Pixl Pay webhook secret not configured, skipping signature verification')
      return true
    }

    // In production, implement HMAC signature verification
    // using the webhook secret
    // Example: 
    // const expectedSig = crypto.createHmac('sha256', this.webhookSecret)
    //   .update(JSON.stringify(payload))
    //   .digest('hex')
    // return expectedSig === signature
    
    return true // Placeholder - implement proper verification
  }

  /**
   * Mock implementation for development/testing
   */
  private mockInitiatePayment(request: PaymentRequest): PaymentResponse {
    const mockPaymentId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    
    return {
      success: true,
      paymentId: mockPaymentId,
      paymentUrl: `${baseUrl}/api/payments/mock-checkout?membershipId=${request.reference}&paymentId=${mockPaymentId}`,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      metadata: request.metadata,
    }
  }

  private mockGetPaymentStatus(paymentId: string): PaymentStatus {
    return {
      transactionId: paymentId,
      status: 'PENDING',
      amount: 0,
      currency: 'GBP',
    }
  }

  /**
   * Initiate a refund
   */
  async initiateRefund(paymentId: string, amount?: number): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      console.warn('Pixl Pay not configured, returning mock refund response')
      return { success: true }
    }

    try {
      const response = await fetch(`${this.baseUrl}/payments/${paymentId}/refund`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          amount: amount,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        return {
          success: false,
          error: error.message || 'Refund failed',
        }
      }

      return { success: true }
    } catch (error) {
      console.error('Refund error:', error)
      return {
        success: false,
        error: 'Failed to process refund',
      }
    }
  }
}

export const pixlPay = new PixlPayClient()
export default pixlPay
