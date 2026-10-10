import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Icon2D } from '@/components/Icon2D'

// Kullanıcı bildirimi (2026-09-02): "tablette ekran beyaz ekran olarak açıyor android
// tablette". Kök neden: uygulamada hiç React ErrorBoundary yoktu; render sırasında herhangi
// bir çalışma-zamanı hatası (ör. eski Android WebView'da olmayan bir API, tek bir bileşenin
// beklenmedik null'ı) TÜM ağacı unmount ediyor ve geriye BEYAZ EKRAN kalıyordu. Kullanıcı
// hiçbir bilgi göremediği için ne olduğunu anlayamıyordu.
//
// Bu sınır, hatayı yakalar ve beyaz ekran yerine kullanıcıya (a) sahada işe yarayan bir
// "Yeniden dene / Sayfayı yenile" ekranı, (b) teknik ekibe iletilebilecek hata metnini
// gösterir. Böylece hem şu anki tablet hatası teşhis edilebilir hale gelir hem de gelecekte
// tek bir bileşen çökse bile uygulama tamamen kararmaz.

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

// Yalnızca geliştirme/test ortamında etkin kalıcı doğrulama kancası: ?__eb_probe=1 ile
// render sırasında bilinçli bir hata fırlatır. Production bundle'ında import.meta.env.DEV
// false olduğu için tamamen ölü koda dönüşür (tree-shake edilir); saha kullanıcısı bunu
// asla tetikleyemez. E2E testi (root-error-boundary.spec.ts) bu kanca sayesinde
// ErrorBoundary'nin gerçekten beyaz ekran yerine hata ekranı gösterdiğini KALICI olarak
// doğrular — böylece ileride biri sınırı yanlışlıkla kaldırırsa test kırılır.
const ErrorProbe = ({ children }: { children: ReactNode }): ReactNode => {
  if (import.meta.env.DEV && typeof window !== 'undefined' && window.location.search.includes('__eb_probe=1')) {
    throw new Error('EB_PROBE: ErrorBoundary doğrulama hatası (yalnızca dev/test)')
  }
  return children
}

export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Konsola yaz (tablette uzaktan hata ayıklama / WebView inspector için) — sunucuya
    // göndermek başka bir işin konusu; burada en azından iz bırakılır.
    console.error('[RootErrorBoundary] render hatası:', error, info.componentStack)
  }

  private handleReload = () => {
    // Tam sayfa yenileme: bozuk JS state'i tamamen sıfırlar (sahada en güvenilir kurtarma).
    window.location.reload()
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return <ErrorProbe>{this.props.children}</ErrorProbe>

    return (
      <div
        role="alert"
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#f8fafc',
          color: '#0f172a',
        }}
      >
        <Icon2D kind="warning" className="h-12 w-12" style={{ color: '#f59e0b' }} />
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Bir sorun oluştu</h1>
        <p style={{ fontSize: 14, color: '#475569', maxWidth: 420, margin: 0 }}>
          Ekran yüklenirken beklenmeyen bir hata oluştu. Lütfen sayfayı yenileyin. Sorun
          sürerse aşağıdaki hata metnini teknik ekibe iletin.
        </p>
        <button
          type="button"
          onClick={this.handleReload}
          style={{
            marginTop: 8,
            padding: '12px 28px',
            fontSize: 16,
            fontWeight: 700,
            color: '#fff',
            background: '#4f46e5',
            border: 'none',
            borderRadius: 14,
            cursor: 'pointer',
          }}
        >
          Sayfayı Yenile
        </button>
        <pre
          style={{
            marginTop: 12,
            maxWidth: '90vw',
            maxHeight: 200,
            overflow: 'auto',
            fontSize: 11,
            color: '#b91c1c',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 10,
            padding: 12,
            textAlign: 'left',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {error.name}: {error.message}
          {error.stack ? `\n\n${error.stack}` : ''}
        </pre>
      </div>
    )
  }
}
