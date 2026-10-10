export const PASSWORD_RULE_TEXT = 'En az 8 karakter, bir büyük harf ve bir rakam içermelidir.'

export const isStrongPassword = (pw: string): boolean =>
  pw.length >= 8 && /\p{Lu}/u.test(pw) && /[0-9]/.test(pw)
