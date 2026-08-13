import { useState } from 'react';

export default function CopyChip({ value }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch (e) {
      /* ignore */
    }
  }

  return (
    <span className={`copy-chip${copied ? ' copied' : ''}`} onClick={handleCopy}>
      {value}
      <span className="copy-icon">⧉</span>
      <span className="copy-tip">{copied ? 'Copied!' : 'Tap to copy'}</span>
    </span>
  );
}
