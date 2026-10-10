import { api } from './api'
import type {
  FieldTask, FieldTaskDetail, FieldRespondentLookup, FieldSubmitResult,
  FieldResponseSummary, FieldSubmitPayload, FieldNviLookupResult,
  FieldCitizenSubmissionPayload, FieldCitizenSubmissionResult,
  FieldSurveySmsLinkPayload, FieldSurveySmsLinkResult,
  FieldLocationPingPayload, FieldLocationPingResult,
} from '@/types/fieldSurvey.types'
import { enqueueSurveySubmit, enqueueCitizenSubmission, registerFieldOfflineSender } from '@/lib/fieldOfflineQueue'

// Kullanıcı isteği (2026-09-02): "internet yoksa verileri cache'e yazsın, internet geldiğinde
// otomatik senkronize etsin." `error.response` YOKSA (sunucudan hiç yanıt gelmedi — DNS/ağ
// koptu, timeout, vs.) bu bir AĞ hatasıdır; 4xx/5xx gibi sunucunun bilerek reddettiği bir
// durum DEĞİLDİR, dolayısıyla yalnızca bu durumda offline kuyruğa alınır. Sunucu "zorunlu
// alan eksik" gibi bir hata döndürdüyse kuyruğa almak yanlış olur (aynı hatalı istek sonsuza
// kadar tekrar başarısız olur) — o durumda normal hata olarak fırlatılmaya devam eder.
const isNetworkError = (e: unknown): boolean => {
  const err = e as { response?: unknown; request?: unknown; code?: string } | undefined
  return !!err && err.response === undefined && (err.request !== undefined || err.code === 'ERR_NETWORK')
}

// Kuyruğa alınan bir kayıt için özel hata: FieldSurveyRunner buna göre "cihazınıza
// kaydedildi, bağlantı gelince otomatik gönderilecek" mesajı gösterir (sert hata değil).
export class FieldOfflineQueuedError extends Error {
  constructor() { super('Kayıt cihazda bekletiliyor; internet bağlantısı gelince otomatik gönderilecek.') }
}

// Düzeltme (2026-09-05, denetim bulgusu): kuyruğa yazma (localStorage/native köprü)
// KOTA DOLU, private-mode veya köprü hatası yüzünden gerçekte TUTMAMış olabilir.
// Bu durumda çağrı tarafi (FieldSurveyRunner / FieldQuickActionsModal) "cihazınıza
// kaydedildi" diyip formu TEMEZLEMEMELİ — kullanıcı verisi hiçbir yerde kalmadan
// kaybolur. Bu hata ile ayırt edilir: form/taslağı KORUNMALI, kullanıcıya açıkça
// "cihaza kaydedilemedi, tekrar deneyin" gösterilmeli.
export class FieldOfflinePersistFailedError extends Error {
  constructor() { super('Kayıt cihaza kaydedilemedi (depolama alanı dolu olabilir). Lütfen tekrar deneyin veya cihaz depolama alanını boşaltın.') }
}

// Kullanıcı isteği (2026-09-01): saha görevlisi vatandaşın anket toplama ekranı servisleri.
const fieldSurveyService = {
  async tasks(): Promise<FieldTask[]> {
    const res = await api.get<{ data: FieldTask[] }>('/me/surveys/field/tasks')
    return res.data.data
  },

  async taskDetail(taskId: string): Promise<FieldTaskDetail> {
    const res = await api.get<{ data: FieldTaskDetail }>(`/me/surveys/field/tasks/${taskId}`)
    return res.data.data
  },

  async lookup(taskId: string, tckn: string): Promise<FieldRespondentLookup> {
    const res = await api.get<{ data: FieldRespondentLookup }>(
      `/me/surveys/field/tasks/${taskId}/respondent`, { params: { tckn } })
    return res.data.data
  },

  async submit(taskId: string, payload: FieldSubmitPayload): Promise<FieldSubmitResult> {
    try {
      return await rawSubmit(taskId, payload)
    } catch (e) {
      if (isNetworkError(e)) {
        const persisted = enqueueSurveySubmit(taskId, payload)
        throw persisted ? new FieldOfflineQueuedError() : new FieldOfflinePersistFailedError()
      }
      throw e
    }
  },

  async responses(taskId: string, take = 20): Promise<FieldResponseSummary[]> {
    const res = await api.get<{ data: FieldResponseSummary[] }>(
      `/me/surveys/field/tasks/${taskId}/responses`, { params: { take } })
    return res.data.data
  },

  // Kullanıcı isteği (2026-09-01): "nvi entegrasyonu da yap" — TC yerel kayıtta yoksa
  // gerçek NVI sorgusuyla doğrulama.
  async nviLookup(taskId: string, tckn: string, birthDate: string): Promise<FieldNviLookupResult> {
    const res = await api.post<{ data: FieldNviLookupResult }>(
      `/me/surveys/field/tasks/${taskId}/nvi-lookup`, { tckn, birthDate })
    return res.data.data
  },

  // Kullanıcı isteği (2026-09-01): görüşülen kişi adına doğrudan talep/öneri/şikayet.
  async createSubmission(payload: FieldCitizenSubmissionPayload): Promise<FieldCitizenSubmissionResult> {
    try {
      return await rawCreateSubmission(payload)
    } catch (e) {
      if (isNetworkError(e)) {
        const persisted = enqueueCitizenSubmission(payload)
        throw persisted ? new FieldOfflineQueuedError() : new FieldOfflinePersistFailedError()
      }
      throw e
    }
  },

  // Kullanıcı isteği (2026-09-01): saha görevlisinin canlı GPS konumu.
  async sendLocation(payload: FieldLocationPingPayload): Promise<FieldLocationPingResult> {
    const res = await api.post<{ data: FieldLocationPingResult }>('/me/surveys/field/location', payload)
    return res.data.data
  },

  // Kullanıcı isteği (2026-09-01): telefona SMS ile anket linki gönderme.
  async sendSmsLink(taskId: string, payload: FieldSurveySmsLinkPayload): Promise<FieldSurveySmsLinkResult> {
    const res = await api.post<{ data: FieldSurveySmsLinkResult }>(
      `/me/surveys/field/tasks/${taskId}/sms-link`, payload)
    return res.data.data
  },
}

// Ham (kuyruğa almadan doğrudan deneyen) gönderim fonksiyonları — hem yukarıdaki submit/
// createSubmission tarafından hem de offline kuyruğun kendisi tarafından (bağlantı geri
// gelince tekrar denerken) kullanılır; `_silent: true` ile ağ hatası toast'ı bastırılır
// (kuyruk zaten kendi "cihazda bekliyor" bildirimini gösterir).
async function rawSubmit(taskId: string, payload: FieldSubmitPayload): Promise<FieldSubmitResult> {
  const res = await api.post<{ data: FieldSubmitResult }>(
    `/me/surveys/field/tasks/${taskId}/responses`, payload, { _silent: true } as never)
  return res.data.data
}
async function rawCreateSubmission(payload: FieldCitizenSubmissionPayload): Promise<FieldCitizenSubmissionResult> {
  const res = await api.post<{ data: FieldCitizenSubmissionResult }>(
    '/me/surveys/field/submissions', payload, { _silent: true } as never)
  return res.data.data
}

registerFieldOfflineSender({
  sendSurveySubmit: rawSubmit,
  sendCitizenSubmission: rawCreateSubmission,
})

export default fieldSurveyService

