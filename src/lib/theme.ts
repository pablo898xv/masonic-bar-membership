export const THEME_KEY = 'mbm-theme'

export type Theme = 'light' | 'dark'

export function systemTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function storedTheme(): Theme | null {
  if (typeof window === 'undefined') return null
  const value = window.localStorage.getItem(THEME_KEY)
  return value === 'dark' || value === 'light' ? value : null
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
}

export function setTheme(theme: Theme) {
  window.localStorage.setItem(THEME_KEY, theme)
  applyTheme(theme)
}

export function initTheme(): Theme {
  const theme = storedTheme() || systemTheme()
  applyTheme(theme)
  return theme
}
