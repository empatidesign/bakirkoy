import { useState, useEffect, useRef, useCallback } from 'react'
import {
  SunIcon, MoonIcon, MonitorIcon, CheckIcon, RotateCcwIcon,
  TypeIcon, PaletteIcon, LayoutIcon, BoxIcon,
  TableIcon, BadgeCheckIcon, MousePointerClickIcon,
  ChevronDownIcon, SaveIcon, DownloadIcon, UploadIcon,
  SquareIcon, CircleIcon, ListIcon, AlignJustifyIcon, SlidersIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme, type ThemeMode } from '@/framework/theme/ThemeContext'
import { Badge } from '@/design-system/Badge'
import { Button } from '@/design-system/Button'
import { Switch } from '@/design-system/Switch'
import { Input } from '@/design-system/Input'
import { Checkbox } from '@/design-system/Checkbox'
import { PREMIUM_THEMES, type PremiumTheme } from './premiumThemes'

type TokenType = 'color' | 'size' | 'toggle' | 'select'

type TokenDef = {
  key: string
  label: string
  type: TokenType
  cssVar: string
  desc?: string
  unit?: string
  options?: { label: string; value: string }[]
}

type TokenGroup = {
  label: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  tokens: TokenDef[]
}

const hslToHex = (h: number, s: number, l: number): string => {
  s /= 100; l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * c).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

