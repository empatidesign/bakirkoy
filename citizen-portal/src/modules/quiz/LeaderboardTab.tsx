import { useEffect, useState } from 'react'
import { TrophyIcon, Loader2Icon, MedalIcon } from 'lucide-react'
import { Button, EmptyState, Badge, SkeletonRows } from '@/design-system'
import { Select } from '@/design-system'
import type { CitizenQuiz, CitizenQuizLeaderboard } from '@/types/quiz.types'
import quizService from '@/services/quiz.service'

type Props = {
  initialQuizId?: string | null
}

// Kullanıcı isteği (2026-08-30): "yarışmalardaki tablolarda standart yapay zeka tablo
// başlarındaki renkten kaçın" — podyum kartları önceden her sıra için ayrı bir rastgele
// gökkuşağı gradyanı (gri/altın/turuncu degrade arka planlar) kullanıyordu; bu, tipik
// "AI panosu" görünümüdür. Artık üç kart da aynı nötr kart zeminini (bg-card/border)
// paylaşıyor, renk sadece madalya ikonunda anlamlı bir vurgu olarak kalıyor.
const PODIUM_CONFIG = [
  { rank: 2, label: '2.', color: '#94A3B8', height: 'h-20', textColor: 'text-foreground-default' },
  { rank: 1, label: '1.', color: '#F59E0B', height: 'h-28', textColor: 'text-foreground-strong' },
  { rank: 3, label: '3.', color: '#CD7C42', height: 'h-16', textColor: 'text-foreground-default' },
]

export const LeaderboardTab = ({ initialQuizId }: Props) => {
  const [quizzes, setQuizzes] = useState<CitizenQuiz[]>([])
  const [quizzesLoading, setQuizzesLoading] = useState(true)
  const [quizzesError, setQuizzesError] = useState(false)
  const [quizzesReloadKey, setQuizzesReloadKey] = useState(0)
  const [selectedQuizId, setSelectedQuizId] = useState<string>(initialQuizId ?? '')
  const [board, setBoard] = useState<CitizenQuizLeaderboard | null>(null)
  const [boardLoading, setBoardLoading] = useState(false)

  useEffect(() => {
    let active = true
    setQuizzesLoading(true)
    setQuizzesError(false)
    quizService.list({ page: 1, limit: 50 })
      .then((r) => {
        if (!active) return
        setQuizzes(r.items)
        if (!initialQuizId && r.items.length > 0) {
          setSelectedQuizId(r.items[0].id)
        }
      })
      .catch(() => {
        if (active) {
          setQuizzes([])
          setQuizzesError(true)
        }
      })
      .finally(() => { if (active) setQuizzesLoading(false) })
    return () => { active = false }
  }, [initialQuizId, quizzesReloadKey])

  useEffect(() => {
    if (!selectedQuizId) { setBoard(null); return }
    let active = true
    setBoardLoading(true)
    quizService.leaderboard(selectedQuizId)
      .then((b) => { if (active) setBoard(b ?? null) })
      .catch(() => { if (active) setBoard(null) })
      .finally(() => { if (active) setBoardLoading(false) })
    return () => { active = false }
  }, [selectedQuizId])

  const displayBoard = board
  const top3 = displayBoard?.rankings.filter((r) => r.rank <= 3) ?? []
  const rest = displayBoard?.rankings.filter((r) => r.rank > 3) ?? []

  return (
    <div className="space-y-4 p-4">
      {quizzesLoading ? (
        <SkeletonRows rows={2} />
      ) : quizzesError ? (
        <EmptyState
          icon={TrophyIcon}
          title="Yarışmalar yüklenemedi"
          description="Bağlantınızı kontrol edip tekrar deneyin."
          action={<Button variant="outline" size="sm" onClick={() => setQuizzesReloadKey((k) => k + 1)}>Tekrar Dene</Button>}
        />
      ) : (
        <Select
          value={selectedQuizId}
          onChange={(e) => setSelectedQuizId(e.target.value)}
          className="w-full"
        >
          <option value="">Yarışma seçin</option>
          {quizzes.map((q) => (
            <option key={q.id} value={q.id}>{q.title}</option>
          ))}
        </Select>
      )}

      {boardLoading && (
        <div className="flex justify-center py-8">
          <Loader2Icon className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {!boardLoading && displayBoard && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">{displayBoard.totalParticipants.toLocaleString('tr-TR')} katılımcı</Badge>
            <Badge tone="neutral">{displayBoard.questionCount} soru</Badge>
          </div>

          {top3.length > 0 && (
            <div className="flex items-end justify-center gap-3 px-2 pb-2">
              {PODIUM_CONFIG.map(({ rank, label, color, height, textColor }) => {
                const entry = top3.find((r) => r.rank === rank)
                if (!entry) return null
                return (
                  <div
                    key={rank}
                    className={`flex flex-1 flex-col items-center gap-2 rounded-2xl border border-border bg-card p-3 ${entry.isCurrentUser ? 'ring-2 ring-primary/40 ring-offset-1' : ''}`}
                  >
                    <div
                      className={`flex ${height} w-12 flex-col items-center justify-end pb-1`}
                    >
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-full text-white text-sm font-black shadow-md"
                        style={{ background: color }}
                      >
                        {label}
                      </div>
                    </div>
                    <MedalIcon className="h-5 w-5" style={{ color }} />
                    <p className={`text-center text-[11px] font-bold leading-tight ${textColor} max-w-[80px] line-clamp-2`}>
                      {entry.participantName}
                    </p>
                    <p className={`text-[10px] font-semibold ${textColor} opacity-70`}>
                      {entry.correctAnswers} doğru
                    </p>
                    <p className={`text-[13px] font-black ${textColor}`}>
                      {entry.score} <span className="text-[9px] font-semibold">puan</span>
                    </p>
                  </div>
                )
              })}
            </div>
          )}

          {rest.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="grid grid-cols-[auto_1fr_auto_auto] gap-3 border-b border-border bg-surface-1 px-4 py-2.5">
                <span className="w-7 text-center text-[10px] font-bold uppercase tracking-wider text-foreground-subtle">#</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-subtle">İsim</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-subtle">Doğru</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-subtle">Puan</span>
              </div>
              {rest.map((r, idx) => (
                <div
                  key={r.rank}
                  className={`grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-4 py-3 ${
                    idx < rest.length - 1 ? 'border-b border-border' : ''
                  } ${r.isCurrentUser ? 'bg-primary/5' : ''}`}
                >
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-surface-1 text-xs font-bold text-foreground-muted">
                    {r.rank}
                  </span>
                  <p className={`truncate text-[13px] font-semibold ${r.isCurrentUser ? 'text-primary' : 'text-foreground'}`}>
                    {r.participantName}
                    {r.isCurrentUser && (
                      <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">Sen</span>
                    )}
                  </p>
                  <span className="text-[12px] font-semibold text-success">{r.correctAnswers}</span>
                  <span className="text-[13px] font-black text-primary">{r.score}</span>
                </div>
              ))}
            </div>
          )}

          {top3.length === 0 && rest.length === 0 && (
            <EmptyState icon={TrophyIcon} title="Sıralama boş" description="Henüz katılımcı yok." />
          )}
        </div>
      )}

      {!boardLoading && !displayBoard && selectedQuizId && (
        <EmptyState icon={TrophyIcon} title="Sıralama yüklenemedi" description="Lütfen tekrar deneyin." />
      )}
    </div>
  )
}
