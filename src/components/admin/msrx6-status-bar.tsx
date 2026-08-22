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
  const chromeHint = !writer.support.secureContext || (!writer.support.bluetooth && !writer.support.serial && !writer.support.hid)
  const usbAvailable = writer.support.hid || writer.support.serial
  const status = writer.connected
    ? [writer.deviceName, phaseLabel(writer.phase)].filter(Boolean).join(' · ')
    : phaseLabel(writer.phase)

  return (
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex min-w-0 shrink items-center gap-2">
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${
              writer.connected ? 'bg-green-500' : writer.phase === 'connecting' ? 'bg-amber-400' : 'bg-gray-300'
            }`}
          />
          <p className="truncate text-sm text-gray-900 dark:text-white">
            <span className="font-medium">MSRx6</span>
            <span className="text-gray-500 dark:text-slate-400"> · {status}</span>
          </p>
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-2 overflow-x-auto">
          <label className="flex shrink-0 items-center gap-1 text-xs text-gray-600 dark:text-slate-300">
            <input
              type="radio"
              name="msrx6-coercivity"
              checked={writer.coercivity === 'hico'}
              onChange={() => writer.applyCoercivity('hico')}
            />
            HiCo
          </label>
          <label className="flex shrink-0 items-center gap-1 text-xs text-gray-600 dark:text-slate-300">
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
            onClick={() => writer.connect('usb')}
            disabled={!usbAvailable || writer.phase === 'connecting'}
          >
            {writer.connected && (writer.transport === 'hid' || writer.transport === 'serial') ? 'Reconnect USB' : 'Connect USB'}
          </Button>
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
        <p className="pt-1 text-xs text-amber-800 dark:text-amber-200">
          {!writer.support.secureContext
            ? 'USB and Bluetooth writers need https (or localhost) in Chrome or Edge. Safari cannot talk to the writer.'
            : 'Use Chrome or Edge on this Mac. Safari cannot talk to the writer.'}
        </p>
      )}
      {!writer.connected && writer.support.hid && (
        <p className="pt-1 text-xs text-gray-500 dark:text-slate-400">
          Chrome lists the USB writer as Unknown device (0801:0003) — that is the MSRx6. Close EasyMSR, then Connect USB and pick it.
        </p>
      )}
      {writer.error && <p className="pt-1 text-xs text-red-700">{writer.error}</p>}
    </div>
  )
}
