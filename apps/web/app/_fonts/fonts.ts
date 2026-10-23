import { Geist_Mono, Inter, Instrument_Serif } from "next/font/google";

/** Design system type: Inter for everything, Instrument Serif for the Signature wing, Geist Mono for codes. */
export const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
export const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});
export const geistMono = Geist_Mono({ subsets: ["latin"], weight: ["500"], variable: "--font-geist-mono", display: "swap" });

export const fontVariables = `${inter.variable} ${instrumentSerif.variable} ${geistMono.variable}`;
