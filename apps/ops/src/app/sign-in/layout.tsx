export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-screen flex items-center justify-center bg-black">
        {children}
      </body>
    </html>
  );
}
