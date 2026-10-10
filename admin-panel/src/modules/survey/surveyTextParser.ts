import type { SurveyQuestionForm, SurveyQuestionType } from '@/types/survey.types'
import { SURVEY_QUESTION_TYPES_WITH_OPTIONS } from '@/types/survey.types'

// Kullanıcı isteği (2026-09-01): "yapay zeka yardımıyla soruları ve cevapları verdiğinde
// otomatikmen bir anket sistemine çevirir".
//
// Bu ayrıştırıcı, yöneticinin serbestçe yazdığı/yapıştırdığı soru metnini anket sorularına
// çevirir. Dış bir LLM servisine bağımlı olmadan çalışır (çevrimdışı, ücretsiz, anında ve
// veri gizliliği açısından güvenli): soru satırını ve altındaki şıkları tanır, şık sayısı ve
// biçiminden soru tipini kendisi çıkarır. Böylece yönetici "sorularımı ve cevaplarımı
// yapıştırayım, sistem anketi kursun" akışını tek ekranda yaşar.
//
// Desteklenen kalıplar:
//   1. Belediyemizden memnun musunuz?        <- numaralı ya da düz soru satırı
//      a) Evet                               <- a) A. A- - • gibi şık işaretleri
//      b) Hayır
//   Soru: ... / S: ...                       <- açık soru öneki
//   [çoklu] Hangilerini kullanıyorsunuz?     <- tipi zorlayan etiketler
//   [yıldız] Hizmeti puanlayın
//
// Tip çıkarımı (etiket verilmediyse):
//   - Şık yoksa ve soru "puanla/değerlendir" içeriyorsa  -> rating (1-5 yıldız)
//   - Şık yoksa ve "kaç/neden/açıkla/öneri/görüş" varsa  -> text
//   - Şıklar tam olarak Evet/Hayır ise                    -> yes_no
//   - Şıklar memnuniyet ölçeğine benziyorsa               -> satisfaction
//   - Şıklar katılım ölçeğine benziyorsa                  -> agreement
//   - Soru "hangileri/birden fazla" içeriyorsa            -> checkbox
//   - Diğer tüm şıklı sorular                             -> multiple_choice

export type ParsedQuestion = SurveyQuestionForm & { sourceLine: number }

export interface ParseResult {
  questions: ParsedQuestion[]
  /** Ayrıştırılamayan ve yok sayılan satırlar (kullanıcıya gösterilir). */
  ignoredLines: { line: number; text: string; reason: string }[]
}

const TYPE_TAGS: Record<string, SurveyQuestionType> = {
  yildiz: 'rating',
  yıldız: 'rating',
  puan: 'rating',
  rating: 'rating',
  emoji: 'emoji_rating',
  begeni: 'like_dislike',
  beğeni: 'like_dislike',
  memnuniyet: 'satisfaction',
  katilim: 'agreement',
  katılım: 'agreement',
  tekli: 'multiple_choice',
  coklu: 'checkbox',
  çoklu: 'checkbox',
  evethayir: 'yes_no',
  'evet/hayir': 'yes_no',
  'evet/hayır': 'yes_no',
  olcek: 'scale',
  ölçek: 'scale',
  metin: 'text',
  text: 'text',
}

// Şık işaretleri: "a) ", "A. ", "- ", "• ", "* ".
// Bilinçli olarak SAYI ile başlayan satırlar (ör. "1. ...") şık sayılmaz — Türkçe anket
// metinlerinde numaralandırma neredeyse her zaman SORU sırasını belirtir ve bunu şık sanmak
// ilk soruyu tamamen yutuyordu (doğrulama betiği bu hatayı yakaladı). Sayılı şık isteyen
// kullanıcılar tire/harf biçimini kullanabilir.
const OPTION_RE = /^\s*(?:[-•*]|[a-hA-Ha-zçğıöşü]\s*[).:])\s+(.{1,200})$/
// "1. Soru metni" / "1) Soru metni" gibi numaralı soru satırı.
const NUMBERED_QUESTION_RE = /^\s*\d{1,2}\s*[).:-]\s*(.+)$/
const QUESTION_PREFIX_RE = /^\s*(?:soru|s)\s*[:.]\s*(.+)$/i
const TAG_RE = /^\s*\[([^\]]+)\]\s*(.*)$/

const normalize = (s: string) => s.trim().toLocaleLowerCase('tr').replace(/\s+/g, ' ')

const SATISFACTION_HINTS = ['çok kötü', 'kötü', 'orta', 'iyi', 'çok iyi', 'memnun değilim', 'çok memnunum']
const AGREEMENT_HINTS = ['kesinlikle katılmıyorum', 'katılmıyorum', 'kararsızım', 'katılıyorum', 'kesinlikle katılıyorum']

const looksLikeYesNo = (opts: string[]) => {
  if (opts.length !== 2) return false
  const set = new Set(opts.map(normalize))
  return set.has('evet') && (set.has('hayır') || set.has('hayir'))
}

const looksLikeScaleSet = (opts: string[], hints: string[]) => {
  if (opts.length < 3) return false
  const normed = opts.map(normalize)
  const hits = normed.filter((o) => hints.some((h) => o.includes(h) || h.includes(o))).length
  return hits >= Math.ceil(opts.length * 0.6)
}

