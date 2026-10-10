import { useEffect, useState } from 'react'
import { UsersIcon } from 'lucide-react'
import { DataTable, Badge, EmptyState, type DataTableColumn } from '@/design-system'
import { maskPhone } from '@/lib/utils'
import applicationsService from '@/services/applications.service'
import type { Application } from '@/types/application.types'
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_TONE } from '@/types/application.types'

interface StandingParticipantListProps {
  eventId?: string
  sessionId?: string
}

const columns: DataTableColumn<Application>[] = [
  { key: 'participantName', header: 'Katılımcı', cell: (r) => r.participantName },
  { key: 'phone', header: 'Telefon', cell: (r) => (r.phone ? maskPhone(r.phone) : '—') },
  {
    key: 'status',
    header: 'Durum',
    cell: (r) => (
      <Badge tone={APPLICATION_STATUS_TONE[r.status] ?? 'neutral'}>
        {APPLICATION_STATUS_LABELS[r.status] ?? r.status}
      </Badge>
    ),
  },
]

export const StandingParticipantList = ({ eventId, sessionId }: StandingParticipantListProps) => {
  const scoped = !!eventId || !!sessionId
  const [rows, setRows] = useState<Application[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!scoped) return
    let active = true
    const load = async () => {
      setLoading(true)
      try {
        const scope = sessionId ? { sessionId } : { eventId }
        const res = await applicationsService.getList({ ...scope, page, limit })
        if (!active) return
        setRows(res.items)
        setTotal(res.total)
        setTotalPages(res.totalPages)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [scoped, eventId, sessionId, page, limit])

  if (!scoped) {
    return (
      <EmptyState
        icon={UsersIcon}
        title="Ayakta düzen"
        description="Bu salon ayakta düzendedir; koltuk planı yoktur."
      />
    )
  }

  return (
    <DataTable<Application>
      title={`Kayıtlı Katılımcılar`}
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      loading={loading}
      showRowNumbers
      page={page}
      totalPages={totalPages}
      total={total}
      onPageChange={setPage}
      limit={limit}
      onLimitChange={(l) => { setLimit(l); setPage(1) }}
      empty={
        <EmptyState
          icon={UsersIcon}
          title="Katılımcı yok"
          description="Bu etkinliğe/seansa kayıtlı katılımcı bulunmuyor."
        />
      }
    />
  )
}
