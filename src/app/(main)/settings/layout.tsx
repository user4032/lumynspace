import { SettingsNav } from "@/components/settings/settings-nav"

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-layout="wide" className="mx-auto grid w-full max-w-[1000px] gap-6 px-4 py-6 sm:px-6 md:grid-cols-[200px_1fr] md:gap-8">
      <div className="md:col-span-2">
        <h1 className="text-2xl font-semibold tracking-[-0.03em]">Налаштування</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ваш профіль, ваш стиль, ваші правила.</p>
      </div>
      <SettingsNav />
      <div className="min-w-0 space-y-6">{children}</div>
    </div>
  )
}
