import { Link } from 'react-router-dom'
import { CalendarDaysIcon, Building2Icon, ArrowRightIcon } from 'lucide-react'

export const HomePage = () => (
  <div>
    <div className="relative overflow-hidden" style={{ background: 'linear-gradient(160deg, #071e3d 0%, #003e6d 50%, #005da3 100%)' }}>
      <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
      <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:py-20">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 p-3 backdrop-blur shadow-lg">
          <img src="/logo.png" alt="Bakırköy Belediyesi Logo" className="h-full w-full object-contain" />
        </div>
        <h1 className="font-display text-3xl font-black text-white sm:text-4xl">Bakırköy Belediyesi Portalı</h1>
        <p className="mx-auto mt-3 max-w-xl text-[14.5px] text-white/70">
          Belediye etkinliklerini ve hizmet tesislerini üyelik gerekmeden görüntüleyin. Başvuru yapmak için Vatandaş Portalına geçiş yapabilirsiniz.
        </p>
      </div>
    </div>

    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 py-8 sm:grid-cols-2">
      <Link
        to="/etkinlikler"
        className="group flex items-center justify-between gap-4 rounded-lg border border-border bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-soft">
            <CalendarDaysIcon className="h-6 w-6 text-primary" />
          </span>
          <div>
            <p className="font-display text-lg font-bold text-foreground">Etkinlikler</p>
            <p className="text-[13px] text-foreground/50">Yaklaşan etkinlikleri keşfedin</p>
          </div>
        </div>
        <ArrowRightIcon className="h-5 w-5 shrink-0 text-foreground/25 transition-transform group-hover:translate-x-1" />
      </Link>

      <Link
        to="/tesisler"
        className="group flex items-center justify-between gap-4 rounded-lg border border-border bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-soft">
            <Building2Icon className="h-6 w-6 text-primary" />
          </span>
          <div>
            <p className="font-display text-lg font-bold text-foreground">Hizmet Tesisleri</p>
            <p className="text-[13px] text-foreground/50">Tesisleri, adresleri ve çalışma saatlerini görün</p>
          </div>
        </div>
        <ArrowRightIcon className="h-5 w-5 shrink-0 text-foreground/25 transition-transform group-hover:translate-x-1" />
      </Link>
    </div>
  </div>
)
