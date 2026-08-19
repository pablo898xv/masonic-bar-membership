import { getAppSettings } from './settings'

/**
 * Till System Integration Module
 *
 * Configuration can be saved on the admin Settings page, with environment
 * variables used as a fallback.
 */

export interface TillSystemCard {
  cardNumber: string
  membershipId: string
  expiryDate: Date
  magstripeData?: string
}

export interface TillSystemDisableRequest {
  cardNumber: string
  reason?: string
}

export interface TillSystemResponse {
  success: boolean
  cardId?: string
  message?: string
  data?: Record<string, unknown>
  status?: 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'BLOCKED'
}

class TillSystemClient {
  private baseUrl = ''
  private apiKey = ''

  private async load() {
    const settings = await getAppSettings()
    this.baseUrl = settings.tillSystemApiUrl
    this.apiKey = settings.tillSystemApiKey
  }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    }
  }

  /**
   * Check if the till system is configured
   */
  async isConfigured(): Promise<boolean> {
    await this.load()
    return !!(this.baseUrl && this.apiKey)
  }

  /**
   * Enable a membership card in the till system
   * 
   * This should be called when:
   * 1. A QR code membership is activated (payment completed)
   * 2. A physical card is issued to the member
   */
  async enableCard(card: TillSystemCard): Promise<TillSystemResponse> {
    if (!(await this.isConfigured())) {
      console.warn('Till system not configured, returning mock response')
      return this.mockEnableCard(card)
    }

    try {
      const response = await fetch(`${this.baseUrl}/cards/enable`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          card_number: card.cardNumber,
          membership_id: card.membershipId,
          expiry_date: card.expiryDate.toISOString(),
          magstripe_data: card.magstripeData,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        return {
          success: false,
          message: error.message || 'Failed to enable card',
        }
      }

      const data = await response.json()
      return {
        success: true,
        cardId: data.card_id,
        message: 'Card enabled successfully',
        status: 'ACTIVE',
      }
    } catch (error) {
      console.error('Till system API error:', error)
      return {
        success: false,
        message: 'Failed to connect to till system',
      }
    }
  }

  /**
   * Disable a membership card in the till system
   * 
   * This should be called when:
   * 1. A membership expires
   * 2. A membership is cancelled/refunded
   * 3. A card is reported lost/stolen
   */
  async disableCard(request: TillSystemDisableRequest): Promise<TillSystemResponse> {
    if (!(await this.isConfigured())) {
      console.warn('Till system not configured, returning mock response')
      return { success: true, message: 'Card disabled (mock)', status: 'INACTIVE' }
    }

    try {
      const response = await fetch(`${this.baseUrl}/cards/disable`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          card_number: request.cardNumber,
          reason: request.reason || 'Membership ended',
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        return {
          success: false,
          message: error.message || 'Failed to disable card',
        }
      }

      return {
        success: true,
        message: 'Card disabled successfully',
        status: 'INACTIVE',
      }
    } catch (error) {
      console.error('Till system API error:', error)
      return {
        success: false,
        message: 'Failed to connect to till system',
      }
    }
  }

  /**
   * Check the status of a card in the till system
   */
  async getCardStatus(cardNumber: string): Promise<TillSystemResponse> {
    if (!(await this.isConfigured())) {
      console.warn('Till system not configured, returning mock response')
      return { success: true, message: 'Status check (mock)', status: 'INACTIVE', data: {} }
    }

    try {
      const response = await fetch(`${this.baseUrl}/cards/${cardNumber}/status`, {
        method: 'GET',
        headers: this.headers,
      })

      if (!response.ok) {
        return {
          success: false,
          message: 'Card not found in till system',
        }
      }

      const responseData = await response.json()
      return {
        success: true,
        cardId: responseData.card_id,
        data: responseData,
        message: 'Status retrieved',
        status: responseData.status?.toUpperCase() as 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'BLOCKED',
      }
    } catch (error) {
      console.error('Till system API error:', error)
      return {
        success: false,
        message: 'Failed to connect to till system',
      }
    }
  }

  /**
   * Extend the validity of a card (for renewals)
   */
  async extendCard(cardNumber: string, newValidUntil: Date): Promise<TillSystemResponse> {
    if (!(await this.isConfigured())) {
      console.warn('Till system not configured, returning mock response')
      return { success: true, message: 'Card extended (mock)', status: 'ACTIVE' }
    }

    try {
      const response = await fetch(`${this.baseUrl}/cards/${cardNumber}/extend`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          valid_until: newValidUntil.toISOString(),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        return {
          success: false,
          message: error.message || 'Failed to extend card',
        }
      }

      return {
        success: true,
        message: 'Card extended successfully',
        status: 'ACTIVE',
      }
    } catch (error) {
      console.error('Till system API error:', error)
      return {
        success: false,
        message: 'Failed to connect to till system',
      }
    }
  }

  /**
   * Mock implementation for development/testing
   */
  private mockEnableCard(card: TillSystemCard): TillSystemResponse {
    console.log('Mock till system: Enabling card', card.cardNumber)
    return {
      success: true,
      cardId: `mock_${card.cardNumber}_${Date.now()}`,
      message: 'Card enabled successfully (mock)',
      status: 'ACTIVE',
    }
  }
}

export const tillSystem = new TillSystemClient()
export default tillSystem
