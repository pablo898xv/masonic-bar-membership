'use client'

import { ReactNode } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  size?: 'md' | 'lg'
  children: ReactNode
}

export function Modal({ isOpen, onClose, title, size = 'md', children }: ModalProps) {
  if (!isOpen) return null
  const width = size === 'lg' ? 'max-w-xl' : 'max-w-lg'
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-[100dvh] items-end justify-center p-0 sm:items-center sm:p-4">
        <div 
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
        />
        
        <div className={`relative bg-white dark:bg-slate-900 rounded-t-xl sm:rounded-xl shadow-xl ${width} w-full max-h-[min(92dvh,100%)] overflow-hidden`}>
          {title && (
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 pr-4">{title}</h3>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          
          <div className="px-4 sm:px-6 py-4 overflow-y-auto max-h-[calc(min(92dvh,100%)-8rem)] pb-[max(1rem,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
