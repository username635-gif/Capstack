import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from './_components/ThemeProvider';

export const metadata: Metadata = {
  title: "Capstack Partner",
  description: "Partner portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
