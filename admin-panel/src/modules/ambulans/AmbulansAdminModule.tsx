import { useState } from 'react'
import {
  AmbulanceIcon,
  CalendarDaysIcon,
  FileCheckIcon,
  SearchIcon,
  SmartphoneIcon,
  BarChart3Icon,
  ShieldCheckIcon,
  Building2Icon
} from 'lucide-react'
import { Tabs } from '@/design-system'
import { AmbulanceOperationsTimeline } from './AmbulanceOperationsTimeline'
import { AmbulanceApplicationsReview } from './AmbulanceApplicationsReview'
import { AmbulanceFleetManagement } from './AmbulanceFleetManagement'
import { AmbulanceDriverSimulator } from './AmbulanceDriverSimulator'
import { AmbulanceAnalyticsHeatmap } from './AmbulanceAnalyticsHeatmap'
import { AmbulanceAuditLogsView } from './AmbulanceAuditLogsView'
import { IstanbulHospitalsTab } from './IstanbulHospitalsTab'
import { PatientLookupPanel } from './PatientLookupPanel'
import { ISTANBUL_HOSPITALS } from './hospitalsData'
import {
  INITIAL_VEHICLES,
  INITIAL_CREWS,
  INITIAL_APPLICATIONS,
  INITIAL_AUDIT_LOGS
} from './mockData'
import { AmbulanceApplication, OperationTask, OperationStep } from './types'

interface Props {
  operations: OperationTask[]
  setOperations: React.Dispatch<React.SetStateAction<OperationTask[]>>
}

type SubTab = 'timeline' | 'lookup' | 'applications' | 'hospitals' | 'fleet' | 'driver' | 'analytics' | 'audit'

