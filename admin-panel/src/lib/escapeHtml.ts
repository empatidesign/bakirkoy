/**
 * Ortak HTML escape yardımcısı. Leaflet harita popup'larında kullanıcı/backend
 * kontrollü serbest metin (isim, adres, açıklama vb.) `innerHTML`/`bindPopup`
 * ile enjekte edilmeden önce bu fonksiyondan geçmelidir.
 *
 * 2026-07-30 denetiminde tespit edildi: bu fonksiyon önceden 3 farklı dosyada
 * (FacilityMap, EmergencyAreaMap, SubmissionMap) ayrı ayrı tanımlanmıştı
 * (DRY ihlali) — mantık aynıydı (tek tırnak dahil tüm özel karakterler
 * kaçırılıyordu, exploit edilebilir bir açık yoktu), ama kopyala-yapıştır
 * ile 3 yerde tekrarlanan bir güvenlik kontrolü, yeni bir alan eklenip
 * escape edilmesi unutulursa kolayca XSS'e dönüşebilecek bir tasarım
 * kokusuydu. Tek ortak dosyaya taşındı.
 */
export const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;'
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      default: return '&#39;'
    }
  })
