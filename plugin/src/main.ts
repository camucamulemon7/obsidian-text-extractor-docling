import { MenuItem, Notice, Platform, Plugin, TFile, App } from 'obsidian'
import { loadSettings, settings, TextExtractorSettingsTab } from './settings'
import * as TextExtract from 'obsidian-text-extract'
import {
  canFileBeExtracted,
  extractText,
  isInCache,
  removeFromCache,
} from 'obsidian-text-extract'
import { createNote } from './utils'

export type TextExtractorApi = {
  extractText: (file: TFile) => Promise<string>
  canFileBeExtracted: (filePath: string) => boolean
  isInCache: (file: TFile) => Promise<boolean>
}

export default class TextExtractorPlugin extends Plugin {
  public api: TextExtractorApi = {
    async extractText(file: TFile): Promise<string> {
      return await TextExtract.extractText(file, buildExtractOptions())
    },
    canFileBeExtracted: TextExtract.canFileBeExtracted,
    isInCache: TextExtract.isInCache,
  }

  async onload() {
    await loadSettings(this)
    await TextExtract.convertOldCachePaths()
    this.addSettingTab(new TextExtractorSettingsTab(this))

    this.addCommand({
      id: 'extract-to-clipboard',
      name: 'Extract text to clipboard',
      callback: () => {
        const file = getActiveFile(this.app)
        if (file != null && canFileBeExtracted(file.path)) {
          extractToClipboard(file)
        }
      },
    })

    this.addCommand({
      id: 'extract-to-new-note',
      name: 'Extract text into a new note',
      callback: () => {
        const file = getActiveFile(this.app)
        if (file != null && canFileBeExtracted(file.path)) {
          extractToNewNote(file)
        }
      },
    })

    this.registerEvent(
      app.workspace.on('file-menu', (menu, file, _source) => {
        if (file instanceof TFile && canFileBeExtracted(file.path)) {
          if (Platform.isDesktopApp) {
            menu.addItem((item: MenuItem) => {
              item.setTitle('Text Extractor')
              const submenu = item.setSubmenu()

              // Copy to clipboard
              submenu.addItem(item => {
                item
                  .setTitle('Extract Text to clipboard')
                  .setIcon('clipboard-copy')
                  .onClick(async () => {
                    extractToClipboard(file)
                  })
              })

              // Create new note
              submenu.addItem(item => {
                item
                  .setTitle('Extract text into a new note')
                  .setIcon('document')
                  .onClick(async () => {
                    extractToNewNote(file)
                  })
              })

              // Locate cache file
              if (Platform.isDesktopApp) {
                submenu.addSeparator()
                submenu.addItem(item => {
                  item
                    .setTitle('Clear cache for this file')
                    .setIcon('trash')
                    .onClick(async () => {
                      await removeFromCache(file)
                      new Notice(
                        `Text Extractor - Removed ${file.path} from cache`
                      )
                    })
                })
              }
            })
          } else {
            menu.addItem(item => {
              item
                .setTitle('Extract text into a new note')
                .setIcon('document')
                .onClick(async () => {
                  extractToNewNote(file)
                })
            })
          }
        }
      })
    )
  }

  onunload() {
    TextExtract.clearProcessQueue()
  }
}

async function extractTextWithNotice(file: TFile) {
  if (!(await isInCache(file))) {
    new Notice(
      `Text Extractor - Extracting text from file ${file.path}, please wait...`
    )
  }
  try {
    return await extractText(file, buildExtractOptions())
  } catch (e) {
    new Notice(`Text Extractor - Error extracting text from file ${file.path}`)
    throw e
  }
}

function buildExtractOptions() {
  return {
    docling: {
      enabled: settings.useDoclingServe,
      serverUrl: settings.doclingServeUrl,
      apiKey: settings.doclingApiKey,
      outputFormat: settings.doclingOutputFormat,
      doOcr: settings.doclingDoOcr,
      forceOcr: settings.doclingForceOcr,
      ocrPreset: settings.doclingOcrPreset,
      ocrLang: getOcrLanguageCodes(
        settings.doclingOcrLanguages,
        settings.doclingOcrPreset
      ),
      pipeline: settings.doclingPipeline,
      pdfBackend: settings.doclingPdfBackend,
      vlmModel:
        settings.doclingPipeline === 'vlm'
          ? settings.doclingVlmModel
          : undefined,
      timeoutMs: settings.doclingTimeoutSec * 1000,
      concurrency: settings.doclingConcurrency,
    },
  }
}

const TESSERACT_LANGUAGE_CODES: Record<string, string> = {
  ja: 'jpn',
  en: 'eng',
  de: 'deu',
  fr: 'fra',
  es: 'spa',
  it: 'ita',
  pt: 'por',
  ko: 'kor',
  'zh-cn': 'chi_sim',
  'zh-tw': 'chi_tra',
  ru: 'rus',
  ar: 'ara',
  hi: 'hin',
  th: 'tha',
  vi: 'vie',
  nl: 'nld',
  pl: 'pol',
  tr: 'tur',
  uk: 'ukr',
}

function getOcrLanguageCodes(
  languages: string[],
  preset: 'auto' | 'easyocr' | 'tesseract'
): string[] {
  if (preset !== 'tesseract') {
    return languages
  }
  return languages.map(
    language => TESSERACT_LANGUAGE_CODES[language] ?? language
  )
}

async function extractToClipboard(file: TFile) {
  const { clipboard } = require('electron')
  const text = await extractTextWithNotice(file)
  if (!text) {
    new Notice(
      'Text Extractor - No text was extracted. Check docling-serve and clear the file cache before retrying.'
    )
    return
  }
  await clipboard.writeText(text)
  new Notice('Text Extractor - Text copied to clipboard')
}

async function extractToNewNote(file: TFile) {
  const extractedText = await extractTextWithNotice(file)
  const contents = cleanExtractedNote(extractedText)
  if (!contents) {
    new Notice(
      'Text Extractor - No text was extracted. Check docling-serve and clear the file cache before retrying.'
    )
    return
  }
  await createNote(file.basename, contents)
}

function cleanExtractedNote(text: string): string {
  return text.replace(/<!--\s*image\s*-->\s*/gi, '').trim()
}

function getActiveFile(app: App): TFile | null {
  return app.workspace.activeEditor?.file ?? app.workspace.getActiveFile()
}
