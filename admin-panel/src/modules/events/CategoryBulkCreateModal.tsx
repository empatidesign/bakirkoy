import { useEffect, useMemo, useState } from 'react'
import { LayersIcon, CheckCircle2Icon, XCircleIcon, SparklesIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Modal, Button, Field, Textarea, NumberInput, Banner, Badge, ToggleChip } from '@/design-system'
import eventCategoryService from '@/services/eventCategory.service'
import type { EventCategoryForm, EventCategoryBulkResultItem } from '@/types/eventCategory.types'

/**
 * Kullanıcı isteği (2026-10-06): "kategori de olabilir program da olabilir, tek tek ekleme
 * dışında çoklu ekleme olsun ve en uygun etkinlik kategorilerini de ekle". Hazır öneri
 * listesinden seçim + satır satır serbest giriş ("Ad | Açıklama | Puan") ile tek işlemde
 * birden fazla kategori/program oluşturur. Aynı adlı mevcut kayıtlar backend'de atlanır.
 */

const COLORS = ['#2563eb', '#16a34a', '#ea580c', '#7c3aed', '#dc2626', '#0891b2', '#db2777', '#ca8a04']

type Suggestion = { name: string; description: string; points: number }

export const SUGGESTED_GROUPS: { title: string; color: string; items: Suggestion[] }[] = [
  {
    title: 'Sahne ve Gösteri', color: '#7c3aed', items: [
      { name: 'Tiyatro', description: 'Yetişkin ve genel izleyici tiyatro oyunları', points: 10 },
      { name: 'Çocuk Tiyatrosu', description: 'Çocuklara yönelik tiyatro ve oyunlar', points: 10 },
      { name: 'Konser', description: 'Müzik dinletileri ve konserler', points: 10 },
      { name: 'Sinema / Film Gösterimi', description: 'Film gösterimleri ve açık hava sineması', points: 5 },
      { name: 'Dans Gösterisi', description: 'Halk dansları ve modern dans gösterileri', points: 5 },
      { name: 'Kukla ve Karagöz', description: 'Geleneksel kukla, Karagöz ve Hacivat gösterileri', points: 5 },
    ],
  },
  {
    title: 'Eğitim ve Gelişim', color: '#2563eb', items: [
      { name: 'Seminer', description: 'Bilgilendirici seminerler', points: 10 },
      { name: 'Konferans', description: 'Uzman konuşmacılı konferanslar', points: 10 },
      { name: 'Söyleşi', description: 'Yazar, sanatçı ve uzmanlarla söyleşiler', points: 10 },
      { name: 'Panel', description: 'Çok konuşmacılı panel ve oturumlar', points: 10 },
      { name: 'Atölye', description: 'Uygulamalı atölye çalışmaları', points: 15 },
      { name: 'Kurs', description: 'Dönemlik kurs ve eğitimler', points: 20 },
      { name: 'Kariyer Günleri', description: 'Kariyer, istihdam ve gençlik buluşmaları', points: 10 },
    ],
  },
  {
    title: 'Kültür ve Sanat', color: '#db2777', items: [
      { name: 'Sergi', description: 'Resim, fotoğraf ve el sanatları sergileri', points: 5 },
      { name: 'Festival', description: 'Kültür, sanat ve gençlik festivalleri', points: 10 },
      { name: 'Fuar', description: 'Kitap, kariyer ve tematik fuarlar', points: 5 },
      { name: 'Edebiyat ve İmza Günü', description: 'Kitap tanıtımı ve imza günleri', points: 5 },
      { name: 'Şiir Dinletisi', description: 'Şiir ve edebiyat dinletileri', points: 5 },
    ],
  },
  {
    title: 'Spor ve Doğa', color: '#16a34a', items: [
      { name: 'Spor Turnuvası', description: 'Futbol, basketbol, voleybol vb. turnuvalar', points: 15 },
      { name: 'Koşu / Maraton', description: 'Halk koşuları ve maratonlar', points: 10 },
      { name: 'Doğa Yürüyüşü', description: 'Doğa yürüyüşleri ve kamp etkinlikleri', points: 10 },
      { name: 'Satranç Turnuvası', description: 'Satranç ve akıl oyunları turnuvaları', points: 10 },
      { name: 'E-Spor', description: 'Dijital oyun turnuvaları', points: 5 },
    ],
  },
  {
    title: 'Çocuk ve Gençlik', color: '#ea580c', items: [
      { name: 'Çocuk Etkinliği', description: 'Çocuklara yönelik oyun ve eğlence etkinlikleri', points: 5 },
      { name: 'Bilim Şenliği', description: 'Bilim, teknoloji ve deney etkinlikleri', points: 10 },
      { name: 'Yarışma', description: 'Bilgi yarışması ve ödüllü yarışmalar', points: 15 },
      { name: 'Gençlik Buluşması', description: 'Gençlere yönelik sosyal buluşmalar', points: 10 },
    ],
  },
  {
    title: 'Milli ve Manevi Günler', color: '#dc2626', items: [
      { name: 'Milli Bayram Kutlaması', description: '23 Nisan, 19 Mayıs, 29 Ekim vb. kutlamalar', points: 10 },
      { name: 'Anma Programı', description: '15 Temmuz, 18 Mart vb. anma törenleri', points: 10 },
      { name: 'Ramazan Etkinlikleri', description: 'İftar, sahur ve Ramazan sokağı etkinlikleri', points: 5 },
      { name: 'Dini Program', description: 'Mevlid, kandil ve manevi programlar', points: 5 },
    ],
  },
  {
    title: 'Sosyal ve Toplumsal', color: '#0891b2', items: [
      { name: 'Kadın ve Aile', description: 'Kadın ve aileye yönelik programlar', points: 10 },
      { name: 'Engelsiz Yaşam', description: 'Engelli bireylere yönelik etkinlikler', points: 10 },
      { name: 'Yaşlılara Yönelik Etkinlik', description: 'Yaşlı vatandaşlara yönelik sosyal etkinlikler', points: 10 },
      { name: 'Sosyal Sorumluluk / Gönüllülük', description: 'Gönüllülük ve yardım kampanyaları', points: 15 },
      { name: 'Kültür Gezisi', description: 'Şehir içi ve dışı kültür gezileri', points: 10 },
    ],
  },
  {
    title: 'Programlar', color: '#ca8a04', items: [
      { name: 'Kültür Sanat Programı', description: 'Dönemlik kültür sanat programı', points: 0 },
      { name: 'Yaz Etkinlik Programı', description: 'Yaz dönemi etkinlik programı', points: 0 },
      { name: 'Yarıyıl Tatili Programı', description: 'Sömestr tatili çocuk ve gençlik programı', points: 0 },
      { name: 'Ramazan Programı', description: 'Ramazan ayı boyunca düzenlenen program', points: 0 },
      { name: 'Hafta Sonu Programı', description: 'Hafta sonu düzenli etkinlik programı', points: 0 },
    ],
  },
]

