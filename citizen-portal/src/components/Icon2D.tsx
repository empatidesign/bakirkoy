/**
 * Kullanıcı isteği (2026-09-17): "citizen portalın genelinde yapay zeka iconu kullanmasın,
 * ayrıca tüm sayfadaki resim icon yerine 2d icon olsun".
 *
 * Portalda ikon olarak kullanılan emojiler (🏛️ 📋 🎉 …) işletim sistemine göre farklı
 * render ediliyordu (Apple/Google/Windows üç ayrı görsel dil) ve "resim ikon" hissi
 * veriyordu. Bu dosya onların tek kaynaklı 2D karşılığıdır: düz dolgu (fill=currentColor),
 * renk ve boyut CSS'ten gelir, her platformda aynı görünür.
 *
 * Desen AuthIcon2D'den geliyor (giriş ekranlarında zaten kullanılıyordu); burada portalın
 * tamamına genişletildi. Yeni bir ikon gerektiğinde PATHS'e tek satır eklenir.
 *
 * `svgMarkup()` ise Leaflet popup'ları içindir: o balonlar React değil HTML string ile
 * üretildiği için ikonu inline <svg> olarak gömmek gerekiyor.
 */

export type Icon2DKind =
  // kurum & genel
  | 'city' | 'building' | 'landmark' | 'clipboard' | 'family' | 'bell' | 'handshake'
  | 'chart' | 'ticket' | 'phone' | 'mobile' | 'compass' | 'pin' | 'clock' | 'book'
  | 'bus' | 'star' | 'brain' | 'party' | 'medal' | 'eye' | 'pencil' | 'check' | 'close'
  | 'warning' | 'gift' | 'sos' | 'parking'
  // spor branşları
  | 'basketball' | 'badminton' | 'football' | 'pingpong' | 'volleyball'
  // saha hızlı aksiyon durumları
  | 'dot'
  // memnuniyet ölçeği yüzleri
  | 'face-1' | 'face-2' | 'face-3' | 'face-4' | 'face-5'

