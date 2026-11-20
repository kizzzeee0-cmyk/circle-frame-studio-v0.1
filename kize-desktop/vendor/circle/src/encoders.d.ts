declare module 'gifenc' {
  export type Palette = number[][]
  export function quantize(data: Uint8Array | Uint8ClampedArray, maxColors: number, options?: { format?: 'rgb565'|'rgb444'|'rgba4444'; oneBitAlpha?: boolean | number }): Palette
  export function applyPalette(data: Uint8Array | Uint8ClampedArray, palette: Palette, format?: 'rgb565'|'rgb444'|'rgba4444'): Uint8Array
  export function GIFEncoder(options?: { auto?: boolean }): {
    writeFrame(index: Uint8Array, width: number, height: number, options?: {
      palette?: Palette
      delay?: number
      repeat?: number
      transparent?: boolean
      transparentIndex?: number
      dispose?: number
    }): void
    finish(): void
    bytes(): Uint8Array
  }
}

declare module '@upng/upng-js' {
  const UPNG: {
    encode(imgs: ArrayBuffer[], width: number, height: number, colorCount: number, delays?: number[]): ArrayBuffer
  }
  export default UPNG
}

declare module 'wasm-webp' {
  export interface WebPAnimationFrame {
    data: Uint8Array
    duration: number
    config?: { lossless?: number; quality?: number }
  }
  export function encodeAnimation(width: number, height: number, hasAlpha: boolean, frames: WebPAnimationFrame[]): Promise<Uint8Array | null>
}