const hexToHsl = (hex: string): string => {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

const parseRawVar = (cssVar: string): string => {
  if (typeof document === 'undefined') return ''
  return getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim()
}


const TOKEN_GROUPS: TokenGroup[] = [
  {
    label: 'Zemin & Yüzeyler',
    icon: LayoutIcon,
    tokens: [
      { key: '--background',   label: 'Sayfa Zemini',          type: 'color', cssVar: '--background' },
      { key: '--surface-0',    label: 'Yüzey 0 – Ana Zemin',   type: 'color', cssVar: '--surface-0' },
      { key: '--surface-1',    label: 'Yüzey 1 – Kart',        type: 'color', cssVar: '--surface-1' },
      { key: '--surface-2',    label: 'Yüzey 2 – Vurgulu',     type: 'color', cssVar: '--surface-2' },
      { key: '--input-bg',     label: 'Input Arka Planı',       type: 'color', cssVar: '--input-bg' },
      { key: '--border',       label: 'Kenarlık Rengi',         type: 'color', cssVar: '--border' },
    ],
  },
  {
    label: 'Metin Renkleri',
    icon: TypeIcon,
    tokens: [
      { key: '--foreground-strong',  label: 'Güçlü Metin (Başlık)',  type: 'color', cssVar: '--foreground-strong' },
      { key: '--foreground-default', label: 'Normal Metin',           type: 'color', cssVar: '--foreground-default' },
      { key: '--foreground-muted',   label: 'Soluk Metin',            type: 'color', cssVar: '--foreground-muted' },
      { key: '--foreground-subtle',  label: 'Çok Soluk (İpucu)',      type: 'color', cssVar: '--foreground-subtle' },
    ],
  },
  {
    label: 'Ana Renk (Primary)',
    icon: PaletteIcon,
    tokens: [
      { key: '--primary',            label: 'Ana Renk',                 type: 'color', cssVar: '--primary' },
      { key: '--primary-foreground', label: 'Ana Renk Üzeri Metin',     type: 'color', cssVar: '--primary-foreground' },
      { key: '--primary-soft',       label: 'Ana Renk Açık Zemin',      type: 'color', cssVar: '--primary-soft' },
    ],
  },
  {
    label: 'Durum Renkleri',
    icon: BadgeCheckIcon,
    tokens: [
      { key: '--success',      label: 'Başarı',         type: 'color', cssVar: '--success' },
      { key: '--success-soft', label: 'Başarı Açık',    type: 'color', cssVar: '--success-soft' },
      { key: '--warning',      label: 'Uyarı',          type: 'color', cssVar: '--warning' },
      { key: '--warning-soft', label: 'Uyarı Açık',     type: 'color', cssVar: '--warning-soft' },
      { key: '--danger',       label: 'Tehlike',        type: 'color', cssVar: '--danger' },
      { key: '--danger-soft',  label: 'Tehlike Açık',   type: 'color', cssVar: '--danger-soft' },
      { key: '--info',         label: 'Bilgi',          type: 'color', cssVar: '--info' },
      { key: '--info-soft',    label: 'Bilgi Açık',     type: 'color', cssVar: '--info-soft' },
    ],
  },
  {
    label: 'Vurgu Renkleri',
    icon: PaletteIcon,
    tokens: [
      { key: '--accent-blue',        label: 'Mavi',          type: 'color', cssVar: '--accent-blue' },
      { key: '--accent-blue-soft',   label: 'Mavi Açık',     type: 'color', cssVar: '--accent-blue-soft' },
      { key: '--accent-green',       label: 'Yeşil',         type: 'color', cssVar: '--accent-green' },
      { key: '--accent-green-soft',  label: 'Yeşil Açık',    type: 'color', cssVar: '--accent-green-soft' },
      { key: '--accent-orange',      label: 'Turuncu',       type: 'color', cssVar: '--accent-orange' },
      { key: '--accent-orange-soft', label: 'Turuncu Açık',  type: 'color', cssVar: '--accent-orange-soft' },
      { key: '--accent-violet',      label: 'Mor',           type: 'color', cssVar: '--accent-violet' },
      { key: '--accent-violet-soft', label: 'Mor Açık',      type: 'color', cssVar: '--accent-violet-soft' },
    ],
  },
  {
    label: 'Tablo',
    icon: TableIcon,
    tokens: [
      { key: '--table-header-bg',    label: 'Başlık Satırı Zemini',    type: 'color', cssVar: '--table-header-bg' },
      { key: '--table-stripe-bg',    label: 'Zebra Satır Rengi',        type: 'color', cssVar: '--table-stripe-bg' },
      { key: '--table-col-lines',    label: 'Dikey Sütun Çizgileri',    type: 'toggle', cssVar: '--table-col-lines' },
      { key: '--table-row-lines',    label: 'Yatay Satır Çizgileri',    type: 'toggle', cssVar: '--table-row-lines' },
      { key: '--table-stripe',       label: 'Zebra Satır (Açık/Kapalı)', type: 'toggle', cssVar: '--table-stripe' },
      { key: '--table-hover',        label: 'Hover Vurgusu',             type: 'toggle', cssVar: '--table-hover' },
      { key: '--table-outer-border', label: 'Dış Kenarlık',              type: 'toggle', cssVar: '--table-outer-border' },
    ],
  },
  {
    label: 'Input Alanları',
    icon: AlignJustifyIcon,
    tokens: [
      { key: '--input-border',        label: 'Input Kenarlık Rengi',     type: 'color',  cssVar: '--border' },
      { key: '--input-focus-ring',    label: 'Odak Halkası Rengi',       type: 'color',  cssVar: '--ring' },
      { key: '--input-h',             label: 'Input Yüksekliği',         type: 'size',   cssVar: '--control-h',    unit: 'rem' },
      { key: '--input-radius',        label: 'Input Köşe Yuvarlama',     type: 'size',   cssVar: '--radius-field', unit: 'rem' },
      { key: '--input-font-size',     label: 'Input Yazı Boyutu',        type: 'size',   cssVar: '--text-sm',      unit: 'rem' },
      { key: '--input-show-border',   label: 'Kenarlık Göster',          type: 'toggle', cssVar: '--input-show-border' },
      { key: '--input-filled',        label: 'Dolu Zemin Stili',         type: 'toggle', cssVar: '--input-filled' },
    ],
  },
  {
    label: 'Butonlar',
    icon: MousePointerClickIcon,
    tokens: [
      { key: '--btn-radius',    label: 'Buton Köşe Yuvarlama', type: 'size',  cssVar: '--radius-field', unit: 'rem' },
      { key: '--btn-h',         label: 'Buton Yüksekliği',     type: 'size',  cssVar: '--control-h',    unit: 'rem' },
      { key: '--btn-font-size', label: 'Buton Yazı Boyutu',    type: 'size',  cssVar: '--text-sm',      unit: 'rem' },
      {
        key: '--btn-style',
        label: 'Primary Buton Stili',
        type: 'select',
        cssVar: '--btn-style',
        options: [
          { label: 'Dolu (Solid)', value: 'solid' },
          { label: 'Outline',      value: 'outline' },
          { label: 'Gradient',     value: 'gradient' },
        ],
      },
    ],
  },
  {
    label: 'Checkbox & Radio',
    icon: SquareIcon,
    tokens: [
      { key: '--checkbox-color',   label: 'Checkbox Aktif Rengi',  type: 'color',  cssVar: '--primary' },
      { key: '--checkbox-radius',  label: 'Checkbox Köşesi',       type: 'size',   cssVar: '--radius-field', unit: 'rem' },
      { key: '--radio-color',      label: 'Radio Aktif Rengi',     type: 'color',  cssVar: '--primary' },
      {
        key: '--checkbox-size',
        label: 'Boyut',
        type: 'select',
        cssVar: '--checkbox-size',
        options: [
          { label: 'Küçük (14px)',  value: '14px' },
          { label: 'Normal (16px)', value: '16px' },
          { label: 'Büyük (18px)',  value: '18px' },
        ],
      },
    ],
  },
  {
    label: 'Select & Combobox',
    icon: ListIcon,
    tokens: [
      { key: '--select-bg',          label: 'Select Zemin Rengi',    type: 'color', cssVar: '--input-bg' },
      { key: '--select-h',           label: 'Select Yüksekliği',     type: 'size',  cssVar: '--control-h',    unit: 'rem' },
      { key: '--select-radius',      label: 'Select Köşe Yuvarlama', type: 'size',  cssVar: '--radius-field', unit: 'rem' },
      { key: '--select-option-hover',label: 'Seçenek Hover Rengi',   type: 'color', cssVar: '--primary-soft' },
    ],
  },
  {
    label: 'Kartlar',
    icon: BoxIcon,
    tokens: [
      { key: '--card-bg',          label: 'Kart Zemini',          type: 'color', cssVar: '--surface-1' },
      { key: '--card-radius',      label: 'Kart Köşe Yuvarlama', type: 'size',  cssVar: '--radius-card',  unit: 'rem' },
      { key: '--card-shadow',      label: 'Kart Gölgesi',
        type: 'select', cssVar: '--card-shadow-preset',
        options: [
          { label: 'Düz (Gölgesiz)', value: 'flat' },
          { label: 'Hafif',          value: 'sm' },
          { label: 'Normal',         value: 'md' },
          { label: 'Derin',          value: 'lg' },
        ],
      },
      { key: '--card-border-show', label: 'Kenarlık Göster',     type: 'toggle', cssVar: '--card-border-show' },
    ],
  },
  {
    label: 'Modal & Drawer',
    icon: SlidersIcon,
    tokens: [
      { key: '--modal-radius',      label: 'Modal Köşe Yuvarlama',  type: 'size',  cssVar: '--radius-panel', unit: 'rem' },
      { key: '--modal-overlay-opacity', label: 'Arka Plan Karartma',
        type: 'select', cssVar: '--modal-overlay-opacity',
        options: [
          { label: 'Çok Hafif (%20)',  value: '0.20' },
          { label: 'Hafif (%40)',      value: '0.40' },
          { label: 'Normal (%60)',     value: '0.60' },
          { label: 'Koyu (%80)',       value: '0.80' },
        ],
      },
      { key: '--drawer-width', label: 'Drawer Genişliği',
        type: 'select', cssVar: '--drawer-width',
        options: [
          { label: 'Dar (360px)',     value: '360px' },
          { label: 'Normal (480px)', value: '480px' },
          { label: 'Geniş (600px)',  value: '600px' },
        ],
      },
    ],
  },
  {
    label: 'Sidebar & Header',
    icon: LayoutIcon,
    tokens: [
      { key: '--sidebar-bg',        label: 'Sidebar Zemini',      type: 'color', cssVar: '--sidebar-bg' },
      { key: '--sidebar-active-bg', label: 'Aktif Öğe Zemini',   type: 'color', cssVar: '--sidebar-active-bg' },
      { key: '--sidebar-hover-bg',  label: 'Hover Zemini',        type: 'color', cssVar: '--sidebar-hover-bg' },
      { key: '--header-bg',         label: 'Header Zemini',       type: 'color', cssVar: '--header-bg' },
    ],
  },
  {
    label: 'Yazı Boyutları',
    icon: TypeIcon,
    tokens: [
      { key: '--text-xs',   label: 'XS – Küçük Etiket', type: 'size', cssVar: '--text-xs',   unit: 'rem' },
      { key: '--text-sm',   label: 'SM – Normal Metin', type: 'size', cssVar: '--text-sm',   unit: 'rem' },
      { key: '--text-base', label: 'Base',              type: 'size', cssVar: '--text-base', unit: 'rem' },
      { key: '--text-lg',   label: 'LG',                type: 'size', cssVar: '--text-lg',   unit: 'rem' },
      { key: '--text-xl',   label: 'XL',                type: 'size', cssVar: '--text-xl',   unit: 'rem' },
      { key: '--text-2xl',  label: '2XL – Başlık',      type: 'size', cssVar: '--text-2xl',  unit: 'rem' },
    ],
  },
  {
    label: 'Kenar Yuvarlaması (Genel)',
    icon: CircleIcon,
    tokens: [
      { key: '--radius-field', label: 'Field / Input / Buton', type: 'size', cssVar: '--radius-field', unit: 'rem' },
      { key: '--radius-card',  label: 'Kart',                  type: 'size', cssVar: '--radius-card',  unit: 'rem' },
      { key: '--radius-panel', label: 'Panel / Modal',         type: 'size', cssVar: '--radius-panel', unit: 'rem' },
    ],
  },
]

const MODE_OPTIONS: { value: ThemeMode; icon: typeof SunIcon; label: string }[] = [
  { value: 'light',  icon: SunIcon,     label: 'Açık' },
  { value: 'dark',   icon: MoonIcon,    label: 'Koyu' },
  { value: 'system', icon: MonitorIcon, label: 'Sistem' },
]

type CustomTokens = Record<string, string>
type UIToggles = Record<string, boolean>
type UISelects = Record<string, string>

const TOGGLE_DEFAULTS: UIToggles = {
  '--table-col-lines':    false,
  '--table-row-lines':    true,
  '--table-stripe':       true,
  '--table-hover':        true,
  '--table-outer-border': true,
  '--input-show-border':  true,
  '--input-filled':       true,
  '--card-border-show':   true,
}

const SELECT_DEFAULTS: UISelects = {
  '--btn-style':              'solid',
  '--checkbox-size':          '16px',
  '--card-shadow-preset':     'sm',
  '--modal-overlay-opacity':  '0.60',
  '--drawer-width':           '480px',
}

const TOGGLE_STORAGE  = 'nexora_ui_toggles'
const SELECT_STORAGE  = 'nexora_ui_selects'
const PRESET_STORAGE  = 'nexora_custom_presets'
const TOKEN_OVERRIDE  = 'nexora_token_overrides'

type SavedPreset = { name: string; tokens: CustomTokens; toggles: UIToggles; selects: UISelects; savedAt: string }

const loadJSON = <T,>(key: string, def: T): T => {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? def } catch { return def }
}
const saveJSON = (key: string, val: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch { void 0 }
}

