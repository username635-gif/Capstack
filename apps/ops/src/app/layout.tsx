import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from './_components/ThemeProvider';
import QueryProvider from './_components/QueryProvider';

export const metadata: Metadata = {
  title: "Capstack Ops Console",
  description: "Internal credit operations workspace for loan review, servicing, collections, and portfolio oversight.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <QueryProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
