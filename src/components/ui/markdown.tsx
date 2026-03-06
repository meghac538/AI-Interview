"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Copy, Check } from "lucide-react";
import { copyToClipboard } from "@/lib/utils";

interface CodeBlockProps {
  children: string;
  className?: string;
}

function CodeBlock({ children, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const language = className?.replace("language-", "") || "text";

  const handleCopy = async () => {
    const success = await copyToClipboard(children);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative my-4 rounded-xl bg-foreground/95 border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-foreground/90 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          aria-label={copied ? "Copied!" : "Copy code"}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-primary" />
              <span className="text-primary">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <div className="overflow-x-auto">
        <pre className="!my-0 !bg-transparent">
          <code className={className}>{children}</code>
        </pre>
      </div>
    </div>
  );
}

interface MarkdownContentProps {
  content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          p: ({ children }) => (
            <p className="text-sm mb-3 leading-relaxed last:mb-0">{children}</p>
          ),

          h1: ({ children }) => (
            <h1 className="text-xl font-semibold mb-3 mt-4 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold mb-2.5 mt-3 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold mb-2 mt-3 first:mt-0">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-semibold mb-2 mt-2 first:mt-0">
              {children}
            </h4>
          ),
          h5: ({ children }) => (
            <h5 className="text-sm font-semibold mb-1.5 mt-2 first:mt-0">
              {children}
            </h5>
          ),
          h6: ({ children }) => (
            <h6 className="text-xs font-semibold mb-1.5 mt-2 first:mt-0 uppercase tracking-wider">
              {children}
            </h6>
          ),

          ul: ({ children }) => (
            <ul className="space-y-1.5 mb-3 ml-4 list-none">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="space-y-1.5 mb-3 ml-5 list-decimal marker:text-primary marker:font-semibold">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-sm leading-relaxed relative pl-0 before:content-['•'] before:absolute before:-left-4 before:text-primary before:font-bold">
              {children}
            </li>
          ),

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

          code: ({ className, children, ...props }) => {
            const isCodeBlock = className?.startsWith("language-");

            if (isCodeBlock) {
              return (
                <CodeBlock className={className}>
                  {String(children).replace(/\n$/, "")}
                </CodeBlock>
              );
            }

            return (
              <code
                className="bg-muted px-1.5 py-0.5 rounded-md font-mono text-[0.875em]"
                {...props}
              >
                {children}
              </code>
            );
          },

          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary bg-muted/30 pl-4 pr-3 py-2 my-3 text-sm text-muted-foreground italic">
              {children}
            </blockquote>
          ),

          hr: () => <hr className="my-4 border-t border-border" />,

          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-xl border">
              <table className="min-w-full divide-y divide-border">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/50">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-border bg-card">{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="even:bg-muted/20">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2 text-sm">{children}</td>
          ),

          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
