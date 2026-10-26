import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { RightRail } from "@/components/layout/right-rail"
import { MobileNav } from "@/components/layout/mobile-nav"
import { CommandMenuProvider } from "@/components/layout/command-menu"
import { ViewerSync } from "@/components/viewer-sync"
import { PushSetup } from "@/components/push-setup"

export default function MainLayout({ children }: LayoutProps<"/">) {
  return (
    <CommandMenuProvider>
      <ViewerSync />
      <PushSetup />
      <Header />
      <div className="group/shell mx-auto flex max-w-[1220px] justify-center px-0 md:px-4">
        <Sidebar />
        <main
          id="content"
          className="min-h-[calc(100dvh-3.5rem)] min-w-0 flex-1 pb-16 md:border-x md:pb-0 lg:max-w-[640px] group-has-[[data-layout=wide]]/shell:lg:max-w-none"
        >
          {children}
        </main>
        <RightRail />
      </div>
      <MobileNav />
    </CommandMenuProvider>
  )
}
