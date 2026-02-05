'use client'

import { clsx } from 'clsx'

interface FormattedTextProps {
  text: string
  className?: string
  /** Truncate text to max lines (0 = no truncation) */
  maxLines?: number
  /** Preserve whitespace and line breaks */
  preserveWhitespace?: boolean
}

/**
 * Renders text with markdown-like formatting:
 * - **bold** → <strong>bold</strong>
 * - *italic* or _italic_ → <em>italic</em>
 * - [link](url) → clickable link
 * - Line breaks preserved
 * - Emoji and hashtags displayed as-is
 */
export function FormattedText({
  text,
  className,
  maxLines = 0,
  preserveWhitespace = true,
}: FormattedTextProps) {
  if (!text) return null

  // Convert markdown to HTML
  const formatText = (input: string): string => {
    // Step 1: Extract and preserve allowed HTML tags (<b>, <strong>, <i>, <em>)
    // Replace them with placeholders to survive XSS escaping
    let html = input
      .replace(/<b>/gi, '\x00BOLD_OPEN\x00')
      .replace(/<\/b>/gi, '\x00BOLD_CLOSE\x00')
      .replace(/<strong>/gi, '\x00BOLD_OPEN\x00')
      .replace(/<\/strong>/gi, '\x00BOLD_CLOSE\x00')
      .replace(/<i>/gi, '\x00ITALIC_OPEN\x00')
      .replace(/<\/i>/gi, '\x00ITALIC_CLOSE\x00')
      .replace(/<em>/gi, '\x00ITALIC_OPEN\x00')
      .replace(/<\/em>/gi, '\x00ITALIC_CLOSE\x00')

    // Step 2: Escape remaining HTML to prevent XSS
    html = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    // Step 3: Restore allowed tags
    html = html
      .replace(/\x00BOLD_OPEN\x00/g, '<strong>')
      .replace(/\x00BOLD_CLOSE\x00/g, '</strong>')
      .replace(/\x00ITALIC_OPEN\x00/g, '<em>')
      .replace(/\x00ITALIC_CLOSE\x00/g, '</em>')

    // Step 4: Convert markdown to HTML
    html = html
      // Bold: **text** or __text__
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      // Italic: *text* or _text_ (but not inside words like some_variable)
      .replace(/(?<![a-zA-Z0-9])_([^_\n]+?)_(?![a-zA-Z0-9])/g, '<em>$1</em>')
      .replace(/(?<![a-zA-Z0-9*])\*([^*\n]+?)\*(?![a-zA-Z0-9*])/g, '<em>$1</em>')
      // Links: [text](url)
      .replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary underline hover:text-primary/80">$1</a>'
      )
      // Line breaks - use space for truncated preview, br for full text
      .replace(/\n/g, maxLines > 0 ? ' ' : '<br />')

    return html
  }

  return (
    <div
      className={clsx(
        // Don't use whitespace-pre-wrap with line-clamp (breaks truncation)
        preserveWhitespace && maxLines === 0 && 'whitespace-pre-wrap',
        'break-words',
        className
      )}
      style={maxLines > 0 ? {
        display: '-webkit-box',
        WebkitLineClamp: maxLines,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      } : undefined}
      dangerouslySetInnerHTML={{ __html: formatText(text) }}
    />
  )
}

/**
 * Simple text preview with truncation and basic formatting
 * Used in lists and cards where space is limited
 */
export function TextPreview({
  text,
  maxLength = 100,
  className,
}: {
  text: string
  maxLength?: number
  className?: string
}) {
  if (!text) return null

  // Strip markdown and HTML tags for preview
  const plainText = text
    // Remove HTML tags completely (handles multiline)
    .replace(/<b>/gi, '')
    .replace(/<\/b>/gi, '')
    .replace(/<strong>/gi, '')
    .replace(/<\/strong>/gi, '')
    .replace(/<i>/gi, '')
    .replace(/<\/i>/gi, '')
    .replace(/<em>/gi, '')
    .replace(/<\/em>/gi, '')
    // Strip markdown
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim()

  const truncated = plainText.length > maxLength
    ? plainText.slice(0, maxLength) + '...'
    : plainText

  return (
    <span className={className}>
      {truncated}
    </span>
  )
}

export default FormattedText
