import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import {
  CITIZEN_KVKK_TEXT, CITIZEN_NOTIFICATION_TEXT,
  COMPANY_KVKK_TEXT, COMPANY_NOTIFICATION_TEXT,
  COMPANY_STAFF_KVKK_TEXT, COMPANY_STAFF_NOTIFICATION_TEXT,
} from './legalTexts'

export interface LegalDocuments {
  citizenKvkk: string
  citizenNotification: string
  companyKvkk: string
  companyNotification: string
  companyStaffKvkk: string
  companyStaffNotification: string
}

const fallback: LegalDocuments = {
  citizenKvkk: CITIZEN_KVKK_TEXT,
  citizenNotification: CITIZEN_NOTIFICATION_TEXT,
  companyKvkk: COMPANY_KVKK_TEXT,
  companyNotification: COMPANY_NOTIFICATION_TEXT,
  companyStaffKvkk: COMPANY_STAFF_KVKK_TEXT,
  companyStaffNotification: COMPANY_STAFF_NOTIFICATION_TEXT,
}

let cached: LegalDocuments | null = null

export const useLegalDocuments = () => {
  const [documents, setDocuments] = useState<LegalDocuments>(cached ?? fallback)

  useEffect(() => {
    let active = true
    api.get<{ data: { legalDocuments?: Partial<LegalDocuments> } }>('/mobile/app-config')
      .then(({ data }) => {
        const merged = { ...fallback }
        const remote = data?.data?.legalDocuments
        for (const key of Object.keys(fallback) as (keyof LegalDocuments)[]) {
          const value = remote?.[key]
          if (typeof value === 'string' && value.trim()) merged[key] = value
        }
        cached = merged
        if (active) setDocuments(merged)
      })
      .catch(() => { /* Ağ yoksa güvenli yerel metin gösterilir. */ })
    return () => { active = false }
  }, [])

  return documents
}