const inferType = (question: string, options: string[]): SurveyQuestionType => {
  const q = normalize(question)

  if (options.length === 0) {
    if (/(puanla|puanlay|değerlendir|degerlendir|kaç yıldız|kac yildiz)/.test(q)) return 'rating'
    return 'text'
  }
  if (looksLikeYesNo(options)) return 'yes_no'
  if (looksLikeScaleSet(options, SATISFACTION_HINTS)) return 'satisfaction'
  if (looksLikeScaleSet(options, AGREEMENT_HINTS)) return 'agreement'
  // "hangi hizmetlerden yararlandınız" gibi çoğul/çoklu yanıt bekleyen kalıplar çoklu seçime
  // düşer; "hangisi/hangi biri" gibi tekil kalıplar çoktan seçmeli kalır.
  if (/(hangileri|birden fazla|birden çok|çoklu|tümünü|hepsini işaretle|işaretleyiniz)/.test(q)) return 'checkbox'
  if (/\bhangi\b/.test(q) && !/(hangisi|hangi biri|\ben (öncelikli|önemli|acil|çok))/.test(q) && /(ler|lar)(den|dan|i|ı)?\b/.test(q)) return 'checkbox'
  return 'multiple_choice'
}

const defaultConfig = (type: SurveyQuestionType) => {
  if (type === 'scale') return { scaleMin: 1, scaleMax: 5, minLabel: '', maxLabel: '' }
  if (type === 'rating') return { ratingCount: 5 }
  return {}
}

const isRequiredByDefault = (type: SurveyQuestionType) => type !== 'text'

/**
 * Serbest metni anket sorularına çevirir. Boş/anlamsız satırlar `ignoredLines` ile raporlanır,
 * sessizce yutulmaz — yönetici neyin atlandığını görebilir.
 */
export function parseSurveyText(raw: string): ParseResult {
  const lines = (raw ?? '').split(/\r?\n/)
  const questions: ParsedQuestion[] = []
  const ignoredLines: ParseResult['ignoredLines'] = []

  let current: ParsedQuestion | null = null
  let forcedType: SurveyQuestionType | null = null

  const flush = () => {
    if (!current) return
    const type = forcedType ?? inferType(current.question, current.options)
    // yes_no/satisfaction/agreement tiplerinde şıklar sabittir; yine de kullanıcının yazdığı
    // şıklar korunur ki önizlemede ve tip değiştirildiğinde (ör. çoktan seçmeliye çevirme)
    // veri kaybı olmasın. Backend bu tiplerde options'ı zaten yok sayar.
    const keepOptions = SURVEY_QUESTION_TYPES_WITH_OPTIONS.includes(type)
      || type === 'yes_no' || type === 'satisfaction' || type === 'agreement'
    questions.push({
      ...current,
      type,
      options: keepOptions ? current.options.filter((o) => o.trim()) : [],
      required: isRequiredByDefault(type),
      config: defaultConfig(type),
    })
    current = null
    forcedType = null
  }

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim()
    if (!line) return

    // Şık satırı: yalnızca açık bir soru varken anlamlıdır.
    const optionMatch = line.match(OPTION_RE)
    if (optionMatch && current) {
      const text = optionMatch[1].trim()
      if (text) current.options.push(text)
      return
    }

    // Yeni soru satırı.
    let text = line
    let tag: string | null = null

    const tagMatch = text.match(TAG_RE)
    if (tagMatch) {
      tag = normalize(tagMatch[1]).replace(/\s/g, '')
      text = tagMatch[2].trim()
    }

    const numbered = text.match(NUMBERED_QUESTION_RE)
    if (numbered) text = numbered[1].trim()

    const prefixed = text.match(QUESTION_PREFIX_RE)
    if (prefixed) text = prefixed[1].trim()

    if (!text) {
      ignoredLines.push({ line: index + 1, text: rawLine, reason: 'Boş soru metni' })
      return
    }

    // Şık gibi görünen ama açık soru olmayan satır (ör. metnin başında liste) yok sayılır.
    if (optionMatch && !current) {
      ignoredLines.push({ line: index + 1, text: rawLine, reason: 'Bu şıkkın bağlı olduğu soru yok' })
      return
    }

    flush()
    current = { type: 'text', question: text, description: '', required: true, options: [], config: {}, sourceLine: index + 1 }
    if (tag && TYPE_TAGS[tag]) forcedType = TYPE_TAGS[tag]
    else if (tag) ignoredLines.push({ line: index + 1, text: `[${tagMatch?.[1]}]`, reason: 'Bilinmeyen tip etiketi, otomatik tip kullanıldı' })
  })

  flush()

  // Şıklı olması gereken ama tek/sıfır şıkkı olan sorular geçersizdir; metne düşürülür.
  const fixed = questions.map((q) => {
    if (SURVEY_QUESTION_TYPES_WITH_OPTIONS.includes(q.type) && q.options.length < 2) {
      return { ...q, type: 'text' as SurveyQuestionType, options: [], required: false, config: {} }
    }
    return q
  })

  return { questions: fixed, ignoredLines }
}

export const SURVEY_TEXT_EXAMPLE = `1. Belediyemizin genel hizmet kalitesinden memnun musunuz?
a) Evet
b) Hayır

[yıldız] Temizlik hizmetlerini puanlayın

[çoklu] Hangi hizmetlerden yararlandınız?
- Kütüphane
- Spor tesisi
- Kurslar
- Sosyal yardım

Belediyeden beklentilerinizi yazınız.`
