export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className={className}>
      <rect width="64" height="64" rx="21" fill="#B76550" />
      <path d="M32 23C23 13 12 24 21 33L32 44L43 33C52 24 41 13 32 23Z" fill="#FFF8ED" />
      <path d="M15 39C22 38 28 41 32 47C36 41 42 38 49 39M32 36V47" stroke="#FFF8ED" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
