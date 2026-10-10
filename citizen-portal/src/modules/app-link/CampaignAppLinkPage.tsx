import { useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLinkIcon, Loader2Icon, SmartphoneIcon } from 'lucide-react'

const ANDROID_FALLBACK = 'https://play.google.com/store/apps/details?id=com.bakirkoy.belediye'
const IOS_FALLBACK = 'https://apps.apple.com/tr/developer/bakirkoy-belediyesi'

const platform = /iPad|iPhone|iPod/i.test(navigator.userAgent) ? 'ios' : 'android'

const readStoreUrl = async (): Promise<string> => {
  const fallback = platform === 'ios' ? IOS_FALLBACK : ANDROID_FALLBACK
  try {
    const response = await fetch(`/api/v1/mobile/app-config?version=0.0.0&platform=${platform}`)
    if (!response.ok) return fallback
    const body = await response.json()
    const remote = body?.data?.versionCheck?.storeUrl
    return typeof remote === 'string' && /^https:\/\/(?:[^/]+\.)?(?:play\.google\.com|apps\.apple\.com|itunes\.apple\.com)(?:\/|$)/i.test(remote)
      ? remote
      : fallback
  } catch {
    return fallback
  }
}

export const CampaignAppLinkPage = () => {
  const campaignId = useMemo(() => {
    const raw = window.location.pathname.replace(/^\/kampanya\//, '').split('/')[0] ?? ''
    try {
      return decodeURIComponent(raw)
    } catch {
      return raw
    }
  }, [])
  const deepLink = useMemo(
    () => `bakirkoy://kampanya/${encodeURIComponent(campaignId)}`,
    [campaignId],
  )
  const [storeUrl, setStoreUrl] = useState(platform === 'ios' ? IOS_FALLBACK : ANDROID_FALLBACK)

  // storeUrl bağımlılıkta OLMAMALI: mağaza adresi fetch'i dönünce effect yeniden çalışır,
  // deep link ikinci kez tetiklenir ve mağaza timer'ı sıfırlanır (uygulama kurulu değilse
  // yönlendirme ~1.8sn gecikir). Güncel değeri ref üzerinden okuyup effect'i yalnızca
  // deepLink'e bağlıyoruz — böylece yönlendirme mount'ta tam bir kez denenir.
  const storeUrlRef = useRef(storeUrl)
  storeUrlRef.current = storeUrl

  useEffect(() => {
    let active = true
    void readStoreUrl().then((url) => {
      if (active) setStoreUrl(url)
    })

    window.location.href = deepLink
    const timer = window.setTimeout(() => {
      if (document.visibilityState === 'visible') window.location.replace(storeUrlRef.current)
    }, 1800)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [deepLink])

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-slate-50 p-5">
      <section className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-xl shadow-slate-200/60">
        <img src="/logo.png" alt="Bakırköy Belediyesi" className="mx-auto h-20 w-20 object-contain" />
        <div className="mx-auto mt-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-[#005da3]">
          <SmartphoneIcon className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-extrabold text-slate-900">Kampanya açılıyor</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Bakırköy Belediyesi uygulaması cihazınızda yüklüyse kampanya detayına yönlendirileceksiniz.
        </p>
        <a
          href={deepLink}
          className="mt-6 flex h-12 items-center justify-center gap-2 rounded-xl bg-[#005da3] px-4 text-sm font-bold text-white shadow-md shadow-[#005da3]/25"
        >
          <ExternalLinkIcon className="h-4 w-4" />
          Uygulamada Aç
        </a>
        <a href={storeUrl} className="mt-3 flex items-center justify-center gap-2 py-2 text-sm font-semibold text-sky-700">
          <Loader2Icon className="h-4 w-4 animate-spin" />
          Uygulama yoksa mağazaya git
        </a>
      </section>
    </main>
  )
}
