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
  customerName: string
  metadata?: Record<string, string>
  returnUrl: string
  webhookUrl: string
}

export interface PaymentResponse {
  success: boolean
  transactionId?: string
  redirectUrl?: string
  error?: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
}

export interface PaymentStatus {
  transactionId: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED'
  amount: number
  currency: string
  paidAt?: string
  refundedAt?: string
  metadata?: Record<string, string>
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

  constructor() {
    this.baseUrl = process.env.PIXL_PAY_API_URL || ''
    this.apiKey = process.env.PIXL_PAY_API_KEY || ''
    this.merchantId = process.env.PIXL_PAY_MERCHANT_ID || ''
  }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'X-Merchant-ID': this.merchantId,
    }
  }

  /**
   * Initiate a payment through Pixl Pay
   * 
   * For card payments, this will redirect to Dojo's payment page
   * For open banking, this will redirect to the bank selection page
   */
  async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    if (!this.baseUrl || !this.apiKey) {
      console.warn('Pixl Pay not configured, returning mock response')
      return this.mockInitiatePayment(request)
    }

    try {
      const response = await fetch(`${this.baseUrl}/payments/initiate`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          amount: Math.round(request.amount * 100),
          currency: request.currency,
          payment_method: request.paymentMethod.toLowerCase().replace('_', '-'),
          reference: request.reference,
          description: request.description,
          customer: {
            email: request.customerEmail,
            name: request.customerName,
          },
          metadata: request.metadata,
          return_url: request.returnUrl,
          webhook_url: request.webhookUrl,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        return {
          success: false,
          error: error.message || 'Payment initiation failed',
          status: 'FAILED',
        }
      }

      const data = await response.json()
      return {
        success: true,
        transactionId: data.transaction_id,
        redirectUrl: data.redirect_url,
        status: 'PENDING',
      }
    } catch (error) {
      console.error('Pixl Pay API error:', error)
      return {
        success: false,
        error: 'Failed to connect to payment provider',
        status: 'FAILED',
      }
    }
  }

  /**
   * Check the status of a payment
   */
  async getPaymentStatus(transactionId: string): Promise<PaymentStatus | null> {
    if (!this.baseUrl || !this.apiKey) {
      console.warn('Pixl Pay not configured, returning mock status')
      return this.mockGetPaymentStatus(transactionId)
    }

    try {
      const response = await fetch(`${this.baseUrl}/payments/${transactionId}`, {
        method: 'GET',
        headers: this.headers,
      })

      if (!response.ok) {
        return null
      }

      const data = await response.json()
      return {
        transactionId: data.transaction_id,
        status: data.status.toUpperCase(),
        amount: data.amount / 100,
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
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.apiKey) {
      console.warn('Pixl Pay not configured, skipping signature verification')
      return true
    }

    // In production, implement HMAC signature verification
    // using the API key as the secret
    // Example: const expectedSig = crypto.createHmac('sha256', this.apiKey).update(payload).digest('hex')
    // return expectedSig === signature
    
    return true // Placeholder - implement proper verification
  }

  /**
   * Mock implementation for development/testing
   */
  private mockInitiatePayment(request: PaymentRequest): PaymentResponse {
    const mockTransactionId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    return {
      success: true,
      transactionId: mockTransactionId,
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/mock-checkout?txn=${mockTransactionId}&amount=${request.amount}&method=${request.paymentMethod}`,
      status: 'PENDING',
    }
  }

  private mockGetPaymentStatus(transactionId: string): PaymentStatus {
    return {
      transactionId,
      status: 'PENDING',
      amount: 0,
      currency: 'GBP',
    }
  }

  /**
   * Initiate a refund
   */
  async initiateRefund(transactionId: string, amount?: number): Promise<{ success: boolean; error?: string }> {
    if (!this.baseUrl || !this.apiKey) {
      console.warn('Pixl Pay not configured, returning mock refund response')
      return { success: true }
    }

    try {
      const response = await fetch(`${this.baseUrl}/payments/${transactionId}/refund`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          amount: amount ? Math.round(amount * 100) : undefined,
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
