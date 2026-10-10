import { useEffect, useState } from 'react'
import { CrownIcon, MedalIcon, TrophyIcon, UsersIcon, ListChecksIcon } from 'lucide-react'
import { Select, Field, Avatar, Badge, StatCard, EmptyState, SkeletonRows } from '@/design-system'
import { cn, maskTC } from '@/lib/utils'
import quizService from '@/services/quiz.service'
import type { SelectOption } from '@/types/common'
import type { QuizLeaderboard, QuizRanking } from '@/types/quiz.types'
import { formatDuration } from './quizConstants'

const PODIUM_STYLES: Record<number, { ring: string; text: string; icon: typeof CrownIcon }> = {
  1: { ring: 'border-[hsl(var(--warning))] bg-[hsl(var(--warning-soft))]', text: 'text-[hsl(var(--warning))]', icon: CrownIcon },
  2: { ring: 'border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]', text: 'text-[hsl(var(--foreground-muted))]', icon: MedalIcon },
  3: { ring: 'border-[hsl(var(--accent-orange))] bg-[hsl(var(--accent-orange-soft))]', text: 'text-[hsl(var(--accent-orange))]', icon: MedalIcon },
}

const PodiumCard = ({ ranking, elevated }: { ranking?: QuizRanking; elevated?: boolean }) => {
  if (!ranking) return <div />
  const style = PODIUM_STYLES[ranking.rank] ?? PODIUM_STYLES[3]
  const Icon = style.icon
  return (
    <div className={cn('rounded-card border bg-[hsl(var(--surface-1))] p-4 text-center', elevated ? 'sm:-mt-3' : '')}>
      <div className={cn('mx-auto mb-2 flex items-center justify-center rounded-full border-2', style.ring, elevated ? 'h-16 w-16' : 'h-14 w-14')}>
        <Icon className={cn('h-7 w-7', style.text)} />
      </div>
      <p className={cn('type-kpi-value tabular-nums', style.text)}>{ranking.rank}.</p>
      <div className="mt-1 flex flex-col items-center gap-1">
        <Avatar name={ranking.participantName} />
        <p className="type-body-strong">{ranking.participantName}</p>
        <p className="type-caption tabular-nums">{maskTC(ranking.tckn)}</p>
      </div>
      <div className="mt-2 flex items-center justify-center gap-2">
        <Badge tone="success">{ranking.correctAnswers}/{ranking.totalQuestions}</Badge>
        <span className="type-body-strong tabular-nums text-[hsl(var(--primary))]">{ranking.score} puan</span>
      </div>
      <p className="mt-1 type-caption tabular-nums">{formatDuration(ranking.timeSpent)}</p>
    </div>
  )
}

export const LeaderboardTab = () => {
  const [options, setOptions] = useState<SelectOption[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [board, setBoard] = useState<QuizLeaderboard | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    quizService.getOptions()
      .then((o) => {
        setOptions(o ?? [])
        if (o?.length) setSelectedId((prev) => prev || o[0].value)
      })
      .catch(() => setOptions([]))
  }, [])

  useEffect(() => {
    if (!selectedId) { setBoard(null); return }
    setLoading(true)
    quizService.getLeaderboard(selectedId)
      .then(setBoard)
      .catch(() => setBoard(null))
      .finally(() => setLoading(false))
  }, [selectedId])

  if (options.length === 0) {
    return <EmptyState icon={TrophyIcon} title="Yarışma yok" description="Liderlik tablosu için önce bir yarışma oluşturun." />
  }

  const rankings = board?.rankings ?? []
  const top3 = rankings.slice(0, 3)
  const others = rankings.slice(3)

  return (
    <div className="space-y-4">
      <div className="max-w-md">
        <Field label="Yarışma">
          <Select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} placeholder="Yarışma seçin">
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
      </div>

      {board && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
          <StatCard size="compact" label="Toplam Katılımcı" value={board.totalParticipants} icon={UsersIcon} accent="blue" />
          <StatCard size="compact" label="Soru Sayısı" value={board.questionCount} icon={ListChecksIcon} accent="violet" />
        </div>
      )}

      {loading ? (
        <SkeletonRows rows={5} />
      ) : rankings.length === 0 ? (
        <EmptyState icon={UsersIcon} title="Katılım yok" description="Bu yarışmaya henüz katılım olmamış." />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3">
            <PodiumCard ranking={top3[1]} />
            <PodiumCard ranking={top3[0]} elevated />
            <PodiumCard ranking={top3[2]} />
          </div>

          {others.length > 0 && (
            <div className="space-y-2">
              {others.map((r) => (
                <div key={r.rank} className="flex items-center justify-between gap-3 rounded-card border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--surface-2))] type-body-strong tabular-nums">{r.rank}</span>
                    <Avatar name={r.participantName} />
                    <div className="min-w-0">
                      <p className="type-body-strong">{r.participantName}</p>
                      <p className="type-caption tabular-nums">{maskTC(r.tckn)}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <Badge tone="success">{r.correctAnswers}/{r.totalQuestions}</Badge>
                    <span className="type-body-strong tabular-nums text-[hsl(var(--primary))]">{r.score} puan</span>
                    <span className="hidden type-caption tabular-nums sm:inline">{formatDuration(r.timeSpent)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
