import { useEffect, useRef, useState } from 'react'
import { SmartphoneIcon, AlertTriangleIcon, SaveIcon, LinkIcon, ShieldCheckIcon, ArrowUpCircleIcon, ImageIcon, UploadIcon, Trash2Icon, PaletteIcon } from 'lucide-react'
import { toast } from 'sonner'
import {
  PageHeader, Button, Input, Textarea, Field, FormSection, ToggleRow, Banner, SkeletonRows,
} from '@/design-system'
import { UiStandardsContext } from '@/design-system/UiStandards/UiStandards'
import '@/templates/FacilityTemplate/pilot/facility-ui.css'
import { ImageCropModal } from '@/components/specialized/ImageCropModal'
import { formatDateTime, isValidAppVersion, isValidHttpsUrl } from '@/lib/utils'
import { mobileConfigService, type MobileAppConfig, type UpdateVersionControlRequest } from '@/services/mobileConfig.service'
import { QuickActionsSection } from './QuickActionsSection'
import { MobileLogoField } from './MobileLogoField'
import { HomeFeatureCardsSection } from './HomeFeatureCardsSection'
import { OnboardingImagesSection } from './OnboardingImagesSection'

type VersionForm = Record<keyof UpdateVersionControlRequest, string>

const SPLASH_MAX_BYTES = 2 * 1024 * 1024
const SPLASH_SOURCE_MAX_BYTES = 15 * 1024 * 1024
const SPLASH_WIDTH = 1080
const SPLASH_HEIGHT = 1920

const HOME_LOGO_WIDTH = 1200
const HOME_LOGO_HEIGHT = 195
const TABBAR_LOGO_SIZE = 512

const EMPTY_VERSION_FORM: VersionForm = {
  androidMinVersion: '',
  androidLatestVersion: '',
  androidStoreUrl: '',
  iosMinVersion: '',
  iosLatestVersion: '',
  iosStoreUrl: '',
  updateMessage: '',
  updateReleaseNotes: '',
}

const toVersionForm = (c: MobileAppConfig): VersionForm => ({
  androidMinVersion: c.androidMinVersion ?? '',
  androidLatestVersion: c.androidLatestVersion ?? '',
  androidStoreUrl: c.androidStoreUrl ?? '',
  iosMinVersion: c.iosMinVersion ?? '',
  iosLatestVersion: c.iosLatestVersion ?? '',
  iosStoreUrl: c.iosStoreUrl ?? '',
  updateMessage: c.updateMessage ?? '',
  updateReleaseNotes: c.updateReleaseNotes ?? '',
})

const parseVersion = (value: string): number[] | null => {
  const trimmed = value.trim()
  if (!trimmed || !isValidAppVersion(trimmed)) return null
  return trimmed.split('.').map(Number)
}

const minNotAboveLatest = (min: string, latest: string): boolean => {
  const a = parseVersion(min)
  const b = parseVersion(latest)
  if (!a || !b) return true
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x !== y) return x < y
  }
  return true
}