const readAllCssTokens = (): CustomTokens => {
  const result: CustomTokens = {}
  TOKEN_GROUPS.forEach(g =>
    g.tokens.forEach(t => {
      if (t.type === 'color' || t.type === 'size') {
        result[t.cssVar] = parseRawVar(t.cssVar)
      }
    })
  )
  return result
}

const setCssVar = (cssVar: string, val: string) => {
  document.documentElement.style.setProperty(cssVar, ` ${val}`)
}
const removeCssVar = (cssVar: string) => {
  document.documentElement.style.removeProperty(cssVar)
}

interface ColorRowProps { cssVar: string; label: string; value: string; onChange: (hsl: string) => void; onReset: () => void }
const ColorRow = ({ cssVar, label, value, onChange, onReset }: ColorRowProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [hex, setHex] = useState('#888888')
  const [hslText, setHslText] = useState(value)

  useEffect(() => {
    setHslText(value)
    try {
      const [h, s, l] = value.split(' ').map(v => parseFloat(v))
      if (!isNaN(h)) setHex(hslToHex(h, s, l))
    } catch { void 0 }
  }, [value])

  const fromHex = (h: string) => {
    setHex(h)
    if (/^#[0-9a-fA-F]{6}$/.test(h)) { const hsl = hexToHsl(h); setHslText(hsl); onChange(hsl) }
  }
  const fromHsl = (v: string) => {
    setHslText(v)
    onChange(v)
    try { const [h, s, l] = v.split(' ').map(x => parseFloat(x)); if (!isNaN(h)) setHex(hslToHex(h, s, l)) } catch { void 0 }
  }

  return (
    <div className="flex items-center gap-2.5 py-2" style={{ borderBottom: '0.5px solid hsl(var(--border))' }}>
      <button
        className="relative h-7 w-7 flex-shrink-0 rounded-lg shadow-sm overflow-hidden"
        style={{ background: `hsl(${value})`, border: '0.5px solid hsl(var(--border))' }}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="color" value={hex} onChange={e => fromHex(e.target.value)}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-[hsl(var(--foreground-strong))] truncate">{label}</p>
        <p className="text-[9px] font-mono text-[hsl(var(--foreground-subtle))] truncate">{cssVar}</p>
      </div>
      <input type="text" value={hex} onChange={e => fromHex(e.target.value)}
        className="w-[72px] h-6 rounded px-1.5 text-[10px] font-mono text-center flex-shrink-0"
        style={{ background: 'hsl(var(--input-bg))', border: '0.5px solid hsl(var(--border))', color: 'hsl(var(--foreground-default))' }} />
      <input type="text" value={hslText} onChange={e => fromHsl(e.target.value)} placeholder="H S% L%"
        className="w-[128px] h-6 rounded px-1.5 text-[10px] font-mono flex-shrink-0 hidden sm:block"
        style={{ background: 'hsl(var(--input-bg))', border: '0.5px solid hsl(var(--border))', color: 'hsl(var(--foreground-default))' }} />
      <button onClick={onReset} className="h-6 w-6 flex-shrink-0 rounded flex items-center justify-center hover:bg-[hsl(var(--surface-2))]">
        <RotateCcwIcon className="h-3 w-3 text-[hsl(var(--foreground-subtle))]" />
      </button>
    </div>
  )
}

interface SizeRowProps { cssVar: string; label: string; value: string; unit: string; onChange: (v: string) => void; onReset: () => void }
const SizeRow = ({ cssVar, label, value, unit, onChange, onReset }: SizeRowProps) => {
  const numVal = parseFloat(value) || 0
  const [local, setLocal] = useState(value)
  useEffect(() => { setLocal(value) }, [value])
  const max = unit === 'rem' ? 4 : 100
  const step = unit === 'rem' ? 0.0625 : 1

  return (
    <div className="flex items-center gap-2.5 py-2" style={{ borderBottom: '0.5px solid hsl(var(--border))' }}>
      <div className="h-7 w-7 flex-shrink-0 rounded-lg flex items-center justify-center text-[8px] font-bold"
        style={{ background: 'hsl(var(--surface-2))', color: 'hsl(var(--primary))' }}>{unit}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-[hsl(var(--foreground-strong))] truncate">{label}</p>
        <p className="text-[9px] font-mono text-[hsl(var(--foreground-subtle))] truncate">{cssVar}</p>
      </div>
      <input type="range" min={0} max={max} step={step} value={numVal}
        onChange={e => { const v = `${e.target.value}${unit}`; setLocal(v); onChange(v) }}
        className="w-24 flex-shrink-0 accent-[hsl(var(--primary))]" />
      <input type="text" value={local} onChange={e => { setLocal(e.target.value); onChange(e.target.value) }}
        className="w-16 h-6 rounded px-1.5 text-[10px] font-mono text-center flex-shrink-0"
        style={{ background: 'hsl(var(--input-bg))', border: '0.5px solid hsl(var(--border))', color: 'hsl(var(--foreground-default))' }} />
      <button onClick={onReset} className="h-6 w-6 flex-shrink-0 rounded flex items-center justify-center hover:bg-[hsl(var(--surface-2))]">
        <RotateCcwIcon className="h-3 w-3 text-[hsl(var(--foreground-subtle))]" />
      </button>
    </div>
  )
}

interface ToggleRowProps { label: string; cssVar: string; value: boolean; onChange: (v: boolean) => void }
const ToggleRow = ({ label, cssVar, value, onChange }: ToggleRowProps) => (
  <div className="flex items-center gap-2.5 py-2" style={{ borderBottom: '0.5px solid hsl(var(--border))' }}>
    <div className="h-7 w-7 flex-shrink-0 rounded-lg flex items-center justify-center"
      style={{ background: value ? 'hsl(var(--primary-soft))' : 'hsl(var(--surface-2))' }}>
      <div className="h-2 w-2 rounded-full" style={{ background: value ? 'hsl(var(--primary))' : 'hsl(var(--foreground-subtle))' }} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[11px] font-semibold text-[hsl(var(--foreground-strong))]">{label}</p>
      <p className="text-[9px] font-mono text-[hsl(var(--foreground-subtle))]">{cssVar}</p>
    </div>
    <Switch checked={value} onCheckedChange={onChange} />
  </div>
)

interface SelectRowProps { label: string; cssVar: string; value: string; options: { label: string; value: string }[]; onChange: (v: string) => void }
const SelectRow = ({ label, cssVar, value, options, onChange }: SelectRowProps) => (
  <div className="flex items-center gap-2.5 py-2" style={{ borderBottom: '0.5px solid hsl(var(--border))' }}>
    <div className="h-7 w-7 flex-shrink-0 rounded-lg flex items-center justify-center"
      style={{ background: 'hsl(var(--surface-2))' }}>
      <ChevronDownIcon className="h-3.5 w-3.5 text-[hsl(var(--foreground-muted))]" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[11px] font-semibold text-[hsl(var(--foreground-strong))]">{label}</p>
      <p className="text-[9px] font-mono text-[hsl(var(--foreground-subtle))]">{cssVar}</p>
    </div>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="h-7 rounded-lg px-2 text-[11px] font-medium flex-shrink-0"
      style={{ background: 'hsl(var(--input-bg))', border: '0.5px solid hsl(var(--border))', color: 'hsl(var(--foreground-default))' }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
)

const GroupPanel = ({ group, tokens, toggles, selects, onColor, onSize, onToggle, onSelect, onReset }: {
  group: TokenGroup
  tokens: CustomTokens
  toggles: UIToggles
  selects: UISelects
  onColor: (cssVar: string, hsl: string) => void
  onSize: (cssVar: string, val: string) => void
  onToggle: (cssVar: string, val: boolean) => void
  onSelect: (cssVar: string, val: string) => void
  onReset: (cssVar: string, type: TokenType) => void
}) => {
  const [open, setOpen] = useState(true)
  const Icon = group.icon

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '0.5px solid hsl(var(--border))', boxShadow: 'var(--shadow-card)' }}>
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
        style={{ background: open ? 'hsl(var(--primary-soft))' : 'hsl(var(--surface-1))' }}
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ background: open ? 'hsl(var(--primary))' : 'hsl(var(--surface-2))' }}>
          <Icon className="h-3.5 w-3.5" style={{ color: open ? 'white' : 'hsl(var(--foreground-muted))' }} />
        </div>
        <span className="flex-1 text-[12px] font-bold text-[hsl(var(--foreground-strong))]">{group.label}</span>
        <span className="text-[10px] text-[hsl(var(--foreground-subtle))]">{group.tokens.length} ayar</span>
        <ChevronDownIcon className={cn('h-4 w-4 text-[hsl(var(--foreground-muted))] transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="px-4" style={{ background: 'hsl(var(--surface-1))' }}>
          {group.tokens.map(t => {
            if (t.type === 'color') {
              const val = tokens[t.cssVar] ?? ''
              return <ColorRow key={t.key} cssVar={t.cssVar} label={t.label} value={val}
                onChange={hsl => onColor(t.cssVar, hsl)} onReset={() => onReset(t.cssVar, 'color')} />
            }
            if (t.type === 'size') {
              const val = tokens[t.cssVar] ?? ''
              return <SizeRow key={t.key} cssVar={t.cssVar} label={t.label} value={val} unit={t.unit ?? 'rem'}
                onChange={v => onSize(t.cssVar, v)} onReset={() => onReset(t.cssVar, 'size')} />
            }
            if (t.type === 'toggle') {
              return <ToggleRow key={t.key} label={t.label} cssVar={t.cssVar}
                value={toggles[t.cssVar] ?? TOGGLE_DEFAULTS[t.cssVar] ?? false}
                onChange={v => onToggle(t.cssVar, v)} />
            }
            if (t.type === 'select' && t.options) {
              return <SelectRow key={t.key} label={t.label} cssVar={t.cssVar}
                value={selects[t.cssVar] ?? SELECT_DEFAULTS[t.cssVar] ?? t.options[0].value}
                options={t.options} onChange={v => onSelect(t.cssVar, v)} />
            }
            return null
          })}
        </div>
      )}
    </div>
  )
}

