import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from './_components/ThemeProvider';

export const metadata: Metadata = {
  title: "Capstack Borrower Portal",
  description: "Apply for personal and business loans online with fast decisions, transparent pricing, and secure borrower self-service.",
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