const norm = (s: string) => s.trim().toLocaleLowerCase('tr-TR')

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export const CategoryBulkCreateModal = ({ open, onClose, onCreated }: Props) => {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [text, setText] = useState('')
  const [defaultPoints, setDefaultPoints] = useState(0)
  const [existing, setExisting] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [results, setResults] = useState<EventCategoryBulkResultItem[] | null>(null)

  useEffect(() => {
    if (!open) return
    setSelected(new Set()); setText(''); setResults(null)
    eventCategoryService.getList({ page: 1, limit: 100 })
      .then((r) => setExisting(new Set(r.items.map((c) => norm(c.name)))))
      .catch(() => setExisting(new Set()))
  }, [open])

  const items = useMemo<EventCategoryForm[]>(() => {
    const out: EventCategoryForm[] = []
    const seen = new Set<string>()
    const push = (f: EventCategoryForm) => {
      const k = norm(f.name)
      if (!k || seen.has(k)) return
      seen.add(k); out.push(f)
    }
    SUGGESTED_GROUPS.forEach((g) => g.items.forEach((s) => {
      if (selected.has(s.name)) push({ name: s.name, description: s.description, color: g.color, defaultPoints: s.points })
    }))
    text.split('\n').forEach((line) => {
      const [name = '', description = '', pts] = line.split('|').map((p) => p.trim())
      const n = Number(pts)
      push({
        name: name.slice(0, 100),
        description: description.slice(0, 300),
        color: COLORS[out.length % COLORS.length],
        defaultPoints: pts && Number.isFinite(n) && n >= 0 ? Math.floor(n) : defaultPoints,
      })
    })
    return out
  }, [selected, text, defaultPoints])

  const newCount = items.filter((i) => !existing.has(norm(i.name))).length

  const toggle = (name: string) => setSelected((prev) => {
    const next = new Set(prev)
    if (next.has(name)) next.delete(name); else next.add(name)
    return next
  })

  const selectGroup = (names: string[]) => setSelected((prev) => {
    const avail = names.filter((n) => !existing.has(norm(n)))
    const allOn = avail.every((n) => prev.has(n))
    const next = new Set(prev)
    avail.forEach((n) => (allOn ? next.delete(n) : next.add(n)))
    return next
  })

  const save = async () => {
    const toSend = items.filter((i) => !existing.has(norm(i.name)))
    if (toSend.length === 0) return
    if (toSend.length > 100) { toast.error('Tek seferde en fazla 100 kategori eklenebilir.'); return }
    setSaving(true)
    try {
      const res = await eventCategoryService.bulkCreate(toSend)
      setResults(res)
      const ok = res.filter((r) => r.success).length
      if (ok > 0) { toast.success(`${ok} kategori eklendi.`); onCreated() }
      if (res.length - ok > 0) toast.error(`${res.length - ok} kayıt atlandı.`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Çoklu Kategori / Program Ekle"
      subtitle="Hazır önerilerden seçin veya her satıra bir ad yazın"
      width={760}
      className="max-w-[96vw]"
      footer={results ? (
        <div className="flex justify-end"><Button variant="outline" onClick={onClose}>Kapat</Button></div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="type-caption">{items.length} kayıt hazır{items.length !== newCount ? ` (${items.length - newCount} zaten mevcut, atlanacak)` : ''}</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>İptal</Button>
            <Button variant="primary" iconLeft={<LayersIcon className="h-4 w-4" />} isLoading={saving} disabled={newCount === 0} onClick={save}>
              {newCount > 0 ? `${newCount} Kategori Ekle` : 'Kategori Ekle'}
            </Button>
          </div>
        </div>
      )}
    >
      <div className="max-h-[70vh] space-y-5 overflow-y-auto p-5">
        {!results && (
          <>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <SparklesIcon className="h-4 w-4 text-primary" />
                <span className="type-body-strong">Önerilen Etkinlik Kategorileri</span>
                <Button variant="ghost" size="sm" className="ml-auto" onClick={() => selectGroup(SUGGESTED_GROUPS.flatMap((g) => g.items.map((i) => i.name)))}>
                  Tüm önerileri seç / kaldır
                </Button>
              </div>
              {SUGGESTED_GROUPS.map((g) => (
                <div key={g.title} className="space-y-1.5">
                  <button type="button" className="type-caption font-semibold hover:text-primary" onClick={() => selectGroup(g.items.map((i) => i.name))}>
                    {g.title} <span className="font-normal">(tümünü seç)</span>
                  </button>
                  <div className="flex flex-wrap gap-1.5">
                    {g.items.map((s) => {
                      const exists = existing.has(norm(s.name))
                      return (
                        <ToggleChip key={s.name} active={selected.has(s.name)} disabled={exists} color={g.color} onClick={() => toggle(s.name)}>
                          {s.name}{exists ? ' (mevcut)' : ''}
                        </ToggleChip>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <Field label="Kendi Kategori / Programlarınız" hint="Her satıra bir kayıt. İsteğe bağlı: Ad | Açıklama | Puan  (ör. Ebru Atölyesi | Geleneksel sanatlar | 15)">
              <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder={'Ebru Atölyesi\nYaz Okulu Programı | Yaz tatili programı\nGençlik Kampı | | 20'} />
            </Field>

            <Field label="Varsayılan Katılım Puanı" hint="Puan yazılmayan satırlar için kullanılır">
              <NumberInput value={defaultPoints} onChange={(n) => setDefaultPoints(n)} min={0} suffix="puan" />
            </Field>

            {items.length > 0 && (
              <div className="rounded-card border border-border bg-surface-1 p-3">
                <p className="type-caption mb-2">Önizleme</p>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((i) => (
                    <Badge key={i.name} color={existing.has(norm(i.name)) ? undefined : i.color} tone={existing.has(norm(i.name)) ? 'neutral' : undefined}>
                      {i.name}{i.defaultPoints ? ` · ${i.defaultPoints}p` : ''}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Banner tone="info" variant="soft">
              Aynı adla kayıtlı kategoriler otomatik atlanır. Eklenen kayıtlar daha sonra tek tek düzenlenebilir.
            </Banner>
          </>
        )}

        {results && (
          <div className="space-y-2">
            {results.map((r) => (
              <div key={r.index} className="flex items-center justify-between gap-2 rounded-card border border-border px-3 py-2">
                <span className="type-body-strong">{r.name}</span>
                {r.success ? (
                  <Badge tone="success"><CheckCircle2Icon className="h-3 w-3" /> Eklendi</Badge>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Badge tone="danger"><XCircleIcon className="h-3 w-3" /> Atlandı</Badge>
                    {r.error && <span className="type-caption text-danger">{r.error}</span>}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
