// @vitest-environment jsdom
import { StrictMode } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { BypassPage } from './BypassPage'
import { tokenStorage } from '@/services/tokenStorage'

/**
 * Canlı hata (2026-09-23): admin panel "Katılımcılar" ekranından portala geçerken
 * "Geçersiz veya süresi dolmuş bypass kodu".
 *
 * Bypass kodu backend'de TEK KULLANIMLIK (Redis GETDEL). Bu yüzden takas isteğinin
 * component ömründe yalnızca BİR KEZ gitmesi ZORUNLUDUR. React.StrictMode (portal
 * index.tsx'te açık) effect'leri mount->unmount->remount ile iki kez çalıştırdığı
 * için koruma olmadan ikinci istek kodu yanmış bulur ve kullanıcı hata ekranı görür.
 *
 * Bu test gerçek StrictMode altında gerçek bir DOM'a render eder; sahte bir
 * "iki kez çağır" simülasyonu değildir.
 */

const postMock = vi.fn()

// React'in act(...) desteğini etkinleştirir; aksi hâlde effect'ler act içinde
// düzgün boşaltılamaz ve render döngüye girebilir.
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/services/api', () => ({
  api: { post: (...args: unknown[]) => postMock(...args) },
}))

vi.mock('@/services/tokenStorage', () => ({
  tokenStorage: {
    clearBypassSession: vi.fn(),
    setBypassTokens: vi.fn(),
    setBypassKind: vi.fn(),
  },
}))

// Bu iki fonksiyon effect'in bağımlılık dizisinde yer alıyor. Gerçek uygulamada
// useCallback ile SABİT referanslardır; testte de sabit tutulmalıdır, aksi hâlde
// her render yeni referans üretir ve effect sonsuz döngüye girer (testin kendi
// kusuru olur, bileşenin değil).
const refreshUserMock = vi.fn().mockResolvedValue(undefined)
const refreshCompanyMock = vi.fn().mockResolvedValue(undefined)

vi.mock('@/framework/auth/AuthContext', () => ({
  useAuth: () => ({ refreshUser: refreshUserMock }),
}))

vi.mock('@/framework/companyAuth/CompanyAuthContext', () => ({
  useCompanyAuth: () => ({ refreshCompany: refreshCompanyMock }),
}))

describe('BypassPage tek kullanımlık kod', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    postMock.mockReset()
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  it('StrictMode altında takas isteğini yalnızca BİR KEZ gönderir', async () => {
    // Backend davranışını taklit et: ilk çağrı başarılı, kod tükenir; ikinci
    // çağrı gerçek sunucudaki gibi "geçersiz kod" hatası verir.
    let calls = 0
    postMock.mockImplementation(async () => {
      calls += 1
      if (calls > 1) throw new Error('BYPASS_CODE_INVALID')
      return { data: { data: { accessToken: 'a', refreshToken: 'r', user: {}, sessionConfig: {} } } }
    })

    await act(async () => {
      createRoot(container).render(
        <StrictMode>
          <MemoryRouter initialEntries={['/bypass?code=ABC123']}>
            <BypassPage />
          </MemoryRouter>
        </StrictMode>,
      )
    })

    expect(postMock).toHaveBeenCalledTimes(1)
    // Hata ekranı görünmemeli: kullanıcı geçerli bir bağlantıyla geldi.
    expect(container.textContent).not.toContain('Geçersiz veya süresi dolmuş')
  })

  it('takas başarılı olduğunda token saklanır (sahte unmount sonucu atmaz)', async () => {
    // NOT (dürüstlük): Bu test düzeltme olmadan da geçer, çünkü StrictMode'un
    // sahte unmount'u bu senaryoda token yazımından SONRA gerçekleşiyor. Regresyon
    // koruması olarak tutuluyor. Asıl kanıt yukarıdaki testtedir: düzeltme geri
    // alındığında "2 kez çağrıldı" diyerek düşer (gerçek çalıştırmayla doğrulandı).
    postMock.mockResolvedValue({
      data: { data: { accessToken: 'acc', refreshToken: 'ref', user: {}, sessionConfig: {} } },
    })

    await act(async () => {
      createRoot(container).render(
        <StrictMode>
          <MemoryRouter initialEntries={['/bypass?code=XYZ']}>
            <BypassPage />
          </MemoryRouter>
        </StrictMode>,
      )
    })

    // Eski kodda StrictMode'un sahte unmount'u active=false yapıp başarılı
    // yanıtı ÇÖPE ATIYORDU; kod yanmış ama oturum açılmamış oluyordu.
    expect(tokenStorage.setBypassTokens).toHaveBeenCalledWith('acc', 'ref')
  })
})
