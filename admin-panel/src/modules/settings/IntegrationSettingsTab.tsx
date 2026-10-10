import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  MapPinIcon, SparklesIcon, KeyIcon, CheckCircle2Icon, XCircleIcon,
  Trash2Icon, SaveIcon, BotIcon, RadioTowerIcon, PlugZapIcon,
  LibraryBigIcon, PhoneCallIcon,
} from 'lucide-react'
import {
  Button, Field, FormSection, ToggleRow, PasswordInput, Select, Badge, Input, Banner,
} from '@/design-system'
import integrationSettingsService from '@/services/integrationSettings.service'
import type {
  IntegrationSettings, UpdateAiProviderRequest, UpdateMapProviderRequest, UpdateUlakbelSettingsRequest, UlakbelTestResult,
} from '@/types/integrationSettings.types'


type MapDraft = { enabled: boolean; apiKeyInput: string }
type AiDraft = { enabled: boolean; apiKeyInput: string; model: string }
type UlakbelDraft = { enabled: boolean; baseUrl: string; apiTokenInput: string; notifyCitizenOnUpdate: boolean; sourceId: string }
type FlexcityDraft = { enabled: boolean; baseUrl: string; appKeyInput: string; securityCodeInput: string }
type Bridge360Draft = { enabled: boolean; baseUrl: string; apiKeyInput: string }

const emptyMapDraft: MapDraft = { enabled: false, apiKeyInput: '' }
const emptyAiDraft: AiDraft = { enabled: false, apiKeyInput: '', model: '' }
const emptyUlakbelDraft: UlakbelDraft = { enabled: false, baseUrl: '', apiTokenInput: '', notifyCitizenOnUpdate: true, sourceId: '' }
const emptyFlexcityDraft: FlexcityDraft = { enabled: false, baseUrl: '', appKeyInput: '', securityCodeInput: '' }
const emptyBridge360Draft: Bridge360Draft = { enabled: false, baseUrl: '', apiKeyInput: '' }
const toFlexcityDraft = (s: IntegrationSettings): FlexcityDraft =>
  ({ enabled: s.flexcity?.enabled ?? false, baseUrl: s.flexcity?.baseUrl ?? '', appKeyInput: '', securityCodeInput: '' })
const toBridge360Draft = (s: IntegrationSettings): Bridge360Draft =>
  ({ enabled: s.bridge360?.enabled ?? false, baseUrl: s.bridge360?.baseUrl ?? '', apiKeyInput: '' })

const AI_PROVIDER_OPTIONS = [
  { value: '', label: 'Otomatik (ilk etkin sağlayıcı)' },
  { value: 'openai', label: 'ChatGPT (OpenAI)' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'gemini', label: 'Google Gemini' },
]

