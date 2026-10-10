import { useEffect, useState, useRef } from 'react'
import {
  TrophyIcon, SparklesIcon, CheckCircle2Icon, XCircleIcon, RotateCcwIcon,
  HelpCircleIcon, ClockIcon, FlameIcon, WifiIcon, BatteryMediumIcon,
  ChevronRightIcon, PlayIcon,
} from 'lucide-react'
import { Modal, Button } from '@/design-system'
import quizService from '@/services/quiz.service'
import type { Quiz, QuizQuestion } from '@/types/quiz.types'
import { cn } from '@/lib/utils'

interface Props {
  quiz: Quiz | null
  open: boolean
  onClose: () => void
  onOpenQuestions?: () => void
}

type Phase = 'intro' | 'playing' | 'result'

export const QuizMobilePreviewModal = ({ quiz, open, onClose, onOpenQuestions }: Props) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState<Phase>('intro')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)
  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [wrongCount, setWrongCount] = useState(0)
  const [questionTimeLeft, setQuestionTimeLeft] = useState<number>(30)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!open || !quiz) {
      setQuestions([])
      setPhase('intro')
      setCurrentIndex(0)
      setSelectedOption(null)
      setAnswered(false)
      setScore(0)
      setCorrectCount(0)
      setWrongCount(0)
      return
    }

    setLoading(true)
    quizService
      .getQuestions(quiz.id)
      .then((data) => {
        setQuestions(data || [])
      })
      .catch(() => setQuestions([]))
      .finally(() => setLoading(false))
  }, [open, quiz?.id])

  const currentQ = questions[currentIndex]
  const totalQuestions = questions.length
  const progressPercent = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0

  // Start question timer when playing
  useEffect(() => {
    if (phase !== 'playing' || answered || !currentQ) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }

    const limit = currentQ.timeLimit || quiz?.perQuestionTimeLimit || 30
    setQuestionTimeLeft(limit)

    timerRef.current = setInterval(() => {
      setQuestionTimeLeft((prev) => {
        if (prev <= 1) {
          // Time's up -> mark answered as timed out (wrong)
          handleSelectOption(-1)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [phase, currentIndex, answered, currentQ])

  const handleStart = () => {
    setPhase('playing')
    setCurrentIndex(0)
    setSelectedOption(null)
    setAnswered(false)
    setScore(0)
    setCorrectCount(0)
    setWrongCount(0)
  }

  const handleSelectOption = (idx: number) => {
    if (answered || !currentQ) return
    setSelectedOption(idx)
    setAnswered(true)

    const isCorrect = idx === currentQ.correctAnswer
    if (isCorrect) {
      const earned = currentQ.points || 10
      setScore((s) => s + earned)
      setCorrectCount((c) => c + 1)
    } else {
      setWrongCount((w) => w + 1)
    }
  }

  const handleNext = () => {
    if (currentIndex + 1 < totalQuestions) {
      setCurrentIndex((i) => i + 1)
      setSelectedOption(null)
      setAnswered(false)
    } else {
      setPhase('result')
    }
  }

  const handleRestart = () => {
    handleStart()
  }

  if (!quiz) return null

  const accentColor = quiz.categoryColor || '#6366f1'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Mobil Görünüm Önizlemesi"
      subtitle={`${quiz.title} • Vatandaş Arayüzü Simülasyonu`}
      width={460}
      className="p-3 sm:p-5"
    >
      <div className="flex flex-col items-center">
        {/* Smartphone Shell */}
        <div className="relative flex h-[660px] w-[340px] flex-col overflow-hidden rounded-[42px] border-[8px] border-slate-900 bg-slate-950 text-slate-100 shadow-2xl ring-1 ring-slate-800">
          {/* Dynamic Island */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 flex h-5 w-24 items-center justify-between rounded-full bg-black px-2.5 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-slate-900 border border-slate-800" />
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-950/60 ring-1 ring-indigo-500/20" />
          </div>

          {/* Status Bar */}
          <div className="flex h-10 w-full items-end justify-between px-6 pb-1 text-[11px] font-semibold text-slate-300">
            <span>09:41</span>
            <div className="flex items-center gap-1.5 opacity-90">
              <WifiIcon className="h-3 w-3" />
              <span className="text-[10px] font-bold">5G</span>
              <BatteryMediumIcon className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* Phone Content Screen */}
          <div className="flex flex-1 flex-col overflow-hidden bg-slate-900/90 text-slate-100">
            {loading ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-xs text-slate-400">Yarışma ve sorular yükleniyor...</p>
              </div>
            ) : totalQuestions === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800/80 text-slate-400 shadow-inner">
                  <HelpCircleIcon className="h-7 w-7" />
                </div>
                <h4 className="text-sm font-semibold text-slate-200">Soru Bulunamadı</h4>
                <p className="text-xs leading-relaxed text-slate-400">
                  Bu yarışmaya henüz soru eklenmemiş. Soruları ekledikten sonra burada interaktif olarak test edebilirsiniz.
                </p>
                {onOpenQuestions && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      onClose()
                      onOpenQuestions()
                    }}
                    className="mt-2"
                  >
                    Soruları Yönet
                  </Button>
                )}
              </div>
            ) : phase === 'intro' ? (
              /* INTRO SCREEN */
              <div className="flex flex-1 flex-col justify-between overflow-y-auto p-5">
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium text-white shadow-sm"
                      style={{ backgroundColor: accentColor }}
                    >
                      <SparklesIcon className="h-3 w-3" />
                      {quiz.categoryName || 'Genel'}
                    </span>
                    {quiz.ageGroupName && (
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                        {quiz.ageGroupName}
                      </span>
                    )}
                  </div>

                  <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-indigo-950/60 to-purple-950/40 p-4 text-center">
                    <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/30">
                      <TrophyIcon className="h-7 w-7" />
                    </div>
                    <h3 className="text-base font-bold text-slate-100">{quiz.title}</h3>
                    {quiz.description && (
                      <p className="mt-1 line-clamp-3 text-xs text-slate-300/80 leading-relaxed">
                        {quiz.description}
                      </p>
                    )}
                  </div>

                  {/* Rules / Specs Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl border border-slate-800/80 bg-slate-800/40 p-2.5">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <HelpCircleIcon className="h-3.5 w-3.5 text-indigo-400" />
                        <span className="text-[11px]">Soru Sayısı</span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-200">{totalQuestions} Soru</p>
                    </div>

                    <div className="rounded-xl border border-slate-800/80 bg-slate-800/40 p-2.5">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <ClockIcon className="h-3.5 w-3.5 text-amber-400" />
                        <span className="text-[11px]">Soru Süresi</span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-200">
                        {quiz.perQuestionTimeLimit || 30} sn
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-800/80 bg-slate-800/40 p-2.5">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <FlameIcon className="h-3.5 w-3.5 text-rose-400" />
                        <span className="text-[11px]">Toplam Süre</span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-200">
                        {quiz.durationMinutes || 10} dk
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-800/80 bg-slate-800/40 p-2.5">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <CheckCircle2Icon className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-[11px]">Katılım</span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-200">Tek Seferlik</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 pb-2">
                  <button
                    type="button"
                    onClick={handleStart}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-110 active:scale-[0.98]"
                  >
                    <PlayIcon className="h-4 w-4 fill-white" />
                    Yarışmaya Başla
                  </button>
                  <p className="mt-2 text-center text-[10px] text-slate-500">
                    Önizleme modudur; sonuçlar liderlik tablosuna işlenmez.
                  </p>
                </div>
              </div>
            ) : phase === 'playing' ? (
              /* PLAYING SCREEN */
              <div className="flex flex-1 flex-col justify-between overflow-y-auto p-4">
                <div className="space-y-3">
                  {/* Top Progress & Timer */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-medium text-slate-300">
                        Soru <span className="text-white font-bold">{currentIndex + 1}</span> / {totalQuestions}
                      </span>
                      <div
                        className={cn(
                          'flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums',
                          questionTimeLeft <= 5
                            ? 'bg-rose-500/20 text-rose-400 animate-pulse'
                            : 'bg-slate-800 text-slate-200',
                        )}
                      >
                        <ClockIcon className="h-3 w-3" />
                        <span>{questionTimeLeft}s</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full bg-indigo-500 transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Question Card */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-400">
                        +{currentQ.points || 10} Puan
                      </span>
                      {currentQ.difficulty && (
                        <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400 capitalize">
                          {currentQ.difficulty}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold leading-snug text-slate-100">
                      {currentQ.question}
                    </p>
                  </div>

                  {/* Options List */}
                  <div className="space-y-2">
                    {currentQ.options.map((opt, idx) => {
                      const letters = ['A', 'B', 'C', 'D', 'E', 'F']
                      const isCorrect = idx === currentQ.correctAnswer
                      const isChosen = selectedOption === idx

                      let style = 'border-slate-800 bg-slate-800/40 text-slate-200 hover:bg-slate-800 hover:border-slate-700'
                      let icon = null

                      if (answered) {
                        if (isCorrect) {
                          style = 'border-emerald-500 bg-emerald-500/20 text-emerald-300 font-semibold shadow-sm'
                          icon = <CheckCircle2Icon className="h-4 w-4 shrink-0 text-emerald-400" />
                        } else if (isChosen && !isCorrect) {
                          style = 'border-rose-500 bg-rose-500/20 text-rose-300 font-semibold shadow-sm'
                          icon = <XCircleIcon className="h-4 w-4 shrink-0 text-rose-400" />
                        } else {
                          style = 'border-slate-800/50 bg-slate-900/40 text-slate-500 opacity-60'
                        }
                      }

                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={answered}
                          onClick={() => handleSelectOption(idx)}
                          className={cn(
                            'flex w-full items-center justify-between rounded-xl border p-3 text-left text-xs transition-all',
                            style,
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={cn(
                                'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold',
                                answered && isCorrect
                                  ? 'bg-emerald-500 text-white'
                                  : answered && isChosen
                                  ? 'bg-rose-500 text-white'
                                  : 'bg-slate-700/80 text-slate-300',
                              )}
                            >
                              {letters[idx] ?? idx + 1}
                            </span>
                            <span className="truncate">{opt}</span>
                          </div>
                          {icon}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="pt-3">
                  {answered ? (
                    <button
                      type="button"
                      onClick={handleNext}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-indigo-500 transition-colors"
                    >
                      <span>{currentIndex + 1 < totalQuestions ? 'Sonraki Soru' : 'Sonuçları Gör'}</span>
                      <ChevronRightIcon className="h-4 w-4" />
                    </button>
                  ) : (
                    <p className="text-center text-[10px] text-slate-500">
                      Doğru olduğunu düşündüğünüz şıkkı seçin.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              /* RESULT SCREEN */
              <div className="flex flex-1 flex-col items-center justify-between overflow-y-auto p-5 text-center">
                <div className="space-y-4 pt-4">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-500/10 text-amber-400 ring-2 ring-amber-500/30">
                    <TrophyIcon className="h-9 w-9" />
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-slate-100">Yarışma Tamamlandı!</h3>
                    <p className="mt-1 text-xs text-slate-400">
                      Tüm soruları başarıyla yanıtladınız.
                    </p>
                  </div>

                  {/* Summary score card */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                      Toplam Puan
                    </span>
                    <p className="mt-0.5 text-3xl font-extrabold text-amber-400 tabular-nums">
                      {score}
                    </p>

                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-800 pt-3 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400">Doğru</span>
                        <p className="font-bold text-emerald-400 tabular-nums">{correctCount}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400">Yanlış</span>
                        <p className="font-bold text-rose-400 tabular-nums">{wrongCount}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400">Başarı</span>
                        <p className="font-bold text-indigo-400 tabular-nums">
                          %{totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-full space-y-2 pt-4 pb-2">
                  <button
                    type="button"
                    onClick={handleRestart}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-indigo-500 transition-colors"
                  >
                    <RotateCcwIcon className="h-3.5 w-3.5" />
                    Yeniden Başlat
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
                  >
                    Önizlemeyi Kapat
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Home Indicator bar */}
          <div className="flex h-5 w-full items-center justify-center bg-slate-950 pb-1">
            <span className="h-1 w-28 rounded-full bg-slate-700/80" />
          </div>
        </div>
      </div>
    </Modal>
  )
}
