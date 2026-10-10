import { useCallback, useEffect, useRef, useState } from 'react'

// Kullanıcı isteği (2026-10-05): "tesislerde birşey eklediğimde eklediğim şeyler kayıt
// olmasa da taslak olarak kalsın, bu genel olarak bütün programlarda olsun, yapılan
// ekleme emeği boşa gitmesin" — kullanıcı bir form doldururken (örn. yeni spor salonu,
// yeni grup, yeni kullanıcı) kaydetmeden kapatırsa (yanlışlıkla X'e basma, sekme
// kapanması, tarayıcı çökmesi) girdiği veriler localStorage'a debounce'lu şekilde
// otomatik yazılır. Form tekrar açıldığında aynı taslak varsa "Devam Et / Sil" seçeneği
// sunulur. CrudListTemplate bunu TÜM modüllerde otomatik kullanır (her caller'ın ayrı
// ayrı entegre etmesine gerek kalmadan) — bkz. CrudListTemplate.tsx.
//
// Depolama: localStorage (sekme/tarayıcı kapanmasına dayanıklı, sessionStorage değil).
// Anahtar: `nexora.draft.{resourceKey}.{create|editingId}` — aynı kaynağın farklı
// düzenleme kayıtları birbirinin taslağını ezmez.

const DEBOUNCE_MS = 600
const PREFIX = 'nexora.draft.'

interface StoredDraft<F> {
  form: F
  savedAt: number
}

function draftKey(resourceKey: string, scope: string) {
  return `${PREFIX}${resourceKey}.${scope}`
}

function readDraft<F>(key: string): StoredDraft<F> | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredDraft<F>
    if (!parsed || typeof parsed.savedAt !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

function writeDraft<F>(key: string, form: F) {
  try {
    localStorage.setItem(key, JSON.stringify({ form, savedAt: Date.now() } satisfies StoredDraft<F>))
  } catch {
    // Kota dolu/gizli mod vb. — taslak sessizce atlanır, ana kayıt akışını bozmaz.
  }
}

function clearDraftKey(key: string) {
  try { localStorage.removeItem(key) } catch { /* no-op */ }
}

/** Bir form değerinin "boş" (emptyForm ile aynı) olup olmadığını denetler;
 * boşsa taslak yazmaya gerek yok (gereksiz localStorage trafiği + yanlışlıkla
 * boş taslak teklif etmeyi önler). */
function isEmptyLike<F>(form: F, empty: F): boolean {
  try {
    return JSON.stringify(form) === JSON.stringify(empty)
  } catch {
    return false
  }
}

export interface UseFormDraftOptions<F> {
  /** Modül/kaynak bazında benzersiz anahtar, örn. "sports.facilities". */
  resourceKey: string
  /** 'create' modunda tüm kullanıcılar aynı taslağı paylaşır; 'edit' modunda editingId ile ayrışır. */
  scope: string
  emptyForm: F
  /** Taslak sistemini bu form için kapatmak isteyen caller'lar false geçebilir (örn. dosya/File alanı barındıran formlar). */
  enabled?: boolean
}

export interface FormDraftApi<F> {
  /** Açılışta bulunan taslak (varsa); kullanıcı "Devam Et" derse bu değer forma uygulanır. */
  pendingDraft: StoredDraft<F> | null
  /** Taslağı geri yükle ve bildirimi kapat. */
  restoreDraft: (apply: (form: F) => void) => void
  /** Taslağı sil (kullanıcı "Taslağı Sil" derse veya kayıt başarıyla tamamlanınca). */
  discardDraft: () => void
  /** Form her değiştiğinde çağrılır; debounce'lu şekilde localStorage'a yazar. */
  notifyChange: (form: F) => void
}

export function useFormDraft<F>({ resourceKey, scope, emptyForm, enabled = true }: UseFormDraftOptions<F>): FormDraftApi<F> {
  const key = draftKey(resourceKey, scope)
  const [pendingDraft, setPendingDraft] = useState<StoredDraft<F> | null>(() => (enabled ? readDraft<F>(key) : null))
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const keyRef = useRef(key)
  // pendingDraft state'inin en güncel halini senkron biçimde taşır — restoreDraft
  // disk yerine bunu kullanır (aşağıdaki notlara bakın).
  const pendingDraftRef = useRef<StoredDraft<F> | null>(pendingDraft)
  pendingDraftRef.current = pendingDraft

  // scope değiştiğinde (ör. create -> başka bir kaydı edit etmeye geçiş) o kaydın
  // kendi taslağını yeniden oku.
  useEffect(() => {
    keyRef.current = key
    setPendingDraft(enabled ? readDraft<F>(key) : null)
  }, [key, enabled])

  const discardDraft = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    clearDraftKey(keyRef.current)
    setPendingDraft(null)
  }, [])

  const restoreDraft = useCallback((apply: (form: F) => void) => {
    // DİKKAT: localStorage'dan yeniden OKUNMAZ — form açılırken emptyForm'a
    // resetlenip notifyChange tetiklendiğinde (boş form = emptyForm eşitliği)
    // taslak zaten "temizlenmiş" olabilir (bkz. notifyChange). Bu yüzden ilk
    // okumada state'e alınan pendingDraft'ı (ref üzerinden en güncel haliyle)
    // kullanmak zorunludur, diskten tekrar okumak çoktan silinmiş taslağı kaçırır.
    const current = pendingDraftRef.current
    if (current) apply(current.form)
    setPendingDraft(null)
  }, [])

  const notifyChange = useCallback((form: F) => {
    if (!enabled) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (isEmptyLike(form, emptyForm)) {
        clearDraftKey(keyRef.current)
      } else {
        writeDraft(keyRef.current, form)
      }
    }, DEBOUNCE_MS)
  }, [enabled, emptyForm])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return { pendingDraft, restoreDraft, discardDraft, notifyChange }
}

export function formatDraftAge(savedAt: number): string {
  const diffMs = Date.now() - savedAt
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'az önce'
  if (mins < 60) return `${mins} dakika önce`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} saat önce`
  const days = Math.floor(hours / 24)
  return `${days} gün önce`
}
