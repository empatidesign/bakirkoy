import { useEffect, useState } from 'react'
import { AlertTriangleIcon, ShieldAlertIcon, Trash2Icon } from 'lucide-react'
import { Button, Input, Modal, SkeletonRows } from '@/design-system'
import surveyService from '@/services/survey.service'
import type { Survey, SurveyDeleteImpact } from '@/types/survey.types'

// Kullanıcı isteği (2026-09-01): "silmek icin mutlaka silmek istiyorum onay gibi birşey yazıp
// silmek lazım cünkü birsürü data gider bunun önelimni al, ayrıca silmek süper yönetici
// yapabilir". Bu modal:
//  1. Silmeden ÖNCE kaç yanıtın/sorunun/saha görevinin yok olacağını gösterir,
//  2. Onay metni birebir yazılmadan silme düğmesini açmaz,
//  3. Süper yönetici değilse silmeyi hiç mümkün kılmaz (backend de ayrıca reddeder).

type Props = {
  survey: Survey | null
  onClose: () => void
  onDeleted: () => void
}

export const SurveyDeleteDialog = ({ survey, onClose, onDeleted }: Props) => {
  const [impact, setImpact] = useState<SurveyDeleteImpact | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!survey) {
      setImpact(null)
      setText('')
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    setText('')
    surveyService
      .deleteImpact(survey.id)
      .then(setImpact)
      .catch(() => setError('Silme bilgileri alınamadı.'))
      .finally(() => setLoading(false))
  }, [survey])

  const phrase = impact?.confirmationPhrase ?? 'silmek istiyorum'
  const phraseOk = text.trim().toLocaleLowerCase('tr') === phrase.toLocaleLowerCase('tr')
  const canDelete = impact?.canDelete === true

  const submit = async () => {
    if (!survey || !phraseOk || !canDelete || deleting) return
    setDeleting(true)
    setError(null)
    try {
      await surveyService.remove(survey.id, text.trim())
      onDeleted()
      onClose()
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || 'Anket silinemedi.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Modal open={!!survey} onClose={onClose}>
      <div className="p-6">
        <div className="mb-5 flex items-start gap-4 pr-8">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-field bg-danger-soft">
            <Trash2Icon className="h-5 w-5 text-danger" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground-strong">Anketi Kalıcı Olarak Sil</h3>
            <p className="mt-1 type-muted">{survey?.title}</p>
          </div>
        </div>

        {loading ? (
          <SkeletonRows rows={3} />
        ) : (
          <>
            {impact && (
              <div className="mb-4 rounded-field border border-danger/30 bg-danger-soft/40 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-danger">
                  <AlertTriangleIcon className="h-4 w-4" />
                  Bu işlem geri alınamaz
                </p>
                <ul className="mt-2 space-y-1 type-muted">
                  <li><b>{impact.responseCount}</b> vatandaş yanıtı kalıcı olarak silinecek</li>
                  <li><b>{impact.questionCount}</b> soru silinecek</li>
                  <li><b>{impact.fieldTaskCount}</b> saha görevi etkilenecek</li>
                </ul>
                <p className="mt-2 type-caption">
                  Veriyi korumak istiyorsanız silmek yerine anketi <b>pasife alabilirsiniz</b>.
                </p>
              </div>
            )}

            {!canDelete ? (
              <div className="mb-4 flex items-start gap-3 rounded-field border border-warning/30 bg-warning-soft/40 p-4">
                <ShieldAlertIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
                <p className="type-muted">
                  Anket silme yetkisi yalnızca <b>süper yöneticidedir</b>. Anketi pasife alabilir
                  veya süper yöneticiden silmesini talep edebilirsiniz.
                </p>
              </div>
            ) : (
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-foreground-strong">
                  Onaylamak için <span className="font-mono text-danger">{phrase}</span> yazın
                </label>
                <Input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={phrase}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter' && phraseOk) submit() }}
                />
              </div>
            )}

            {error && <p className="mb-3 type-caption text-danger">{error}</p>}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={onClose} disabled={deleting}>
                Vazgeç
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={submit}
                disabled={!phraseOk || !canDelete || deleting}
                isLoading={deleting}
              >
                Kalıcı Olarak Sil
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
