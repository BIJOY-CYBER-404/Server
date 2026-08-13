import { useEffect, useState } from 'react';

export default function ThemeToggle({ floating }) {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    setTheme(current);
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('theme', next);
    } catch (e) {
      /* ignore */
    }
    setTheme(next);
  }

  return (
    <button
      type="button"
      className={`theme-toggle${floating ? ' theme-toggle-floating' : ''}`}
      onClick={toggle}
      aria-label="Toggle theme"
      title="Toggle dark / light theme"
    >
      <span className="icon-sun">☀️</span>
      <span className="icon-moon">🌙</span>
    </button>
  );
}
