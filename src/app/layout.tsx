import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Brief AI — AI-ассистент для технических заданий',
  description: 'Создайте качественное ТЗ за 15 минут с помощью AI. Без шаблонов, с уточняющими вопросами.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="font-sans">{children}</body>
    </html>
  );
}
