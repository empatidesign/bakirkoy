import { QRCodeSVG } from 'qrcode.react'
import { cn } from '@/lib/utils'

interface QrCodeProps {
  value: string
  size?: number
  className?: string
}

export const QrCode = ({ value, size = 200, className }: QrCodeProps) => (
  <div className={cn('inline-flex items-center justify-center rounded-card bg-white p-4 ring-1 ring-black/5', className)}>
    <QRCodeSVG value={value} size={size} level="H" marginSize={4} bgColor="#ffffff" fgColor="#000000" />
  </div>
)
