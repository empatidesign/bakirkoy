import { useState } from 'react'
import { BrainIcon, TrophyIcon } from 'lucide-react'
import { ModuleHeader } from '@/design-system'
import { QuizListTab } from './QuizListTab'
import { LeaderboardTab } from './LeaderboardTab'

type QuizTab = 'list' | 'leaderboard'

export const QuizPage = () => {
  const [tab, setTab] = useState<QuizTab>('list')
  const [leaderboardQuizId, setLeaderboardQuizId] = useState<string | null>(null)

  const handleGoLeaderboard = (quizId: string) => {
    setLeaderboardQuizId(quizId)
    setTab('leaderboard')
  }

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={BrainIcon}
        title="Yarışma"
        subtitle="Bilgi yarışmalarına katıl, sıralamada yüksel"
        gradient="linear-gradient(160deg, #581c87 0%, #7e22ce 55%, #a855f7 100%)"
        tabs={[
          { key: 'list', label: 'Yarışmalar', icon: BrainIcon },
          { key: 'leaderboard', label: 'Liderlik', icon: TrophyIcon },
        ]}
        value={tab}
        onValueChange={(k) => setTab(k as QuizTab)}
      />
      <div className="flex-1 overflow-y-auto">
        {tab === 'list' ? (
          <QuizListTab onGoLeaderboard={handleGoLeaderboard} />
        ) : (
          <LeaderboardTab initialQuizId={leaderboardQuizId} />
        )}
      </div>
    </div>
  )
}
