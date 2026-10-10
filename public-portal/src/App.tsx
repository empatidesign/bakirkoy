import { Routes, Route, Navigate } from 'react-router-dom'
import { PublicLayout } from '@/components/PublicLayout'
import { HomePage } from '@/modules/home/HomePage'
import { EventsListPage } from '@/modules/events/EventsListPage'
import { FacilitiesListPage } from '@/modules/facilities/FacilitiesListPage'
import { FacilityDetailPage } from '@/modules/facilities/FacilityDetailPage'

const App = () => (
  <Routes>
    <Route element={<PublicLayout />}>
      <Route path="/" element={<HomePage />} />
      <Route path="/etkinlikler" element={<EventsListPage />} />
      <Route path="/tesisler" element={<FacilitiesListPage />} />
      <Route path="/tesisler/:id" element={<FacilityDetailPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  </Routes>
)

export default App
