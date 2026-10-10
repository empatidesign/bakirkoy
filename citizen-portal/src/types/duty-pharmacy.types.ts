export interface CitizenDutyPharmacy {
  id: string
  name: string
  phone: string | null
  directions: string | null
  address: string | null
  neighborhood: string | null
  district: string
  latitude: number | null
  longitude: number | null
  dutyEndTime: string | null
  dutyDate: string
  syncedAt: string
  /**
   * true ise gösterilen liste BUGÜNE ait değil (dutyDate < bugün).
   * Backend "bugünün tarihi"ne göre değil "tablodaki en son tarihe" göre
   * döndürür; senkron görevi bir gece çalışmazsa dünün listesi gelir.
   * Liste gizlenmez (nöbet gece yarısını aşar, sabaha karşı hâlâ geçerli
   * olabilir) ama kullanıcı uyarılmalıdır.
   * Bkz. uçtan uca test 2026-09-21, bulgu J1.
   */
  isStale?: boolean
}
