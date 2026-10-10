import { renderToStaticMarkup } from 'react-dom/server'
import { QRCodeSVG } from 'qrcode.react'
import { escapeHtml } from '@/lib/escapeHtml'
import { citizenPortalBase } from '@/lib/citizenPortal'

export type StaticQrMode = 'attendance' | 'entry' | 'entry_exit' | 'split'

export interface StaticQrInfo {
  enabled: boolean
  mode: StaticQrMode
  code?: string | null
  entryCode?: string | null
  exitCode?: string | null
}

export interface LabeledQr {
  code: string
  name: string
  label: string
}

const SINGLE_LABEL: Record<Exclude<StaticQrMode, 'split'>, string> = {
  attendance: 'YOKLAMA',
  entry: 'GİRİŞ',
  entry_exit: 'GİRİŞ / ÇIKIŞ',
}

export const staticQrUrl = (code: string) => `${citizenPortalBase()}/qr-giris/${code}`

export const labeledQrsOf = (name: string, info: StaticQrInfo | null | undefined): LabeledQr[] => {
  if (!info?.enabled) return []
  if (info.mode === 'split') {
    return info.entryCode && info.exitCode
      ? [{ code: info.entryCode, name, label: 'GİRİŞ' }, { code: info.exitCode, name, label: 'ÇIKIŞ' }]
      : []
  }
  return info.code ? [{ code: info.code, name, label: SINGLE_LABEL[info.mode] ?? 'GİRİŞ' }] : []
}

const qrSvg = (code: string, size: number) =>
  renderToStaticMarkup(<QRCodeSVG xmlns="http://www.w3.org/2000/svg" value={staticQrUrl(code)} size={size} level="H" marginSize={2} bgColor="#ffffff" fgColor="#000000" />)

const fileSlug = (text: string) => text.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '')

const wrapLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

export const downloadLabeledQrPng = (qr: LabeledQr) => {
  const width = 1024
  const qrSize = 900
  const pad = (width - qrSize) / 2
  const measure = document.createElement('canvas').getContext('2d')
  if (!measure) return
  measure.font = '600 52px Poppins, sans-serif'
  const nameLines = wrapLines(measure, qr.name, width - 2 * pad)
  const height = pad + qrSize + 40 + nameLines.length * 64 + 130 + pad

  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, pad, pad, qrSize, qrSize)
    ctx.fillStyle = '#111111'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    let y = pad + qrSize + 40
    ctx.font = '600 52px Poppins, sans-serif'
    for (const l of nameLines) {
      ctx.fillText(l, width / 2, y)
      y += 64
    }
    ctx.font = '800 110px Poppins, sans-serif'
    ctx.fillText(qr.label, width / 2, y + 10)
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `${fileSlug(qr.name)}-${fileSlug(qr.label)}-qr.png`
    a.click()
  }
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg(qr.code, qrSize))}`
}

export const openPrintWindow = () => window.open('', '_blank', 'width=800,height=900')

export const printLabeledQrs = (qrs: LabeledQr[], title: string, target?: Window | null) => {
  const win = target ?? openPrintWindow()
  if (!win) return false
  if (!qrs.length) {
    win.close()
    return false
  }
  const pages = qrs.map((q) => `
    <section class="page">
      <div class="qr">${qrSvg(q.code, 520)}</div>
      <div class="name">${escapeHtml(q.name)}</div>
      <div class="label">${escapeHtml(q.label)}</div>
      <div class="hint">Bu QR kodunu telefonunuzla okutun.</div>
    </section>`).join('')
  win.document.open()
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
    <style>
      @page { size: A4; margin: 15mm; }
      body { margin: 0; font-family: Poppins, Arial, sans-serif; color: #111; }
      .page { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 260mm; text-align: center; page-break-after: always; break-after: page; }
      .page:last-child { page-break-after: auto; break-after: auto; }
      .qr svg { width: 140mm; height: 140mm; }
      .name { margin-top: 10mm; font-size: 22pt; font-weight: 600; max-width: 170mm; }
      .label { margin-top: 4mm; font-size: 48pt; font-weight: 800; letter-spacing: 2px; }
      .hint { margin-top: 6mm; font-size: 12pt; color: #555; }
    </style></head><body>${pages}</body></html>`)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 300)
  return true
}
