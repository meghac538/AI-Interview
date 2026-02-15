'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Copy, Check } from 'lucide-react'
import { copyToClipboard } from '@/lib/utils'

interface CodeBlockProps {
  children: string
  className?: string
}

function CodeBlock({ children, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  // Extract language from className (format: "language-javascript")
  const language = className?.replace('language-', '') || 'text'

  const handleCopy = async () => {
    const success = await copyToClipboard(children)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="relative my-4 rounded-2xl bg-zinc-900 border border-zinc-700 overflow-hidden">
      {/* Header with language label and copy button */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-800 border-b border-zinc-700">
        <span className="text-xs font-medium text-zinc-300 uppercase tracking-wider">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          aria-label={copied ? 'Copied!' : 'Copy code'}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-blue-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code content with syntax highlighting */}
      <div className="overflow-x-auto">
        <pre className="!my-0 !bg-transparent">
          <code className={className}>{children}</code>
        </pre>
      </div>
    </div>
  )
}

interface MarkdownContentProps {
  content: string
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Paragraphs
          p: ({ children }) => (
            <p className="text-sm text-foreground mb-3 leading-relaxed last:mb-0">
              {children}
            </p>
          ),

          // Headings
          h1: ({ children }) => (
            <h1 className="font-display text-xl font-semibold text-foreground mb-3 mt-4 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-display text-lg font-semibold text-foreground mb-2.5 mt-3 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-foreground mb-2 mt-3 first:mt-0">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-semibold text-foreground mb-2 mt-2 first:mt-0">
              {children}
            </h4>
          ),
          h5: ({ children }) => (
            <h5 className="text-sm font-semibold text-muted-foreground mb-1.5 mt-2 first:mt-0">
              {children}
            </h5>
          ),
          h6: ({ children }) => (
            <h6 className="text-xs font-semibold text-muted-foreground mb-1.5 mt-2 first:mt-0 uppercase tracking-wider">
              {children}
            </h6>
          ),

          // Lists
          ul: ({ children }) => (
            <ul className="space-y-1.5 mb-3 ml-4 list-none">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="space-y-1.5 mb-3 ml-5 list-decimal marker:text-primary marker:font-semibold">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-sm text-foreground leading-relaxed relative pl-0 before:content-['•'] before:absolute before:-left-4 before:text-primary before:font-bold">
              {children}
            </li>
          ),

          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 underline decoration-primary/30 font-medium transition-colors"
            >
              {children}
            </a>
          ),

          // Inline code
          code: ({ className, children, ...props }) => {
            // Check if this is a code block (has language class) or inline code
            const isCodeBlock = className?.startsWith('language-')

            if (isCodeBlock) {
              // Code block - use CodeBlock component
              return (
                <CodeBlock className={className}>
                  {String(children).replace(/\n$/, '')}
                </CodeBlock>
              )
            }

            // Inline code
            return (
              <code
                className="bg-muted text-foreground px-1.5 py-0.5 rounded-md font-mono text-[0.875em]"
                {...props}
              >
                {children}
              </code>
            )
          },

          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary bg-muted pl-4 pr-3 py-2 my-3 text-sm text-muted-foreground italic">
              {children}
            </blockquote>
          ),

          // Horizontal rule
          hr: () => (
            <hr className="my-4 border-t border-border" />
          ),

          // Tables (via remark-gfm)
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-xl border">
              <table className="min-w-full divide-y divide-border">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-border bg-card">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="even:bg-muted/50">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2 text-sm text-foreground">
              {children}
            </td>
          ),

          // Strong and emphasis
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic">
              {children}
            </em>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
