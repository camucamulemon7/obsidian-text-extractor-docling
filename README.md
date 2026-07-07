# Text Extractor for Docling

An Obsidian plugin that extracts text from PDFs, images, and Office documents
through an external docling-serve instance. It retains the `text-extractor`
plugin ID and API for compatibility with
[Omnisearch](https://github.com/scambier/obsidian-omnisearch).

Maintained by [camucamulemon7](https://github.com/camucamulemon7/obsidian-text-extractor-docling).
Based on the original
[Obsidian Text Extractor](https://github.com/scambier/obsidian-text-extractor)
by Simon Cambier.

![](https://raw.githubusercontent.com/scambier/obsidian-text-extractor/master/images/context_menu.png)

Supported files:

- Images (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.bmp`)
- PDFs (`.pdf`)
- Office documents (`.docx`, `.xlsx`, `.pptx`)

### Limitations

- This fork requires a reachable docling-serve instance.
- Local PDF parsing, OCR, and Office extraction are not included.

### Cache & Sync

The plugin caches extracted text as local `.json` files inside the plugin
directory. Subsequent requests use the cache without contacting docling-serve.




## Installation

Text Extractor is available on the [Obsidian community plugins repository](https://obsidian.md/plugins?search=Text%20Extractor). You can also install it manually by downloading the latest release from the [releases page](https://github.com/scambier/obsidian-text-extractor/releases) or by using the [BRAT plugin manager](https://github.com/TfTHacker/obsidian42-brat).

## Why?

Text extraction is a useful feature, but it is not easy to implement, and consumes a lot of resources.

**With this plugin, I hope to provide a unified way to extract texts from images & PDFs, and make it available to other plugins.** This way, other plugins can use it without having to worry about the implementation details, and without having to needlessly consume resources.

## ⚠️ Work in progress

I'm [dogfooding](https://en.wikipedia.org/wiki/Eating_your_own_dog_food) this plugin with Omnisearch. The API functions likely won't change, but this is still a beta.

## Using Text Extractor as a dependency for your plugin

The exposed API:

```ts
// Add this type somewhere in your code
export type TextExtractorApi = {
  extractText: (file: TFile) => Promise<string>
  canFileBeExtracted: (filePath: string) => boolean
  isInCache: (file: TFile) => Promise<boolean>
}

// Then, you can just use this function to get the API
export function getTextExtractor(): TextExtractorApi | undefined {
  return (app as any).plugins?.plugins?.['text-extractor']?.api
}

// And use it like this
const text = await getTextExtractor()?.extractText(file)
```

Note that Text Extractor only extract texts _on demand_, when you call `extractText()` on a file, to avoid unnecessary resource consumption. Subsequent calls to `extractText()` will return the cached text.

## docling-serve

This fork sends PDF, image, DOCX, XLSX, and PPTX extraction to an external
[docling-serve](https://github.com/docling-project/docling-serve) instance.
This keeps PDF parsing and OCR work off the computer running Obsidian.

Enable **Use docling-serve** in the Text Extractor settings and set the server
URL (for example, `http://gpu-server:5001`). Plain text output is recommended
for Omnisearch. Configure an API key when the server requires one; it is sent
in the `X-Api-Key` header. OCR languages, OCR engine, processing pipeline, and
VLM model can be selected in the settings. The default setup uses Japanese and
English, EasyOCR, the standard pipeline, PyPDFium2, a 300-second timeout, and
concurrency `1`.

Run docling-serve on a trusted LAN or behind a VPN, particularly when your
vault contains private documents. This fork retains the `text-extractor`
plugin ID for Omnisearch compatibility, so it replaces the official Text
Extractor plugin and cannot be installed alongside it.

## Development

While this plugin is first developed for Omnisearch, it's totally agnostic and I'd like it to become a community effort. If you wish to submit a PR, please open an issue first so we can discuss the feature.

The plugin is split in two parts:

- The text extraction library, which does the actual work
- The plugin itself, which is a wrapper around the library and exposes some useful options to the user

Each project is in its own folder and has its own `package.json` and
`node_modules`. The library uses Rollup, while the plugin uses esbuild.

## Acknowledgements

This project is a fork of
[scambier/obsidian-text-extractor](https://github.com/scambier/obsidian-text-extractor).
Heartfelt thanks to Simon Cambier and all contributors to the original project
for building the foundation, maintaining Omnisearch compatibility, and making
their work available to the community.
