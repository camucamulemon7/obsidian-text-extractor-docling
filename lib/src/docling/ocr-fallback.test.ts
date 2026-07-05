import { describe, expect, test } from 'vitest'
import type { DoclingOptions } from '../types'
import {
  searchableTextLength,
  selectMoreSearchableText,
  shouldRetryWithForceOcr,
} from './ocr-fallback'

const options: DoclingOptions = {
  enabled: true,
  serverUrl: 'http://localhost:5002',
  outputFormat: 'md',
  doOcr: true,
  forceOcr: false,
  ocrPreset: 'easyocr',
  ocrLang: ['ja', 'en'],
  pipeline: 'standard',
  pdfBackend: 'pypdfium2',
  timeoutMs: 300_000,
  concurrency: 1,
}

describe('automatic Force OCR fallback', () => {
  test('retries image-heavy PDFs with very little searchable text', () => {
    const text = Array.from(
      { length: 58 },
      () => '<!-- image -->'
    ).join('\n\n') + '\nA short caption'

    expect(shouldRetryWithForceOcr('aa.pdf', text, options)).toBe(true)
  })

  test('does not retry a PDF that already contains enough text', () => {
    const text = `${'Searchable business document text '.repeat(20)}
<!-- image -->
<!-- image -->
<!-- image -->`

    expect(shouldRetryWithForceOcr('report.pdf', text, options)).toBe(false)
  })

  test('does not retry non-PDF files or an explicit Force OCR request', () => {
    const text = '<!-- image -->'.repeat(10)

    expect(shouldRetryWithForceOcr('slides.pptx', text, options)).toBe(false)
    expect(
      shouldRetryWithForceOcr('scan.pdf', text, {
        ...options,
        forceOcr: true,
      })
    ).toBe(false)
  })

  test('retries image-heavy PDFs regardless of pipeline or output selection', () => {
    const text = '<!-- image -->'.repeat(10)

    expect(
      shouldRetryWithForceOcr('scan.pdf', text, {
        ...options,
        pipeline: 'vlm',
        outputFormat: 'text',
      })
    ).toBe(true)
  })

  test('keeps the result containing more searchable text', () => {
    const original = '<!-- image -->'.repeat(10) + 'caption'
    const forced = 'Recognized text from every page'

    expect(selectMoreSearchableText(original, forced)).toBe(forced)
    expect(selectMoreSearchableText(forced, original)).toBe(forced)
    expect(searchableTextLength(original)).toBe(7)
  })
})
