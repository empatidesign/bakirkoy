const PENDING_QR_KEY = 'pending_qr_code'

export const pendingQr = {
  set(code: string): void {
    sessionStorage.setItem(PENDING_QR_KEY, code)
  },
  take(): string | null {
    const v = sessionStorage.getItem(PENDING_QR_KEY)
    if (v) sessionStorage.removeItem(PENDING_QR_KEY)
    return v
  },
  peek(): string | null {
    return sessionStorage.getItem(PENDING_QR_KEY)
  },
}
