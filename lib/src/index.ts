import type { TFile } from 'obsidian'
import type { ExtractTextOptions } from './types'
import { convertOldCachePaths, getCacheBasePath, getCachePath } from './cache'
import { doclingManager } from './docling/docling-manager'

/**
 * Returns a promise that resolves to the text extracted from the file.
 * Will throw an error if the file type is not supported; check canFileBeExtracted() first.
 * @param file
 * @param options - docling-serve connection and conversion options
 * @returns
 */
function extractText(
  file: TFile,
  options: Partial<ExtractTextOptions> = {}
): Promise<string> {
  if (!canFileBeExtracted(file.path)) {
    throw new Error('File type not supported')
  }

  if (!options.docling?.enabled) {
    return Promise.resolve('')
  }

  return doclingManager.getText(file, options.docling).catch(error => {
    console.warn(`Text Extractor - docling-serve failed for ${file.path}`, error)
    return ''
  })
}

function isFilePDF(path: string): boolean {
  return path.toLowerCase().endsWith('.pdf')
}

function isFileImage(path: string): boolean {
  path = path.toLowerCase()
  return (
    path.endsWith('.png') ||
    path.endsWith('.jpg') ||
    path.endsWith('.jpeg') ||
    path.endsWith('.webp') ||
    path.endsWith('.gif') ||
    path.endsWith('.bmp')
  )
}

function isFileOffice(path: string): boolean {
  path = path.toLowerCase()
  return (
    path.endsWith('.docx') ||
    path.endsWith('.xlsx') ||
    path.endsWith('.pptx')
  )
}

/**
 * Returns true if the filepath is a supported file type.
 * @param filePath
 * @returns
 */
function canFileBeExtracted(filePath: string): boolean {
  return isFilePDF(filePath) || isFileImage(filePath) || isFileOffice(filePath)
}

/**
 * Clears the process queue.
 * This stops any pending text extraction.
 */
function clearProcessQueue() {
  doclingManager.clearQueue()
}

async function isInCache(file: TFile): Promise<boolean> {
  const path = getCachePath(file)
  return app.vault.adapter.exists(path.fullpath)
}

async function removeFromCache(file: TFile): Promise<void> {
  const path = getCachePath(file)
  if (await isInCache(file)) {
    return await app.vault.adapter.remove(path.fullpath)
  }
}

export {
  extractText,
  canFileBeExtracted,
  clearProcessQueue,
  isInCache,
  removeFromCache,
  getCacheBasePath,
  convertOldCachePaths,
}