const PreviewTable = ({ toggles }: { toggles: UIToggles }) => {
  const showColLines   = toggles['--table-col-lines'] ?? false
  const showRowLines   = toggles['--table-row-lines'] ?? true
  const showStripe     = toggles['--table-stripe'] ?? true
  const showHover      = toggles['--table-hover'] ?? true
  const showOuterBorder = toggles['--table-outer-border'] ?? true
  const [hovered, setHovered] = useState<number | null>(null)

  const rows = [
    { name: 'Ayşe Kaya',     status: 'Onaylı',     tone: 'success' as const, date: '12.06.26' },
    { name: 'Mehmet Yıldız', status: 'Bekliyor',   tone: 'warning' as const, date: '13.06.26' },
    { name: 'Elif Şahin',    status: 'Reddedildi', tone: 'danger'  as const, date: '14.06.26' },
  ]

  return (
    <div className="overflow-hidden" style={{
      border: showOuterBorder ? '0.5px solid hsl(var(--border))' : 'none',
      borderRadius: 'var(--radius-card)',
      boxShadow: 'var(--shadow-card)',
    }}>
      <div className="grid" style={{
        gridTemplateColumns: '1fr auto 80px',
        background: `hsl(var(--table-header-bg, 214 40% 98.5%))`,
        borderBottom: showRowLines ? '0.5px solid hsl(var(--border))' : 'none',
      }}>
        {['AD SOYAD', 'DURUM', 'TARİH'].map((h, i) => (
          <div key={h} className="px-3 py-2 text-[9px] font-semibold uppercase tracking-wide"
            style={{
              color: 'hsl(var(--foreground-subtle))',
              borderRight: showColLines && i < 2 ? '0.5px solid hsl(var(--border))' : 'none',
            }}>{h}</div>
        ))}
      </div>
      {rows.map((row, i) => (
        <div key={row.name} className="grid transition-colors" style={{
          gridTemplateColumns: '1fr auto 80px',
          background: hovered === i && showHover
            ? 'hsl(var(--primary-soft))'
            : showStripe && i % 2 === 1
              ? `hsl(var(--table-stripe-bg, 214 55% 99%))`
              : 'hsl(var(--surface-1))',
          borderBottom: showRowLines && i < rows.length - 1 ? '0.5px solid hsl(var(--border))' : 'none',
          cursor: 'default',
        }}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
        >
          <div className="px-3 py-2 text-[10px] font-medium truncate"
            style={{ color: 'hsl(var(--foreground-strong))', borderRight: showColLines ? '0.5px solid hsl(var(--border))' : 'none' }}>
            {row.name}
          </div>
          <div className="px-3 py-2 flex items-center"
            style={{ borderRight: showColLines ? '0.5px solid hsl(var(--border))' : 'none' }}>
            <Badge tone={row.tone} className="text-[8px] py-0">{row.status}</Badge>
          </div>
          <div className="px-3 py-2 text-[9px]" style={{ color: 'hsl(var(--foreground-subtle))' }}>{row.date}</div>
        </div>
      ))}
    </div>
  )
}

