import { cn } from "@/lib/utils"

/** Знак Lumyn — чотирипроменева «іскра світла» (вертикаль трохи довша — оптичний баланс). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-5", className)} fill="currentColor">
      <path d="M12 1.25C13.03 7.7 16.1 10.93 22.25 12C16.1 13.07 13.03 16.3 12 22.75C10.97 16.3 7.9 13.07 1.75 12C7.9 10.93 10.97 7.7 12 1.25Z" />
    </svg>
  )
}

export function Logo({ className, withWordmark = true }: { className?: string; withWordmark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-foreground", className)}>
      <LogoMark />
      {withWordmark && <span className="text-[17px] font-semibold tracking-[-0.03em]">Lumyn</span>}
    </span>
  )
}
