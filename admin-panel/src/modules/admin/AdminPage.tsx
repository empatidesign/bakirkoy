import { useSearchParams } from 'react-router-dom'
import { ShieldIcon, UserIcon, Building2Icon, BellIcon, SendIcon } from 'lucide-react'
import { PageHeader, Tabs, SectionToolbar, Card, EmptyState, Button } from '@/design-system'
import { UiStandardsContext } from '@/design-system/UiStandards/UiStandards'
import '@/templates/FacilityTemplate/pilot/facility-ui.css'
import { useAuth } from '@/framework/auth/AuthContext'
import { AdminsTab } from './AdminsTab'
import { DepartmentsTab } from './DepartmentsTab'
import { RolesTab } from './RolesTab'
import { BulkOperationsTab } from './BulkOperationsTab'

type ActiveTab = 'admins' | 'departments' | 'roles' | 'bulk-operations' | 'notifications'

const Placeholder = ({
  icon: Icon, title, subtitle, addLabel, description,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle: string
  addLabel: string
  description: string
}) => (
  <>
    <SectionToolbar icon={Icon} title={title} subtitle={subtitle}
      actions={<Button variant="primary" size="sm" disabled>+ {addLabel}</Button>} />
    <Card className="py-4">
      <EmptyState icon={Icon} title={title} description={description} />
    </Card>
  </>
)

export const AdminPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const { can } = useAuth()
  const activeTab = (searchParams.get('tab') ?? 'admins') as ActiveTab
  const editRequestId = searchParams.get('edit')
  const createRole = searchParams.get('create') ? (searchParams.get('role') ?? '') : null
  const setTab = (tab: string) =>
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('tab', tab); return n })
  const clearEditRequest = () =>
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.delete('edit'); return n }, { replace: true })
  const clearCreateRequest = () =>
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.delete('create'); n.delete('role'); return n }, { replace: true })

  return (
    <UiStandardsContext.Provider value={true}>
      <div className="facility-ui-pilot pilot-page-shell flex h-full flex-col">
        <PageHeader
          icon={ShieldIcon}
          title="Yönetici Hesap Yönetimi"
          subtitle="Yöneticiler, departmanlar, roller ve yetkiler"
          breadcrumb="Sistem / Yönetici Hesapları"
        />

        <Tabs
          value={activeTab}
          onValueChange={setTab}
          tabs={[
            { key: 'admins', label: 'Yöneticiler', icon: UserIcon },
            { key: 'roles', label: 'Roller', icon: ShieldIcon },
            { key: 'departments', label: 'Departmanlar', icon: Building2Icon },
            ...(can('sms-send.assign') ? [{ key: 'bulk-operations', label: 'Toplu İşlemler', icon: SendIcon }] : []),
            { key: 'notifications', label: 'Bildirimler', icon: BellIcon },
          ]}
        />

        <div className="pilot-content flex-1 space-y-4 overflow-auto">
          {activeTab === 'admins' && (
            <AdminsTab editRequestId={editRequestId} onEditRequestHandled={clearEditRequest} createRole={createRole} onCreateRequestHandled={clearCreateRequest} />
          )}
          {activeTab === 'departments' && <DepartmentsTab />}
          {activeTab === 'roles' && <RolesTab />}
          {activeTab === 'bulk-operations' && can('sms-send.assign') && <BulkOperationsTab />}
          {activeTab === 'notifications' && (
            <Placeholder icon={BellIcon} title="Bildirimler" subtitle="Yöneticilere yönelik sistem bildirimleri" addLabel="Bildirim Gönder"
              description="Yöneticilere yönelik sistem bildirimleri buradan yönetilecek (backend hazırlanıyor)." />
          )}
        </div>
      </div>
    </UiStandardsContext.Provider>
  )
}
