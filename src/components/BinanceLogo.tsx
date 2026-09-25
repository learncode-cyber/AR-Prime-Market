// Official Binance "diamond" mark (BNB / Binance Pay brand).
// Inline SVG so it renders crisp at any size without an extra network request.
export function BinanceLogo({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 126.61 126.61"
      className={className}
      aria-label="Binance"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#F3BA2F"
        d="M38.73,53.2l24.59-24.58l24.6,24.6l14.3-14.31L63.32,0L24.43,38.9L38.73,53.2z M0,63.31l14.3-14.3l14.3,14.3l-14.3,14.3L0,63.31z M38.73,73.41l24.59,24.59l24.6-24.6l14.31,14.29l-0.01,0.02L63.32,126.61L24.43,87.72l-0.02-0.02L38.73,73.41z M98,63.31l14.3-14.31l14.31,14.3l-14.31,14.32L98,63.31z M77.83,63.3h0.01l-14.51-14.52L52.62,59.49l0,0l-1.23,1.24l-2.54,2.54l-0.02,0.02l0.02,0.02l14.5,14.51l14.51-14.51l0.01-0.01L77.83,63.3"
      />
    </svg>
  );
}
