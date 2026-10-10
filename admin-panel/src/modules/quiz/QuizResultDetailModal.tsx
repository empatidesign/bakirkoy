import { useEffect, useState } from 'react'
import { AwardIcon, CheckCircle2Icon, XCircleIcon, ClockIcon, Trophy, Hash, Users } from 'lucide-react'
import { Modal, Badge, SkeletonRows, EmptyState } from '@/design-system'
import quizService from '@/services/quiz.service'
import type { QuizParticipationDetail } from '@/types/quiz.types'
import { formatDuration } from './quizConstants'
import { formatDateTime, maskTC } from '@/lib/utils'

interface Props {
  quizId: string
  participationId: string | null
  open: boolean
  onClose: () => void
}

export const QuizResultDetailModal = ({ quizId, participationId, open, onClose }: Props) => {
  const [detail, setDetail] = useState<QuizParticipationDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open || !participationId) return
    setLoading(true)
    setDetail(null)
    quizService
      .getParticipationDetail(quizId, participationId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false))
  }, [open, quizId, participationId])

  const initials = detail?.participantName
    ? detail.participantName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <Modal open={open} onClose={onClose} title="" width={760}>
      {loading ? (
        <SkeletonRows rows={5} />
      ) : !detail ? (
        <EmptyState icon={Trophy} title="Sonuç bulunamadı" description="Bu katılıma ait sonuç yüklenemedi." />
      ) : (
        <div>
          {/* Kullanıcı isteği (2026-08-30): "yarışmalardaki tablolarda standart yapay zeka
              tablo başlarındaki renkten kaçın" — bu ekran önceden alakasız bir pembe→turuncu
              gradyan banner ve her istatistik kartı için rastgele bir gökkuşağı rengi
              (sarı/yeşil/mor/pembe/mavi/turuncu) kullanıyordu; klasik "AI panosu" görünümü.
              Artık modülün kendi marka rengi (Bilgi Yarışması = yeşil, bkz. QuizPage
              PageHeader) tek vurgu, istatistik kartlarındaki renkler ise sadece anlamlı
              olanlarda (doğru=yeşil, yanlış=kırmızı) kalıyor, geri kalanı nötr gri. */}
          <div className="relative overflow-hidden ds-hero">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #fff, transparent)' }} />
            <div className="relative flex items-center gap-4 px-6 py-5">
              <span
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-xl font-bold text-white shadow-lg"
                style={{ background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.35)' }}
              >
                {initials}
              </span>
              <div>
                <p className="text-lg font-bold text-white">{detail.participantName}</p>
                <p className="text-[12px] text-white/70">{maskTC(detail.tckn)}</p>
                <span className="mt-1.5 inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold bg-white/20 text-white">
                  Tamamlandı
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-5">
            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="border-b border-border bg-surface-1 px-4 py-3">
                <p className="text-sm font-semibold text-foreground-strong">Sonuç Özeti</p>
              </div>
              <div className="grid grid-cols-2 divide-x divide-y divide-border">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--surface-2))]">
                    <AwardIcon className="h-3.5 w-3.5 text-foreground-muted" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-foreground-subtle uppercase tracking-wide">Toplam Puan</p>
                    <p className="text-sm font-semibold text-foreground-default">{detail.score}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success-soft">
                    <CheckCircle2Icon className="h-3.5 w-3.5 text-success" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-foreground-subtle uppercase tracking-wide">Doğru</p>
                    <p className="text-sm font-semibold text-foreground-default">{detail.correctAnswers}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-danger-soft">
                    <XCircleIcon className="h-3.5 w-3.5 text-danger" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-foreground-subtle uppercase tracking-wide">Yanlış</p>
                    <p className="text-sm font-semibold text-foreground-default">{detail.wrongAnswers}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--surface-2))]">
                    <ClockIcon className="h-3.5 w-3.5 text-foreground-muted" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-foreground-subtle uppercase tracking-wide">Süre</p>
                    <p className="text-sm font-semibold text-foreground-default">{formatDuration(detail.timeSpent)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="border-b border-border bg-surface-1 px-4 py-3">
                <p className="text-sm font-semibold text-foreground-strong">Sıralama & Tamamlanma</p>
              </div>
              <div className="grid grid-cols-2 divide-x divide-border">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--surface-2))]">
                    <Hash className="h-3.5 w-3.5 text-foreground-muted" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-foreground-subtle uppercase tracking-wide">Sıra</p>
                    <p className="text-sm font-semibold text-foreground-default">{detail.rank}. sıra</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--surface-2))]">
                    <Users className="h-3.5 w-3.5 text-foreground-muted" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-foreground-subtle uppercase tracking-wide">Katılımcı</p>
                    <p className="text-sm font-semibold text-foreground-default">{detail.totalParticipants.toLocaleString('tr-TR')} kişi</p>
                  </div>
                </div>
              </div>
              {detail.completedAt && (
                <div className="border-t border-border px-4 py-3 flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--surface-2))]">
                    <ClockIcon className="h-3.5 w-3.5 text-foreground-muted" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-foreground-subtle uppercase tracking-wide">Tamamlanma Zamanı</p>
                    <p className="text-sm font-semibold text-foreground-default">{formatDateTime(detail.completedAt)}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="border-b border-border bg-surface-1 px-4 py-3">
                <p className="text-sm font-semibold text-foreground-strong">Soru Bazlı Sonuçlar</p>
              </div>
              <div className="divide-y divide-border">
                {detail.answers.map((a) => (
                  <div key={a.order} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge tone="neutral">{a.order}</Badge>
                          {/* DÜZELTME (2026-09-27, kapsamlı test bulgusu): pas geçilen (PassRights
                              ile işaretli) sorular backend'de doğru/yanlış sayılmaz ama bu rozet
                              isCorrect=false olduğu için hepsini kırmızı "Yanlış" gösteriyordu —
                              vatandaşın bilinçli pas geçtiği bir soru admin'e yanlış cevap gibi
                              yansıyordu. isPassed artık ayrı, nötr bir rozetle gösteriliyor. */}
                          <Badge tone={a.isPassed ? 'neutral' : a.isCorrect ? 'success' : 'danger'}>
                            {a.isPassed ? 'Pas Geçildi' : a.isCorrect ? 'Doğru' : 'Yanlış'}
                          </Badge>
                        </div>
                        <p className="mt-1 type-body-strong">{a.question}</p>
                        <p className="mt-1 type-caption">
                          Verilen cevap:{' '}
                          <span className={a.isPassed ? 'text-foreground-muted' : a.isCorrect ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--danger))]'}>
                            {/* Kullanıcı bulgusu (2026-08-09): admin panelde "beyaz sayfa" —
                                a.options undefined/kısa olduğunda a.options[a.selectedAnswer]
                                null referans hatası fırlatıp React ağacını çökertiyordu (global
                                ErrorBoundary da yok). Backend artık her zaman gerçek soru
                                verisiyle tutarlı bir liste döndürüyor (bkz. QuizService.
                                BuildAnswerDetails), ama burada da savunma amaçlı optional
                                chaining + fallback bırakılıyor. */}
                            {a.isPassed ? 'Pas geçildi' : a.selectedAnswer >= 0 ? (a.options?.[a.selectedAnswer] ?? 'Bilinmeyen cevap') : 'Cevaplanmadı'}
                          </span>
                          {!a.isCorrect && !a.isPassed && (
                            <>
                              {' · '}Doğru: <span className="text-[hsl(var(--success))]">{a.options?.[a.correctAnswer] ?? '—'}</span>
                            </>
                          )}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="type-body-strong tabular-nums">{a.points} puan</p>
                        <p className="type-caption tabular-nums">{a.timeSpent} sn</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
