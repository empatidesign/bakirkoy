import DOMPurify from 'dompurify'

export const sanitizeHtml = (html: string | null | undefined): string =>
  DOMPurify.sanitize(html ?? '')
