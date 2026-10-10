/**
 * Tam ekran gündüz illüstrasyonu — Yönetim Portalı girişi.
 *
 * Kullanıcı isteği (2026-10-08): "tasarımı tamamen değiştir, halen istediğim
 * gibi olmadı" — önceki tasarım (koyu lacivert, gece, 50/50 split-screen)
 * Sultangazi'nin iskeletiyle aynıydı (sadece metin/renk farklıydı). Bu sürüm
 * yapısal olarak farklı: tüm ekranı kaplayan GÜNDÜZ illüstrasyonu üzerinde
 * yüzen bir cam panel (glass card) kullanılıyor; "kurumsal/idari" hissi için
 * sahne Bakırköy Belediye binası + bulvar + bayrak etrafında kurgulandı
 * (vatandaş portalındaki sahil/vapur sahnesinden bilinçli olarak farklı).
 *
 * Saf SVG, dış bağımlılık yok. preserveAspectRatio="xMidYMid slice" ile
 * `position:fixed; inset:0; width:100%; height:100%` kapsayıcıda tam ekran
 * arka plan olarak kullanılır.
 */
export const BakirkoySkylineArt = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" className={className} role="img" aria-label="Bakırköy Belediyesi bulvarı illüstrasyonu" fill="none">
    <defs>
      <linearGradient id="bka-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#CDEBFB" />
        <stop offset=".55" stopColor="#E8F5FC" />
        <stop offset="1" stopColor="#F7FBFD" />
      </linearGradient>
      <radialGradient id="bka-sun" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#FFF3C9" stopOpacity=".95" />
        <stop offset="1" stopColor="#FFF3C9" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="bka-ground" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#EFEAE0" />
        <stop offset="1" stopColor="#E2DACB" />
      </linearGradient>
      <linearGradient id="bka-building" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#F8FAFC" />
        <stop offset="1" stopColor="#DDE6EF" />
      </linearGradient>
    </defs>

    {/* Gökyüzü */}
    <rect x="0" y="0" width="1920" height="1080" fill="url(#bka-sky)" />
    <circle cx="1560" cy="190" r="260" fill="url(#bka-sun)" />
    <circle cx="1560" cy="190" r="70" fill="#FFF8E1" opacity=".9" />

    {/* Bulutlar */}
    <g fill="#ffffff" opacity=".8">
      <ellipse cx="260" cy="160" rx="90" ry="28" />
      <ellipse cx="330" cy="150" rx="60" ry="22" />
      <ellipse cx="780" cy="110" rx="70" ry="20" />
      <ellipse cx="1120" cy="220" rx="56" ry="18" />
    </g>

    {/* Uzak ufuk / deniz şeridi */}
    <rect x="0" y="560" width="1920" height="60" fill="#BFE0EE" opacity=".6" />

    {/* Zemin / meydan */}
    <path d="M0 620 L1920 600 V1080 H0 Z" fill="url(#bka-ground)" />

    {/* Bulvar ağaç sırası — sol */}
    <g>
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={`l${i}`} transform={`translate(${90 + i * 95} ${660 + i * 14})`}>
          <rect x="-4" y="30" width="8" height="54" rx="3" fill="#8a7c63" />
          <circle cx="0" cy="12" r="34" fill="#4f9a3c" opacity=".92" />
          <circle cx="-18" cy="24" r="22" fill="#5aab46" opacity=".9" />
          <circle cx="20" cy="22" r="22" fill="#5aab46" opacity=".9" />
        </g>
      ))}
    </g>
    {/* Bulvar ağaç sırası — sağ */}
    <g>
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={`r${i}`} transform={`translate(${1830 - i * 95} ${660 + i * 14})`}>
          <rect x="-4" y="30" width="8" height="54" rx="3" fill="#8a7c63" />
          <circle cx="0" cy="12" r="34" fill="#4f9a3c" opacity=".92" />
          <circle cx="-18" cy="24" r="22" fill="#5aab46" opacity=".9" />
          <circle cx="20" cy="22" r="22" fill="#5aab46" opacity=".9" />
        </g>
      ))}
    </g>

    {/* Meydan döşeme çizgileri */}
    <g stroke="#CBBFA7" strokeWidth="2" opacity=".5">
      <path d="M200 1080 L720 640" />
      <path d="M420 1080 L820 640" />
      <path d="M1720 1080 L1200 640" />
      <path d="M1500 1080 L1100 640" />
    </g>

    {/* Belediye binası — klasik kurumsal cephe, merkez-sağ */}
    <g transform="translate(860 420)">
      <rect x="0" y="120" width="400" height="220" fill="url(#bka-building)" stroke="#C3D0DD" strokeWidth="2" />
      <rect x="-20" y="330" width="440" height="22" fill="#C9D4DE" />
      {/* Alınlık */}
      <path d="M-30 120 L200 40 L430 120 Z" fill="#EAF0F6" stroke="#C3D0DD" strokeWidth="2" />
      <rect x="170" y="56" width="60" height="10" fill="#B9C7D4" />
      {/* Sütunlar */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x={24 + i * 64} y="140" width="22" height="180" fill="#E4EBF1" stroke="#C3D0DD" strokeWidth="1.5" />
      ))}
      {/* Giriş kapısı */}
      <rect x="168" y="230" width="64" height="90" fill="#0F4C81" opacity=".85" rx="2" />
      <rect x="192" y="244" width="16" height="76" fill="#0b3b63" opacity=".6" />
      {/* Bayrak direği */}
      <rect x="196" y="-30" width="4" height="72" fill="#8a7c63" />
      <path d="M200 -30 L252 -16 L200 -2 Z" fill="#C8102E" />
    </g>

    {/* Taşıt yolu ayracı */}
    <rect x="0" y="920" width="1920" height="10" fill="#D8CEB8" opacity=".7" />
    <g stroke="#B9AD92" strokeWidth="4" strokeDasharray="36 28" opacity=".55">
      <line x1="0" y1="925" x2="1920" y2="925" />
    </g>

    {/* Ön plan — logodaki "insan figürlerinden oluşan ağaç" motifi, sol alt köşe */}
    <g transform="translate(150 1010)">
      <rect x="-4" y="-26" width="8" height="34" rx="2" fill="#80c242" />
      <g fill="#80c242">
        <circle cx="0" cy="-98" r="9" />
        <circle cx="-20" cy="-80" r="9" />
        <circle cx="20" cy="-80" r="9" />
        <circle cx="-38" cy="-58" r="9" />
        <circle cx="-10" cy="-58" r="9" />
        <circle cx="18" cy="-58" r="9" />
        <circle cx="38" cy="-58" r="9" />
        <circle cx="-28" cy="-36" r="9" />
        <circle cx="0" cy="-36" r="9" />
        <circle cx="28" cy="-36" r="9" />
      </g>
    </g>

    {/* Kuşlar */}
    <g stroke="#6b7f93" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity=".6">
      <path d="M1200 200 q10 -10 20 0 q10 -10 20 0" />
      <path d="M1340 260 q8 -8 16 0 q8 -8 16 0" />
    </g>
  </svg>
)

export default BakirkoySkylineArt
