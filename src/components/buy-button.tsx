"use client"

import { useId, useState } from "react"
import { cn } from "@/lib/utils"

const PLANE =
  "M16.906 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z";

type BuyButtonProps = {
  href: string;
  disabled?: boolean;
  className?: string;
};

export function BuyButton({ href, disabled, className }: BuyButtonProps) {
  // унікальні id, бо на сторінці кілька кнопок
  const uid = useId().replace(/:/g, "");
  const grad = `tg-grad-${uid}`;
  const clip = `tg-clip-${uid}`;
  const [launch, setLaunch] = useState(false);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      onClick={() => !disabled && setLaunch(true)}
      className={cn(
        "buy-btn shrink-0",
        disabled && "pointer-events-none opacity-60",
        className,
      )}
    >
      {/* літачок, що вилітає з-за кнопки на клік */}
      <span
        className={cn("buy-btn__fly", launch && "go")}
        onAnimationEnd={() => setLaunch(false)}
        aria-hidden="true"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" focusable="false">
          <circle cx="12" cy="12" r="12" fill={`url(#${grad})`} />
          <path fill="#fff" d={PLANE} />
        </svg>
      </span>

      {/* біла поверхня */}
      <span className="buy-btn__bg" aria-hidden="true" />

      {/* логотип Telegram, з'являється на hover */}
      <svg
        className="buy-btn__icon"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id={grad} x1="12" y1="0" x2="12" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#2AABEE" />
            <stop offset="1" stopColor="#229ED9" />
          </linearGradient>
          <clipPath id={clip}>
            <circle cx="12" cy="12" r="12" />
          </clipPath>
        </defs>
        <circle cx="12" cy="12" r="12" fill={`url(#${grad})`} />
        <g clipPath={`url(#${clip})`}>
          <path className="plane" fill="#fff" d={PLANE} />
        </g>
      </svg>

      <span className="buy-btn__label">Купити</span>
    </a>
  );
}
