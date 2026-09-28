import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { NavBar } from "@/components/nav-bar";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { getCurrentUser } from "@/lib/current-user";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Specibase",
  description: "Sample database for evolutionary biology field collections",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Best-effort — before NEXT_PUBLIC_SUPABASE_* is configured (see
  // .env.example), this throws; the nav bar just shows as signed-out in
  // that case, matching proxy.ts's own fail-open behavior. Once auth is
  // set up, a real failure here is rare enough not to need its own UI.
  const user = await getCurrentUser().catch(() => null);

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Sets data-theme before paint so switching pages or reloading
            never flashes the wrong theme while React hydrates. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <NavBar user={user} />
        {children}
      </body>
    </html>
  );
}
