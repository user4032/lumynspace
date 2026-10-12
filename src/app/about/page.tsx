import { pageMeta } from "@/lib/seo"
import { LegalPage } from "@/components/legal-page"

export const metadata = pageMeta("Про нас", "Lumyn — спокійна соцмережа з контролем над стрічкою.", "/about")

export default function AboutPage() {
  return (
    <LegalPage title="Про Lumyn" updated="12 жовтня 2026 р.">
      <p>Lumyn — соціальна мережа, яка не кричить. Замість лайків — світло: допис живе, доки ним діляться. Стрічку налаштовуєте ви, а не алгоритм.</p>

      <h2>Що ми робимо</h2>
      <ul>
        <li><strong>Світло замість лайків.</strong> Допис живе 24 години. Кожне світло додає годину, максимум 72. 25 світлів — і допис лишається назавжди.</li>
        <li><strong>Стрічка з кермом.</strong> Два повзунки: друзі чи нове, текст чи медіа. Вкладка «Підписки» — чиста хронологія.</li>
        <li><strong>Без темних патернів.</strong> Жодних стріків і фейкових сповіщень.</li>
      </ul>

      <h2>Наші принципи</h2>
      <ul>
        <li>Ми не продаємо персональні дані.</li>
        <li>Ми збираємо лише те, що потрібно для роботи сервісу.</li>
        <li>Ви можете видалити акаунт і дані самостійно в налаштуваннях.</li>
      </ul>

      <h2>Хто стоїть за проєктом</h2>
      <p>Lumyn розробляється як незалежний проєкт в Україні. Юридична особа ще не зареєстрована.</p>

      <h2>Зв&apos;язок</h2>
      <p>Загальні питання: <a href="mailto:hello@lumyn.space">hello@lumyn.space</a><br />
      Підтримка: <a href="mailto:support@lumyn.space">support@lumyn.space</a><br />
      Приватність: <a href="mailto:privacy@lumyn.space">privacy@lumyn.space</a></p>
    </LegalPage>
  )
}