export const AmbulansAdminModule = ({ operations, setOperations }: Props) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('timeline')
  
  const [vehicles, setVehicles] = useState(INITIAL_VEHICLES)
  const [crews] = useState(INITIAL_CREWS)
  const [applications, setApplications] = useState<AmbulanceApplication[]>(INITIAL_APPLICATIONS)
  const [auditLogs, setAuditLogs] = useState(INITIAL_AUDIT_LOGS)

  const handleUpdateStep = (taskId: string, nextStep: OperationStep) => {
    setOperations(prev =>
      prev.map(task => (task.id === taskId ? { ...task, step: nextStep } : task))
    )

    const newLog = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      actorName: 'Mustafa Çelik',
      actorRole: 'Ambulans Şoförü',
      action: `DURUM_${nextStep}`,
      targetTrackingNo: operations.find(o => o.id === taskId)?.trackingNo || 'AMB-GÖREV',
      details: `Görev adımı "${nextStep}" olarak güncellendi. GPS koordinatı işlendi.`,
      ipAddress: '10.24.112.5'
    }
    setAuditLogs(prev => [newLog, ...prev])
  }

  const handleReassignAmbulance = (taskId: string, targetAmbulanceId: string) => {
    const targetVeh = vehicles.find(v => v.id === targetAmbulanceId)
    setOperations(prev =>
      prev.map(task =>
        task.id === taskId
          ? {
              ...task,
              ambulanceId: targetAmbulanceId,
              ambulancePlate: targetVeh ? targetVeh.plate : task.ambulancePlate
            }
          : task
      )
    )

    const newLog = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      actorName: 'Operasyon Sorumlusu',
      actorRole: 'Dispatcher',
      action: 'GÖREV_AKTARILDI',
      targetTrackingNo: operations.find(o => o.id === taskId)?.trackingNo || 'AMB-GÖREV',
      details: `Görev ${targetVeh?.plate || targetAmbulanceId} ambulansına aktarıldı.`,
      ipAddress: '192.168.10.12'
    }
    setAuditLogs(prev => [newLog, ...prev])
  }

  const handleRunOptimization = () => {
    setVehicles(prev =>
      prev.map(v => ({
        ...v,
        workloadScoreToday: Math.round(50 + Math.random() * 15)
      }))
    )

    const newLog = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      actorName: 'Akıllı Dağıtım Motoru',
      actorRole: 'Sistem',
      action: 'OTOMATIK_OPTIMIZASYON',
      targetTrackingNo: 'TÜM_FILO',
      details: 'Adil Görev Yükü Puanı algoritması çalıştırıldı, görevler dengelendi.',
      ipAddress: '127.0.0.1'
    }
    setAuditLogs(prev => [newLog, ...prev])
  }

  const handleApproveApp = (appId: string, notes: string) => {
    setApplications(prev =>
      prev.map(a =>
        a.id === appId
          ? {
              ...a,
              status: 'ONAYLANDI',
              reviewNotes: notes,
              history: [
                ...a.history,
                {
                  status: 'ONAYLANDI',
                  timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
                  actor: 'Sağlık İşleri Müdürü',
                  note: notes
                }
              ]
            }
          : a
      )
    )

    const newLog = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      actorName: 'Sağlık İşleri Müdürü',
      actorRole: 'Yönetici',
      action: 'BAŞVURU_ONAYLANDI',
      targetTrackingNo: applications.find(a => a.id === appId)?.applicationNo || 'AMB',
      details: `Başvuru onaylandı. Not: ${notes}`,
      ipAddress: '192.168.10.45'
    }
    setAuditLogs(prev => [newLog, ...prev])
  }

  const handleRejectApp = (appId: string, reason: string) => {
    setApplications(prev =>
      prev.map(a =>
        a.id === appId
          ? {
              ...a,
              status: 'REDDEDILDI',
              reviewNotes: reason,
              history: [
                ...a.history,
                {
                  status: 'REDDEDILDI',
                  timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
                  actor: 'Değerlendirme Hekimi',
                  note: reason
                }
              ]
            }
          : a
      )
    )
  }

  const handleRequestDoc = (appId: string, note: string) => {
    setApplications(prev =>
      prev.map(a =>
        a.id === appId
          ? {
              ...a,
              status: 'EKSIK_BELGE',
              reviewNotes: note,
              history: [
                ...a.history,
                {
                  status: 'EKSIK_BELGE',
                  timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
                  actor: 'Operatör',
                  note
                }
              ]
            }
          : a
      )
    )
  }

  return (
    <div className="space-y-4">
      <Tabs
        variant="pill"
        value={activeSubTab}
        onValueChange={(key) => setActiveSubTab(key as SubTab)}
        tabs={[
          { key: 'timeline', label: 'Operasyon Ajandası & Gantt', icon: CalendarDaysIcon },
          { key: 'lookup', label: 'Hasta Sorgula (Çağrı Merkezi)', icon: SearchIcon },
          { key: 'applications', label: 'Başvuru & Evrak İnceleme', icon: FileCheckIcon, count: applications.length },
          { key: 'hospitals', label: 'İstanbul Hastaneleri & Rotalar', icon: Building2Icon, count: ISTANBUL_HOSPITALS.length },
          { key: 'fleet', label: 'Filo, Ekip & Bakım', icon: AmbulanceIcon, count: vehicles.length },
          { key: 'driver', label: 'Şoför Mobil Terminali', icon: SmartphoneIcon },
          { key: 'analytics', label: 'Isı Haritası & Raporlama', icon: BarChart3Icon },
          { key: 'audit', label: 'Denetim İzi', icon: ShieldCheckIcon },
        ]}
      />

      {activeSubTab === 'timeline' && (
        <AmbulanceOperationsTimeline
          operations={operations}
          vehicles={vehicles}
          crews={crews}
          onUpdateStep={handleUpdateStep}
          onReassignAmbulance={handleReassignAmbulance}
          onRunOptimization={handleRunOptimization}
        />
      )}

      {activeSubTab === 'lookup' && (
        <PatientLookupPanel
          operations={operations}
          vehicles={vehicles}
          crews={crews}
        />
      )}

      {activeSubTab === 'applications' && (
        <AmbulanceApplicationsReview
          applications={applications}
          onApprove={handleApproveApp}
          onReject={handleRejectApp}
          onRequestDocument={handleRequestDoc}
        />
      )}

      {activeSubTab === 'hospitals' && (
        <IstanbulHospitalsTab />
      )}

      {activeSubTab === 'fleet' && (
        <AmbulanceFleetManagement
          vehicles={vehicles}
          crews={crews}
          onUpdateVehicleStatus={(vehId, status) => {
            setVehicles(prev =>
              prev.map(v => (v.id === vehId ? { ...v, status } : v))
            )
          }}
        />
      )}

      {activeSubTab === 'driver' && (
        <AmbulanceDriverSimulator
          tasks={operations}
          onStepChange={handleUpdateStep}
        />
      )}

      {activeSubTab === 'analytics' && (
        <AmbulanceAnalyticsHeatmap />
      )}

      {activeSubTab === 'audit' && (
        <AmbulanceAuditLogsView logs={auditLogs} />
      )}
    </div>
  )
}
