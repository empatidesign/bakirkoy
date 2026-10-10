import { useCallback, useRef, useState } from 'react'
import { UserIcon, UserPlusIcon, ShieldCheckIcon } from 'lucide-react'
import {
  Combobox, Input, PhoneInput, EmailInput, TcknInput, isValidTckn, Label, RoleBadge, Badge,
  SegmentedControl, Switch,
  type ComboOption,
} from '@/design-system'
import adminService from '@/services/admin.service'
import { useRoleColor } from '@/lib/roleColors'
import type { AdminUser } from '@/types/admin.types'

export interface ResponsiblePersonValue {
  managerId?: string
  manager?: string
  managerRoleKey?: string
  managerRoleName?: string
  managerRoleColor?: string
  managerPhone?: string
  managerEmail?: string
  emergencyPhone?: string
  tckn?: string
  grantAccess?: boolean
}

export interface ResponsiblePersonRoleTemplate {
  name: string
  color?: string
  scopeHint?: string
}

interface ResponsiblePersonFieldProps {
  value: ResponsiblePersonValue
  onChange: (patch: Partial<ResponsiblePersonValue>) => void
  label?: string
  required?: boolean
  disabled?: boolean
  showEmergency?: boolean
  showEmail?: boolean
  allowManual?: boolean
  showTckn?: boolean
  hint?: string
  allowCreate?: boolean
  allowAccessGrant?: boolean
  roleTemplate?: ResponsiblePersonRoleTemplate
  // Kullanıcı isteği (2026-08-02): Hizmet Tesisleri'nde "Yeni Yetkili Ekle" akışında
  // T.C. Kimlik No zorunlu olmamalı. Varsayılan true (mevcut davranış korunur —
  // Etkinlik Seansları, Kütüphane, Geziler vb. diğer kullanım yerlerini etkilemez).
  requireTckn?: boolean
}

const FieldWrap = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label required={required}>{label}</Label>
    {children}
  </div>
)

