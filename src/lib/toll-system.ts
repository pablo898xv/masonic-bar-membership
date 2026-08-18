/**
 * Toll System Integration Module
 * 
 * This module provides integration with the external toll system
 * that manages access control for the Masonic Hall Bar.
 * 
 * The toll system needs to be notified when a membership card is activated
 * so that the card can be used for access/payment at the bar.
 * 
 * Configuration required:
 * - TOLL_SYSTEM_API_URL: Base URL of the toll system API
 * - TOLL_SYSTEM_API_KEY: API key for authentication
 */

export interface TollSystemCard {
  cardNumber: string
  memberName: string
  memberEmail: string
  validFrom: Date
  validUntil: Date
  cardType: 'QR_CODE' | 'PHYSICAL_CARD'
}

export interface TollSystemResponse {
  success: boolean
  cardId?: string
  error?: string
  status?: 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'BLOCKED'
}

class TollSystemClient {
  private baseUrl: string
  private apiKey: string

  constructor() {
    this.baseUrl = process.env.TOLL_SYSTEM_API_URL || ''
    this.apiKey = process.env.TOLL_SYSTEM_API_KEY || ''
  }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    }
  }

  /**
   * Check if the toll system is configured
   */
  isConfigured(): boolean {
    return !!(this.baseUrl && this.apiKey)
  }

  /**
   * Enable a membership card in the toll system
   * 
   * This should be called when:
   * 1. A QR code membership is activated (payment completed)
   * 2. A physical card is issued to the member
   */
  async enableCard(card: TollSystemCard): Promise<TollSystemResponse> {
    if (!this.isConfigured()) {
      console.warn('Toll system not configured, returning mock response')
      return this.mockEnableCard(card)
    }

    try {
      const response = await fetch(`${this.baseUrl}/cards/enable`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          card_number: card.cardNumber,
          member_name: card.memberName,
          member_email: card.memberEmail,
          valid_from: card.validFrom.toISOString(),
          valid_until: card.validUntil.toISOString(),
          card_type: card.cardType.toLowerCase().replace('_', '-'),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        return {
          success: false,
          error: error.message || 'Failed to enable card',
        }
      }

      const data = await response.json()
      return {
        success: true,
        cardId: data.card_id,
        status: 'ACTIVE',
      }
    } catch (error) {
      console.error('Toll system API error:', error)
      return {
        success: false,
        error: 'Failed to connect to toll system',
      }
    }
  }

  /**
   * Disable a membership card in the toll system
   * 
   * This should be called when:
   * 1. A membership expires
   * 2. A membership is cancelled/refunded
   * 3. A card is reported lost/stolen
   */
  async disableCard(cardNumber: string, reason?: string): Promise<TollSystemResponse> {
    if (!this.isConfigured()) {
      console.warn('Toll system not configured, returning mock response')
      return { success: true, status: 'INACTIVE' }
    }

    try {
      const response = await fetch(`${this.baseUrl}/cards/disable`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          card_number: cardNumber,
          reason: reason || 'Membership ended',
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        return {
          success: false,
          error: error.message || 'Failed to disable card',
        }
      }

      return {
        success: true,
        status: 'INACTIVE',
      }
    } catch (error) {
      console.error('Toll system API error:', error)
      return {
        success: false,
        error: 'Failed to connect to toll system',
      }
    }
  }

  /**
   * Check the status of a card in the toll system
   */
  async getCardStatus(cardNumber: string): Promise<TollSystemResponse> {
    if (!this.isConfigured()) {
      console.warn('Toll system not configured, returning mock response')
      return { success: true, status: 'INACTIVE' }
    }

    try {
      const response = await fetch(`${this.baseUrl}/cards/${cardNumber}/status`, {
        method: 'GET',
        headers: this.headers,
      })

      if (!response.ok) {
        return {
          success: false,
          error: 'Card not found in toll system',
        }
      }

      const data = await response.json()
      return {
        success: true,
        cardId: data.card_id,
        status: data.status.toUpperCase(),
      }
    } catch (error) {
      console.error('Toll system API error:', error)
      return {
        success: false,
        error: 'Failed to connect to toll system',
      }
    }
  }

  /**
   * Extend the validity of a card (for renewals)
   */
  async extendCard(cardNumber: string, newValidUntil: Date): Promise<TollSystemResponse> {
    if (!this.isConfigured()) {
      console.warn('Toll system not configured, returning mock response')
      return { success: true, status: 'ACTIVE' }
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
          error: error.message || 'Failed to extend card',
        }
      }

      return {
        success: true,
        status: 'ACTIVE',
      }
    } catch (error) {
      console.error('Toll system API error:', error)
      return {
        success: false,
        error: 'Failed to connect to toll system',
      }
    }
  }

  /**
   * Mock implementation for development/testing
   */
  private mockEnableCard(card: TollSystemCard): TollSystemResponse {
    console.log('Mock toll system: Enabling card', card.cardNumber)
    return {
      success: true,
      cardId: `mock_${card.cardNumber}_${Date.now()}`,
      status: 'ACTIVE',
    }
  }
}

export const tollSystem = new TollSystemClient()
export default tollSystem
