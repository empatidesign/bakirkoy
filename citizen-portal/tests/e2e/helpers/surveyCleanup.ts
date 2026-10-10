/**
 * Kullanıcı isteği (2026-09-02): analiz ekranları GERÇEK ve gerçekçi veri göstermeli.
 *
 * Hata bulgusu (2026-09-02): E2E testleri her koşumda kalıcı anket oluşturup hiç
 * silmiyordu ("GPS Takip E2E xxxx", "Mahalle Sorun Tespiti xxxx", "Kapsam Testi xxxx").
 * Biriken bu anketler ÜRETİM ANALİTİĞİNE karışıyordu: tek bir mahallede (Cebeci)
 * yanıt sayısı 170 yerine 417'ye çıkmış ve yaş dağılımı %24 yerine %41.7 görünmüştü.
 * Yani Mahalle Analizi ekranı yöneticiye yanlış demografi gösteriyordu.
 *
 * Çözüm: test kendi ürettiği anketi kaydeder ve bittiğinde siler. Silme başarısız
 * olsa bile test sonucunu ETKİLEMEZ (temizlik, doğrulamanın kendisi değildir).
 *
 * Kullanım:
 *   const trash = new SurveyTrash(API_BASE, adminToken)
 *   trash.add(surveyId)
 *   test.afterAll(() => trash.purge())
 */
export class SurveyTrash {
  private readonly ids = new Set<string>()

  constructor(
    private readonly apiBase: string,
    private readonly tokenProvider: () => Promise<string>,
  ) {}

  /** Testin oluşturduğu anketi temizlik listesine ekler. */
  add(surveyId: string | undefined | null): void {
    if (surveyId) this.ids.add(surveyId)
  }

  /** Biriken anketleri siler. Hata yutulur; temizlik testi düşürmemeli. */
  async purge(): Promise<void> {
    if (this.ids.size === 0) return
    let token: string
    try {
      token = await this.tokenProvider()
    } catch {
      return // yönetici oturumu alınamadıysa sessizce vazgeç
    }
    for (const id of this.ids) {
      try {
        // Silme ucu kasıtlı olarak onay cümlesi ister (SurveyDeleteRules.ConfirmationPhrase);
        // yanlışlıkla anket silinmesini engelleyen bu koruma testte de sağlanmalıdır.
        await fetch(`${this.apiBase}/surveys/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmation: 'silmek istiyorum' }),
        })
      } catch {
        // yok say: temizlik en iyi çaba ilkesiyle çalışır
      }
    }
    this.ids.clear()
  }
}
