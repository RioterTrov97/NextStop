// Single source of truth for the brand colour. Theme, manifest, <meta theme-color>, icon backgrounds and logo.svg all derive from this.
export const brand = {
  50: '#FFF7ED',
  100: '#FFEDD5',
  200: '#FED7AA',
  300: '#FDBA74',
  400: '#FB923C',
  500: '#F97316',
  600: '#EA6A12',
  700: '#C2570C',
  800: '#9A3F0C',
  900: '#431407',
  950: '#2A0C04',
} as const

export const themeColor = brand[600]
export const logoGradient = [brand[600], brand[700]] as const
