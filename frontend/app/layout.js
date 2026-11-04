import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ShopProvider } from "@/components/shop/ShopProvider";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export const metadata = {
  title: { default: "BookBack", template: "%s | BookBack" },
  description: "Buy, sell and give a second life to school and college books.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <AuthProvider>
          <ShopProvider>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-brand focus:px-4 focus:py-2 focus:text-white"
            >
              Skip to content
            </a>
            <Navbar />
            <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
              {children}
            </main>
            <Footer />
          </ShopProvider>
        </AuthProvider>
      </body>
    </html>
  );
}