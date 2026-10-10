import { useEffect, useState } from 'react'
import {
  BrainIcon, ClockIcon, UsersIcon, ChevronRightIcon,
  CheckCircle2Icon, CalendarIcon, ZapIcon, TrophyIcon, TagIcon,
} from 'lucide-react'
import { Button, EmptyState, SkeletonRows } from '@/design-system'
import { formatDate } from '@/lib/utils'
import type { CitizenQuiz } from '@/types/quiz.types'
import quizService from '@/services/quiz.service'
import { QuizPlayModal } from './QuizPlayModal'

type Props = {
  onGoLeaderboard: (quizId: string) => void
}

export const QuizListTab = ({ onGoLeaderboard }: Props) => {
  const [items, setItems] = useState<CitizenQuiz[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError(false)
    quizService.list({ page: 1, limit: 50 })
      .then((r) => { if (active) setItems(r.items) })
      .catch(() => {
        if (active) {
          setItems(null)
          setLoadError(true)
        }
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reloadKey])

  const activeQuizzes = items?.filter((q) => q.status === 'ongoing') ?? []
  const upcoming = items?.filter((q) => q.status === 'upcoming') ?? []
  const completed = items?.filter((q) => q.status === 'completed') ?? []

  // Kullanıcı geri bildirimi (2026-08-30): önceki tasarımda her kart tam
  // genişlikte, tek başına çok doygun bir gradyanla boyanmıştı; alt alta
  // dizilince ekran "renk bloklarının üst üste bağırdığı" kötü bir görünüm
  // veriyordu (rengin mavi olması da bunun sadece bir belirtisiydi, asıl
  // sorun tasarımın kendisiydi). Uygulamanın geri kalanı (StatCard,
  // InfoTile, DiscoverTab kategori rozetleri) beyaz kart + ince kenarlık +
  // "soft" arkaplanlı küçük bir ikon rozeti dilini kullanıyor — gradyan
  // bloklar değil. Bu kart da o dile taşındı: nötr beyaz zemin, sadece
  // ikon rozeti ve ince bir sol şerit tasarım sistemindeki accent rengini
  // taşıyor. Kurumsal mavi (`accent-blue`) burada bilinçli olarak
  // kullanılmıyor; geri kalan üç sakin accent (green/orange/violet/pink)
  // sırayla dönüyor.
  const ACCENTS = [
    { bar: 'bg-accent-orange', soft: 'bg-accent-orange-soft', text: 'text-accent-orange' },
    { bar: 'bg-accent-green', soft: 'bg-accent-green-soft', text: 'text-accent-green' },
    { bar: 'bg-accent-violet', soft: 'bg-accent-violet-soft', text: 'text-accent-violet' },
    { bar: 'bg-accent-pink', soft: 'bg-accent-pink-soft', text: 'text-accent-pink' },
  ]

  const ActiveCard = ({ q, idx }: { q: CitizenQuiz; idx: number }) => {
    const accent = ACCENTS[idx % ACCENTS.length]
    return (
      <button
        type="button"
        onClick={() => setSelectedId(q.id)}
        className="w-full text-left group"
      >
        <div className="relative flex gap-3 overflow-hidden rounded-card border border-border bg-card p-4 shadow-card transition-all duration-150 hover:border-[hsl(var(--border))]/80 hover:shadow-md active:scale-[0.99]">
          <span className={`absolute inset-y-0 left-0 w-1 ${accent.bar}`} />

          <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-card ${accent.soft}`}>
            <BrainIcon className={`h-5 w-5 ${accent.text}`} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[14px] font-bold text-foreground-strong leading-snug line-clamp-2">{q.title}</h3>
              <ChevronRightIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground-subtle transition-transform group-hover:translate-x-0.5" />
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {q.categoryName && (
                <span className="text-[11px] font-medium text-foreground-muted">{q.categoryName}</span>
              )}
              {q.ageGroupName && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${accent.soft} ${accent.text}`}>
                  <UsersIcon className="h-2.5 w-2.5" />{q.ageGroupName}
                </span>
              )}
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${accent.soft} ${accent.text}`}>
                <ZapIcon className="h-2.5 w-2.5" /> Devam Ediyor
              </span>
              {q.alreadyParticipated && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-green-soft px-2 py-0.5 text-[10px] font-bold text-accent-green">
                  <CheckCircle2Icon className="h-2.5 w-2.5" /> Katıldınız
                </span>
              )}
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1 text-[11px] text-foreground-muted">
                <BrainIcon className="h-3 w-3" />{q.questionCount} soru
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-foreground-muted">
                <ClockIcon className="h-3 w-3" />{q.durationMinutes} dk
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-foreground-muted">
                <UsersIcon className="h-3 w-3" />{q.participantCount} katılımcı
              </span>
              <span className="text-[11px] text-foreground-subtle">
                {formatDate(q.startDate)} – {formatDate(q.endDate)}
              </span>
            </div>
          </div>
        </div>
      </button>
    )
  }

  const UpcomingCard = ({ q }: { q: CitizenQuiz }) => (
    <div className="flex items-center gap-3 rounded-card border border-amber-200/60 bg-amber-50 px-4 py-3">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-card bg-amber-100">
        <ClockIcon className="h-4 w-4 text-amber-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-foreground-strong truncate">{q.title}</p>
        <p className="text-[11px] text-amber-600/80 mt-0.5">
          {formatDate(q.startDate)} tarihinde başlıyor
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-600">
        Yakında
      </span>
    </div>
  )

  return (
    <div className="p-4 md:p-5 space-y-6">
      {loading ? (
        <SkeletonRows rows={4} />
      ) : loadError ? (
        <div className="space-y-3">
          <EmptyState icon={BrainIcon} title="Yarışmalar yüklenemedi" description="Bağlantınızı kontrol edip tekrar deneyin." />
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => setReloadKey((k) => k + 1)}>Tekrar Dene</Button>
          </div>
        </div>
      ) : !items || items.length === 0 ? (
        <EmptyState icon={BrainIcon} title="Yarışma bulunamadı" description="Aktif yarışmalar burada görünecek." />
      ) : (
        <>
          {activeQuizzes.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <ZapIcon className="h-4 w-4 text-purple-500" />
                <p className="text-[11px] font-black uppercase tracking-widest text-purple-500">
                  Aktif ({activeQuizzes.length})
                </p>
              </div>
              <div className="space-y-3">
                {activeQuizzes.map((q, i) => (
                  <ActiveCard key={q.id} q={q} idx={i} />
                ))}
              </div>
            </section>
          )}

          {upcoming.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <CalendarIcon className="h-4 w-4 text-amber-500" />
                <p className="text-[11px] font-black uppercase tracking-widest text-amber-500">
                  Yakında ({upcoming.length})
                </p>
              </div>
              <div className="space-y-2">
                {upcoming.map((q) => <UpcomingCard key={q.id} q={q} />)}
              </div>
            </section>
          )}

          {completed.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <TrophyIcon className="h-4 w-4 text-foreground-subtle" />
                <p className="text-[11px] font-black uppercase tracking-widest text-foreground-subtle">
                  Tamamlandı ({completed.length})
                </p>
              </div>
              <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-card">
                {completed.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setSelectedId(q.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-1 group"
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-card bg-surface-2">
                      <BrainIcon className="h-3.5 w-3.5 text-foreground-muted" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-foreground-muted truncate group-hover:text-foreground transition-colors">
                        {q.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {q.categoryName && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-foreground-subtle">
                            <TagIcon className="h-2.5 w-2.5" />{q.categoryName}
                          </span>
                        )}
                        {q.ageGroupName && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-foreground-subtle">
                            <UsersIcon className="h-2.5 w-2.5" />{q.ageGroupName}
                          </span>
                        )}
                        <span className="text-[10px] text-foreground-subtle">
                          {q.questionCount} soru · {q.participantCount} katılımcı
                        </span>
                      </div>
                    </div>
                    {q.alreadyParticipated && (
                      <CheckCircle2Icon className="h-4 w-4 flex-shrink-0 text-emerald-400" />
                    )}
                    <ChevronRightIcon className="h-3.5 w-3.5 flex-shrink-0 text-foreground-subtle group-hover:text-purple-400 transition-colors" />
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <QuizPlayModal
        quizId={selectedId}
        onClose={() => setSelectedId(null)}
        onGoLeaderboard={(id) => { setSelectedId(null); onGoLeaderboard(id) }}
      />
    </div>
  )
}
