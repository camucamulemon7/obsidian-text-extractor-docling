import type { DoclingOptions } from '../types'

const IMAGE_MARKER_PATTERN = /<!--\s*image\s*-->/gi
const MIN_IMAGE_MARKERS = 3
const MAX_TEXT_CHARACTERS_PER_IMAGE = 50

export function searchableTextLength(text: string): number {
  return text.replace(IMAGE_MARKER_PATTERN, '').replace(/\s/g, '').length
}

export function shouldRetryWithForceOcr(
  filePath: string,
  text: string,
  options: DoclingOptions
): boolean {
  if (
    !filePath.toLowerCase().endsWith('.pdf') ||
    !options.doOcr ||
    options.forceOcr
  ) {
    return false
  }

  const imageMarkers = text.match(IMAGE_MARKER_PATTERN)?.length ?? 0
  if (imageMarkers < MIN_IMAGE_MARKERS) {
    return false
  }

  return (
    searchableTextLength(text) <
    imageMarkers * MAX_TEXT_CHARACTERS_PER_IMAGE
  )
}

export function selectMoreSearchableText(
  originalText: string,
  forcedOcrText: string
): string {
  return searchableTextLength(forcedOcrText) >
    searchableTextLength(originalText)
    ? forcedOcrText
    : originalText
}
