import { VerifiedBadgeHint } from "@/components/verified-badge-hint"
import { VERIFIED_PATH } from "@/components/verified-path"

export { VERIFIED_PATH }

/**
 * Знак верифікації з підказкою «Підтверджений акаунт»:
 * ховер на десктопі, тап — на телефоні (verified-badge-hint.tsx).
 */
export function VerifiedBadge(props: { className?: string; shimmer?: boolean }) {
  return <VerifiedBadgeHint {...props} />
}

/** Та сама печатка для ImageResponse (satori): без CSS. */
export function VerifiedMarkStatic({ size = 28, color = "#ededed" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <path d={VERIFIED_PATH} fill={color} fillRule="evenodd" />
    </svg>
  )
}
