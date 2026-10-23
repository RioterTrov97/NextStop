// Minimal protobuf wire-format reader; protobufjs codegen needs eval, which Workers block.

export type WireValue = number | Uint8Array

export interface Field {
  field: number
  wire: number
  value: WireValue
}

export function* readFields(buf: Uint8Array): Generator<Field> {
  let pos = 0
  const varint = (): number => {
    let result = 0
    let mul = 1
    for (;;) {
      const b = buf[pos++]
      if (b === undefined) throw new Error('Truncated varint')
      result += (b & 0x7f) * mul
      if (b < 0x80) return result
      mul *= 128
    }
  }

  while (pos < buf.length) {
    const key = varint()
    const field = Math.floor(key / 8)
    const wire = key % 8
    switch (wire) {
      case 0:
        yield { field, wire, value: varint() }
        break
      case 1:
        yield { field, wire, value: buf.subarray(pos, (pos += 8)) }
        break
      case 2: {
        const len = varint()
        yield { field, wire, value: buf.subarray(pos, (pos += len)) }
        break
      }
      case 5:
        yield { field, wire, value: buf.subarray(pos, (pos += 4)) }
        break
      default:
        throw new Error(`Unsupported wire type ${wire}`)
    }
  }
}

export function toFloat(v: WireValue): number {
  const b = v as Uint8Array
  return new DataView(b.buffer, b.byteOffset, b.byteLength).getFloat32(0, true)
}

const decoder = new TextDecoder()
export const toStr = (v: WireValue): string => decoder.decode(v as Uint8Array)