/** viewBox 0 0 24 24, fill="currentColor" varsayımıyla yazılmış düz 2D yollar. */
const PATHS: Record<Icon2DKind, string> = {
  city: 'M3 21V9l6-4v3l6-3v4h6v12H3Zm2-2h4v-3H5v3Zm0-5h4v-3H5v3Zm6 5h4v-3h-4v3Zm0-5h4v-3h-4v3Zm6 5h2v-3h-2v3Zm0-5h2v-3h-2v3Z',
  building: 'M4 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5h2a2 2 0 0 1 2 2v11h-8v-4h-2v4H4Zm3-13h3V6H7v3Zm0 5h3v-3H7v3Zm5-5h3V6h-3v3Zm0 5h3v-3h-3v3Z',
  landmark: 'M12 2 2 8v2h20V8L12 2ZM4 12v7H2v2h20v-2h-2v-7h-3v7h-2v-7h-2v7h-2v-7H8v7H6v-7H4Z',
  clipboard: 'M9 2h6a2 2 0 0 1 2 2h1a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1a2 2 0 0 1 2-2Zm0 2v2h6V4H9ZM7 10h10v2H7v-2Zm0 4h10v2H7v-2Z',
  family: 'M7 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm10 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20v-1.5C2 15.9 4.2 14 7 14s5 1.9 5 4.5V20H2Zm10.8 0v-1.5c0-1.6-.6-3-1.6-4 .8-.3 1.8-.5 2.8-.5 2.8 0 5 1.9 5 4.5V20h-6.2Z',
  bell: 'M12 22a2.5 2.5 0 0 0 2.5-2.5h-5A2.5 2.5 0 0 0 12 22Zm7-5v-5a7 7 0 0 0-5.5-6.8V4a1.5 1.5 0 0 0-3 0v1.2A7 7 0 0 0 5 12v5l-2 2v1h18v-1l-2-2Z',
  handshake: 'M11 5 8.5 7.5a2 2 0 0 0 0 2.8l.2.2a2 2 0 0 0 2.8 0L13 8.8l5 5V18a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-1H4a2 2 0 0 1-2-2V9l4-4h5Zm2 0h5l4 4v6a2 2 0 0 1-2 2h-.5l-5.6-5.6L13 5Z',
  chart: 'M4 21V10h4v11H4Zm6 0V3h4v18h-4Zm6 0v-7h4v7h-4Z',
  ticket: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7Zm6 1v8h2V8H9Z',
  phone: 'M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1.2 1.2 0 0 1 1.3-.3c1.4.5 2.9.7 4.3.7a1.2 1.2 0 0 1 1.2 1.2V20a1.2 1.2 0 0 1-1.2 1.2A18.2 18.2 0 0 1 2.8 3a1.2 1.2 0 0 1 1.2-1.2h3.2A1.2 1.2 0 0 1 8.4 3c0 1.5.2 2.9.7 4.3a1.2 1.2 0 0 1-.3 1.3l-2.2 2.2Z',
  mobile: 'M7 1h10a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2Zm0 4v13h10V5H7Zm4 14h2v1h-2v-1Z',
  compass: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.2 5.8-2.4 5.6a1 1 0 0 1-.5.5l-5.6 2.4 2.4-5.6a1 1 0 0 1 .5-.5l5.6-2.4ZM12 10.8a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Z',
  pin: 'M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z',
  clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 5v5.2l4 2.4-1 1.6-5-3V7h2Z',
  book: 'M4 3h10a3 3 0 0 1 3 3v15H7a3 3 0 0 1-3-3V3Zm14 0h2v18h-2V3ZM7 7v2h7V7H7Z',
  bus: 'M5 3h14a2 2 0 0 1 2 2v11a2 2 0 0 1-1 1.7V20a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H7v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2.3A2 2 0 0 1 3 16V5a2 2 0 0 1 2-2Zm0 4v5h14V7H5Zm1.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm11 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  star: 'm12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21.1 7 14.2l-5-4.9 6.9-1L12 2Z',
  brain: 'M9 2a3 3 0 0 0-3 3 3 3 0 0 0-2 5.2A3 3 0 0 0 5 16a3 3 0 0 0 3 3 2.5 2.5 0 0 0 3-2.4V4.5A2.5 2.5 0 0 0 9 2Zm6 0a2.5 2.5 0 0 0-2 2.5v12.1A2.5 2.5 0 0 0 16 19a3 3 0 0 0 3-3 3 3 0 0 0 1-5.8A3 3 0 0 0 18 5a3 3 0 0 0-3-3Z',
  party: 'm2 22 4.5-12 7.5 7.5L2 22Zm7-13.8L11.2 6l1.4 1.4-2.2 2.2L9 8.2ZM14 2h2v3h-2V2Zm5.1 1.5 1.4 1.4-2.1 2.1-1.4-1.4 2.1-2.1ZM19 10h3v2h-3v-2Zm-2.9 4.5 2.1 2.1-1.4 1.4-2.1-2.1 1.4-1.4Z',
  medal: 'M7 2h10l-2.6 5.2a6 6 0 1 1-4.8 0L7 2Zm5 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 2 .9 1.9 2.1.3-1.5 1.5.4 2-1.9-1-1.9 1 .4-2L9 14.2l2.1-.3.9-1.9Z',
  eye: 'M12 5c5 0 9 4.5 9 7s-4 7-9 7-9-4.5-9-7 4-7 9-7Zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z',
  pencil: 'M3 17.2 16.8 3.4l3.8 3.8L6.8 21H3v-3.8Zm15-12L16.6 6.6 18 8l1.4-1.4L18 5.2Z',
  check: 'M9.5 17.6 4 12.1l1.7-1.7 3.8 3.8 8.8-8.8L20 7.1 9.5 17.6Z',
  close: 'm12 10.6 5-5 1.4 1.4-5 5 5 5-1.4 1.4-5-5-5 5-1.4-1.4 5-5-5-5L7 5.6l5 5Z',
  warning: 'M12 2 1 21h22L12 2Zm-1 7h2v6h-2V9Zm0 8h2v2h-2v-2Z',
  sos: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-4.6 6.5h3v1.6h-1.4v1.1h1.4v1.6h-3V8.5Zm4 0h3v1.6h-1.4v1.1h1.4v1.6h-3V8.5Zm4 0h3v1.6h-1.4v1.1h1.4v1.6h-3V8.5ZM7 15h10v1.8H7V15Z',
  parking: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm4 4v10h2.2v-3H13a3.5 3.5 0 0 0 0-7H9Zm2.2 2H13a1.5 1.5 0 0 1 0 3h-1.8V9Z',
  gift: 'M3 11h8V9H5.5A2.5 2.5 0 1 1 8 4.5c1 0 1.8.6 2.4 1.5L12 8.4 13.6 6c.6-.9 1.4-1.5 2.4-1.5A2.5 2.5 0 1 1 18.5 9H13v2h8v4h-1v6H4v-6H3v-4Zm8 6h2v-6h-2v6Z',

  basketball: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 2.1v6.9H4.1A8 8 0 0 1 11 4.1Zm2 0A8 8 0 0 1 19.9 11H13V4.1ZM4.1 13H11v6.9A8 8 0 0 1 4.1 13Zm8.9 6.9V13h6.9a8 8 0 0 1-6.9 6.9Z',
  badminton: 'm13.8 2.2 8 8-5.1 5.1-8-8 5.1-5.1ZM7.3 8.7l8 8-1.4 1.4-1-1-3.1 3.1a3 3 0 1 1-4.2-4.2l3.1-3.1-1-1 1.6-1.6a3 3 0 0 0-2-2.6Z',
  football: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 3.2 3.4 2.5-1.3 4h-4.2l-1.3-4L12 5.2ZM5.2 9.9l2.6 2-1.3 4-2.5-.9a8 8 0 0 1 1.2-5.1Zm13.6 0a8 8 0 0 1 1.2 5.1l-2.5.9-1.3-4 2.6-2ZM9.3 19.4l1.6-2.4h2.2l1.6 2.4a8 8 0 0 1-5.4 0Z',
  pingpong: 'M14.8 2.3a7.5 7.5 0 0 1 3 12.4l-1.3 1.3-8.4-8.4 1.3-1.3a7.5 7.5 0 0 1 5.4-4ZM7 9.1l7.9 7.9-2.3 2.3a3 3 0 0 1-4.2 0l-3.7-3.7a3 3 0 0 1 0-4.2L7 9.1Zm12 8a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z',
  volleyball: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 2.1v5.4l-4.7 2.7-1.9-1.1A8 8 0 0 1 11 4.1Zm2 .2a8 8 0 0 1 5.9 5.2l-4.7 2.7-1.2-.7V4.3ZM4.1 12.7l1.9 1.1v5.4a8 8 0 0 1-1.9-6.5Zm15.6-.5a8 8 0 0 1-3.2 6.7l-2.7-4.7 1.2-.7 4.7-1.3ZM8 20a8 8 0 0 0 5.4.7l-2.7-4.7H8V20Z',

  dot: 'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z',

  'face-1': 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM8.5 10a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm7 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3ZM12 13.5c-2.2 0-4.1 1.3-5 3.2l1.8.9c.6-1.3 1.8-2.1 3.2-2.1s2.6.8 3.2 2.1l1.8-.9c-.9-1.9-2.8-3.2-5-3.2Z',
  'face-2': 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM8.5 10a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm7 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3ZM7.6 16.4l.8-1.8c1.1-.5 2.3-.8 3.6-.8s2.5.3 3.6.8l.8 1.8c-1.3-.7-2.8-1-4.4-1s-3.1.3-4.4 1Z',
  'face-3': 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM8.5 10a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm7 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3ZM8 15h8v2H8v-2Z',
  'face-4': 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM8.5 10a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm7 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3ZM12 17.5c-2.2 0-4.1-1.3-5-3.2l1.8-.9c.6 1.3 1.8 2.1 3.2 2.1s2.6-.8 3.2-2.1l1.8.9c-.9 1.9-2.8 3.2-5 3.2Z',
  'face-5': 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM8.5 10a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm7 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3ZM6.5 13h11c0 3-2.5 5.3-5.5 5.3S6.5 16 6.5 13Z',
}

export const Icon2D = ({
  kind,
  className = 'h-4 w-4',
  style,
}: {
  kind: Icon2DKind
  className?: string
  style?: React.CSSProperties
}) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className} style={style} fill="currentColor">
    <path d={PATHS[kind]} />
  </svg>
)

/**
 * Leaflet popup'ları innerHTML ile kuruluyor; oraya React bileşeni geçilemediği için
 * aynı yolu inline <svg> string'i olarak veriyoruz. `size` px, `color` CSS rengi.
 */
export const svgMarkup = (kind: Icon2DKind, size = 13, color = 'currentColor') =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${color}" aria-hidden="true" style="vertical-align:-2px;flex-shrink:0"><path d="${PATHS[kind]}"/></svg>`
