/**
 * Ortak HTML escape yardımcısı. Leaflet/Google Maps harita popup'larında
 * kullanıcı/firma kontrollü serbest metin (başlık, alt başlık, adres vb.)
 * `innerHTML`/`bindPopup` ile enjekte edilmeden önce bu fonksiyondan geçmelidir.
 *
 * 2026-07-30 denetiminde tespit edildi: bu fonksiyon önceden 4 farklı dosyada
 * (LiveMapPage, MemberBusinessesTab, EmergencyAreaMapTab, DutyPharmacyMapTab)
 * ayrı ayrı tanımlanmıştı (DRY ihlali) ve hiçbiri tek tırnağı (`'`) kaçırmıyordu.
 * Mevcut kullanım bağlamlarında (çift tırnaklı attribute'lar, düz metin içerik)
 * bu pratikte sömürülebilir değildi, ama gelecekte bu değerlerin tek tırnaklı
 * bir attribute içine konulması ihtimaline karşı savunma derinliği olarak
 * tek tırnak da eklendi ve tek bir ortak dosyaya taşındı.
 */
export const escapeHtml = (s: string): string =>
  s.replace(/[<>&"']/g, (c) => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] ?? c
  ))
