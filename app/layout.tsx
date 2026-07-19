import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Instrument_Serif } from "next/font/google";
import { redirect } from "next/navigation";
import { betaSignInPath, getBetaUser } from "../lib/beta-auth";
import "./globals.css";

export const dynamic = "force-dynamic";

const interfaceFont = IBM_Plex_Sans({ variable: "--font-interface", subsets: ["latin"] });
const displayFont = Instrument_Serif({ variable: "--font-display", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });
const dataFont = IBM_Plex_Mono({ variable: "--font-data", subsets: ["latin"], weight: ["500", "600"] });

export const metadata: Metadata = {
  title: "JobFit Prep — Tailor your resume. Prepare with purpose.",
  description: "Turn one master resume and one job description into a targeted resume, transparent fit analysis, and interview prep pack.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getBetaUser();
  if (!user) redirect(betaSignInPath("/"));
  return <html lang="en"><body className={`${interfaceFont.variable} ${displayFont.variable} ${dataFont.variable}`}>{children}</body></html>;
}