const PremiumThemeCard = ({
  theme,
  active,
  onApply,
}: {
  theme: PremiumTheme
  active: boolean
  onApply: (t: PremiumTheme) => void
}) => {
  const { primary, surface, accent, text } = theme.preview
  return (
    <button
      onClick={() => onApply(theme)}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl text-left transition-all duration-200',
        active ? 'ring-2 ring-offset-2' : 'hover:-translate-y-0.5 hover:shadow-xl',
      )}
      style={{
        border: active ? `1.5px solid ${primary}` : '0.5px solid hsl(var(--border))',
        boxShadow: active ? `0 0 0 3px ${primary}33` : 'var(--shadow-card)',
        ['--tw-ring-color' as string]: primary,
      }}
    >
      <div className="relative h-24 overflow-hidden flex-shrink-0" style={{ background: surface }}>
        <div className="absolute inset-0 flex flex-col gap-1.5 p-3">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded" style={{ background: primary }} />
            <div className="flex flex-col gap-0.5">
              <div className="h-1.5 w-14 rounded-full" style={{ background: text, opacity: 0.7 }} />
              <div className="h-1 w-10 rounded-full" style={{ background: primary, opacity: 0.6 }} />
            </div>
            <div className="ml-auto flex gap-1">
              {[primary, accent, surface].map((c, i) => (
                <div key={i} className="h-4 w-4 rounded" style={{ background: c, border: `0.5px solid ${text}22`, opacity: i === 2 ? 0.5 : 1 }} />
              ))}
            </div>
          </div>
          <div className="rounded-lg p-2 mt-1" style={{ background: `${surface}cc`, border: `0.5px solid ${text}15` }}>
            <div className="flex items-center justify-between mb-1.5">
              {['AD SOYAD', 'DURUM', 'TARİH'].map(h => (
                <div key={h} className="h-1 rounded-full" style={{ background: text, opacity: 0.3, width: h === 'AD SOYAD' ? 36 : h === 'DURUM' ? 22 : 18 }} />
              ))}
            </div>
            {[1, 2].map(i => (
              <div key={i} className="flex items-center justify-between py-0.5">
                <div className="h-1.5 w-16 rounded-full" style={{ background: text, opacity: 0.5 }} />
                <div className="h-3 w-10 rounded-full" style={{ background: i === 1 ? '#10b98133' : '#f59e0b33' }} />
                <div className="h-1.5 w-8 rounded-full" style={{ background: text, opacity: 0.3 }} />
              </div>
            ))}
          </div>
          <div className="flex gap-1.5 mt-auto">
            <div className="flex-1 h-5 rounded-lg" style={{ background: primary }} />
            <div className="flex-1 h-5 rounded-lg" style={{ background: 'transparent', border: `0.5px solid ${primary}` }} />
            <div className="w-12 h-5 rounded-lg" style={{ background: `${text}11` }} />
          </div>
        </div>
        {active && (
          <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full" style={{ background: primary }}>
            <CheckIcon className="h-3 w-3 text-white" />
          </div>
        )}
      </div>
      <div className="flex-1 p-3" style={{ background: 'hsl(var(--surface-1))' }}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[12px] font-bold leading-tight" style={{ color: 'hsl(var(--foreground-strong))' }}>
              {theme.emoji} {theme.name}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: 'hsl(var(--foreground-muted))' }}>{theme.subtitle}</p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {theme.tags.map(tag => (
            <span key={tag} className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
              style={{ background: `${primary}18`, color: primary }}>{tag}</span>
          ))}
        </div>
        <div className="mt-2.5 flex gap-1">
          {[theme.preview.primary, theme.preview.accent, theme.preview.surface, theme.preview.text].map((c, i) => (
            <div key={i} className="h-4 w-4 rounded-full border" style={{ background: c, borderColor: 'hsl(var(--border))' }} />
          ))}
        </div>
      </div>
    </button>
  )
}

