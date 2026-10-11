import { ViewerSync } from "@/components/viewer-sync"

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ViewerSync />
      {children}
    </>
  )
}
