import { useEffect, useRef, useState } from 'react'
import { ArrowLeftIcon, SendIcon, MessageSquareIcon } from 'lucide-react'
import { Avatar, IconButton, Textarea, Button, EmptyState, SkeletonRows } from '@/design-system'
import { cn } from '@/lib/utils'
import { teamService } from '@/services/team.service'
import { teamRealtime, type RealtimeMessage } from '@/services/teamRealtime'
import type { TeamMessage } from '@/types/team.types'
import type { OnlinePerson } from '@/types/presence.types'

interface ChatViewProps {
  person: OnlinePerson
  onBack: () => void
  onThreadRead?: () => void
}

const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

const dedupeById = (list: TeamMessage[]) => {
  const seen = new Set<string>()
  return list.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)))
}

export const ChatView = ({ person, onBack, onThreadRead }: ChatViewProps) => {
  const [messages, setMessages] = useState<TeamMessage[]>([])
  const [pending, setPending] = useState<TeamMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const atBottomRef = useRef(true)

  const isAtBottom = () => {
    const el = scrollRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 60
  }

  const scrollToBottom = (smooth: boolean) => {
    endRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' })
  }

  const load = async (showLoading: boolean) => {
    if (showLoading) setLoading(true)
    try {
      const data = await teamService.getThread(person.id)
      const stick = atBottomRef.current
      setMessages(data)
      onThreadRead?.()
      requestAnimationFrame(() => {
        if (showLoading || stick) scrollToBottom(!showLoading)
      })
    } catch {
      if (showLoading) setMessages([])
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  useEffect(() => {
    atBottomRef.current = true
    setPending([])
    load(true)
    const off = teamRealtime.onMessage((m: RealtimeMessage) => {
      if (m.senderId !== person.id && m.recipientId !== person.id) return
      const mine = m.senderId !== person.id
      const incoming: TeamMessage = {
        id: m.id, senderId: m.senderId, recipientId: m.recipientId, text: m.text, mine, readAt: null, sentAt: m.sentAt,
      }
      const stick = atBottomRef.current || mine
      setMessages((prev) => dedupeById([...prev, incoming]))
      if (!mine) teamService.markThreadRead(person.id).then(() => onThreadRead?.()).catch(() => undefined)
      requestAnimationFrame(() => { if (stick) scrollToBottom(true) })
    })
    return () => off()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person.id])

  const send = async () => {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    const tempId = `temp-${performance.now()}`
    const optimistic: TeamMessage = {
      id: tempId,
      senderId: 'me',
      recipientId: person.id,
      text,
      mine: true,
      readAt: null,
      sentAt: new Date().toISOString(),
    }
    setPending((p) => [...p, optimistic])
    setDraft('')
    atBottomRef.current = true
    requestAnimationFrame(() => scrollToBottom(true))
    try {
      const saved = await teamService.sendMessage(person.id, text)
      setMessages((prev) => dedupeById([...prev, saved]))
      setPending((p) => p.filter((x) => x.id !== tempId))
    } catch {
      setPending((p) => p.filter((x) => x.id !== tempId))
      setDraft(text)
    } finally {
      setSending(false)
    }
  }

  const all = dedupeById([...messages, ...pending])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border bg-surface-1 px-3 py-2">
        <IconButton title="Geri" onClick={onBack}>
          <ArrowLeftIcon className="h-4 w-4" />
        </IconButton>
        <Avatar name={person.fullName} size="sm" />
        <div className="min-w-0">
          <div className="type-body-strong truncate">{person.fullName}</div>
          <div className="type-caption">{person.online ? 'Çevrimiçi' : 'Çevrimdışı'}</div>
        </div>
      </div>

      <div ref={scrollRef} onScroll={() => (atBottomRef.current = isAtBottom())} className="min-h-0 flex-1 overflow-y-auto p-3">
        {loading ? (
          <SkeletonRows rows={4} />
        ) : all.length === 0 ? (
          <EmptyState icon={MessageSquareIcon} title="Mesaj yok" description="İlk mesajı gönderin." />
        ) : (
          <div className="space-y-2">
            {all.map((m) => (
              <div key={m.id} className={cn('flex', m.mine ? 'justify-end' : 'justify-start')}>
                <div className="max-w-[80%]">
                  <div
                    className={cn(
                      'rounded-card px-3 py-1.5 type-body break-words',
                      m.mine ? 'bg-primary text-white' : 'bg-surface-2 text-foreground-strong',
                      m.id.startsWith('temp-') && 'opacity-70',
                    )}
                  >
                    {m.text}
                  </div>
                  <div className="type-caption mt-0.5 text-right tabular-nums">{formatTime(m.sentAt)}</div>
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <div className="flex items-end gap-2 border-t border-border p-2">
        <Textarea
          rows={2}
          placeholder="Mesaj yazın…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
        />
        <Button variant="primary" size="sm" isLoading={sending} disabled={!draft.trim()} onClick={send}>
          <SendIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
