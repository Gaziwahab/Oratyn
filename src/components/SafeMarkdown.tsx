import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { parseSafeMarkdown, type InlineSpan } from '../../packages/domain/src/discussion';

function renderInlineSpans(spans: InlineSpan[]) {
  return spans.map((span, idx) => {
    if (span.type === 'text') {
      return <span key={idx}>{span.text}</span>;
    }
    if (span.type === 'bold') {
      return (
        <strong key={idx} className="font-semibold text-slate-100">
          {span.text}
        </strong>
      );
    }
    if (span.type === 'code') {
      return (
        <code
          key={idx}
          className="rounded bg-slate-800/90 px-1.5 py-0.5 font-mono text-[13px] text-blue-300"
        >
          {span.text}
        </code>
      );
    }
    return (
      <a
        key={idx}
        href={span.href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 underline decoration-blue-400/50 underline-offset-2 hover:text-blue-300"
      >
        {span.label}
      </a>
    );
  });
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API unavailable in restricted iframe
    }
  };

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-slate-800 bg-[#080C12]">
      <div className="flex items-center justify-between border-b border-slate-800/80 px-3 py-1.5 text-xs text-slate-400">
        <span className="font-mono">{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy code snippet"
          className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[13px] leading-relaxed text-slate-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function SafeMarkdown({ content }: { content: string }) {
  const blocks = parseSafeMarkdown(content);

  return (
    <div className="space-y-2 text-[15px] leading-relaxed text-slate-200">
      {blocks.map((block, index) => {
        if (block.type === 'paragraph') {
          return <p key={index}>{renderInlineSpans(block.spans)}</p>;
        }
        if (block.type === 'list') {
          return (
            <ul key={index} className="list-disc space-y-1 pl-5 text-slate-200">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx}>{renderInlineSpans(item)}</li>
              ))}
            </ul>
          );
        }
        return <CodeBlock key={index} language={block.language} code={block.code} />;
      })}
    </div>
  );
}
