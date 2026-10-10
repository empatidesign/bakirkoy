import { CompanyCampaignsPageBody } from '@/modules/companyApp/CompanyCampaignsPage'
import { useCompanyStaffAuth } from '@/framework/companyStaffAuth/CompanyStaffAuthContext'

export const CompanyStaffCampaignsPage = () => {
  const { state } = useCompanyStaffAuth()
  const company = state.status === 'authenticated' ? state.company : undefined
  const isApproved = company?.status === 'Approved'
  return (
    <CompanyCampaignsPageBody
      isApproved={isApproved}
      statusBanner={company ? { status: company.status, rejectReason: company.rejectReason } : undefined}
    />
  )
}
