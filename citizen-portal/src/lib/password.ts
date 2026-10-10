// 2026-09-23: Elle yazılan harf listesi ([A-ZĞÜŞİÖÇ]) eksikti — Â, Î, Û gibi
// düzeltme işaretli büyük harfleri ve diğer dillerin büyük harflerini saymıyordu.
// Unicode kategorisi \p{Lu} her dildeki büyük harfi kapsar. Backend de aynı
// kuralı kullanır (bkz. PasswordPolicy.cs), böylece "panelde geçerli ama
// sunucuda reddedildi" tutarsızlığı oluşmaz.
export const isStrongPassword = (value: string): boolean =>
  value.length >= 8 && /\p{Lu}/u.test(value) && /\d/.test(value)

export const PASSWORD_RULE_TEXT = 'En az 8 karakter, bir büyük harf ve bir rakam içermelidir.'

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const LOWER = 'abcdefghijkmnopqrstuvwxyz'
const DIGITS = '23456789'
const SYMBOLS = '!@#$%*?-_'

const pickFrom = (pool: string): string => {
  const idx = crypto.getRandomValues(new Uint32Array(1))[0] % pool.length
  return pool[idx]
}

const shuffle = (chars: string[]): string[] => {
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars
}

export const generateSuggestedPassword = (length = 12): string => {
  const size = Math.max(length, 12)
  const pools = [UPPER, LOWER, DIGITS, SYMBOLS]
  const all = UPPER + LOWER + DIGITS + SYMBOLS
  const chars = pools.map(pickFrom)
  while (chars.length < size) chars.push(pickFrom(all))
  return shuffle(chars).join('')
}

