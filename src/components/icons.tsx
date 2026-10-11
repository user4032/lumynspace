import { cn } from "@/lib/utils"

/** Іскра Lumyn — знак «світла». outline для неактивного стану, filled — для «дав світло». */
export function SparkIcon({ filled = false, className, strokeWidth = 1.8 }: { filled?: boolean; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-[18px]", className)}>
      <path
        d="M12 2.5c.45 5 4.5 9.05 9.5 9.5-5 .45-9.05 4.5-9.5 9.5-.45-5-4.5-9.05-9.5-9.5 5-.45 9.05-4.5 9.5-9.5Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Зірка «Близькі друзі» */
export function CloseFriendsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-3.5", className)} fill="currentColor">
      <path d="M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1L3.2 9.3l6.1-.9L12 2.8Z" />
    </svg>
  )
}
