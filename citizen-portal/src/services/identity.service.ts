import { api } from './api'
import type { CitizenIdentityQrDto, QrPassListDto } from '@/types/identity.types'

const identityService = {
  identityQr: (): Promise<CitizenIdentityQrDto> =>
    api.get('/me/identity-qr').then((r) => r.data.data),

  qrPasses: (): Promise<QrPassListDto> =>
    api.get('/me/qr-passes').then((r) => r.data.data),
}

export default identityService
