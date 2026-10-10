export interface CitizenIdentityQrDto {
  token: string
  rotationSeconds: number
  expiresAt: string
  shortCode: string
}

export interface QrPassDto {
  kind: 'identity' | 'facility' | string
  title: string
  subtitle: string
  token: string
  rotationSeconds: number
  expiresAt: string | null
  shortCode: string | null
  module: string | null
  referenceId: string | null
}

export interface QrPassListDto {
  identity: QrPassDto
  passes: QrPassDto[]
}
