function clamp(n: number, min = 0, max = 255) {
  return Math.min(max, Math.max(min, n))
}

export function hexToRgb(hex: string) {
  const clean = hex.replace('#', '')
  const normalized = clean.length === 3 ? clean.split('').map(x => x + x).join('') : clean
  const num = parseInt(normalized, 16)
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  }
}

export function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map(v => clamp(Math.round(v)).toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

export function mixHex(a: string, b: string, t: number) {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  const p = Math.min(1, Math.max(0, t))
  return rgbToHex(
    ca.r + (cb.r - ca.r) * p,
    ca.g + (cb.g - ca.g) * p,
    ca.b + (cb.b - ca.b) * p,
  )
}

export function hexToRgba(hex: string, alpha = 1) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`
}
