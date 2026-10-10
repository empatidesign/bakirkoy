import { CompanyRedeemPageBody } from '@/modules/companyApp/CompanyRedeemPage'
import { useCompanyStaffAuth } from '@/framework/companyStaffAuth/CompanyStaffAuthContext'

export const CompanyStaffRedeemPage = () => {
  const { state } = useCompanyStaffAuth()
  const company = state.status === 'authenticated' ? state.company : undefined
  const isApproved = company?.status === 'Approved'
  return <CompanyRedeemPageBody isApproved={isApproved} />
}
