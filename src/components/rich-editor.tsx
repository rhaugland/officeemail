"use client";

import { useRef, useEffect, useCallback } from "react";

type RichEditorProps = {
  value: string;
  onChange: (html: string) => void;
  onFocus?: () => void;
  placeholder?: string;
  className?: string;
};

export function RichEditor({ value, onChange, onFocus, placeholder, className = "" }: RichEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isUpdating = useRef(false);

  // Sync value into the editor only when it changes externally
  useEffect(() => {
    if (ref.current && !isUpdating.current) {
      if (ref.current.innerHTML !== value) {
        ref.current.innerHTML = value || "";
      }
    }
  }, [value]);

  const handleInput = useCallback(() => {
    if (ref.current) {
      isUpdating.current = true;
      onChange(ref.current.innerHTML);
      requestAnimationFrame(() => {
        isUpdating.current = false;
      });
    }
  }, [onChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.execCommand("insertParagraph", false);
    }
  };

  return (
    <div className="relative">
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onFocus={onFocus}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        className={`w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black min-h-[200px] prose prose-sm max-w-none [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-gray-400 ${className}`}
      />
    </div>
  );
}

export function insertVariableIntoEditor(containerEl: HTMLElement | null, variable: string) {
  if (!containerEl) return;
  containerEl.focus();

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    // No selection, append to end
    containerEl.innerHTML += variable;
    return;
  }

  const range = sel.getRangeAt(0);
  // Make sure we're inside the editor
  if (!containerEl.contains(range.commonAncestorContainer)) {
    containerEl.focus();
    const newRange = document.createRange();
    newRange.selectNodeContents(containerEl);
    newRange.collapse(false);
    sel.removeAllRanges();
    sel.addRange(newRange);
  }

  document.execCommand("insertText", false, variable);
}
