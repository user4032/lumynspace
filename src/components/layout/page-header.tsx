import { cn } from "@/lib/utils"

/** Липкий заголовок колонки (як у X / Vercel dashboard) */
export function PageHeader({
  title,
  subtitle,
  children,
  className,
  back,
}: {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  children?: React.ReactNode
  className?: string
  back?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "sticky top-14 z-30 border-b bg-background/75 backdrop-blur-xl supports-backdrop-filter:bg-background/60",
        className
      )}
    >
      {(title || back) && (
        <div className="flex min-h-14 items-center gap-3 px-4">
          {back}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[17px] font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      )}
      {children}
    </div>
  )
}
