/**
 * Test Data Factory — kullanıcı/kayıt üretimi (QA gap #9 — 2026-09-04).
 *
 * Repoda `tests/factories/` klasörü hiç yoktu; test verisi her spec dosyasının
 * içine inline yazılıyordu. Bu dosya ilk factory'yi kurar ve deseni gösterir.
 * Üretilen tüm değerler `qaTestData.ts`'deki standart prefix'i kullanır, böylece
 * `cleanupQaTestData()` ile tek seferde temizlenebilirler.
 */
import { qaTestEmail, qaTestPhone, qaTestValue } from '../e2e/helpers/qaTestData'
import { isStrongPassword } from '../../src/lib/password'

export interface TestPasswordChangeInput {
  currentPassword: string
  newPassword: string
}

/**
 * Şifre değiştirme testi için geçerli bir yeni şifre üretir. Uygulamanın kendi
 * `isStrongPassword` kuralına göre üretir (en az 8 karakter, 1 büyük harf, 1
 * rakam — bkz. `src/lib/password.ts`) böylece factory ile gerçek validasyon
 * kuralı arasında asla drift olmaz.
 */
export function createTestPasswordChange(currentPassword: string): TestPasswordChangeInput {
  // Rastgele ama garanti olarak güçlü: sabit "Qa" (büyük harf şartı) + benzersiz
  // random suffix (qaTestValue) + sabit rakam ("9", rakam şartı). isStrongPassword
  // ile assert edilerek üretim ile kural arasında sessiz drift önlenir.
  const uniqueSuffix = qaTestValue('Pw').replace(/[^A-Za-z0-9]/g, '')
  const candidate = `Qa${uniqueSuffix}9`
  if (!isStrongPassword(candidate)) {
    throw new Error(
      `createTestPasswordChange ürettiği şifre isStrongPassword kuralını geçemedi: "${candidate}". ` +
        `Bu, factory ile src/lib/password.ts kuralı arasında bir uyumsuzluk anlamına gelir — factory'yi güncelle.`,
    )
  }
  return { currentPassword, newPassword: candidate }
}

export interface TestCustomerInput {
  fullName: string
  email: string
  phone: string
}

/**
 * Genel amaçlı "müşteri/vatandaş" test kaydı üretir. Master prompt'un
 * `createTestCustomer()` örneğine karşılık gelir (madde 6) — admin-panel'deki
 * CRUD testlerinde (participants, companies vb.) kullanılabilecek jenerik şablon.
 */
export function createTestCustomer(overrides: Partial<TestCustomerInput> = {}): TestCustomerInput {
  return {
    fullName: qaTestValue('Vatandaş'),
    email: qaTestEmail(),
    phone: qaTestPhone(),
    ...overrides,
  }
}

export interface TestCompanyInput {
  name: string
  taxNumber: string
  phone: string
  email: string
}

/** Master prompt'un `createTestCompany()` örneğine karşılık gelir. */
export function createTestCompany(overrides: Partial<TestCompanyInput> = {}): TestCompanyInput {
  // Vergi numarası formatı gerçek bir algoritmik VKN değil (10 haneli, checksum'lı);
  // burada sadece "10 haneli benzersiz sayı" üretiliyor — gerçek VKN validasyonu
  // test edilecekse ayrı bir `createValidVkn()` yazılmalı, bu factory'nin kapsamı dışı.
  const taxNumber = String(Math.floor(1000000000 + Math.random() * 8999999999)).slice(0, 10)
  return {
    name: qaTestValue('Firma'),
    taxNumber,
    phone: qaTestPhone(),
    email: qaTestEmail(),
    ...overrides,
  }
}
