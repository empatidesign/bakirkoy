/**
 * Tam ekran gündüz sahil sahnesi — Vatandaş/Firma portalı girişi.
 *
 * Kullanıcı isteği (2026-10-08): "tasarımı tamamen değiştir, halen istediğim
 * gibi olmadı" — önceki koyu/gece split-screen tasarımı (admin panelin eski
 * hâliyle ve Sultangazi'yle aynı iskelet) kaldırıldı. Bu sahne bilinçli
 * olarak admin panelin "belediye binası + bulvar" sahnesinden FARKLI:
 * Bakırköy sahili + vapur iskelesi + Yeşilköy Deniz Feneri, gündüz ışığında.
 *
 * Saf SVG, dış bağımlılık yok. `position:fixed; inset:0` tam ekran arka
 * plan olarak kullanılır; glass-panel form bunun üzerinde yüzer.
 */
export const BakirkoySkylineArt = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" className={className} role="img" aria-label="Bakırköy sahili ve Yeşilköy Deniz Feneri illüstrasyonu" fill="none">
    <defs>
      <linearGradient id="bks-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#BFE3F7" />
        <stop offset=".5" stopColor="#DCF0FA" />
        <stop offset="1" stopColor="#F3FAFD" />
      </linearGradient>
      <radialGradient id="bks-sun" cx=".5" cy=".5" r=".5">
        <stop offset="0" stopColor="#FFF4CE" stopOpacity=".95" />
        <stop offset="1" stopColor="#FFF4CE" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="bks-sea" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#7FC6E0" />
        <stop offset="1" stopColor="#3E97BE" />
      </linearGradient>
      <linearGradient id="bks-tower" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#FDFEFE" />
        <stop offset=".55" stopColor="#EAF1F6" />
        <stop offset="1" stopColor="#C4D4E1" />
      </linearGradient>
    </defs>

    {/* Gökyüzü */}
    <rect x="0" y="0" width="1920" height="1080" fill="url(#bks-sky)" />
    <circle cx="340" cy="190" r="230" fill="url(#bks-sun)" />
    <circle cx="340" cy="190" r="62" fill="#FFF8DF" opacity=".95" />

    {/* Bulutlar */}
    <g fill="#ffffff" opacity=".85">
      <ellipse cx="1180" cy="140" rx="86" ry="26" />
      <ellipse cx="1250" cy="128" rx="56" ry="20" />
      <ellipse cx="760" cy="90" rx="64" ry="18" />
      <ellipse cx="1560" cy="210" rx="70" ry="20" />
    </g>

    {/* Martılar */}
    <g stroke="#355066" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity=".55">
      <path d="M560 180 q10 -10 20 0 q10 -10 20 0" />
      <path d="M700 240 q8 -8 16 0 q8 -8 16 0" />
      <path d="M1420 160 q9 -9 18 0 q9 -9 18 0" />
    </g>

    {/* Deniz */}
    <rect x="0" y="560" width="1920" height="300" fill="url(#bks-sea)" />
    <g stroke="#ffffff" strokeOpacity=".35" strokeWidth="3">
      <path d="M0 610 Q240 592 480 610 T960 610 T1440 610 T1920 610" />
      <path d="M0 660 Q240 644 480 660 T960 660 T1440 660 T1920 660" />
      <path d="M0 712 Q240 696 480 712 T960 712 T1440 712 T1920 712" />
    </g>

    {/* Uzak şehir silüeti (sahil arkası) */}
    <g fill="#9FC0D6" opacity=".4">
      <rect x="60" y="500" width="24" height="64" /><rect x="94" y="480" width="30" height="84" />
      <rect x="134" y="510" width="20" height="54" /><rect x="900" y="494" width="26" height="70" />
      <rect x="940" y="474" width="34" height="90" /><rect x="986" y="506" width="22" height="58" />
      <rect x="1600" y="498" width="24" height="66" /><rect x="1636" y="478" width="30" height="86" />
    </g>

    {/* Vapur iskelesi */}
    <g stroke="#2E4154" strokeWidth="7" strokeLinecap="round">
      <path d="M260 700 L860 592" />
    </g>
    <g fill="#2E4154">
      <rect x="330" y="648" width="6" height="56" /><rect x="470" y="628" width="6" height="56" />
      <rect x="610" y="608" width="6" height="56" /><rect x="750" y="590" width="6" height="56" />
    </g>
    <g fill="#F2C94C" opacity=".92">
      <circle cx="333" cy="644" r="5" /><circle cx="473" cy="624" r="5" />
      <circle cx="613" cy="604" r="5" /><circle cx="753" cy="586" r="5" />
    </g>

    {/* Vapur */}
    <g transform="translate(1180 650)">
      <path d="M0 40 H240 L220 70 H20 Z" fill="#DCE4EA" stroke="#9FB2C2" strokeWidth="2" />
      <rect x="30" y="10" width="180" height="32" rx="4" fill="#F4F7FA" stroke="#9FB2C2" strokeWidth="2" />
      <rect x="50" y="18" width="20" height="14" fill="#5A89A8" />
      <rect x="85" y="18" width="20" height="14" fill="#5A89A8" />
      <rect x="120" y="18" width="20" height="14" fill="#5A89A8" />
      <rect x="155" y="18" width="20" height="14" fill="#5A89A8" />
      <rect x="100" y="-28" width="14" height="40" fill="#C8102E" />
      <path d="M-8 70 L248 70 L236 84 H4 Z" fill="#B8C6D1" />
    </g>

    {/* Yeşilköy Deniz Feneri — sağ taraf */}
    <g transform="translate(1680 380)">
      <circle cx="60" cy="40" r="48" fill="#FFE7A3" opacity=".12" />
      <circle cx="60" cy="40" r="22" fill="#FFE7A3" opacity=".85" />
      <path d="M60 40 L-180 -24 L-180 104 Z" fill="#FFE7A3" opacity=".25" />
      <path d="M-26 220 L-18 60 L18 60 L26 220 Z" fill="url(#bks-tower)" stroke="#AEBFCF" strokeWidth="1.5" />
      <rect x="-32" y="214" width="64" height="10" fill="#C9D4DF" />
      <g fill="#2A3F55">
        <rect x="-10" y="100" width="7" height="12" rx="3" /><rect x="-10" y="140" width="7" height="12" rx="3" /><rect x="-10" y="180" width="7" height="12" rx="3" />
      </g>
      <rect x="-28" y="54" width="56" height="8" fill="#E9EFF5" />
      <rect x="-24" y="42" width="48" height="2" fill="#2A3F55" />
      <rect x="-16" y="16" width="32" height="28" fill="#22364B" />
      <rect x="-12" y="19" width="24" height="22" fill="#FFE08A" />
      <path d="M-19 17 Q0 -8 19 17 Z" fill="#2A3F55" />
    </g>

    {/* Sahil şeridi önplanı */}
    <path d="M0 760 Q480 724 960 752 Q1440 780 1920 740 V1080 H0 Z" fill="#EFE9DC" />
    <path d="M0 760 Q480 724 960 752 Q1440 780 1920 740" stroke="#D8CDB3" strokeWidth="4" fill="none" opacity=".6" />

    {/* Promenad ağaçları */}
    {[0, 1, 2, 3].map((i) => (
      <g key={`pl${i}`} transform={`translate(${120 + i * 90} ${820 + i * 10})`}>
        <rect x="-3" y="22" width="6" height="40" rx="3" fill="#8a7c63" />
        <circle cx="0" cy="8" r="26" fill="#5aab46" opacity=".9" />
      </g>
    ))}
    {[0, 1, 2, 3].map((i) => (
      <g key={`pr${i}`} transform={`translate(${1800 - i * 90} ${820 + i * 10})`}>
        <rect x="-3" y="22" width="6" height="40" rx="3" fill="#8a7c63" />
        <circle cx="0" cy="8" r="26" fill="#5aab46" opacity=".9" />
      </g>
    ))}

    {/* Ön plan — logodaki "insan figürlerinden oluşan ağaç" motifi */}
    <g transform="translate(960 1010)">
      <rect x="-4" y="-24" width="8" height="32" rx="2" fill="#80c242" />
      <g fill="#80c242">
        <circle cx="0" cy="-92" r="8" />
        <circle cx="-18" cy="-76" r="8" />
        <circle cx="18" cy="-76" r="8" />
        <circle cx="-34" cy="-56" r="8" />
        <circle cx="-9" cy="-56" r="8" />
        <circle cx="16" cy="-56" r="8" />
        <circle cx="34" cy="-56" r="8" />
        <circle cx="-25" cy="-36" r="8" />
        <circle cx="0" cy="-36" r="8" />
        <circle cx="25" cy="-36" r="8" />
      </g>
    </g>
  </svg>
)

export default BakirkoySkylineArt
