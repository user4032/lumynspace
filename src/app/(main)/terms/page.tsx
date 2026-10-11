import type { Metadata } from "next"

export const metadata: Metadata = { title: "Умови використання" }

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Умови використання</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Lumyn — приватний простір. Використовуючи сервіс, ви погоджуєтесь з цими умовами.
      </p>
      <div className="prose prose-sm mt-6 dark:prose-invert">
        <h2>1. Загальні положення</h2>
        <p>Сервіс надається «як є». Ми можемо змінювати функціонал і ці умови.</p>
        <h2>2. Акаунт</h2>
        <p>Ви відповідаєте за збереження доступу до свого акаунта. Нік унікальний.</p>
        <h2>3. Контент</h2>
        <p>Ви зберігаєте права на свій контент, але даєте нам право показувати його в межах сервісу.</p>
        <h2>4. Заборонено</h2>
        <p>Спам, шахрайство, контент, що порушує закон України.</p>
      </div>
    </div>
  )
}
