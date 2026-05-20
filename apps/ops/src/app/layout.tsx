import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from './_components/ThemeProvider';
import QueryProvider from './_components/QueryProvider';
import Sidebar from './_components/Sidebar';
import Topbar from './_components/Topbar';

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
          <ThemeProvider>
            <div className="flex">
              <Sidebar />
              <div className="flex-1 ml-52 min-h-screen">
                <Topbar />
                <main className="p-6" style={{ marginLeft: 0 }}>
                  {children}
                </main>
              </div>
            </div>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
