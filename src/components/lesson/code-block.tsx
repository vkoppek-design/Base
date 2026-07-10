"use client";

import React, { useState, useRef, type ReactNode } from "react";
import { Check, Copy, Sparkles } from "lucide-react";
import pako from "pako";

interface CodeBlockProps {
  children?: ReactNode;
  className?: string;
  node?: any;
  [key: string]: any;
}

export function CodeBlockWrapper({ children, ...props }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const preRef = useRef<any>(null);

  // Helper to extract plain text from React nodes
  const getCodeText = (node: any): string => {
    if (typeof node === "string") return node;
    if (typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(getCodeText).join("");
    if (node?.props?.children) return getCodeText(node.props.children);
    return "";
  };

  // Extract className from the <code> child
  const childrenArray = React.Children.toArray(children);
  const codeElement = childrenArray[0] as React.ReactElement<{ className?: string }>;
  const codeClassName = codeElement?.props?.className || "";
  
  // Check if it's a prompt, mermaid, or code block
  const isMermaid = codeClassName.includes("language-mermaid");
  const isPrompt = codeClassName.includes("language-prompt") || 
                   codeClassName.includes("language-text") || 
                   !codeClassName;

  const handleCopy = async () => {
    const text = preRef.current?.textContent || getCodeText(children);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isMermaid) {
    const codeText = getCodeText(children).trim();
    let mermaidUrl = "";
    try {
      const state = {
        code: codeText,
        mermaid: {
          theme: "dark",
        },
      };
      const json = JSON.stringify(state);
      const data = new TextEncoder().encode(json);
      const compressed = pako.deflate(data, { level: 9 });
      let binary = "";
      const len = compressed.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(compressed[i]);
      }
      const base64UrlSafe = btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
        
      mermaidUrl = `https://mermaid.ink/svg/pako:${base64UrlSafe}`;
    } catch (e) {
      console.error("Failed to generate Mermaid SVG:", e);
    }

    return (
      <div className="my-6 flex flex-col items-center justify-center p-6 bg-card border border-border rounded-2xl shadow-sm overflow-x-auto">
        <div className="w-full text-xs font-semibold text-muted uppercase tracking-wider mb-4 border-b border-border pb-2 select-none">
          📊 Схема процесса
        </div>
        {mermaidUrl ? (
          <img 
            src={mermaidUrl} 
            alt="Схема процесса" 
            className="max-w-full h-auto max-h-[500px] select-none pointer-events-none opacity-90 hover:opacity-100 transition-opacity filter invert dark:invert-0" 
          />
        ) : (
          <pre ref={preRef} className="text-xs text-error font-mono whitespace-pre-wrap w-full bg-error/5 p-3 rounded-xl">
            {children}
          </pre>
        )}
      </div>
    );
  }

  if (isPrompt) {
    const codeText = getCodeText(children).trim();
    return (
      <div className="relative my-6 group rounded-2xl border-l-4 border-accent border-y border-r border-border bg-card/40 hover:bg-card/60 transition-all duration-300 shadow-md overflow-hidden">
        {/* Top bar for Prompt */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-accent/[0.03] border-b border-border select-none">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-accent uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            Готовый промпт
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground font-medium transition-colors cursor-pointer"
            aria-label="Копировать промпт"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-success" />
                <span className="text-success font-medium">Скопировано!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Копировать</span>
              </>
            )}
          </button>
        </div>
        {/* Prompt Content: Styled with Clean Sans-Serif and larger padding */}
        <div
          ref={preRef}
          className="p-5 font-sans text-base leading-relaxed text-foreground select-text whitespace-pre-wrap"
        >
          {codeText}
        </div>
      </div>
    );
  }

  // Fallback for real code blocks (e.g. javascript, SQL)
  return (
    <div className="code-block-wrapper relative">
      <button
        onClick={handleCopy}
        className="code-copy-btn absolute top-3 right-3 z-10 p-2 rounded-lg bg-card-hover border border-border text-muted hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        title={copied ? "Скопировано!" : "Копировать"}
        aria-label="Копировать код"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-success" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>
      <pre ref={preRef} {...props}>
        {children}
      </pre>
    </div>
  );
}
