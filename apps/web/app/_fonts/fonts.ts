import localFont from "next/font/local";

/**
 * Design system type: Inter for everything, Instrument Serif for the Signature wing, Geist Mono for codes.
 * The files (Google Fonts, latin, OFL) live in ./files so builds never wait on fonts.googleapis.com — in the Docker dev
 * container those downloads timed out and were retried on every compile.
 */
export const inter = localFont({
  src: [{ path: "./files/inter-latin-var.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-inter",
  display: "swap",
});
export const instrumentSerif = localFont({
  src: [
    { path: "./files/instrument-serif-latin.woff2", weight: "400", style: "normal" },
    { path: "./files/instrument-serif-latin-italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-instrument",
  display: "swap",
});
export const geistMono = localFont({
  src: [{ path: "./files/geist-mono-latin-500.woff2", weight: "500", style: "normal" }],
  variable: "--font-geist-mono",
  display: "swap",
});

export const fontVariables = `${inter.variable} ${instrumentSerif.variable} ${geistMono.variable}`;
