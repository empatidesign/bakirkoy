import axios from 'axios'

const API_URL = (import.meta.env.VITE_API_URL as string) || ''
const API_KEY = (import.meta.env.VITE_API_KEY as string) || ''

// Bu portal token'sız, herkese açık bir görüntüleme servisidir. Kimlik doğrulaması
// yoktur; erişim yalnızca sabit bir X-Api-Key (PublicApi:ApiKeys, Vault'tan) ile
// sınırlanır. Hiçbir başvuru/işlem endpoint'i çağrılmaz — sadece GET /public/*.
export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: API_KEY ? { 'X-Api-Key': API_KEY } : undefined,
  timeout: 15000,
})
