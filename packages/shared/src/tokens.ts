/** Design tokens as TS values (see DESIGN.md — the tables are law; tokens.css is the CSS implementation). */
export const colors = {
  ink: '#09090F',
  ink2: '#0F0F1A',
  paper: '#F4F2ED',
  muted: '#A8A5A0',
  muted2: '#6B6862',
  border: '#232330',
  primary: '#6366F1',
  primaryDim: '#6366F11A',
  cyan: '#22D3EE',
  green: '#34D399',
  amber: '#FBBF24',
  red: '#F87171',
} as const

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 40, xxl: 64 } as const
export const radius = { sm: 4, md: 8, lg: 16 } as const