export const ResponsiblePersonField = ({
  value, onChange, label = 'Sorumlu / Müdür', required, disabled,
  showEmergency = true, showEmail = true, allowManual, showTckn, hint,
  allowCreate, allowAccessGrant, roleTemplate, requireTckn = true,
}: ResponsiblePersonFieldProps) => {
  const cacheRef = useRef<Map<string, AdminUser>>(new Map())
  const locked = !!value.managerId
  const roleColor = useRoleColor(value.managerRoleKey)
  const [mode, setMode] = useState<'existing' | 'new'>(
    !value.managerId && (value.manager || value.grantAccess) ? 'new' : 'existing',
  )

  const search = useCallback(async (q: string): Promise<ComboOption[]> => {
    const res = await adminService.getList({ page: 1, limit: 10, search: q })
    res.items.forEach((a) => cacheRef.current.set(a.id, a))
    return res.items.map((a) => ({
      value: a.id,
      label: a.fullName,
      description: a.email,
      badge: a.roleName ? { label: a.roleName, color: a.roleColor } : undefined,
    }))
  }, [])

  const clearedManager: Partial<ResponsiblePersonValue> = {
    managerId: '', managerRoleKey: '', managerRoleName: '', managerRoleColor: '',
  }

  const onPick = (val: string, option?: ComboOption) => {
    if (!val) {
      onChange({ ...clearedManager, manager: '', managerPhone: '', managerEmail: '' })
      return
    }
    const a = cacheRef.current.get(val)
    if (a) {
      onChange({ managerId: a.id, managerRoleKey: a.roleKey ?? '', managerRoleName: a.roleName ?? '', managerRoleColor: a.roleColor ?? '', manager: a.fullName, managerPhone: a.phone ?? '', managerEmail: a.email })
    } else if (allowManual && !option) {
      onChange({ ...clearedManager, manager: val })
    } else {
      onChange({ managerId: val })
    }
  }

  const switchMode = (next: 'existing' | 'new') => {
    setMode(next)
    if (next === 'new') {
      onChange({ ...clearedManager, manager: '', managerPhone: '', managerEmail: '' })
    } else {
      onChange({ ...clearedManager, manager: '', managerPhone: '', managerEmail: '', grantAccess: false })
    }
  }

  const showNew = allowCreate && mode === 'new'
  const showTcknField = showTckn || (showNew && allowAccessGrant)

  return (
    <div className="space-y-3">
      {allowCreate && (
        <SegmentedControl
          value={mode}
          onChange={(v) => switchMode(v as 'existing' | 'new')}
          columns={2}
          options={[
            { value: 'existing', label: 'Mevcut yöneticiden seç', icon: UserIcon },
            { value: 'new', label: 'Yeni kişi ekle', icon: UserPlusIcon },
          ]}
          disabled={disabled}
        />
      )}

      {showNew ? (
        <FieldWrap label="Ad Soyad" required>
          <Input sanitize="letters" value={value.manager ?? ''} onChange={(e) => onChange({ manager: e.target.value })} placeholder="Kişinin adı ve soyadı" disabled={disabled} />
        </FieldWrap>
      ) : (
        <FieldWrap label={label} required={required}>
          <Combobox
            value={value.managerId ?? ''}
            displayValue={value.manager}
            onSearch={search}
            onChange={onPick}
            allowCustom={allowManual}
            placeholder={allowManual ? 'Yöneticiden seç ya da ad soyad yazın...' : 'Yöneticilerden ara ve seç...'}
            emptyText="Yönetici bulunamadı"
            iconLeft={<UserIcon className="h-4 w-4" />}
            disabled={disabled}
            clearable
          />
          {value.managerRoleName && (
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <RoleBadge name={value.managerRoleName} color={value.managerRoleColor || roleColor} />
              <span className="type-caption">Telefon ve e-posta bu yöneticiden alınır (kilitli).</span>
            </div>
          )}
          {hint && <p className="type-caption text-foreground-muted">{hint}</p>}
        </FieldWrap>
      )}

      {showTcknField ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldWrap label="T.C. Kimlik No" required={showNew && requireTckn}>
            <TcknInput value={value.tckn ?? ''} onChange={(d) => onChange({ tckn: d })} disabled={disabled} />
          </FieldWrap>
          <FieldWrap label="Telefon" required={showNew}>
            <PhoneInput value={value.managerPhone ?? ''} onChange={(v) => onChange({ managerPhone: v })} disabled={disabled || locked} />
          </FieldWrap>
        </div>
      ) : (
        <FieldWrap label="Telefon" required={showNew}>
          <PhoneInput value={value.managerPhone ?? ''} onChange={(v) => onChange({ managerPhone: v })} disabled={disabled || locked} />
        </FieldWrap>
      )}

      {(showEmail || showEmergency) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {showEmail && (
            <FieldWrap label="E-posta">
              <EmailInput value={value.managerEmail ?? ''} onChange={(e) => onChange({ managerEmail: e.target.value })} disabled={disabled || locked} />
            </FieldWrap>
          )}
          {showEmergency && (
            <FieldWrap label="Acil Telefon">
              <PhoneInput value={value.emergencyPhone ?? ''} onChange={(v) => onChange({ emergencyPhone: v })} disabled={disabled} />
            </FieldWrap>
          )}
        </div>
      )}

      {showNew && allowAccessGrant && (
        <div className="space-y-2 rounded-card border border-border bg-surface-1 p-3">
          <div className="flex items-start gap-3">
            <ShieldCheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="flex-1 space-y-1">
              <p className="type-body-strong">Sisteme erişim ver</p>
              <p className="type-caption text-foreground-muted">
                Açıksa bu kişiye bir hesap oluşturulur; geçici şifresi SMS/e-posta ile gönderilir ve ilk girişte değiştirmesi istenir. Kapalıysa yalnız iletişim kişisi olarak kaydedilir (giriş yapamaz).
              </p>
            </div>
            <Switch checked={!!value.grantAccess} onCheckedChange={(v) => onChange({ grantAccess: v })} disabled={disabled} />
          </div>
          {value.grantAccess && roleTemplate && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
              <span className="type-caption text-foreground-muted">Verilecek yetki:</span>
              <Badge tone="primary" color={roleTemplate.color}>{roleTemplate.name}</Badge>
              {roleTemplate.scopeHint && <span className="type-caption text-foreground-muted">· {roleTemplate.scopeHint}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export const isResponsiblePersonValid = (v: ResponsiblePersonValue, requireTckn = true): boolean => {
  if (v.managerId) return true
  if (!v.grantAccess) return true
  const tcknOk = !requireTckn || (!!v.tckn && isValidTckn(v.tckn))
  return !!v.manager?.trim() && tcknOk && (v.managerPhone ?? '').length === 11
}
