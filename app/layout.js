export const metadata = {
  title: 'TranslatePipe — Pure Voice Translation',
  description: 'Real-time bidirectional voice translation. No AI conversation. Just translation.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
