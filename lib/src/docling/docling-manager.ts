import PQueue from 'p-queue'
import type { TFile } from 'obsidian'
import { getCachePath, readCache, writeCache } from '../cache'
import type { DoclingOptions } from '../types'
import {
  selectMoreSearchableText,
  shouldRetryWithForceOcr,
} from './ocr-fallback'

class DoclingManager {
  private readonly queue = new PQueue({ concurrency: 1 })

  private setConcurrency(concurrency: number): void {
    const safeConcurrency = Math.max(
      1,
      Math.min(Number.isFinite(concurrency) ? Math.floor(concurrency) : 1, 8)
    )
    this.queue.concurrency = safeConcurrency
  }

  public async getText(file: TFile, options: DoclingOptions): Promise<string> {
    this.setConcurrency(options.concurrency)
    return (
      (await this.queue.add(() => this.getTextInternal(file, options))) ?? ''
    )
  }

  private async getTextInternal(
    file: TFile,
    options: DoclingOptions
  ): Promise<string> {
    const cache = await readCache(file)
    if (cache) {
      if (
        !cache.autoForceOcrAttempted &&
        shouldRetryWithForceOcr(file.path, cache.text ?? '', options)
      ) {
        return await this.retryWithForceOcr(
          file,
          options,
          cache.text ?? ''
        )
      }
      return cache.text ?? ''
    }

    const text = await this.callDoclingServe(file, options)
    if (shouldRetryWithForceOcr(file.path, text, options)) {
      return await this.retryWithForceOcr(file, options, text)
    }

    await this.writeTextCache(file, options, text, false)
    return text
  }

  private async retryWithForceOcr(
    file: TFile,
    options: DoclingOptions,
    originalText: string
  ): Promise<string> {
    console.info(
      `Text Extractor - Retrying image-heavy PDF with Force OCR: ${file.path}`
    )
    try {
      const forcedOcrText = await this.callDoclingServe(file, {
        ...options,
        forceOcr: true,
      })
      const text = selectMoreSearchableText(originalText, forcedOcrText)
      await this.writeTextCache(file, options, text, true)
      return text
    } catch (error) {
      console.warn(
        `Text Extractor - Automatic Force OCR retry failed for ${file.path}`,
        error
      )
      await this.writeTextCache(file, options, originalText, true)
      return originalText
    }
  }

  private async writeTextCache(
    file: TFile,
    options: DoclingOptions,
    text: string,
    autoForceOcrAttempted: boolean
  ): Promise<void> {
    const cachePath = getCachePath(file)
    await writeCache(
      cachePath.folder,
      cachePath.filename,
      text,
      file.path,
      options.ocrLang.join(','),
      autoForceOcrAttempted
    )
  }

  private async callDoclingServe(
    file: TFile,
    options: DoclingOptions
  ): Promise<string> {
    const serverUrl = options.serverUrl.trim().replace(/\/+$/, '')
    if (!serverUrl) {
      throw new Error('docling-serve URL is empty')
    }

    const binary = await app.vault.readBinary(file)
    const form = new FormData()
    form.append('files', new Blob([binary]), file.name)
    form.append('to_formats', options.outputFormat)
    form.append('do_ocr', String(options.doOcr))
    form.append('force_ocr', String(options.forceOcr))
    form.append('ocr_preset', options.ocrPreset)
    form.append('pipeline', options.pipeline)
    form.append('pdf_backend', options.pdfBackend)
    if (options.pipeline === 'vlm' && options.vlmModel) {
      form.append('vlm_pipeline_model', options.vlmModel)
    }
    form.append('abort_on_error', 'false')
    for (const lang of options.ocrLang.filter(Boolean)) {
      form.append('ocr_lang', lang)
    }

    const headers: Record<string, string> = {}
    if (options.apiKey) {
      headers['X-Api-Key'] = options.apiKey
    }

    const controller = new AbortController()
    const timeoutMs =
      Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
        ? options.timeoutMs
        : 300_000
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(`${serverUrl}/v1/convert/file`, {
        method: 'POST',
        headers,
        body: form,
        signal: controller.signal,
      })
      if (!response.ok) {
        throw new Error(`docling-serve failed: HTTP ${response.status}`)
      }

      const result = (await response.json()) as {
        document?: {
          text_content?: unknown
          md_content?: unknown
        }
      }
      const text =
        options.outputFormat === 'md'
          ? result.document?.md_content
          : result.document?.text_content
      if (typeof text !== 'string') {
        throw new Error(
          `docling-serve response is missing document.${options.outputFormat}_content`
        )
      }
      return text
    } finally {
      clearTimeout(timeout)
    }
  }

  public clearQueue(): void {
    this.queue.clear()
  }
}

export const doclingManager = new DoclingManager()
