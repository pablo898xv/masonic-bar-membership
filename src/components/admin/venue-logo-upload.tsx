'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

type Props = {
  tenantId: string
  logoUrl?: string
  onUpdated?: (logoUrl: string) => void
}

const MAX_EDGE = 2400
const MAX_STORE_BYTES = 700_000

function stripDataUrl(dataUrl: string) {
  return dataUrl.replace(/^data:image\/png;base64,/, '')
}

function estimatedBytes(dataUrl: string) {
  return Math.ceil((stripDataUrl(dataUrl).length * 3) / 4)
}

async function fileToPngBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  if (!png) return null
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function drawContain(bitmap: ImageBitmap, maxEdge: number) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { alpha: true })
  if (!ctx) throw new Error('Could not process image')
  const scale = Math.min(maxEdge / bitmap.width, maxEdge / bitmap.height, 1)
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}

function drawCover(bitmap: ImageBitmap, size: number) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { alpha: true })
  if (!ctx) throw new Error('Could not process image')
  canvas.width = size
  canvas.height = size
  const scale = Math.max(size / bitmap.width, size / bitmap.height)
  const drawW = bitmap.width * scale
  const drawH = bitmap.height * scale
  ctx.clearRect(0, 0, size, size)
  ctx.drawImage(bitmap, (size - drawW) / 2, (size - drawH) / 2, drawW, drawH)
  return canvas.toDataURL('image/png')
}

async function prepareLogo(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Choose a PNG or JPEG logo')
  if (file.size > 4_000_000) throw new Error('Logo must be under 4MB')

  const bitmap = await createImageBitmap(file)
  const keepOriginal =
    file.type === 'image/png' &&
    file.size <= MAX_STORE_BYTES &&
    bitmap.width <= MAX_EDGE &&
    bitmap.height <= MAX_EDGE

  let logoPng = keepOriginal ? await fileToPngBase64(file) : null
  if (!logoPng) {
    let edge = MAX_EDGE
    let dataUrl = drawContain(bitmap, edge)
    while (estimatedBytes(dataUrl) > MAX_STORE_BYTES && edge > 400) {
      edge = Math.round(edge * 0.85)
      dataUrl = drawContain(bitmap, edge)
    }
    logoPng = stripDataUrl(dataUrl)
  }

  const iconPng = stripDataUrl(drawCover(bitmap, 180))
  bitmap.close()
  return { logoPng, iconPng }
}

export function VenueLogoUpload({ tenantId, logoUrl, onUpdated }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState(logoUrl || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setPreview(logoUrl || '')
  }, [logoUrl])

  const upload = async (file: File) => {
    setBusy(true)
    setError('')
    try {
      const body = await prepareLogo(file)
      const res = await fetch(`/api/tenants/${tenantId}/logo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save logo')
      const next = data.tenant?.logoUrl || ''
      setPreview(next)
      onUpdated?.(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save logo')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const remove = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/tenants/${tenantId}/logo`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to remove logo')
      setPreview('')
      onUpdated?.('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove logo')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div
          className="h-24 w-48 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden px-2"
          style={
            preview
              ? {
                  backgroundImage:
                    'repeating-conic-gradient(#e5e7eb 0% 25%, transparent 0% 50%)',
                  backgroundSize: '12px 12px',
                }
              : undefined
          }
        >
          {preview ? (
            <img src={preview} alt="Venue logo" className="max-h-20 max-w-full object-contain" />
          ) : (
            <span className="text-xs text-gray-400 px-2 text-center">No logo</span>
          )}
        </div>
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void upload(file)
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" loading={busy} onClick={() => inputRef.current?.click()}>
              {preview ? 'Replace logo' : 'Upload logo'}
            </Button>
            {preview && (
              <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void remove()}>
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Shown on signup, admin, and Apple/Google Wallet cards. PNG transparency is kept; the file is only scaled if it is larger than 2400px.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
