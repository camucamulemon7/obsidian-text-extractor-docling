import TextExtractorPlugin from './main'
import { Notice, PluginSettingTab, Setting } from 'obsidian'
import { getCacheBasePath } from 'obsidian-text-extract'

interface TextExtractorSettings {
  useDoclingServe: boolean
  doclingServeUrl: string
  doclingApiKey: string
  doclingOutputFormat: 'text' | 'md'
  doclingDoOcr: boolean
  doclingForceOcr: boolean
  doclingOcrPreset: 'auto' | 'easyocr' | 'tesseract'
  doclingOcrLanguages: string[]
  doclingPipeline: 'standard' | 'vlm'
  doclingVlmModel: string
  doclingPdfBackend:
    | 'pypdfium2'
    | 'docling_parse'
    | 'dlparse_v1'
    | 'dlparse_v2'
    | 'dlparse_v4'
  doclingTimeoutSec: number
  doclingConcurrency: number
}

export class TextExtractorSettingsTab extends PluginSettingTab {
  plugin: TextExtractorPlugin

  constructor(plugin: TextExtractorPlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  display(): void {
    const { containerEl } = this
    containerEl.empty()

    containerEl.createEl('h2', { text: 'Text Extractor - Settings' })

    new Setting(containerEl).setName('Server').setHeading()

    new Setting(containerEl)
      .setName('Use docling-serve')
      .setDesc('Offload document extraction to an external docling-serve.')
      .addToggle(toggle => {
        toggle.setValue(settings.useDoclingServe).onChange(async value => {
          settings.useDoclingServe = value
          await saveSettings(this.plugin)
          this.display()
        })
      })

    if (!settings.useDoclingServe) {
      containerEl.createDiv({
        cls: 'text-extractor-disabled-callout',
        text: 'docling-serve is disabled. Enable it to configure extraction.',
      })
      return
    }

    new Setting(containerEl)
      .setName('docling-serve URL')
      .setDesc('The server base URL, for example http://gpu-server:5001.')
      .addText(text => {
        text
          .setPlaceholder('http://localhost:5001')
          .setValue(settings.doclingServeUrl)
          .onChange(async value => {
            settings.doclingServeUrl = value.trim()
            await saveSettings(this.plugin)
          })
      })

    new Setting(containerEl)
      .setName('Connection')
      .setDesc(
        'Check that docling-serve is reachable with the current URL and API key.'
      )
      .addButton(button => {
        button.setButtonText('Test connection').onClick(async () => {
          button.setDisabled(true)
          button.setButtonText('Testing…')
          try {
            await testDoclingConnection()
            new Notice('Text Extractor - docling-serve connection successful.')
          } catch (error) {
            console.warn('Text Extractor - Connection test failed', error)
            new Notice('Text Extractor - Could not connect to docling-serve.')
          } finally {
            button.setDisabled(false)
            button.setButtonText('Test connection')
          }
        })
      })

    new Setting(containerEl)
      .setName('API key')
      .setDesc('Sent as X-Api-Key when set.')
      .addText(text => {
        text.inputEl.type = 'password'
        text.setValue(settings.doclingApiKey).onChange(async value => {
          settings.doclingApiKey = value
          await saveSettings(this.plugin)
        })
      })

    new Setting(containerEl).setName('Conversion').setHeading()

    new Setting(containerEl)
      .setName('Output format')
      .setDesc(
        'Plain text is recommended for Omnisearch; Markdown preserves structure.'
      )
      .addDropdown(dropdown => {
        dropdown
          .addOption('text', 'Text')
          .addOption('md', 'Markdown')
          .setValue(settings.doclingOutputFormat)
          .onChange(async value => {
            settings.doclingOutputFormat = value as 'text' | 'md'
            await saveSettings(this.plugin)
          })
      })

    new Setting(containerEl)
      .setName('Processing pipeline')
      .setDesc(
        'Standard is recommended for normal extraction. VLM uses a selected vision-language model.'
      )
      .addDropdown(dropdown => {
        dropdown
          .addOption('standard', 'Standard')
          .addOption('vlm', 'Vision-language model (VLM)')
          .setValue(settings.doclingPipeline)
          .onChange(async value => {
            settings.doclingPipeline =
              value as TextExtractorSettings['doclingPipeline']
            await saveSettings(this.plugin)
            this.display()
          })
      })

    new Setting(containerEl)
      .setName('PDF backend')
      .setDesc(
        'pypdfium2 is recommended for Japanese PDFs with broken embedded character maps.'
      )
      .addDropdown(dropdown => {
        dropdown
          .addOption('pypdfium2', 'PyPDFium2 (recommended for Japanese)')
          .addOption('docling_parse', 'Docling Parse')
          .addOption('dlparse_v1', 'Docling Parse v1')
          .addOption('dlparse_v2', 'Docling Parse v2')
          .addOption('dlparse_v4', 'Docling Parse v4')
          .setValue(settings.doclingPdfBackend)
          .onChange(async value => {
            settings.doclingPdfBackend =
              value as TextExtractorSettings['doclingPdfBackend']
            await saveSettings(this.plugin)
          })
      })

    if (settings.doclingPipeline === 'vlm') {
      new Setting(containerEl)
        .setName('VLM model')
        .setDesc(
          'The selected model must be installed or configured on docling-serve.'
        )
        .addDropdown(dropdown => {
          for (const model of VLM_MODELS) {
            dropdown.addOption(model.value, model.name)
          }
          dropdown.setValue(settings.doclingVlmModel).onChange(async value => {
            settings.doclingVlmModel = value
            await saveSettings(this.plugin)
          })
        })
    }

    new Setting(containerEl).setName('OCR').setHeading()

    new Setting(containerEl)
      .setName('Do OCR')
      .setDesc('OCR images and scanned regions that have no usable text layer.')
      .addToggle(toggle => {
        toggle.setValue(settings.doclingDoOcr).onChange(async value => {
          settings.doclingDoOcr = value
          await saveSettings(this.plugin)
          this.display()
        })
      })

    if (settings.doclingDoOcr) {
      new Setting(containerEl)
        .setName('Force OCR')
        .setDesc(
          'Replace the entire PDF text layer with OCR. Use only when changing the PDF backend does not fix the text.'
        )
        .addToggle(toggle => {
          toggle.setValue(settings.doclingForceOcr).onChange(async value => {
            settings.doclingForceOcr = value
            await saveSettings(this.plugin)
          })
        })

      new Setting(containerEl)
        .setName('OCR engine')
        .setDesc(
          'RapidOCR is fast for general use. EasyOCR was more accurate for Japanese in the tested document.'
        )
        .addDropdown(dropdown => {
          dropdown
            .addOption('auto', 'RapidOCR')
            .addOption('easyocr', 'EasyOCR')
            .addOption('tesseract', 'Tesseract')
            .setValue(settings.doclingOcrPreset)
            .onChange(async value => {
              settings.doclingOcrPreset =
                value as TextExtractorSettings['doclingOcrPreset']
              await saveSettings(this.plugin)
            })
        })

      this.addLanguagePicker(containerEl)
    }

    new Setting(containerEl).setName('Performance').setHeading()

    new Setting(containerEl)
      .setName('Timeout seconds')
      .setDesc('Maximum time to wait for one docling-serve request.')
      .addText(text => {
        text.inputEl.type = 'number'
        text.inputEl.min = '1'
        text
          .setValue(String(settings.doclingTimeoutSec))
          .onChange(async value => {
            settings.doclingTimeoutSec = positiveInteger(value, 300)
            await saveSettings(this.plugin)
          })
      })

    new Setting(containerEl)
      .setName('Concurrency')
      .setDesc('Concurrent docling-serve requests (1–8).')
      .addText(text => {
        text.inputEl.type = 'number'
        text.inputEl.min = '1'
        text.inputEl.max = '8'
        text
          .setValue(String(settings.doclingConcurrency))
          .onChange(async value => {
            settings.doclingConcurrency = Math.min(positiveInteger(value, 1), 8)
            await saveSettings(this.plugin)
          })
      })

    new Setting(containerEl).setName('Cache').setHeading()

    const resetCacheDesc = new DocumentFragment()
    resetCacheDesc.createSpan({}, span => {
      span.innerHTML = `Erase all Text Extractor cache data. Use this if you want to re-extract all your files, e.g after a change in language settings.<br>
        Be careful that re-extracting all your files can take a long time.`
    })
    new Setting(containerEl)
      .setName('Clear cache data')
      .setDesc(resetCacheDesc)
      .addButton(cb => {
        cb.setButtonText('Clear cache')
        cb.onClick(async () => {
          await app.vault.adapter.rmdir(getCacheBasePath(), true)
          new Notice('Text Extract - Cache cleared.')
        })
      })
  }

  private addLanguagePicker(containerEl: HTMLElement): void {
    const languageSetting = new Setting(containerEl)
      .setName('OCR languages')
      .setDesc(
        'Select any number of languages. No selection lets the engine detect automatically.'
      )
    languageSetting.settingEl.addClass('text-extractor-language-setting')

    const details = languageSetting.controlEl.createEl('details', {
      cls: 'text-extractor-language-picker',
    })
    const summary = details.createEl('summary')
    const grid = details.createDiv({ cls: 'text-extractor-language-grid' })

    const updateSummary = () => {
      const selected = OCR_LANGUAGES.filter(language =>
        settings.doclingOcrLanguages.includes(language.code)
      )
      summary.setText(
        selected.length === 0
          ? 'Automatic detection'
          : selected.length <= 3
          ? selected.map(language => language.name).join(', ')
          : `${selected.length} languages selected`
      )
    }

    for (const language of OCR_LANGUAGES) {
      const label = grid.createEl('label', {
        cls: 'text-extractor-language-option',
      })
      const checkbox = label.createEl('input', {
        type: 'checkbox',
        value: language.code,
      })
      checkbox.checked = settings.doclingOcrLanguages.includes(language.code)
      label.createSpan({ text: language.name })
      label.createEl('code', { text: language.code })
      checkbox.addEventListener('change', async () => {
        const selected = new Set(settings.doclingOcrLanguages)
        if (checkbox.checked) {
          selected.add(language.code)
        } else {
          selected.delete(language.code)
        }
        settings.doclingOcrLanguages = OCR_LANGUAGES.map(
          item => item.code
        ).filter(code => selected.has(code))
        updateSummary()
        await saveSettings(this.plugin)
      })
    }

    const actions = details.createDiv({
      cls: 'text-extractor-language-actions',
    })
    const selectRecommended = actions.createEl('button', {
      text: 'Japanese + English',
      cls: 'mod-cta',
    })
    selectRecommended.type = 'button'
    selectRecommended.addEventListener('click', async event => {
      event.preventDefault()
      settings.doclingOcrLanguages = ['ja', 'en']
      await saveSettings(this.plugin)
      this.display()
    })
    const clear = actions.createEl('button', { text: 'Clear' })
    clear.type = 'button'
    clear.addEventListener('click', async event => {
      event.preventDefault()
      settings.doclingOcrLanguages = []
      await saveSettings(this.plugin)
      this.display()
    })
    updateSummary()
  }
}

const DEFAULT_SETTINGS: TextExtractorSettings = {
  useDoclingServe: true,
  doclingServeUrl: 'http://localhost:5001',
  doclingApiKey: '',
  doclingOutputFormat: 'text',
  doclingDoOcr: true,
  doclingForceOcr: false,
  doclingOcrPreset: 'easyocr',
  doclingOcrLanguages: ['ja', 'en'],
  doclingPipeline: 'standard',
  doclingVlmModel: 'granite_docling',
  doclingPdfBackend: 'pypdfium2',
  doclingTimeoutSec: 300,
  doclingConcurrency: 1,
}

const OCR_LANGUAGES = [
  { code: 'ja', name: 'Japanese' },
  { code: 'en', name: 'English' },
  { code: 'zh-cn', name: 'Chinese (Simplified)' },
  { code: 'zh-tw', name: 'Chinese (Traditional)' },
  { code: 'ko', name: 'Korean' },
  { code: 'de', name: 'German' },
  { code: 'fr', name: 'French' },
  { code: 'es', name: 'Spanish' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'th', name: 'Thai' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
  { code: 'tr', name: 'Turkish' },
  { code: 'uk', name: 'Ukrainian' },
] as const

const VLM_MODELS = [
  { value: 'granite_docling', name: 'Granite Docling' },
  { value: 'smoldocling', name: 'SmolDocling' },
  { value: 'granite_vision', name: 'Granite Vision' },
  { value: 'got_ocr_2', name: 'GOT-OCR 2' },
  { value: 'glm_ocr', name: 'GLM-OCR' },
  { value: 'lightonocr', name: 'LightOnOCR' },
  { value: 'smoldocling_vllm', name: 'SmolDocling (vLLM)' },
  { value: 'granite_vision_vllm', name: 'Granite Vision (vLLM)' },
  { value: 'granite_vision_ollama', name: 'Granite Vision (Ollama)' },
  { value: 'granite_docling_vllm', name: 'Granite Docling (vLLM)' },
  { value: 'nanonets_ocr2', name: 'Nanonets OCR2' },
  { value: 'nanonets_ocr2_vllm', name: 'Nanonets OCR2 (vLLM)' },
  {
    value: 'nanonets_ocr2_lmstudio',
    name: 'Nanonets OCR2 (LM Studio)',
  },
  { value: 'glm_ocr_vllm', name: 'GLM-OCR (vLLM)' },
  { value: 'lightonocr_vllm', name: 'LightOnOCR (vLLM)' },
  { value: 'deepseekocr_ollama', name: 'DeepSeek OCR (Ollama)' },
] as const

function positiveInteger(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

async function testDoclingConnection(): Promise<void> {
  const serverUrl = settings.doclingServeUrl.trim().replace(/\/+$/, '')
  if (!serverUrl) {
    throw new Error('docling-serve URL is empty')
  }
  const headers: Record<string, string> = {}
  if (settings.doclingApiKey) {
    headers['X-Api-Key'] = settings.doclingApiKey
  }
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch(`${serverUrl}/health`, {
      headers,
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
  } finally {
    window.clearTimeout(timeout)
  }
}

export let settings = Object.assign(
  {},
  DEFAULT_SETTINGS
) as TextExtractorSettings

export async function loadSettings(plugin: TextExtractorPlugin): Promise<void> {
  const saved = await plugin.loadData()
  settings = Object.assign({}, DEFAULT_SETTINGS, saved)
  if (
    !Array.isArray(saved?.doclingOcrLanguages) &&
    typeof saved?.doclingOcrLang === 'string'
  ) {
    settings.doclingOcrLanguages = saved.doclingOcrLang
      .split(',')
      .map((language: string) => language.trim())
      .filter(Boolean)
  }
}

export async function saveSettings(plugin: TextExtractorPlugin): Promise<void> {
  await plugin.saveData(settings)
}
