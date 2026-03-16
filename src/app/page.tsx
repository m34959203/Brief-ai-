import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white">
      <header className="container mx-auto px-6 py-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">Brief AI</h1>
        <nav className="flex gap-4">
          <Link href="/login" className="text-sm text-gray-600 hover:text-primary transition">
            Войти
          </Link>
          <Link
            href="/wizard/demo"
            className="text-sm bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition"
          >
            Попробовать бесплатно
          </Link>
        </nav>
      </header>

      <main className="container mx-auto px-6 py-20 text-center">
        <h2 className="text-5xl font-bold text-primary mb-6 leading-tight">
          Создайте ТЗ за 15 минут
          <br />
          <span className="text-accent">с помощью AI</span>
        </h2>
        <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
          AI задаёт уточняющие вопросы как опытный Product Owner, ловит противоречия
          и генерирует структурированное техническое задание.
        </p>

        <div className="flex gap-4 justify-center mb-20">
          <Link
            href="/wizard/demo"
            className="bg-primary text-white px-8 py-4 rounded-xl text-lg font-medium hover:bg-primary-600 transition shadow-lg"
          >
            Попробовать без регистрации
          </Link>
          <Link
            href="/register"
            className="border-2 border-primary text-primary px-8 py-4 rounded-xl text-lg font-medium hover:bg-primary-50 transition"
          >
            Создать аккаунт
          </Link>
        </div>

        {/* Как это работает */}
        <section className="max-w-4xl mx-auto mb-20">
          <h3 className="text-3xl font-bold text-gray-900 mb-10">Как это работает</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'Опишите идею', desc: 'Расскажите в свободной форме — что хотите создать и какую проблему решить.' },
              { step: '2', title: 'AI задаёт вопросы', desc: 'AI уточняет детали как Product Owner: роли, фичи, ограничения, приоритеты.' },
              { step: '3', title: 'Получите ТЗ', desc: 'Структурированный документ с User Stories, NFR и планом реализации.' },
            ].map(item => (
              <div key={item.step} className="bg-white p-6 rounded-2xl shadow-md">
                <div className="w-12 h-12 bg-accent text-white rounded-full flex items-center justify-center text-xl font-bold mb-4 mx-auto">
                  {item.step}
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h4>
                <p className="text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Сравнение */}
        <section className="max-w-4xl mx-auto">
          <h3 className="text-3xl font-bold text-gray-900 mb-10">Brief AI vs ChatGPT</h3>
          <div className="bg-white rounded-2xl shadow-md overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-primary-50">
                <tr>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">Критерий</th>
                  <th className="px-6 py-4 text-sm font-medium text-primary">Brief AI</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">ChatGPT</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[
                  ['Структура ТЗ', '6 шагов + 7 разделов', 'Свободный текст'],
                  ['Уточняющие вопросы', 'Всегда задаёт', 'Принимает первый ответ'],
                  ['Противоречия', 'Автоматическая проверка', 'Не проверяет'],
                  ['Каталог фичей', 'По типу проекта', 'Нет'],
                  ['Экспорт', 'PDF + Markdown', 'Копировать текст'],
                ].map(([criteria, brief, chatgpt]) => (
                  <tr key={criteria}>
                    <td className="px-6 py-4 text-sm text-gray-600">{criteria}</td>
                    <td className="px-6 py-4 text-sm font-medium text-success">{brief}</td>
                    <td className="px-6 py-4 text-sm text-gray-400">{chatgpt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