export const ThemeSettingsTab = () => {
  const { mode, setMode } = useTheme()
  const [activeThemeId, setActiveThemeId] = useState<string>(() => loadJSON('nexora_active_theme', 'ocean-blue'))
  const [tokens, setTokens] = useState<CustomTokens>({})
  const [defaults, setDefaults] = useState<CustomTokens>({})
  const [toggles, setToggles] = useState<UIToggles>(() => loadJSON(TOGGLE_STORAGE, TOGGLE_DEFAULTS))
  const [selects, setSelects] = useState<UISelects>(() => loadJSON(SELECT_STORAGE, SELECT_DEFAULTS))
  const [presets, setPresets] = useState<SavedPreset[]>(() => loadJSON(PRESET_STORAGE, []))
  const [presetName, setPresetName] = useState('')
  const [saveOpen, setSaveOpen] = useState(false)
  const [previewSwitch, setPreviewSwitch] = useState(false)
  const [previewCheck, setPreviewCheck] = useState(true)
  const [previewRadio, setPreviewRadio] = useState('opt1')
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    const saved = loadJSON<CustomTokens>(TOKEN_OVERRIDE, {})
    const current = readAllCssTokens()
    const merged = { ...current, ...saved }
    setTokens(merged)
    setDefaults(current)
    Object.entries(saved).forEach(([k, v]) => { if (v) setCssVar(k, v) })
  }, [])

  const handleColor = useCallback((cssVar: string, hsl: string) => {
    setTokens(prev => {
      const next = { ...prev, [cssVar]: hsl }
      saveJSON(TOKEN_OVERRIDE, next)
      return next
    })
    setCssVar(cssVar, hsl)
  }, [])

  const handleSize = useCallback((cssVar: string, val: string) => {
    setTokens(prev => {
      const next = { ...prev, [cssVar]: val }
      saveJSON(TOKEN_OVERRIDE, next)
      return next
    })
    document.documentElement.style.setProperty(cssVar, val)
  }, [])

  const handleToggle = useCallback((cssVar: string, val: boolean) => {
    setToggles(prev => {
      const next = { ...prev, [cssVar]: val }
      saveJSON(TOGGLE_STORAGE, next)
      return next
    })
  }, [])

  const handleSelect = useCallback((cssVar: string, val: string) => {
    setSelects(prev => {
      const next = { ...prev, [cssVar]: val }
      saveJSON(SELECT_STORAGE, next)
      return next
    })
  }, [])

  const handleReset = useCallback((cssVar: string, _type: TokenType) => {
    const def = defaults[cssVar] ?? ''
    setTokens(prev => {
      const next = { ...prev, [cssVar]: def }
      saveJSON(TOKEN_OVERRIDE, next)
      return next
    })
    removeCssVar(cssVar)
  }, [defaults])

  const handleResetAll = () => {
    Object.keys(tokens).forEach(k => removeCssVar(k))
    const fresh = readAllCssTokens()
    setTokens(fresh)
    setDefaults(fresh)
    setToggles(TOGGLE_DEFAULTS)
    setSelects(SELECT_DEFAULTS)
    saveJSON(TOKEN_OVERRIDE, {})
    saveJSON(TOGGLE_STORAGE, TOGGLE_DEFAULTS)
    saveJSON(SELECT_STORAGE, SELECT_DEFAULTS)
  }

  const handleSavePreset = () => {
    if (!presetName.trim()) return
    const p: SavedPreset = {
      name: presetName.trim(),
      tokens: { ...tokens },
      toggles: { ...toggles },
      selects: { ...selects },
      savedAt: new Date().toLocaleString('tr-TR'),
    }
    const next = [p, ...presets.filter(x => x.name !== p.name)]
    setPresets(next)
    saveJSON(PRESET_STORAGE, next)
    setPresetName('')
    setSaveOpen(false)
  }

  const handleLoadPreset = (p: SavedPreset) => {
    Object.entries(p.tokens).forEach(([k, v]) => { if (v) setCssVar(k, v) })
    setTokens(p.tokens)
    setToggles(p.toggles)
    setSelects(p.selects)
    saveJSON(TOKEN_OVERRIDE, p.tokens)
    saveJSON(TOGGLE_STORAGE, p.toggles)
    saveJSON(SELECT_STORAGE, p.selects)
  }

  const handleDeletePreset = (name: string) => {
    const next = presets.filter(p => p.name !== name)
    setPresets(next)
    saveJSON(PRESET_STORAGE, next)
  }

  const handleApplyPremium = useCallback((theme: PremiumTheme) => {
    document.documentElement.classList.add('theme-transitioning')
    Object.entries(theme.tokens).forEach(([k, v]) => setCssVar(k, v))
    const fresh = readAllCssTokens()
    setTokens(fresh)
    setToggles(theme.toggles)
    setSelects(theme.selects)
    setActiveThemeId(theme.id)
    saveJSON(TOKEN_OVERRIDE, theme.tokens)
    saveJSON(TOGGLE_STORAGE, theme.toggles)
    saveJSON(SELECT_STORAGE, theme.selects)
    saveJSON('nexora_active_theme', theme.id)
    setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 300)
  }, [])

  const handleExport = () => {
    const lines = Object.entries(tokens).map(([k, v]) => `  ${k}: ${v};`)
    const css = `:root {\n${lines.join('\n')}\n}\n\n/* UI Toggles */\n${
      Object.entries(toggles).map(([k, v]) => `/* ${k}: ${v} */`).join('\n')
    }\n\n/* UI Selects */\n${
      Object.entries(selects).map(([k, v]) => `/* ${k}: ${v} */`).join('\n')
    }`
    const blob = new Blob([css], { type: 'text/css' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'nexora-theme.css'; a.click()
    URL.revokeObjectURL(url)
  }

  const changedCount = Object.keys(tokens).filter(k => tokens[k] !== defaults[k]).length
    + Object.keys(toggles).filter(k => toggles[k] !== TOGGLE_DEFAULTS[k]).length
    + Object.keys(selects).filter(k => selects[k] !== SELECT_DEFAULTS[k]).length

  const inputBg = tokens['--input-bg'] ? `hsl(${tokens['--input-bg']})` : 'hsl(var(--input-bg))'
  const inputRadius = tokens['--radius-field'] ?? 'var(--radius-field)'

  return (
    <div className="space-y-8">

      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[15px] font-black text-[hsl(var(--foreground-strong))]">Premium Temalar</h2>
            <p className="text-[11px] mt-0.5" style={{ color: 'hsl(var(--foreground-muted))' }}>
              Hazır tasarlanmış tema koleksiyonu — tek tıkla uygula
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
            style={{ background: 'hsl(var(--primary-soft))', color: 'hsl(var(--primary))' }}>
            <span className="h-1.5 w-1.5 rounded-full inline-block" style={{ background: 'hsl(var(--primary))' }} />
            {PREMIUM_THEMES.find(t => t.id === activeThemeId)?.name ?? 'Özel'}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {PREMIUM_THEMES.map(theme => (
            <PremiumThemeCard
              key={theme.id}
              theme={theme}
              active={activeThemeId === theme.id}
              onApply={handleApplyPremium}
            />
          ))}
        </div>
      </div>

      <div className="h-px" style={{ background: 'hsl(var(--border))' }} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-bold text-[hsl(var(--foreground-strong))]">Token Düzenleyici</h2>
          <p className="text-[11px] text-[hsl(var(--foreground-muted))]">
            Tüm CSS token'larını ince ayarla
            {changedCount > 0 && <span className="ml-2 font-semibold" style={{ color: 'hsl(var(--primary))' }}>{changedCount} değişiklik</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-semibold"
            style={{ background: 'hsl(var(--surface-2))', border: '0.5px solid hsl(var(--border))', color: 'hsl(var(--foreground-default))' }}>
            <DownloadIcon className="h-3.5 w-3.5" /> CSS İndir
          </button>
          <button onClick={() => setSaveOpen(o => !o)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-semibold"
            style={{ background: 'hsl(var(--primary))', color: 'white' }}>
            <SaveIcon className="h-3.5 w-3.5" /> Tema Kaydet
          </button>
          <button onClick={handleResetAll}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-semibold"
            style={{ background: 'hsl(var(--surface-2))', border: '0.5px solid hsl(var(--border))', color: 'hsl(var(--foreground-muted))' }}>
            <RotateCcwIcon className="h-3.5 w-3.5" /> Sıfırla
          </button>
        </div>
      </div>

      {saveOpen && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'hsl(var(--primary-soft))', border: '1.5px solid hsl(var(--primary))' }}>
          <p className="text-[12px] font-bold" style={{ color: 'hsl(var(--primary))' }}>Tema Adı</p>
          <div className="flex gap-2">
            <Input value={presetName} onChange={e => setPresetName(e.target.value)} placeholder="ör: Kurumsal Mavi, Koyu Yeşil..."
              onKeyDown={e => e.key === 'Enter' && handleSavePreset()} />
            <Button onClick={handleSavePreset} disabled={!presetName.trim()}>Kaydet</Button>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>İptal</Button>
          </div>
        </div>
      )}

      {presets.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '0.5px solid hsl(var(--border))', boxShadow: 'var(--shadow-card)' }}>
          <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '0.5px solid hsl(var(--border))', background: 'hsl(var(--surface-0))' }}>
            <UploadIcon className="h-3.5 w-3.5 text-[hsl(var(--foreground-muted))]" />
            <span className="text-[12px] font-bold text-[hsl(var(--foreground-strong))]">Kayıtlı Temalar</span>
          </div>
          <div className="p-3 flex flex-wrap gap-2" style={{ background: 'hsl(var(--surface-1))' }}>
            {presets.map(p => (
              <div key={p.name} className="flex items-center gap-2 rounded-lg px-3 py-1.5"
                style={{ background: 'hsl(var(--surface-0))', border: '0.5px solid hsl(var(--border))' }}>
                <button onClick={() => handleLoadPreset(p)}
                  className="text-[11px] font-semibold hover:text-[hsl(var(--primary))] transition-colors"
                  style={{ color: 'hsl(var(--foreground-strong))' }}>{p.name}</button>
                <span className="text-[9px]" style={{ color: 'hsl(var(--foreground-subtle))' }}>{p.savedAt}</span>
                <button onClick={() => handleDeletePreset(p.name)}
                  className="text-[10px] ml-1 hover:text-[hsl(var(--danger))] transition-colors"
                  style={{ color: 'hsl(var(--foreground-subtle))' }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">

        <div className="space-y-4">

          {/* Kullanıcı isteği (2026-08-03): dark mode geçici olarak gizlendi (kod korunuyor,
              ThemeContext.tsx'te effective her zaman 'light'e sabitlendi) — bu yüzden
              Aydınlık/Karanlık Mod seçim paneli de anlamsız kaldığı için gizlendi. */}
          {(false as boolean) && (
          <div className="rounded-xl overflow-hidden" style={{ border: '0.5px solid hsl(var(--border))', boxShadow: 'var(--shadow-card)' }}>
            <div className="px-4 py-2.5 flex items-center gap-2"
              style={{ background: 'hsl(var(--primary-soft))', borderBottom: '0.5px solid hsl(var(--border))' }}>
              <MonitorIcon className="h-3.5 w-3.5" style={{ color: 'hsl(var(--primary))' }} />
              <span className="text-[12px] font-bold text-[hsl(var(--foreground-strong))]">Aydınlık / Karanlık Mod</span>
            </div>
            <div className="p-4 grid grid-cols-3 gap-3" style={{ background: 'hsl(var(--surface-1))' }}>
              {MODE_OPTIONS.map(({ value, icon: Icon, label }) => {
                const active = mode === value
                return (
                  <button key={value} onClick={() => setMode(value)}
                    className="flex flex-col items-center gap-2 rounded-xl p-3 transition-all"
                    style={{
                      background: active ? 'hsl(var(--primary))' : 'hsl(var(--surface-0))',
                      border: active ? '1.5px solid hsl(var(--primary))' : '0.5px solid hsl(var(--border))',
                    }}>
                    <Icon className="h-5 w-5" style={{ color: active ? 'white' : 'hsl(var(--foreground-muted))' }} />
                    <span className="text-[11px] font-semibold" style={{ color: active ? 'white' : 'hsl(var(--foreground-strong))' }}>{label}</span>
                    {active && <CheckIcon className="h-3 w-3 text-white" />}
                  </button>
                )
              })}
            </div>
          </div>
          )}

          {TOKEN_GROUPS.map(group => (
            <GroupPanel
              key={group.label}
              group={group}
              tokens={tokens}
              toggles={toggles}
              selects={selects}
              onColor={handleColor}
              onSize={handleSize}
              onToggle={handleToggle}
              onSelect={handleSelect}
              onReset={handleReset}
            />
          ))}
        </div>

        <div className="xl:sticky xl:top-0 xl:self-start space-y-3 max-h-screen xl:overflow-y-auto">
          <p className="text-[10px] font-bold uppercase tracking-wider px-1" style={{ color: 'hsl(var(--foreground-muted))' }}>Canlı Önizleme</p>

          <div className="space-y-3">

            <div className="rounded-xl overflow-hidden" style={{ border: '0.5px solid hsl(var(--border))', boxShadow: 'var(--shadow-card)' }}>
              <div className="px-3 py-2 text-[10px] font-bold" style={{ background: 'hsl(var(--primary))', color: 'white' }}>Tablo</div>
              <div className="p-3" style={{ background: 'hsl(var(--surface-0))' }}>
                <PreviewTable toggles={toggles} />
              </div>
            </div>

            <div className="rounded-xl overflow-hidden" style={{ border: '0.5px solid hsl(var(--border))', boxShadow: 'var(--shadow-card)' }}>
              <div className="px-3 py-2 text-[10px] font-bold" style={{ background: 'hsl(var(--surface-2))', color: 'hsl(var(--foreground-strong))' }}>Input Alanları</div>
              <div className="p-3 space-y-2" style={{ background: 'hsl(var(--surface-1))' }}>
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'hsl(var(--foreground-subtle))' }}>Metin Input</p>
                  <div className="flex items-center gap-2 px-3" style={{
                    height: 'var(--control-h)', minHeight: 32, maxHeight: 44,
                    background: inputBg, border: (toggles['--input-show-border'] ?? true) ? '0.5px solid hsl(var(--border))' : 'none',
                    borderRadius: inputRadius,
                  }}>
                    <span className="text-[10px]" style={{ color: 'hsl(var(--foreground-subtle))' }}>Ad Soyad giriniz...</span>
                  </div>
                </div>
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'hsl(var(--foreground-subtle))' }}>Select</p>
                  <div className="flex items-center justify-between gap-2 px-3" style={{
                    height: 'var(--control-h)', minHeight: 32, maxHeight: 44,
                    background: inputBg, border: '0.5px solid hsl(var(--border))',
                    borderRadius: inputRadius,
                  }}>
                    <span className="text-[10px]" style={{ color: 'hsl(var(--foreground-default))' }}>Kategori seçin</span>
                    <ChevronDownIcon className="h-3.5 w-3.5" style={{ color: 'hsl(var(--foreground-subtle))' }} />
                  </div>
                </div>
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'hsl(var(--foreground-subtle))' }}>Textarea</p>
                  <div className="px-3 py-2" style={{
                    background: inputBg, border: '0.5px solid hsl(var(--border))',
                    borderRadius: inputRadius, minHeight: 56,
                  }}>
                    <span className="text-[10px]" style={{ color: 'hsl(var(--foreground-subtle))' }}>Açıklama giriniz...</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl overflow-hidden" style={{ border: '0.5px solid hsl(var(--border))', boxShadow: 'var(--shadow-card)' }}>
              <div className="px-3 py-2 text-[10px] font-bold" style={{ background: 'hsl(var(--surface-2))', color: 'hsl(var(--foreground-strong))' }}>Seçim Kontrolleri</div>
              <div className="p-3 space-y-3" style={{ background: 'hsl(var(--surface-1))' }}>
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'hsl(var(--foreground-subtle))' }}>Checkbox</p>
                  <div className="space-y-1.5">
                    {['Seçenek 1', 'Seçenek 2'].map((label, i) => (
                      <label key={label} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={i === 0 ? previewCheck : false}
                          onCheckedChange={i === 0 ? (v => setPreviewCheck(!!v)) : undefined} />
                        <span className="text-[11px]" style={{ color: 'hsl(var(--foreground-default))' }}>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div style={{ height: '0.5px', background: 'hsl(var(--border))' }} />
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'hsl(var(--foreground-subtle))' }}>Radio</p>
                  <div className="space-y-1.5">
                    {[{ val: 'opt1', label: 'Seçenek A' }, { val: 'opt2', label: 'Seçenek B' }].map(o => (
                      <label key={o.val} className="flex items-center gap-2 cursor-pointer" onClick={() => setPreviewRadio(o.val)}>
                        <div className="h-4 w-4 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ border: `1.5px solid ${previewRadio === o.val ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`, background: 'hsl(var(--surface-1))' }}>
                          {previewRadio === o.val && <div className="h-2 w-2 rounded-full" style={{ background: 'hsl(var(--primary))' }} />}
                        </div>
                        <span className="text-[11px]" style={{ color: 'hsl(var(--foreground-default))' }}>{o.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div style={{ height: '0.5px', background: 'hsl(var(--border))' }} />
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'hsl(var(--foreground-subtle))' }}>Switch (Toggle)</p>
                  <div className="space-y-2">
                    {[{ label: 'Bildirimleri Aç', val: previewSwitch }, { label: 'E-posta Gönder', val: false }].map((item, i) => (
                      <div key={item.label} className="flex items-center justify-between">
                        <span className="text-[11px]" style={{ color: 'hsl(var(--foreground-default))' }}>{item.label}</span>
                        <Switch checked={item.val} onCheckedChange={i === 0 ? setPreviewSwitch : undefined} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl overflow-hidden" style={{ border: '0.5px solid hsl(var(--border))', boxShadow: 'var(--shadow-card)' }}>
              <div className="px-3 py-2 text-[10px] font-bold" style={{ background: 'hsl(var(--surface-2))', color: 'hsl(var(--foreground-strong))' }}>Butonlar</div>
              <div className="p-3 space-y-2" style={{ background: 'hsl(var(--surface-1))' }}>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm">Primary</Button>
                  <Button size="sm" variant="outline">Outline</Button>
                  <Button size="sm" variant="ghost">Ghost</Button>
                  <Button size="sm" variant="danger">Tehlike</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" isLoading>Yükleniyor</Button>
                  <Button size="sm" disabled>Devre Dışı</Button>
                </div>
              </div>
            </div>

            <div className="rounded-xl overflow-hidden" style={{ border: '0.5px solid hsl(var(--border))', boxShadow: 'var(--shadow-card)' }}>
              <div className="px-3 py-2 text-[10px] font-bold" style={{ background: 'hsl(var(--surface-2))', color: 'hsl(var(--foreground-strong))' }}>Badge'ler</div>
              <div className="p-3 flex flex-wrap gap-1.5" style={{ background: 'hsl(var(--surface-1))' }}>
                {(['success', 'warning', 'danger', 'info', 'primary', 'neutral'] as const).map(tone => (
                  <Badge key={tone} tone={tone}>{tone}</Badge>
                ))}
              </div>
            </div>

            <div className="rounded-xl overflow-hidden" style={{ border: '0.5px solid hsl(var(--border))', boxShadow: 'var(--shadow-card)' }}>
              <div className="px-3 py-2 text-[10px] font-bold" style={{ background: 'hsl(var(--surface-2))', color: 'hsl(var(--foreground-strong))' }}>Kartlar</div>
              <div className="p-3 space-y-2" style={{ background: 'hsl(var(--surface-0))' }}>
                {[{ label: 'Toplam Başvuru', val: '248', col: 'hsl(var(--accent-blue))' },
                  { label: 'Onaylanan', val: '183', col: 'hsl(var(--accent-green))' }].map(s => (
                  <div key={s.label} className="rounded-xl p-3"
                    style={{ background: 'hsl(var(--surface-1))', border: '0.5px solid hsl(var(--border))', boxShadow: 'var(--shadow-card)', borderRadius: 'var(--radius-card)' }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="h-7 w-7 rounded-lg" style={{ background: `${s.col}22` }} />
                      <div className="h-1.5 w-1.5 rounded-full" style={{ background: s.col }} />
                    </div>
                    <p className="text-[20px] font-black leading-none" style={{ color: s.col }}>{s.val}</p>
                    <p className="text-[9px] font-semibold uppercase tracking-wide mt-1" style={{ color: 'hsl(var(--foreground-subtle))' }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl overflow-hidden" style={{ border: '0.5px solid hsl(var(--border))', boxShadow: 'var(--shadow-card)' }}>
              <div className="px-3 py-2 text-[10px] font-bold" style={{ background: 'hsl(var(--sidebar-bg, var(--surface-1)))', color: 'hsl(var(--foreground-strong))' }}>Sidebar</div>
              {['Panel Anasayfa', 'Katılımcılar', 'Gezi Sistemi'].map((item, i) => (
                <div key={item} className="flex items-center gap-2 px-3 py-2"
                  style={{
                    background: i === 1 ? 'hsl(var(--sidebar-active-bg, var(--surface-0)))' : 'hsl(var(--sidebar-bg, var(--surface-1)))',
                    borderBottom: i < 2 ? '0.5px solid hsl(var(--border))' : undefined,
                  }}>
                  <div className="h-3 w-3 rounded" style={{ background: i === 1 ? 'hsl(var(--primary))' : 'hsl(var(--foreground-subtle))' }} />
                  <span className="text-[10px] font-medium" style={{ color: i === 1 ? 'hsl(var(--primary))' : 'hsl(var(--foreground-muted))' }}>{item}</span>
                  {i === 1 && <div className="ml-auto h-1.5 w-1.5 rounded-full" style={{ background: 'hsl(var(--primary))' }} />}
                </div>
              ))}
            </div>

            <div className="rounded-xl overflow-hidden" style={{ border: '0.5px solid hsl(var(--border))', boxShadow: 'var(--shadow-card)' }}>
              <div className="px-3 py-2 text-[10px] font-bold" style={{ background: 'hsl(var(--surface-2))', color: 'hsl(var(--foreground-strong))' }}>Yazı Örnekleri</div>
              <div className="p-3 space-y-1.5" style={{ background: 'hsl(var(--surface-1))' }}>
                {[
                  { cls: 'type-heading',   label: 'Sayfa Başlığı',  size: 'var(--text-2xl)' },
                  { cls: 'type-section',   label: 'Bölüm Başlığı', size: 'var(--text-base)' },
                  { cls: 'type-body',      label: 'Gövde Metni',   size: 'var(--text-sm)' },
                  { cls: 'type-muted',     label: 'Soluk Metin',   size: 'var(--text-xs)' },
                  { cls: 'type-caption',   label: 'Küçük Etiket',  size: '10px' },
                ].map(t => (
                  <div key={t.cls} className="flex items-baseline gap-2">
                    <span className={t.cls} style={{ lineHeight: 1.3 }}>{t.label}</span>
                    <span className="text-[9px]" style={{ color: 'hsl(var(--foreground-subtle))' }}>{t.size}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
