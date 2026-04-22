import './globals.css';

export const metadata = {
  title: 'ARCHON — AI-Powered Digital Agency',
  description: 'Autonomous multi-agent AI system that researches, creates, reviews, schedules, and publishes content across platforms.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
