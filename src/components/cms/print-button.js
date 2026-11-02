"use client";

/**
 * Save as PDF.
 *
 * `window.print()` and a print stylesheet, rather than a PDF library. The
 * browser produces a real selectable, searchable document with correct Indian
 * typography — and on a phone, "Print → Save as PDF" is where people already
 * expect to find this.
 */
export default function PrintButton({ className = "" }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={className}
    >
      Save as PDF
    </button>
  );
}