export const MobileConfigPage = () => {
  const [config, setConfig] = useState<MobileAppConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [enabled, setEnabled] = useState(false)
  const [url, setUrl] = useState('')
  const [maxVersion, setMaxVersion] = useState('')
  const [message, setMessage] = useState('')
  const [legal, setLegal] = useState<MobileAppConfig['legalDocuments'] | null>(null)
  const [savingLegal, setSavingLegal] = useState(false)

  const [version, setVersion] = useState<VersionForm>(EMPTY_VERSION_FORM)
  const [savingVersion, setSavingVersion] = useState(false)

  const [splashImageUrl, setSplashImageUrl] = useState<string | null>(null)
  const [uploadingSplash, setUploadingSplash] = useState(false)
  const [removingSplash, setRemovingSplash] = useState(false)
  const [splashCropSrc, setSplashCropSrc] = useState<string | null>(null)
  const splashInputRef = useRef<HTMLInputElement>(null)

  const closeSplashCrop = () => {
    if (splashCropSrc) URL.revokeObjectURL(splashCropSrc)
    setSplashCropSrc(null)
    if (splashInputRef.current) splashInputRef.current.value = ''
  }

  useEffect(() => () => {
    if (splashCropSrc) URL.revokeObjectURL(splashCropSrc)
  }, [splashCropSrc])

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const current = await mobileConfigService.get()
        if (!active) return
        setConfig(current)
        setEnabled(current.webViewEnabled)
        setUrl(current.webViewUrl)
        setMaxVersion(current.webViewMaxVersion ?? '')
        setMessage(current.webViewMessage ?? '')
        setLegal(current.legalDocuments)
        setVersion(toVersionForm(current))
        setSplashImageUrl(current.splashImageUrl)
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [])

  const urlError = enabled && url.trim().length > 0 && !isValidHttpsUrl(url.trim())
    ? 'Portal adresi geçerli bir https adresi olmalıdır.'
    : undefined

  const versionError = maxVersion.trim().length > 0 && !isValidAppVersion(maxVersion.trim())
    ? 'Sürüm 1.2.3 biçiminde olmalıdır.'
    : undefined

  const canSave = !saving && !urlError && !versionError && (!enabled || url.trim().length > 0)

  const save = async () => {
    const payload = {
      enabled,
      url: url.trim(),
      maxVersion: maxVersion.trim() || null,
      message: message.trim() || null,
    }
    const modeChanged = config !== null && config.webViewEnabled !== payload.enabled
    const unchanged =
      config !== null &&
      !modeChanged &&
      (config.webViewUrl ?? '') === payload.url &&
      (config.webViewMaxVersion ?? null) === payload.maxVersion &&
      (config.webViewMessage ?? null) === payload.message

    if (unchanged) {
      toast.success('Değişiklik yapılmadı.')
      return
    }

    setSaving(true)
    try {
      const updated = await mobileConfigService.updateWebView(payload)
      setConfig(updated)
      toast.success(
        modeChanged
          ? updated.webViewEnabled
            ? 'Webview modu açıldı. Uygulamayı yeniden açan kullanıcılar portala yönlenecek.'
            : 'Webview modu kapatıldı. Kullanıcılar normal uygulamaya dönecek.'
          : 'Webview ayarları güncellendi.',
      )
    } finally {
      setSaving(false)
    }
  }

  const saveLegal = async () => {
    if (!legal) return
    setSavingLegal(true)
    try {
      const updated = await mobileConfigService.updateLegalDocuments(legal)
      setConfig(updated)
      setLegal(updated.legalDocuments)
      toast.success('KVKK ve bildirim izni metinleri güncellendi.')
    } finally {
      setSavingLegal(false)
    }
  }

  const versionFieldError = (value: string) =>
    value.trim().length > 0 && !isValidAppVersion(value.trim())
      ? 'Sürüm 1.2.3 biçiminde olmalıdır.'
      : undefined

  const storeUrlError = (value: string) =>
    value.trim().length > 0 && !isValidHttpsUrl(value.trim())
      ? 'Mağaza adresi geçerli bir https adresi olmalıdır.'
      : undefined

  const androidOrderError = !minNotAboveLatest(version.androidMinVersion, version.androidLatestVersion)
    ? 'Zorunlu sürüm, güncel sürümden büyük olamaz.'
    : undefined
  const iosOrderError = !minNotAboveLatest(version.iosMinVersion, version.iosLatestVersion)
    ? 'Zorunlu sürüm, güncel sürümden büyük olamaz.'
    : undefined

  const versionHasError = Boolean(
    androidOrderError || iosOrderError ||
    versionFieldError(version.androidMinVersion) ||
    versionFieldError(version.androidLatestVersion) ||
    versionFieldError(version.iosMinVersion) ||
    versionFieldError(version.iosLatestVersion) ||
    storeUrlError(version.androidStoreUrl) ||
    storeUrlError(version.iosStoreUrl),
  )

  const saveVersion = async () => {
    setSavingVersion(true)
    try {
      const payload = Object.fromEntries(
        Object.entries(version).map(([key, value]) => [key, value.trim() || null]),
      ) as unknown as UpdateVersionControlRequest
      const updated = await mobileConfigService.updateVersionControl(payload)
      setConfig(updated)
      setVersion(toVersionForm(updated))
      toast.success('Sürüm kontrolü güncellendi.')
    } finally {
      setSavingVersion(false)
    }
  }

  const uploadSplash = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.warning('Lütfen bir görsel dosyası seçin.')
      return
    }
    if (file.size > SPLASH_MAX_BYTES) {
      toast.warning('Görsel en fazla 2 MB olabilir.')
      return
    }

    setUploadingSplash(true)
    try {
      const { url } = await mobileConfigService.uploadSplashImage(file)
      const updated = await mobileConfigService.updateSplashImage(url)
      setConfig(updated)
      setSplashImageUrl(updated.splashImageUrl)
      toast.success('Açılış görseli güncellendi. Kullanıcılar uygulama açılışında görecek.')
    } finally {
      setUploadingSplash(false)
      if (splashInputRef.current) splashInputRef.current.value = ''
    }
  }

  const selectSplashForCrop = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.warning('Lütfen bir görsel dosyası seçin.')
      return
    }
    if (file.size > SPLASH_SOURCE_MAX_BYTES) {
      toast.warning('Kırpılacak kaynak görsel en fazla 15 MB olabilir.')
      return
    }
    if (splashCropSrc) URL.revokeObjectURL(splashCropSrc)
    setSplashCropSrc(URL.createObjectURL(file))
  }

  const uploadCroppedSplash = async (blob: Blob) => {
    const file = new File([blob], `splash-${Date.now()}.webp`, { type: 'image/webp' })
    closeSplashCrop()
    await uploadSplash(file)
  }

  const removeSplash = async () => {
    setRemovingSplash(true)
    try {
      const updated = await mobileConfigService.updateSplashImage(null)
      setConfig(updated)
      setSplashImageUrl(updated.splashImageUrl)
      toast.success('Açılış görseli kaldırıldı. Uygulama kendi logosunu gösterecek.')
    } finally {
      setRemovingSplash(false)
    }
  }

  const setVersionField = (key: keyof VersionForm) => (value: string) =>
    setVersion((current) => ({ ...current, [key]: value }))

  return (
    <UiStandardsContext.Provider value={true}>
      <div className="facility-ui-pilot pilot-page-shell flex h-full flex-col">
        <PageHeader
          icon={SmartphoneIcon}
          title="Mobil Uygulama Ayarları"
          subtitle="Acil durumda mobil uygulamayı web sürümüne yönlendirin"
          breadcrumb="Sistem / Mobil Uygulama Ayarları"
        />

        <div className="pilot-content flex-1 space-y-4 overflow-auto">
        {loading ? (
          <SkeletonRows rows={6} />
        ) : (
          <>
            {enabled && (
              <Banner tone="warning" variant="soft" icon={AlertTriangleIcon}>
                Webview modu aktif. Kapsamdaki kullanıcılar uygulamayı açtığında native ekranlar
                yerine portal görüntülenir; oturumları devredildiği için tekrar giriş yapmaları
                gerekmez.
              </Banner>
            )}

            <FormSection
              variant="card"
              icon={SmartphoneIcon}
              title="Webview modu"
              subtitle="Mobil uygulamayı tamamen web sürümüne yönlendirir"
            >
              <ToggleRow
                label="Webview modunu aç"
                description="Açıldığında kapsamdaki kullanıcılar uygulama yerine portalı görür."
                checked={enabled}
                onChange={setEnabled}
              />
            </FormSection>

            <FormSection
              variant="card"
              icon={ImageIcon}
              title="Açılış (splash) görseli"
              subtitle="Uygulama açılırken gösterilen görseli buradan yönetin"
            >
              <div className="space-y-4">
                <Banner tone="info" variant="soft">
                  Yüklediğiniz görsel <strong>9:16 oranında</strong> kırpılır ve mobil ekranlara
                  uygun <strong>1080 × 1920 px WebP</strong> olarak kaydedilir. Önemli yazı ve
                  logoları kırpma çerçevesinin içinde tutun. Çıktı en fazla 2 MB olabilir.
                </Banner>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex h-48 w-[108px] shrink-0 items-center justify-center overflow-hidden rounded-card border border-border bg-surface-2">
                    {splashImageUrl ? (
                      <img src={splashImageUrl} alt="Açılış görseli" className="h-full w-full object-contain" />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-foreground-subtle" />
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <p className="type-muted">
                      {splashImageUrl
                        ? 'Şu anda yüklü olan görsel kullanılıyor.'
                        : 'Görsel yüklenmedi — uygulama kendi logosunu gösteriyor.'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <input
                        ref={splashInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) selectSplashForCrop(file)
                        }}
                      />
                      <Button
                        variant="outline"
                        iconLeft={<UploadIcon className="h-4 w-4" />}
                        isLoading={uploadingSplash}
                        disabled={removingSplash}
                        onClick={() => splashInputRef.current?.click()}
                        type="button"
                      >
                        {splashImageUrl ? 'Görseli değiştir' : 'Görsel yükle'}
                      </Button>
                      {splashImageUrl && (
                        <Button
                          variant="danger"
                          iconLeft={<Trash2Icon className="h-4 w-4" />}
                          isLoading={removingSplash}
                          disabled={uploadingSplash}
                          onClick={() => void removeSplash()}
                          type="button"
                        >
                          Kaldır
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </FormSection>

            <OnboardingImagesSection
              images={config?.onboardingImageUrls ?? []}
              onChange={setConfig}
            />

            {splashCropSrc && (
              <ImageCropModal
                open
                imageSrc={splashCropSrc}
                aspect={SPLASH_WIDTH / SPLASH_HEIGHT}
                outputWidth={SPLASH_WIDTH}
                outputHeight={SPLASH_HEIGHT}
                outputType="image/webp"
                outputQuality={0.88}
                helperText="9:16 mobil ekran alanını sürükleyerek ayarlayın · Çıktı: 1080 × 1920 WebP"
                onClose={closeSplashCrop}
                onCrop={(blob) => void uploadCroppedSplash(blob)}
              />
            )}

            <FormSection
              variant="card"
              icon={ArrowUpCircleIcon}
              title="Sürüm kontrolü"
              subtitle="Zorunlu ve önerilen güncelleme sürümlerini platform başına belirleyin"
            >
              <div className="space-y-5">
                <Banner tone="info" variant="soft">
                  <strong>Zorunlu sürüm</strong>: bu sürümün <em>altındaki</em> kullanıcılar
                  kapatılamayan bir güncelleme ekranı görür ve uygulamayı kullanamaz.{' '}
                  <strong>Güncel sürüm</strong>: altındaki kullanıcılara "Daha sonra" ile
                  atlanabilen bir uyarı gösterilir. Alanlar boş bırakılırsa o kontrol uygulanmaz.
                </Banner>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    label="Android — zorunlu sürüm"
                    error={androidOrderError ?? versionFieldError(version.androidMinVersion)}
                    hint="Bu sürümün altı uygulamayı açamaz."
                  >
                    <Input
                      value={version.androidMinVersion}
                      onChange={(e) => setVersionField('androidMinVersion')(e.target.value)}
                      placeholder="1.0.0"
                      error={androidOrderError ?? versionFieldError(version.androidMinVersion)}
                    />
                  </Field>

                  <Field
                    label="Android — güncel sürüm"
                    error={versionFieldError(version.androidLatestVersion)}
                    hint="Play Store'daki son sürüm."
                  >
                    <Input
                      value={version.androidLatestVersion}
                      onChange={(e) => setVersionField('androidLatestVersion')(e.target.value)}
                      placeholder="1.0.4"
                      error={versionFieldError(version.androidLatestVersion)}
                    />
                  </Field>

                  <Field
                    label="iOS — zorunlu sürüm"
                    error={iosOrderError ?? versionFieldError(version.iosMinVersion)}
                    hint="Bu sürümün altı uygulamayı açamaz."
                  >
                    <Input
                      value={version.iosMinVersion}
                      onChange={(e) => setVersionField('iosMinVersion')(e.target.value)}
                      placeholder="1.0.0"
                      error={iosOrderError ?? versionFieldError(version.iosMinVersion)}
                    />
                  </Field>

                  <Field
                    label="iOS — güncel sürüm"
                    error={versionFieldError(version.iosLatestVersion)}
                    hint="App Store'daki son sürüm."
                  >
                    <Input
                      value={version.iosLatestVersion}
                      onChange={(e) => setVersionField('iosLatestVersion')(e.target.value)}
                      placeholder="1.0.4"
                      error={versionFieldError(version.iosLatestVersion)}
                    />
                  </Field>

                  <Field
                    label="Play Store adresi"
                    error={storeUrlError(version.androidStoreUrl)}
                    hint="Boş bırakılırsa uygulama kendi mağaza adresini kullanır."
                  >
                    <Input
                      value={version.androidStoreUrl}
                      onChange={(e) => setVersionField('androidStoreUrl')(e.target.value)}
                      placeholder="https://play.google.com/store/apps/details?id=tr.bel.bakirkoy"
                      error={storeUrlError(version.androidStoreUrl)}
                    />
                  </Field>

                  <Field
                    label="App Store adresi"
                    error={storeUrlError(version.iosStoreUrl)}
                    hint="Boş bırakılırsa uygulama kendi mağaza adresini kullanır."
                  >
                    <Input
                      value={version.iosStoreUrl}
                      onChange={(e) => setVersionField('iosStoreUrl')(e.target.value)}
                      placeholder="https://apps.apple.com/tr/app/id000000000"
                      error={storeUrlError(version.iosStoreUrl)}
                    />
                  </Field>
                </div>

                <Field
                  label="Güncelleme mesajı"
                  hint="Güncelleme ekranında başlığın altında gösterilir. Boşsa varsayılan metin kullanılır."
                >
                  <Input
                    value={version.updateMessage}
                    onChange={(e) => setVersionField('updateMessage')(e.target.value)}
                    placeholder="Yeni sürümde performans iyileştirmeleri ve hata düzeltmeleri var."
                    maxLength={500}
                  />
                </Field>

                <Field label="Sürüm notları" hint="Güncelleme ekranında liste olarak gösterilir.">
                  <Textarea
                    value={version.updateReleaseNotes}
                    onChange={(e) => setVersionField('updateReleaseNotes')(e.target.value)}
                    rows={5}
                    maxLength={4000}
                  />
                </Field>

                <div className="flex justify-end">
                  <Button
                    onClick={saveVersion}
                    disabled={savingVersion || versionHasError}
                    isLoading={savingVersion}
                    iconLeft={<SaveIcon className="h-4 w-4" />}
                  >
                    Sürüm ayarlarını kaydet
                  </Button>
                </div>
              </div>
            </FormSection>

            {legal && (
              <FormSection
                variant="card"
                icon={ShieldCheckIcon}
                title="KVKK ve izin metinleri"
                subtitle="Giriş ekranındaki modallarda gösterilen sistem metinleri"
              >
                <div className="space-y-4">
                  {([
                    ['citizenKvkk', 'Vatandaş KVKK metni'],
                    ['citizenNotification', 'Vatandaş bildirim izni'],
                    ['companyKvkk', 'Firma KVKK metni'],
                    ['companyNotification', 'Firma bildirim izni'],
                    ['companyStaffKvkk', 'Firma personeli KVKK metni'],
                    ['companyStaffNotification', 'Firma personeli bildirim izni'],
                  ] as const).map(([key, label]) => (
                    <Field key={key} label={label} required>
                      <Textarea
                        value={legal[key]}
                        onChange={(e) => setLegal((current) => current ? { ...current, [key]: e.target.value } : current)}
                        rows={key.toLowerCase().includes('kvkk') ? 8 : 5}
                        maxLength={key.toLowerCase().includes('kvkk') ? 20000 : 10000}
                      />
                    </Field>
                  ))}
                  <div className="flex justify-end">
                    <Button
                      onClick={saveLegal}
                      disabled={savingLegal || Object.values(legal).some((text) => !text.trim())}
                      isLoading={savingLegal}
                      iconLeft={<SaveIcon className="h-4 w-4" />}
                    >
                      İzin metinlerini kaydet
                    </Button>
                  </div>
                </div>
              </FormSection>
            )}

            <FormSection
              variant="card"
              icon={LinkIcon}
              title="Portal ve kapsam"
              subtitle="Yönlendirilecek adres, kapsanan sürümler ve kullanıcı mesajı"
            >
              <div className="space-y-4">
                <Field
                  label="Portal adresi"
                  required={enabled}
                  error={urlError}
                  hint="Oturum bilgisi bu adrese aktarıldığı için https zorunludur."
                >
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://portal.bakirkoy.bel.tr"
                    error={urlError}
                  />
                </Field>

                <Field
                  label="Kapsanan en yüksek sürüm"
                  error={versionError}
                  hint="Bu sürüm ve altındaki uygulamalar webview'e düşer. Düzeltilmiş sürüm store'a çıktığında buraya eski sürümü yazın; yeni sürümdeki kullanıcılar otomatik olarak normal uygulamaya döner. Boş bırakılırsa hiçbir sürüm kapsanmaz ve webview açılmaz; kapsam için bir sürüm girin."
                >
                  <Input
                    value={maxVersion}
                    onChange={(e) => setMaxVersion(e.target.value)}
                    placeholder="2.1.0"
                    error={versionError}
                  />
                </Field>

                <Field
                  label="Kullanıcı mesajı"
                  hint="Portalın üstünde ince bir şerit olarak gösterilir."
                >
                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Uygulamamız kısa süreli bakımda."
                    maxLength={500}
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection
              icon={PaletteIcon}
              title="Uygulama Logoları"
              subtitle="Ana sayfa başlığındaki ve alt menü ortasındaki logolar ayrı ayrı yönetilir. Boş bırakılanda uygulama kendi logosunu gösterir."
            >
              <div className="space-y-6">
                <MobileLogoField
                  label="Ana Sayfa Logosu"
                  description="Ana sayfanın üst başlığında görünür. Uzun ve ince yatay logo için uygundur — logoyu çerçevenin tamamına yayın."
                  value={config?.homeLogoUrl ?? null}
                  outputWidth={HOME_LOGO_WIDTH}
                  outputHeight={HOME_LOGO_HEIGHT}
                  onUpload={async (file) => {
                    const { url } = await mobileConfigService.uploadLogo(file)
                    setConfig(await mobileConfigService.updateHomeLogo(url))
                    toast.success('Ana sayfa logosu güncellendi.')
                  }}
                  onRemove={async () => {
                    setConfig(await mobileConfigService.updateHomeLogo(null))
                    toast.success('Ana sayfa logosu kaldırıldı.')
                  }}
                />

                <MobileLogoField
                  label="Alt Menü Logosu"
                  description="Alt menünün ortasındaki yuvarlak butonda görünür. Önerilen: kare (amblem) logo."
                  value={config?.tabBarLogoUrl ?? null}
                  outputWidth={TABBAR_LOGO_SIZE}
                  outputHeight={TABBAR_LOGO_SIZE}
                  round
                  onUpload={async (file) => {
                    const { url } = await mobileConfigService.uploadLogo(file)
                    setConfig(await mobileConfigService.updateTabBarLogo(url))
                    toast.success('Alt menü logosu güncellendi.')
                  }}
                  onRemove={async () => {
                    setConfig(await mobileConfigService.updateTabBarLogo(null))
                    toast.success('Alt menü logosu kaldırıldı.')
                  }}
                />
              </div>
            </FormSection>

            <HomeFeatureCardsSection />

            <QuickActionsSection />

            <div className="flex items-center justify-between gap-3">
              <p className="type-muted">
                {config?.updatedAt
                  ? `Son güncelleme: ${formatDateTime(config.updatedAt)}`
                  : 'Henüz değiştirilmedi.'}
              </p>
              <Button
                onClick={save}
                disabled={!canSave}
                isLoading={saving}
                iconLeft={<SaveIcon className="h-4 w-4" />}
              >
                Kaydet
              </Button>
            </div>
          </>
        )}
        </div>
      </div>
    </UiStandardsContext.Provider>
  )
}
