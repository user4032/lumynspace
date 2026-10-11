import { cn } from "@/lib/utils"

/** Знак Lumyn — чотирипроменева «іскра світла». */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-5", className)} fill="currentColor">
      <path d="M12 1.5c.4 5.6 4.9 10.1 10.5 10.5-5.6.4-10.1 4.9-10.5 10.5-.4-5.6-4.9-10.1-10.5-10.5C7.1 11.6 11.6 7.1 12 1.5Z" />
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
