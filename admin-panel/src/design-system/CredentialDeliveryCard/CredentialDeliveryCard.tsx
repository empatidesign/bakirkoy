import type React from 'react'
import { useState } from 'react'
import { KeyRoundIcon, MailIcon, SmartphoneIcon } from 'lucide-react'
import { Button } from '../Button'
import { Label } from '../Label'

export type DeliveryChannel = 'Email' | 'Sms'

interface CredentialDeliveryCardProps {
  title: string
  description: string
  onSend: (channel: DeliveryChannel) => void | Promise<void>
  disabled?: boolean
  disabledHint?: string
  emailDisabled?: boolean
  emailDisabledHint?: string
  icon?: React.ComponentType<{ className?: string }>
  emailLabel?: string
  smsLabel?: string
}

export const CredentialDeliveryCard = ({
  title,
  description,
  onSend,
  disabled = false,
  disabledHint,
  emailDisabled = false,
  emailDisabledHint,
  icon: Icon = KeyRoundIcon,
  emailLabel = 'E-posta ile Gönder',
  smsLabel = 'SMS ile Gönder',
}: CredentialDeliveryCardProps) => {
  const [sending, setSending] = useState<DeliveryChannel | null>(null)

  const handleSend = async (channel: DeliveryChannel) => {
    setSending(channel)
    try {
      await onSend(channel)
    } finally {
      setSending(null)
    }
  }

  return (
    <div className="space-y-2 rounded-card border border-border bg-surface-1/60 p-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <Label>{title}</Label>
      </div>
      <p className="type-caption">{description}</p>
      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button
          variant="primary"
          isLoading={sending === 'Email'}
          disabled={disabled || emailDisabled || sending !== null}
          onClick={() => handleSend('Email')}
        >
          <MailIcon className="h-3.5 w-3.5" /> {emailLabel}
        </Button>
        <Button
          variant="outline"
          isLoading={sending === 'Sms'}
          disabled={disabled || sending !== null}
          onClick={() => handleSend('Sms')}
        >
          <SmartphoneIcon className="h-3.5 w-3.5" /> {smsLabel}
        </Button>
      </div>
      {disabled && disabledHint && <p className="type-caption text-danger">{disabledHint}</p>}
      {!disabled && emailDisabled && emailDisabledHint && <p className="type-caption text-warning">{emailDisabledHint}</p>}
    </div>
  )
}
