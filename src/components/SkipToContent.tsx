/**
 * Skip to main content link for keyboard/screen reader accessibility.
 * Visible on focus, hidden by default.
 */
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-3 focus:bg-lime-500 focus:text-black focus:font-semibold focus:rounded-xl focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-lime-400 focus:ring-offset-2 focus:ring-offset-dark-bg"
    >
      Skip to main content
    </a>
  );
}
