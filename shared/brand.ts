// Single source of truth for the brand colours. Theme, manifest, <meta theme-color>, the status bar strip, icon
// backgrounds and the logo all derive from this.

/** Eucalyptus: the app's one accent colour. 600 is the light-mode accent (white text about 6:1), 300 the dark-mode one. */
export const brand = {
  50: '#F2F7F4',
  100: '#E3EEE8',
  200: '#C9DDD2',
  300: '#A8C5B5',
  400: '#7FA593',
  500: '#5A8573',
  600: '#3E6B5A',
  700: '#2F5446',
  800: '#253F35',
  900: '#1A2C25',
  950: '#0F1A16',
} as const

/** Neutrals leaning slightly sage, replacing Chakra's grey scale so every grey in the app matches the brand. */
export const sageGray = {
  50: '#F5F7F6',
  100: '#ECF0EE',
  200: '#DDE3E0',
  300: '#C3CCC7',
  400: '#9AA5A0',
  500: '#75817B',
  600: '#58635E',
  700: '#434C48',
  800: '#2C3430',
  900: '#1C2320',
  950: '#121815',
} as const

/** The page background, which the solid header and the iPhone status bar share. */
export const page = { light: '#F3F6F4', dark: '#0D1210' } as const

/** Cards and panels on the page. */
export const panel = { light: '#FFFFFF', dark: '#161D1A' } as const

/** Default text on the page. */
export const ink = { light: '#121815', dark: '#EDF1EF' } as const

// The manifest takes one colour; the app replaces it at runtime with the page colour of the current theme.
export const themeColor = page.light

/** The app icon's background. */
export const logoGradient = [brand[500], brand[700]] as const
