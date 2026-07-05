export type ExtractedText = {
  path: string
  text: string
  langs: string
  libVersion: string
  autoForceOcrAttempted?: boolean
  // hash: string
  // size: number
}

export type DoclingOptions = {
  enabled: boolean
  serverUrl: string
  apiKey?: string
  outputFormat: 'text' | 'md'
  doOcr: boolean
  forceOcr: boolean
  ocrPreset: 'auto' | 'easyocr' | 'tesseract'
  ocrLang: string[]
  pipeline: 'standard' | 'vlm'
  vlmModel?: string
  pdfBackend:
    | 'pypdfium2'
    | 'docling_parse'
    | 'dlparse_v1'
    | 'dlparse_v2'
    | 'dlparse_v4'
  timeoutMs: number
  concurrency: number
}

export type ExtractTextOptions = {
  docling?: DoclingOptions
}
