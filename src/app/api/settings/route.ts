import { NextRequest, NextResponse } from 'next/server'
import { getAppSettings, toPublicSettings, updateAppSettings } from '@/lib/settings'
import { appSettingsUpdateSchema } from '@/lib/validation'

export async function GET() {
  try {
    const settings = await getAppSettings()
    return NextResponse.json(toPublicSettings(settings))
  } catch (error) {
    console.error('Error loading settings:', error)
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = appSettingsUpdateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    if (validation.data.googleWalletServiceAccountJson) {
      try {
        const parsed = JSON.parse(validation.data.googleWalletServiceAccountJson) as {
          client_email?: string
          private_key?: string
        }
        if (!parsed.client_email || !parsed.private_key) {
          return NextResponse.json(
            { error: 'Google service account JSON must include client_email and private_key' },
            { status: 400 }
          )
        }
      } catch {
        return NextResponse.json({ error: 'Google service account JSON is not valid JSON' }, { status: 400 })
      }
    }

    const settings = await updateAppSettings(validation.data)
    return NextResponse.json(toPublicSettings(settings))
  } catch (error) {
    console.error('Error saving settings:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
