function concatBytes(parts: Uint8Array[]) {
  const size = parts.reduce((sum, part) => sum + part.byteLength, 0)
  const out = new Uint8Array(size)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.byteLength
  }
  return out
}

function u16(value: number) {
  const out = new Uint8Array(2)
  new DataView(out.buffer).setUint16(0, value >>> 0)
  return out
}

function i16(value: number) {
  const out = new Uint8Array(2)
  new DataView(out.buffer).setInt16(0, value)
  return out
}

function u32(value: number) {
  const out = new Uint8Array(4)
  new DataView(out.buffer).setUint32(0, value >>> 0)
  return out
}

function i32(value: number) {
  const out = new Uint8Array(4)
  new DataView(out.buffer).setInt32(0, value | 0)
  return out
}

function text4(value: string) {
  return new Uint8Array([...value.slice(0, 4).padEnd(4, ' ')].map(char => char.charCodeAt(0) & 255))
}

function ascii(value: string) {
  return new Uint8Array([...value].map(char => char.charCodeAt(0) & 255))
}

function atom(type: string, ...payload: Uint8Array[]) {
  const body = concatBytes(payload)
  return concatBytes([u32(body.byteLength + 8), text4(type), body])
}

function fullAtom(type: string, flags: number, ...payload: Uint8Array[]) {
  return atom(type, u32(flags), ...payload)
}

function matrixIdentity() {
  return concatBytes([
    i32(0x00010000), i32(0), i32(0),
    i32(0), i32(0x00010000), i32(0),
    i32(0), i32(0), i32(0x40000000),
  ])
}

function zeros(length: number) {
  return new Uint8Array(length)
}

function compressorName(name: string) {
  const out = new Uint8Array(32)
  const bytes = ascii(name.slice(0, 31))
  out[0] = bytes.length
  out.set(bytes, 1)
  return out
}

function pngSampleEntry(width: number, height: number) {
  const payload = concatBytes([
    zeros(6),
    u16(1),
    u16(0),
    u16(0),
    zeros(12),
    u16(width),
    u16(height),
    u32(0x00480000),
    u32(0x00480000),
    u32(0),
    u16(1),
    compressorName('PNG'),
    u16(0x0020),
    i16(-1),
  ])
  return concatBytes([u32(payload.byteLength + 8), text4('png '), payload])
}

function makeFtyp() {
  return atom('ftyp', text4('qt  '), u32(0x00000200), text4('qt  '))
}

function makeMvhd(timescale: number, duration: number) {
  return fullAtom('mvhd', 0,
    u32(0), u32(0),
    u32(timescale), u32(duration),
    u32(0x00010000),
    u16(0x0100), u16(0),
    zeros(8),
    matrixIdentity(),
    zeros(24),
    u32(2),
  )
}

function makeTkhd(width: number, height: number, duration: number) {
  return fullAtom('tkhd', 0x00000007,
    u32(0), u32(0),
    u32(1), u32(0),
    u32(duration),
    zeros(8),
    i16(0), i16(0),
    i16(0), u16(0),
    matrixIdentity(),
    u32(width << 16),
    u32(height << 16),
  )
}

function makeMdhd(timescale: number, duration: number) {
  return fullAtom('mdhd', 0,
    u32(0), u32(0),
    u32(timescale), u32(duration),
    u16(0), u16(0),
  )
}

function makeHdlr() {
  return fullAtom('hdlr', 0,
    u32(0),
    text4('vide'),
    zeros(12),
    ascii('VideoHandler\0'),
  )
}

function makeDinf() {
  const url = fullAtom('url ', 1)
  const dref = fullAtom('dref', 0, u32(1), url)
  return atom('dinf', dref)
}

function makeStbl(width: number, height: number, sampleSizes: number[], offsets: number[]) {
  const stsd = fullAtom('stsd', 0, u32(1), pngSampleEntry(width, height))
  const stts = fullAtom('stts', 0, u32(1), u32(sampleSizes.length), u32(1))
  const stsc = fullAtom('stsc', 0, u32(1), u32(1), u32(1), u32(1))
  const stsz = fullAtom('stsz', 0, u32(0), u32(sampleSizes.length), ...sampleSizes.map(u32))
  const stco = fullAtom('stco', 0, u32(offsets.length), ...offsets.map(u32))
  return atom('stbl', stsd, stts, stsc, stsz, stco)
}

function makeMinf(width: number, height: number, sampleSizes: number[], offsets: number[]) {
  const vmhd = fullAtom('vmhd', 1, u16(0), u16(0), u16(0), u16(0))
  return atom('minf', vmhd, makeDinf(), makeStbl(width, height, sampleSizes, offsets))
}

function makeMoov(width: number, height: number, fps: number, frameCount: number, sampleSizes: number[], offsets: number[]) {
  const timescale = Math.max(1, Math.round(fps))
  const duration = frameCount
  const mdia = atom('mdia',
    makeMdhd(timescale, duration),
    makeHdlr(),
    makeMinf(width, height, sampleSizes, offsets),
  )
  const trak = atom('trak', makeTkhd(width, height, duration), mdia)
  return atom('moov', makeMvhd(timescale, duration), trak)
}

export function encodePngMov(frames: Blob[], width: number, height: number, fps: number) {
  if (!frames.length) throw new Error('MOV 프레임이 없습니다.')
  if (width > 32767 || height > 32767) throw new Error('MOV 해상도가 너무 큽니다.')

  const ftyp = makeFtyp()
  const sampleSizes = frames.map(frame => frame.size)
  const mdatPayloadSize = sampleSizes.reduce((sum, size) => sum + size, 0)
  const mdatSize = mdatPayloadSize + 8
  if (mdatSize >= 0xFFFFFFFF) throw new Error('알파 MOV가 4GB를 초과합니다. 해상도·FPS·길이를 낮춰 주세요.')

  let offset = ftyp.byteLength + 8
  const offsets = sampleSizes.map(size => {
    const current = offset
    offset += size
    return current
  })
  const moov = makeMoov(width, height, fps, frames.length, sampleSizes, offsets)
  const mdatHeader = concatBytes([u32(mdatSize), text4('mdat')])
  return new Blob([ftyp, mdatHeader, ...frames, moov], { type: 'video/quicktime' })
}
