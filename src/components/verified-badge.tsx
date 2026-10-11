import { cn } from "@/lib/utils"

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-label="Підтверджений акаунт" className={cn("size-[15px] shrink-0 text-brand", className)}>
      <circle cx="8" cy="8" r="8" fill="currentColor" />
      <path d="M5.2 8.2l1.9 1.9 3.7-3.9" fill="none" stroke="var(--background)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
