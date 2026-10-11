import { cn } from "@/lib/utils"
import type { Community } from "@/types"

export function CommunityIcon({ community, className }: { community: Pick<Community, "name" | "hue" | "avatarUrl">; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg text-sm font-semibold text-white ring-1 ring-inset ring-white/15",
        className
      )}
      style={{
        background: `linear-gradient(135deg, oklch(0.72 0.14 ${community.hue}), oklch(0.45 0.18 ${community.hue + 40}))`,
      }}
    >
      {community.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- фото спільноти зі Storage
        <img src={community.avatarUrl} alt="" className="absolute inset-0 size-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        community.name.replace(/[^\p{L}]/gu, "").slice(0, 1)
      )}
    </span>
  )
}