export const IntegrationSettingsTab = () => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<IntegrationSettings | null>(null)

  const [mapsDraft, setMapsDraft] = useState<MapDraft>(emptyMapDraft)
  const [openAiDraft, setOpenAiDraft] = useState<AiDraft>(emptyAiDraft)
  const [anthropicDraft, setAnthropicDraft] = useState<AiDraft>(emptyAiDraft)
  const [geminiDraft, setGeminiDraft] = useState<AiDraft>(emptyAiDraft)
  const [defaultProvider, setDefaultProvider] = useState('')
  const [ulakbelDraft, setUlakbelDraft] = useState<UlakbelDraft>(emptyUlakbelDraft)
  const [ulakbelTesting, setUlakbelTesting] = useState(false)
  const [ulakbelTestResult, setUlakbelTestResult] = useState<UlakbelTestResult | null>(null)
  const [flexDraft, setFlexDraft] = useState<FlexcityDraft>(emptyFlexcityDraft)
  const [flexTesting, setFlexTesting] = useState(false)
  const [flexTestTc, setFlexTestTc] = useState('')
  const [flexTestResult, setFlexTestResult] = useState<UlakbelTestResult | null>(null)
  const [bridge360Draft, setBridge360Draft] = useState<Bridge360Draft>(emptyBridge360Draft)
  const [bridge360Testing, setBridge360Testing] = useState(false)
  const [bridge360TestResult, setBridge360TestResult] = useState<UlakbelTestResult | null>(null)

  const load = () => {
    setLoading(true)
    integrationSettingsService.get()
      .then((s) => {
        setSettings(s)
        setMapsDraft({ enabled: s.googleMaps.enabled, apiKeyInput: '' })
        setOpenAiDraft({ enabled: s.openAi.enabled, apiKeyInput: '', model: s.openAi.model ?? '' })
        setAnthropicDraft({ enabled: s.anthropic.enabled, apiKeyInput: '', model: s.anthropic.model ?? '' })
        setGeminiDraft({ enabled: s.gemini.enabled, apiKeyInput: '', model: s.gemini.model ?? '' })
        setDefaultProvider(s.defaultAiProvider ?? '')
        setUlakbelDraft({ enabled: s.ulakbel.enabled, baseUrl: s.ulakbel.baseUrl ?? '', apiTokenInput: '', notifyCitizenOnUpdate: s.ulakbel.notifyCitizenOnUpdate, sourceId: s.ulakbel.sourceId != null ? String(s.ulakbel.sourceId) : '' })
        setUlakbelTestResult(null)
        setFlexDraft(toFlexcityDraft(s))
        setFlexTestResult(null)
        setBridge360Draft(toBridge360Draft(s))
        setBridge360TestResult(null)
      })
      .catch(() => toast.error('Entegrasyon ayarları yüklenemedi.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const buildMapReq = (draft: MapDraft): UpdateMapProviderRequest => ({
    enabled: draft.enabled,
    apiKey: draft.apiKeyInput.trim() || null,
    clearApiKey: false,
  })
  const buildAiReq = (draft: AiDraft): UpdateAiProviderRequest => ({
    enabled: draft.enabled,
    apiKey: draft.apiKeyInput.trim() || null,
    clearApiKey: false,
    model: draft.model.trim() || null,
  })
  const parseSourceId = (raw: string): number | null => {
    const trimmed = raw.trim()
    if (!trimmed) return null
    const n = Number(trimmed)
    return Number.isInteger(n) && n > 0 ? n : null
  }

  const buildUlakbelReq = (draft: UlakbelDraft): UpdateUlakbelSettingsRequest => ({
    enabled: draft.enabled,
    baseUrl: draft.baseUrl.trim() || null,
    apiToken: draft.apiTokenInput.trim() || null,
    clearApiToken: false,
    notifyCitizenOnUpdate: draft.notifyCitizenOnUpdate,
    sourceId: parseSourceId(draft.sourceId),
  })

  const save = async () => {
    if (ulakbelDraft.enabled) {
      const parsedSourceId = parseSourceId(ulakbelDraft.sourceId)
      if (ulakbelDraft.sourceId.trim() && parsedSourceId === null) {
        toast.error('Ulakbell Başvuru Kaynağı (Source ID) pozitif bir tam sayı olmalıdır.')
        return
      }
      if (parsedSourceId === null && settings?.ulakbel.sourceId == null) {
        toast.error('Ulakbell entegrasyonunu açmak için Başvuru Kaynağı (Source ID) girilmelidir.')
        return
      }
    }
    setSaving(true)
    try {
      const result = await integrationSettingsService.save({
        googleMaps: buildMapReq(mapsDraft),
        openAi: buildAiReq(openAiDraft),
        anthropic: buildAiReq(anthropicDraft),
        gemini: buildAiReq(geminiDraft),
        defaultAiProvider: defaultProvider || null,
        ulakbel: buildUlakbelReq(ulakbelDraft),
        flexcity: {
          enabled: flexDraft.enabled,
          baseUrl: flexDraft.baseUrl.trim() || null,
          appKey: flexDraft.appKeyInput.trim() || null,
          securityCode: flexDraft.securityCodeInput.trim() || null,
          clearCredentials: false,
        },
        bridge360: {
          enabled: bridge360Draft.enabled,
          baseUrl: bridge360Draft.baseUrl.trim() || null,
          apiKey: bridge360Draft.apiKeyInput.trim() || null,
          clearApiKey: false,
        },
      })
      setSettings(result)
      setMapsDraft({ enabled: result.googleMaps.enabled, apiKeyInput: '' })
      setOpenAiDraft({ enabled: result.openAi.enabled, apiKeyInput: '', model: result.openAi.model ?? '' })
      setAnthropicDraft({ enabled: result.anthropic.enabled, apiKeyInput: '', model: result.anthropic.model ?? '' })
      setGeminiDraft({ enabled: result.gemini.enabled, apiKeyInput: '', model: result.gemini.model ?? '' })
      setUlakbelDraft({ enabled: result.ulakbel.enabled, baseUrl: result.ulakbel.baseUrl ?? '', apiTokenInput: '', notifyCitizenOnUpdate: result.ulakbel.notifyCitizenOnUpdate, sourceId: result.ulakbel.sourceId != null ? String(result.ulakbel.sourceId) : '' })
      setUlakbelTestResult(null)
      setFlexDraft(toFlexcityDraft(result))
      setFlexTestResult(null)
      setBridge360Draft(toBridge360Draft(result))
      setBridge360TestResult(null)
      toast.success('Entegrasyon ayarları kaydedildi.')
    } catch {
      toast.error('Ayarlar kaydedilemedi.')
    } finally {
      setSaving(false)
    }
  }

  const clearKey = async (kind: 'googleMaps' | 'openAi' | 'anthropic' | 'gemini' | 'ulakbel') => {
    if (!settings) return
    setSaving(true)
    try {
      const result = await integrationSettingsService.save({
        googleMaps: kind === 'googleMaps'
          ? { enabled: false, apiKey: null, clearApiKey: true }
          : buildMapReq(mapsDraft),
        openAi: kind === 'openAi'
          ? { enabled: false, apiKey: null, clearApiKey: true, model: openAiDraft.model.trim() || null }
          : buildAiReq(openAiDraft),
        anthropic: kind === 'anthropic'
          ? { enabled: false, apiKey: null, clearApiKey: true, model: anthropicDraft.model.trim() || null }
          : buildAiReq(anthropicDraft),
        gemini: kind === 'gemini'
          ? { enabled: false, apiKey: null, clearApiKey: true, model: geminiDraft.model.trim() || null }
          : buildAiReq(geminiDraft),
        defaultAiProvider: defaultProvider || null,
        ulakbel: kind === 'ulakbel'
          ? { enabled: false, baseUrl: ulakbelDraft.baseUrl.trim() || null, apiToken: null, clearApiToken: true, notifyCitizenOnUpdate: ulakbelDraft.notifyCitizenOnUpdate, sourceId: parseSourceId(ulakbelDraft.sourceId) }
          : buildUlakbelReq(ulakbelDraft),
      })
      setSettings(result)
      setMapsDraft({ enabled: result.googleMaps.enabled, apiKeyInput: '' })
      setOpenAiDraft({ enabled: result.openAi.enabled, apiKeyInput: '', model: result.openAi.model ?? '' })
      setAnthropicDraft({ enabled: result.anthropic.enabled, apiKeyInput: '', model: result.anthropic.model ?? '' })
      setGeminiDraft({ enabled: result.gemini.enabled, apiKeyInput: '', model: result.gemini.model ?? '' })
      setUlakbelDraft({ enabled: result.ulakbel.enabled, baseUrl: result.ulakbel.baseUrl ?? '', apiTokenInput: '', notifyCitizenOnUpdate: result.ulakbel.notifyCitizenOnUpdate, sourceId: result.ulakbel.sourceId != null ? String(result.ulakbel.sourceId) : '' })
      setUlakbelTestResult(null)
      toast.success('API anahtarı kaldırıldı.')
    } catch {
      toast.error('Anahtar kaldırılamadı.')
    } finally {
      setSaving(false)
    }
  }

  const testFlexcity = async () => {
    setFlexTesting(true)
    setFlexTestResult(null)
    try {
      const result = await integrationSettingsService.testFlexcity(flexTestTc.trim() || undefined)
      setFlexTestResult(result)
      if (result.reachable) toast.success('Flexcity bağlantısı çalışıyor.')
      else toast.error(result.message)
    } catch {
      toast.error('Bağlantı testi başarısız oldu.')
    } finally {
      setFlexTesting(false)
    }
  }

  const clearFlexcity = async () => {
    setSaving(true)
    try {
      const result = await integrationSettingsService.save({
        googleMaps: buildMapReq(mapsDraft),
        openAi: buildAiReq(openAiDraft),
        anthropic: buildAiReq(anthropicDraft),
        gemini: buildAiReq(geminiDraft),
        defaultAiProvider: defaultProvider || null,
        ulakbel: buildUlakbelReq(ulakbelDraft),
        flexcity: { enabled: false, baseUrl: flexDraft.baseUrl.trim() || null, appKey: null, securityCode: null, clearCredentials: true },
      })
      setSettings(result)
      setFlexDraft(toFlexcityDraft(result))
      setFlexTestResult(null)
      toast.success('Flexcity anahtarları kaldırıldı, bağlantı kapatıldı.')
    } catch {
      toast.error('Anahtarlar kaldırılamadı.')
    } finally {
      setSaving(false)
    }
  }

  const testBridge360 = async () => {
    setBridge360Testing(true)
    setBridge360TestResult(null)
    try {
      const result = await integrationSettingsService.testBridge360()
      setBridge360TestResult(result)
      if (result.reachable) toast.success('Bridge360 sunucusuna ulaşıldı.')
      else toast.error(result.message)
    } catch {
      toast.error('Bağlantı testi başarısız oldu.')
    } finally {
      setBridge360Testing(false)
    }
  }

  const clearBridge360 = async () => {
    setSaving(true)
    try {
      const result = await integrationSettingsService.save({
        googleMaps: buildMapReq(mapsDraft),
        openAi: buildAiReq(openAiDraft),
        anthropic: buildAiReq(anthropicDraft),
        gemini: buildAiReq(geminiDraft),
        defaultAiProvider: defaultProvider || null,
        ulakbel: buildUlakbelReq(ulakbelDraft),
        bridge360: { enabled: false, baseUrl: bridge360Draft.baseUrl.trim() || null, apiKey: null, clearApiKey: true },
      })
      setSettings(result)
      setBridge360Draft(toBridge360Draft(result))
      setBridge360TestResult(null)
      toast.success('Bridge360 anahtarı kaldırıldı, bağlantı kapatıldı.')
    } catch {
      toast.error('Anahtar kaldırılamadı.')
    } finally {
      setSaving(false)
    }
  }

  const testUlakbel = async () => {
    setUlakbelTesting(true)
    setUlakbelTestResult(null)
    try {
      const result = await integrationSettingsService.testUlakbel()
      setUlakbelTestResult(result)
      if (result.reachable) toast.success('Ulakbell sunucusuna ulaşıldı.')
      else toast.error(result.message)
    } catch {
      toast.error('Bağlantı testi başarısız oldu.')
    } finally {
      setUlakbelTesting(false)
    }
  }

  const KeyStatusBadge = ({ hasKey, masked }: { hasKey: boolean; masked: string | null }) => (
    hasKey
      ? <Badge tone="success"><CheckCircle2Icon className="h-3 w-3" /> Kayıtlı: {masked}</Badge>
      : <Badge tone="neutral"><XCircleIcon className="h-3 w-3" /> Anahtar girilmemiş</Badge>
  )

  if (loading) {
    return <div className="animate-pulse space-y-4"><div className="h-40 rounded-card bg-surface-2" /><div className="h-40 rounded-card bg-surface-2" /></div>
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <FormSection
        variant="card"
        icon={MapPinIcon}
        title="Google Maps"
        subtitle="Firmalar bölümü ve tüm servislerdeki haritalar (konum seçici, harita görünümleri) bu API key ile çalışır."
      >
        {settings && (
          <div className="flex items-center gap-2">
            <KeyStatusBadge hasKey={settings.googleMaps.hasApiKey} masked={settings.googleMaps.maskedApiKey} />
            {settings.googleMaps.hasApiKey && (
              <Button variant="ghost" size="sm" iconLeft={<Trash2Icon className="h-3.5 w-3.5" />} onClick={() => void clearKey('googleMaps')} disabled={saving}>
                Kaldır
              </Button>
            )}
          </div>
        )}
        <ToggleRow
          label="Google Maps entegrasyonunu etkinleştir"
          description="Kapalıyken haritalar render edilmez, statik/placeholder gösterime düşülür."
          checked={mapsDraft.enabled}
          onChange={(v) => setMapsDraft((p) => ({ ...p, enabled: v }))}
        />
        <Field label="API Key" hint="Google Cloud Console > Credentials'dan alınan 'Maps JavaScript API' anahtarı. Boş bırakılırsa mevcut kayıtlı anahtar korunur.">
          <PasswordInput
            placeholder={settings?.googleMaps.hasApiKey ? 'Değiştirmek için yeni anahtar girin…' : 'AIza…'}
            value={mapsDraft.apiKeyInput}
            onChange={(e) => setMapsDraft((p) => ({ ...p, apiKeyInput: e.target.value }))}
            iconLeft={<KeyIcon className="h-4 w-4" />}
          />
        </Field>
      </FormSection>

      <FormSection
        variant="card"
        icon={SparklesIcon}
        title="Yapay Zeka Sağlayıcıları"
        subtitle="ChatGPT (OpenAI), Anthropic (Claude) ve Google Gemini API key'leri — Raporlama modülündeki 'Yapay Zeka ile Özetle' ve gelecekteki sorgu/analiz özellikleri burada tanımlı olan sağlayıcıyı kullanır."
      >
        <Field label="Varsayılan Sağlayıcı" hint="Sorgu/rapor akışları hangi sağlayıcıyı öncelikli kullanacak. 'Otomatik' seçilirse etkin olan ilk sağlayıcı (OpenAI → Anthropic → Gemini sırasıyla) kullanılır.">
          <Select value={defaultProvider} onChange={(e) => setDefaultProvider(e.target.value)}>
            {AI_PROVIDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>

        <div className="space-y-5 pt-2">
          <div className="rounded-card border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BotIcon className="h-4 w-4 text-[hsl(var(--primary))]" />
                <span className="type-body-strong">ChatGPT (OpenAI)</span>
              </div>
              {settings && (
                <div className="flex items-center gap-2">
                  <KeyStatusBadge hasKey={settings.openAi.hasApiKey} masked={settings.openAi.maskedApiKey} />
                  {settings.openAi.hasApiKey && (
                    <Button variant="ghost" size="sm" iconLeft={<Trash2Icon className="h-3.5 w-3.5" />} onClick={() => void clearKey('openAi')} disabled={saving}>Kaldır</Button>
                  )}
                </div>
              )}
            </div>
            <ToggleRow label="Etkinleştir" checked={openAiDraft.enabled} onChange={(v) => setOpenAiDraft((p) => ({ ...p, enabled: v }))} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="API Key" hint="platform.openai.com üzerinden alınır (sk-… ile başlar).">
                <PasswordInput
                  placeholder={settings?.openAi.hasApiKey ? 'Değiştirmek için yeni anahtar girin…' : 'sk-…'}
                  value={openAiDraft.apiKeyInput}
                  onChange={(e) => setOpenAiDraft((p) => ({ ...p, apiKeyInput: e.target.value }))}
                  iconLeft={<KeyIcon className="h-4 w-4" />}
                />
              </Field>
              <Field label="Model">
                <input
                  className="flex h-[var(--control-h)] w-full rounded-field border border-border bg-surface-0 px-3 type-body outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                  placeholder="gpt-4o"
                  value={openAiDraft.model}
                  onChange={(e) => setOpenAiDraft((p) => ({ ...p, model: e.target.value }))}
                />
              </Field>
            </div>
          </div>

          <div className="rounded-card border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BotIcon className="h-4 w-4 text-[hsl(var(--accent-violet))]" />
                <span className="type-body-strong">Anthropic (Claude)</span>
              </div>
              {settings && (
                <div className="flex items-center gap-2">
                  <KeyStatusBadge hasKey={settings.anthropic.hasApiKey} masked={settings.anthropic.maskedApiKey} />
                  {settings.anthropic.hasApiKey && (
                    <Button variant="ghost" size="sm" iconLeft={<Trash2Icon className="h-3.5 w-3.5" />} onClick={() => void clearKey('anthropic')} disabled={saving}>Kaldır</Button>
                  )}
                </div>
              )}
            </div>
            <ToggleRow label="Etkinleştir" checked={anthropicDraft.enabled} onChange={(v) => setAnthropicDraft((p) => ({ ...p, enabled: v }))} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="API Key" hint="console.anthropic.com üzerinden alınır (sk-ant-… ile başlar).">
                <PasswordInput
                  placeholder={settings?.anthropic.hasApiKey ? 'Değiştirmek için yeni anahtar girin…' : 'sk-ant-…'}
                  value={anthropicDraft.apiKeyInput}
                  onChange={(e) => setAnthropicDraft((p) => ({ ...p, apiKeyInput: e.target.value }))}
                  iconLeft={<KeyIcon className="h-4 w-4" />}
                />
              </Field>
              <Field label="Model">
                <input
                  className="flex h-[var(--control-h)] w-full rounded-field border border-border bg-surface-0 px-3 type-body outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                  placeholder="claude-sonnet-4-5"
                  value={anthropicDraft.model}
                  onChange={(e) => setAnthropicDraft((p) => ({ ...p, model: e.target.value }))}
                />
              </Field>
            </div>
          </div>

          <div className="rounded-card border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BotIcon className="h-4 w-4 text-[hsl(var(--accent-orange))]" />
                <span className="type-body-strong">Google Gemini</span>
              </div>
              {settings && (
                <div className="flex items-center gap-2">
                  <KeyStatusBadge hasKey={settings.gemini.hasApiKey} masked={settings.gemini.maskedApiKey} />
                  {settings.gemini.hasApiKey && (
                    <Button variant="ghost" size="sm" iconLeft={<Trash2Icon className="h-3.5 w-3.5" />} onClick={() => void clearKey('gemini')} disabled={saving}>Kaldır</Button>
                  )}
                </div>
              )}
            </div>
            <ToggleRow label="Etkinleştir" checked={geminiDraft.enabled} onChange={(v) => setGeminiDraft((p) => ({ ...p, enabled: v }))} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="API Key" hint="aistudio.google.com/apikey üzerinden alınır.">
                <PasswordInput
                  placeholder={settings?.gemini.hasApiKey ? 'Değiştirmek için yeni anahtar girin…' : 'AIza…'}
                  value={geminiDraft.apiKeyInput}
                  onChange={(e) => setGeminiDraft((p) => ({ ...p, apiKeyInput: e.target.value }))}
                  iconLeft={<KeyIcon className="h-4 w-4" />}
                />
              </Field>
              <Field label="Model">
                <input
                  className="flex h-[var(--control-h)] w-full rounded-field border border-border bg-surface-0 px-3 type-body outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                  placeholder="gemini-2.0-flash"
                  value={geminiDraft.model}
                  onChange={(e) => setGeminiDraft((p) => ({ ...p, model: e.target.value }))}
                />
              </Field>
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection
        variant="card"
        icon={RadioTowerIcon}
        title="Ulakbell Entegrasyonu"
        subtitle="Muhtarlık başvurularının ilgili birime iletilmesi (Ulakbel'e İlet) bu bağlantı üzerinden gerçek API çağrısıyla yapılır. Yapılandırılmamışsa mevcut yerel takip numarası üretimiyle simüle edilmeye devam eder — hiçbir kesinti olmaz."
      >
        {settings && (
          <div className="flex items-center gap-2">
            <KeyStatusBadge hasKey={settings.ulakbel.hasApiToken} masked={settings.ulakbel.maskedApiToken} />
            {settings.ulakbel.hasApiToken && (
              <Button variant="ghost" size="sm" iconLeft={<Trash2Icon className="h-3.5 w-3.5" />} onClick={() => void clearKey('ulakbel')} disabled={saving}>
                Kaldır
              </Button>
            )}
          </div>
        )}
        <ToggleRow
          label="Ulakbell entegrasyonunu etkinleştir"
          description="Kapalıyken 'Ulakbel'e İlet' butonu mevcut yerel simülasyon davranışına devam eder."
          checked={ulakbelDraft.enabled}
          onChange={(v) => setUlakbelDraft((p) => ({ ...p, enabled: v }))}
        />
        <ToggleRow
          label="Ulakbel sonucu vatandaşa sistem içi bildirim gönder"
          description="Kapalıyken başvuru Ulakbel'e iletildiğinde/sonuçlandığında vatandaşa bizim sistemimizden bildirim GİTMEZ — Ulakbel kendi tarafında bildirim gönderiyorsa bu ayardan bağımsız olarak göndermeye devam eder, biz sadece kendi bildirimimizi kontrol ediyoruz. Entegrasyon simülasyon modunda (yukarıdaki anahtar kapalı) çalışsa bile bu ayar geçerlidir."
          checked={ulakbelDraft.notifyCitizenOnUpdate}
          onChange={(v) => setUlakbelDraft((p) => ({ ...p, notifyCitizenOnUpdate: v }))}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Sunucu Adresi (Base URL)" hint="ör. https://ulakbell.bakirkoy.bel.tr — sonundaki / olmadan.">
            <Input
              placeholder="https://…"
              value={ulakbelDraft.baseUrl}
              onChange={(e) => setUlakbelDraft((p) => ({ ...p, baseUrl: e.target.value }))}
            />
          </Field>
          <Field label="API Token (Bearer)" hint="Boş bırakılırsa mevcut kayıtlı token korunur.">
            <PasswordInput
              placeholder={settings?.ulakbel.hasApiToken ? 'Değiştirmek için yeni token girin…' : 'Bearer token…'}
              value={ulakbelDraft.apiTokenInput}
              onChange={(e) => setUlakbelDraft((p) => ({ ...p, apiTokenInput: e.target.value }))}
              iconLeft={<KeyIcon className="h-4 w-4" />}
            />
          </Field>
          <Field label="Başvuru Kaynağı (Source ID)" hint="Ulakbell'in kuruma verdiği başvuru kaynağı numarası. Gerçek gönderim için zorunludur (pozitif tam sayı).">
            <Input
              sanitize="digits"
              placeholder="ör. 38"
              value={ulakbelDraft.sourceId}
              onChange={(e) => setUlakbelDraft((p) => ({ ...p, sourceId: e.target.value }))}
            />
          </Field>
        </div>
        {settings?.ulakbel.enabled && settings.ulakbel.hasApiToken && (
          <div className="space-y-2">
            <Button variant="outline" size="sm" iconLeft={<PlugZapIcon className="h-3.5 w-3.5" />} isLoading={ulakbelTesting} onClick={() => void testUlakbel()} disabled={ulakbelTesting}>
              Bağlantıyı Test Et
            </Button>
            {ulakbelTestResult && (
              <Banner tone={ulakbelTestResult.reachable ? 'success' : 'danger'} variant="soft">
                {ulakbelTestResult.message}
              </Banner>
            )}
          </div>
        )}
      </FormSection>

      <FormSection
        variant="card"
        icon={LibraryBigIcon}
        title="Flexcity Kütüphane (Ödünç Kitap) Entegrasyonu"
        subtitle="Açıkken kütüphaneye giriş yapan kişinin Flexcity'de iade tarihi geçmiş ödünç kitabı olup olmadığı sorgulanır: görevliye uyarı gösterilir, 'Gecikmiş Kitaplar' listesi dolar. Kütüphane ayarında 'gecikmiş kitabı olan giremesin' açıksa giriş engellenir. Kapalıyken hiçbir sorgu yapılmaz, giriş normal işler."
      >
        {settings && (
          <div className="flex flex-wrap items-center gap-2">
            <KeyStatusBadge hasKey={settings.flexcity?.hasAppKey ?? false} masked={settings.flexcity?.maskedAppKey ?? null} />
            {settings.flexcity?.hasSecurityCode
              ? <Badge tone="success"><CheckCircle2Icon className="h-3 w-3" /> Güvenlik kodu kayıtlı</Badge>
              : <Badge tone="neutral"><XCircleIcon className="h-3 w-3" /> Güvenlik kodu girilmemiş</Badge>}
            {(settings.flexcity?.hasAppKey || settings.flexcity?.hasSecurityCode) && (
              <Button variant="ghost" size="sm" iconLeft={<Trash2Icon className="h-3.5 w-3.5" />} onClick={() => void clearFlexcity()} disabled={saving}>
                Kaldır
              </Button>
            )}
          </div>
        )}
        <ToggleRow
          label="Flexcity entegrasyonunu etkinleştir"
          description="Kapalıyken ödünç kitap sorgusu yapılmaz. Bilgileri girip kapalı bırakabilir, istediğiniz zaman açabilirsiniz."
          checked={flexDraft.enabled}
          onChange={(v) => setFlexDraft((p) => ({ ...p, enabled: v }))}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Sunucu Adresi" hint="Flexcity sunucusu, ör. https://flexcity.bakirkoy.bel.tr (sonunda / olmadan).">
            <Input placeholder="https://…" value={flexDraft.baseUrl} onChange={(e) => setFlexDraft((p) => ({ ...p, baseUrl: e.target.value }))} />
          </Field>
          <Field label="Uygulama Anahtarı (applicationkey)" hint="Boş bırakılırsa kayıtlı anahtar korunur.">
            <PasswordInput
              placeholder={settings?.flexcity?.hasAppKey ? 'Değiştirmek için yeni anahtar…' : 'applicationkey…'}
              value={flexDraft.appKeyInput}
              onChange={(e) => setFlexDraft((p) => ({ ...p, appKeyInput: e.target.value }))}
              iconLeft={<KeyIcon className="h-4 w-4" />}
            />
          </Field>
          <Field label="Güvenlik Kodu" hint="Boş bırakılırsa kayıtlı kod korunur.">
            <PasswordInput
              placeholder={settings?.flexcity?.hasSecurityCode ? 'Değiştirmek için yeni kod…' : 'güvenlik kodu…'}
              value={flexDraft.securityCodeInput}
              onChange={(e) => setFlexDraft((p) => ({ ...p, securityCodeInput: e.target.value }))}
              iconLeft={<KeyIcon className="h-4 w-4" />}
            />
          </Field>
        </div>
        {settings?.flexcity?.enabled && settings.flexcity.hasAppKey && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Deneme TC (isteğe bağlı)" hint="Girilirse bu kişinin gecikmiş kitap sayısı gösterilir.">
                <Input inputMode="numeric" maxLength={11} placeholder="11 haneli TC" value={flexTestTc} onChange={(e) => setFlexTestTc(e.target.value.replace(/\D/g, ''))} />
              </Field>
              <Button variant="outline" size="sm" iconLeft={<PlugZapIcon className="h-3.5 w-3.5" />} isLoading={flexTesting} onClick={() => void testFlexcity()} disabled={flexTesting}>
                Bağlantıyı Test Et
              </Button>
            </div>
            {flexTestResult && (
              <Banner tone={flexTestResult.reachable ? 'success' : 'danger'} variant="soft">{flexTestResult.message}</Banner>
            )}
          </div>
        )}
      </FormSection>

      <FormSection
        variant="card"
        icon={PhoneCallIcon}
        title="Bridge360 Çağrı Merkezi Entegrasyonu"
        subtitle="Halk Masası'nın kaldırılmasıyla birlikte tüm vatandaş talep/şikayet/öneri akışı Muhtarlık modülüne taşındı. Bridge360, Ulakbell'in yanına eklenecek bir çağrı merkezi/CRM hedefi olarak hazırlandı. Gerçek Bridge360 API dokümanı henüz sağlanmadığı için burada sadece bağlantı ayarları ve genel bir erişilebilirlik testi vardır — başvuruların otomatik Bridge360'a iletimi, API bilgileri sağlanmadan eklenmeyecektir."
      >
        <Banner tone="warning" variant="soft">
          Bridge360 API dokümanı/erişim bilgisi henüz sağlanmadı. Bu bölüm sadece ayarları saklar
          ve genel bir bağlantı testi yapar; Ulakbell'deki gibi gerçek bir başvuru iletimi
          (forward) henüz YOKTUR. Gerçek API bilgileri sağlandığında forward özelliği eklenecektir.
        </Banner>
        {settings && (
          <div className="flex items-center gap-2">
            <KeyStatusBadge hasKey={settings.bridge360?.hasApiKey ?? false} masked={settings.bridge360?.maskedApiKey ?? null} />
            {settings.bridge360?.hasApiKey && (
              <Button variant="ghost" size="sm" iconLeft={<Trash2Icon className="h-3.5 w-3.5" />} onClick={() => void clearBridge360()} disabled={saving}>
                Kaldır
              </Button>
            )}
          </div>
        )}
        <ToggleRow
          label="Bridge360 entegrasyonunu etkinleştir"
          description="Şu an sadece bağlantı testi için kullanılır; gerçek API şeması tanımlanana kadar başvuru iletimi yapılmaz."
          checked={bridge360Draft.enabled}
          onChange={(v) => setBridge360Draft((p) => ({ ...p, enabled: v }))}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Sunucu Adresi (Base URL)" hint="Bridge360 sağlayıcısından alınan adres, ör. https://bridge360.ornek.com.tr — sonunda / olmadan.">
            <Input
              placeholder="https://…"
              value={bridge360Draft.baseUrl}
              onChange={(e) => setBridge360Draft((p) => ({ ...p, baseUrl: e.target.value }))}
            />
          </Field>
          <Field label="API Anahtarı" hint="Boş bırakılırsa mevcut kayıtlı anahtar korunur.">
            <PasswordInput
              placeholder={settings?.bridge360?.hasApiKey ? 'Değiştirmek için yeni anahtar girin…' : 'API anahtarı…'}
              value={bridge360Draft.apiKeyInput}
              onChange={(e) => setBridge360Draft((p) => ({ ...p, apiKeyInput: e.target.value }))}
              iconLeft={<KeyIcon className="h-4 w-4" />}
            />
          </Field>
        </div>
        {settings?.bridge360?.enabled && settings.bridge360.hasApiKey && (
          <div className="space-y-2">
            <Button variant="outline" size="sm" iconLeft={<PlugZapIcon className="h-3.5 w-3.5" />} isLoading={bridge360Testing} onClick={() => void testBridge360()} disabled={bridge360Testing}>
              Bağlantıyı Test Et
            </Button>
            {bridge360TestResult && (
              <Banner tone={bridge360TestResult.reachable ? 'success' : 'danger'} variant="soft">
                {bridge360TestResult.message}
              </Banner>
            )}
          </div>
        )}
      </FormSection>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={load} disabled={saving}>Vazgeç</Button>
        <Button variant="primary" iconLeft={<SaveIcon className="h-4 w-4" />} isLoading={saving} onClick={() => void save()}>
          Kaydet
        </Button>
      </div>
    </div>
  )
}
