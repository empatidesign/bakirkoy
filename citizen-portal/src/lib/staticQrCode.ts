const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export const extractStaticQrCode = (raw: string): string => {
  const path = raw.trim().split(/[?#]/)[0].replace(/\/+$/, '')
  const last = path.slice(path.lastIndexOf('/') + 1)
  return safeDecode(last).trim()
}

export const isLibraryStaticQr = (code: string) => code.toLowerCase().startsWith('nxr-lib_')

// Kullanıcı isteği (2026-10-06): "QR okutma her yerde aynı mantıkta çalışsın" — Facility/
// Library'deki prefix ayırt etme deseniyle aynı, Event için.
export const isEventStaticQr = (code: string) => code.toLowerCase().startsWith('nxr-evt_')
