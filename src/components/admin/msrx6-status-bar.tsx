'use client'

import { Button } from '@/components/ui/button'
import { useMsrx6 } from '@/lib/msrx6/use-msrx6'

function phaseLabel(phase: ReturnType<typeof useMsrx6>['phase']) {
  if (phase === 'connecting') return 'Connecting…'
  if (phase === 'writing') return 'Write mode — swipe now'
  if (phase === 'verifying') return 'Verify — swipe again'
  if (phase === 'reading') return 'Read mode — swipe now'
  if (phase === 'ready') return 'Ready for read or write'
  return 'Not connected'
}

export function Msrx6StatusBar() {
  const writer = useMsrx6()
  const chromeHint = !writer.support.bluetooth && !writer.support.serial

  return (
    <div className="sticky top-0 z-20 border-b border-gray-200 bg-white">
      <div className="px-8 py-3 flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`h-2.5 w-2.5 rounded-full shrink-0 ${
              writer.connected ? 'bg-green-500' : writer.phase === 'connecting' ? 'bg-amber-400' : 'bg-gray-300'
            }`}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              MSRx6 {writer.connected ? `· ${writer.deviceName}` : ''}
            </p>
            <p className="text-xs text-gray-500">{phaseLabel(writer.phase)}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-gray-600 mr-2">
            <input
              type="radio"
              name="msrx6-coercivity"
              checked={writer.coercivity === 'hico'}
              onChange={() => writer.applyCoercivity('hico')}
            />
            HiCo
          </label>
          <label className="flex items-center gap-1 text-xs text-gray-600 mr-2">
            <input
              type="radio"
              name="msrx6-coercivity"
              checked={writer.coercivity === 'loco'}
              onChange={() => writer.applyCoercivity('loco')}
            />
            LoCo
          </label>
          <Button
            size="sm"
            onClick={() => writer.connect('bluetooth')}
            loading={writer.phase === 'connecting'}
            disabled={!writer.support.bluetooth}
          >
            {writer.connected && writer.transport === 'bluetooth' ? 'Reconnect' : 'Connect Bluetooth'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => writer.connect('serial')}
            disabled={!writer.support.serial || writer.phase === 'connecting'}
          >
            USB
          </Button>
          {writer.support.hid && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => writer.connect('hid')}
              disabled={writer.phase === 'connecting'}
            >
              USB HID
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => writer.connect('bluetooth-all')}
            disabled={!writer.support.bluetooth || writer.phase === 'connecting'}
          >
            Show all
          </Button>
          {writer.connected && (
            <Button size="sm" variant="ghost" onClick={writer.disconnect}>
              Disconnect
            </Button>
          )}
        </div>
      </div>
      {chromeHint && (
        <p className="px-8 pb-3 text-xs text-amber-800">
          Use Chrome or Edge on this Mac. Safari cannot talk to the writer.
        </p>
      )}
      {writer.error && (
        <p className="px-8 pb-3 text-xs text-red-700">{writer.error}</p>
      )}
    </div>
  )
}
