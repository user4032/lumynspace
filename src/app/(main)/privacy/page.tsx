import type { Metadata } from "next"

export const metadata: Metadata = { title: "Політика конфіденційності" }

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Політика конфіденційності</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Ми збираємо мінімум даних. Zero-Knowledge підхід — приватні ключі не залишають ваш пристрій.
      </p>
      <div className="prose prose-sm mt-6 dark:prose-invert">
        <h2>Що ми зберігаємо</h2>
        <ul>
          <li>Email і нік (для акаунта)</li>
          <li>Публічний контент, який ви публікуєте</li>
          <li>Технічні логи для роботи сервісу</li>
        </ul>
        <h2>Чого ми не зберігаємо</h2>
        <p>Приватні ключі шифрування, вміст зашифрованих повідомлень на сервері в відкритому вигляді.</p>
        <h2>Ваші права</h2>
        <p>Ви можете видалити акаунт у налаштуваннях — усі дані видаляються каскадом.</p>
      </div>
    </div>
  )
}
