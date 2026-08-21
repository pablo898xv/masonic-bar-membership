import { tenantsCollection } from './db'
import { withMagstripeSentinels } from './msrx6/protocol'

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
  constructor(
    private baseUrl: string,
    private apiKey: string
  ) {}

  isConfigured() {
    return Boolean(this.baseUrl && this.apiKey)
  }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    }
  }

  async enableCard(card: TillSystemCard): Promise<TillSystemResponse> {
    if (!this.isConfigured()) {
      console.warn('Till system not configured, returning mock response')
      return {
        success: true,
        cardId: `mock_${card.cardNumber}_${Date.now()}`,
        message: 'Card enabled successfully (mock)',
        status: 'ACTIVE',
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/cards/enable`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          card_number: card.cardNumber,
          membership_id: card.membershipId,
          expiry_date: card.expiryDate.toISOString(),
          magstripe_data: card.magstripeData ? withMagstripeSentinels(card.magstripeData) : undefined,
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

  async disableCard(request: TillSystemDisableRequest): Promise<TillSystemResponse> {
    if (!this.isConfigured()) {
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

  async getCardStatus(cardNumber: string): Promise<TillSystemResponse> {
    if (!this.isConfigured()) {
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

  async extendCard(cardNumber: string, newValidUntil: Date): Promise<TillSystemResponse> {
    if (!this.isConfigured()) {
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
}

export async function tillSystemFor(tenantId: string) {
  const tenant = await tenantsCollection.findById(tenantId)
  return new TillSystemClient(tenant?.tillSystemApiUrl || '', tenant?.tillSystemApiKey || '')
}
