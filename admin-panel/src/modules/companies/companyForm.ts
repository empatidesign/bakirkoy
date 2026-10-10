import { isValidEmail } from '@/design-system'
import type { Company, CompanyInput } from '@/types/company.types'
import { DEFAULT_COMPANY_DISTRICT } from '@/types/company.types'

export interface CompanyForm {
  name: string
  taxNumber: string
  phone: string
  email: string
  address: string
  district: string
  logo: string
  bannerImage: string
  bannerImageMobile: string
  description: string
  website: string
  facebook: string
  instagram: string
  twitter: string
  linkedin: string
  serviceCategoryId: string
  latitude?: number
  longitude?: number
}

export const emptyCompanyForm: CompanyForm = {
  name: '',
  taxNumber: '',
  phone: '',
  email: '',
  address: '',
  district: DEFAULT_COMPANY_DISTRICT,
  logo: '',
  bannerImage: '',
  bannerImageMobile: '',
  description: '',
  website: '',
  facebook: '',
  instagram: '',
  twitter: '',
  linkedin: '',
  serviceCategoryId: '',
  latitude: undefined,
  longitude: undefined,
}

export const toCompanyForm = (r: Company): CompanyForm => ({
  name: r.name,
  taxNumber: r.taxNumber,
  phone: r.phone ?? '',
  email: r.email ?? '',
  address: r.address ?? '',
  district: r.district || DEFAULT_COMPANY_DISTRICT,
  logo: r.logo ?? '',
  bannerImage: r.bannerImage ?? '',
  bannerImageMobile: r.bannerImageMobile ?? '',
  description: r.description ?? '',
  website: r.website ?? '',
  facebook: r.socialMedia?.facebook ?? '',
  instagram: r.socialMedia?.instagram ?? '',
  twitter: r.socialMedia?.twitter ?? '',
  linkedin: r.socialMedia?.linkedin ?? '',
  serviceCategoryId: r.serviceCategory?.id ?? '',
  latitude: r.latitude,
  longitude: r.longitude,
})

export const toCompanyInput = (f: CompanyForm): CompanyInput => {
  const social = {
    facebook: f.facebook.trim() || undefined,
    instagram: f.instagram.trim() || undefined,
    twitter: f.twitter.trim() || undefined,
    linkedin: f.linkedin.trim() || undefined,
  }
  const hasSocial = social.facebook || social.instagram || social.twitter || social.linkedin
  return {
    name: f.name.trim(),
    taxNumber: f.taxNumber.trim(),
    phone: f.phone,
    email: f.email.trim() || undefined,
    address: f.address.trim(),
    district: f.district.trim() || DEFAULT_COMPANY_DISTRICT,
    logo: f.logo || undefined,
    bannerImage: f.bannerImage || undefined,
    bannerImageMobile: f.bannerImageMobile || undefined,
    description: f.description.trim() || undefined,
    website: f.website.trim() || undefined,
    socialMedia: hasSocial ? social : undefined,
    serviceCategoryId: f.serviceCategoryId || undefined,
    latitude: f.latitude,
    longitude: f.longitude,
  }
}

export const getCompanyFormErrors = (f: CompanyForm): string[] => [
  !f.name.trim() && 'Firma adı zorunludur.',
  f.taxNumber.trim().length !== 10 && 'Vergi numarası 10 haneli olmalıdır.',
  f.phone.length !== 11 && 'Geçerli bir telefon numarası giriniz.',
  f.email.trim() && !isValidEmail(f.email) && 'Geçerli bir e-posta adresi giriniz.',
  !f.address.trim() && 'Adres zorunludur.',
  !f.serviceCategoryId && 'Hizmet kategorisi seçimi zorunludur.',
].filter(Boolean) as string[]
