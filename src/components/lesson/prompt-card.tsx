"use client";

import { useState } from "react";
import { Check, Copy, Sparkles } from "lucide-react";
import { getSpecialtyInfo, type Specialty } from "@/lib/specialties";

export interface PromptData {
  id: string;
  title: string;
  description: string;
  prompt: string;
  specialty: Specialty;
  category: string;
  tags: string[];
}

interface PromptCardProps {
  data: PromptData;
  onCopy?: () => void;
}

/**
 * Beautiful prompt card with title, description, prompt text,
 * variable highlighting, specialty tag, and copy button.
 */
export function PromptCard({ data, onCopy }: PromptCardProps) {
  const [copied, setCopied] = useState(false);
  const specialtyInfo = getSpecialtyInfo(data.specialty);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(data.prompt);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = data.prompt;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    onCopy?.();
    setTimeout(() => setCopied(false), 2000);
  };

  // Highlight {variables} in prompt text
  const highlightVariables = (text: string) => {
    const parts = text.split(/(\{[^}]+\})/g);
    return parts.map((part, i) => {
      if (part.startsWith("{") && part.endsWith("}")) {
        return (
          <span key={i} className="prompt-variable">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="prompt-card group">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles className="w-4 h-4 text-accent shrink-0" />
            <h4 className="text-sm font-semibold text-foreground whitespace-normal">
              {data.title}
            </h4>
          </div>
          <p className="text-xs text-muted whitespace-normal">{data.description}</p>
        </div>
        <span
          className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full border ${specialtyInfo.colorClass}`}
        >
          {specialtyInfo.emoji} {specialtyInfo.label}
        </span>
      </div>

      {/* Prompt text */}
      <div className="prompt-text-container mb-3">
        <pre className="prompt-text">{highlightVariables(data.prompt)}</pre>
      </div>

      {/* Tags + Copy */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
          {data.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="prompt-tag">
              {tag}
            </span>
          ))}
        </div>
        <button
          onClick={handleCopy}
          className={`prompt-copy-btn ${
            copied ? "bg-success/15 text-success border-success/30" : ""
          }`}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Скопировано</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Копировать</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
