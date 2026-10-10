import axios from 'axios'

export interface SystemBrandingData {
  logoUrl: string | null
  horizontalLogoUrl: string | null
  updatedAt: string | null
}

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

const systemBrandingService = {
  /**
   * Anonim uç noktayı düz axios ile çağırır (auth interceptor'ından bağımsız)
   * ki oturum yokken/401 durumunda global 401 handler'ın sayfayı /login'e
   * reload atmasına yol açmasın.
   */
  async get(): Promise<SystemBrandingData> {
    const res = await axios.get<{ data: SystemBrandingData }>(
      `${BASE_URL}/api/v1/public/system-branding`,
    )
    return res.data.data
  },
}

export default systemBrandingService
