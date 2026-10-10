import { describe, expect, it } from 'vitest'
import { extractStaticQrCode, isLibraryStaticQr } from './staticQrCode'

const code = 'nxr-lib_9cf1e1f50aa145eeacd5fd328cff3a50'

describe('extractStaticQrCode', () => {
  it('handles bare code, url, query, hash, trailing slash and encoding', () => {
    expect(extractStaticQrCode(code)).toBe(code)
    expect(extractStaticQrCode(` http://192.168.1.8:3100/qr-giris/${code} `)).toBe(code)
    expect(extractStaticQrCode(`http://x/qr-giris/${code}?utm=1#a`)).toBe(code)
    expect(extractStaticQrCode(`http://x/qr-giris/${code}-giris/`)).toBe(`${code}-giris`)
    expect(extractStaticQrCode(`http://x/qr-giris/${code.replace('-', '%2D')}`)).toBe(code)
    expect(isLibraryStaticQr(code.toUpperCase())).toBe(true)
  })
})
