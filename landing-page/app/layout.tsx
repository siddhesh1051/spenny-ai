import type { Metadata } from "next";
import "./globals.css";

// NEXT_PUBLIC_SITE_URL should be set to https://spennyai.vercel.app in Vercel env vars.
// VERCEL_URL is the per-deployment URL (random hash) — NOT suitable for og:image.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://spennyai.vercel.app";
const siteName = "Spenny AI";
const siteTitle = "Spenny AI — Agentic Expense Tracker powered by Sage";
const siteDescription =
  "Track expenses the way you speak. Spenny AI's Sage assistant logs expenses from chat, voice, receipts & bank emails — then answers 'where did my money go?' instantly. No forms. Ever.";

const ogImageUrl = `${siteUrl}/og-thumbnail.png`;
const logoUrl = `${siteUrl}/logo-icon.png`;

const ogImage = {
  url: ogImageUrl,
  width: 1200,
  height: 630,
  alt: "Spenny AI — Agentic Expense Tracker powered by Sage",
  type: "image/png",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: "%s | Spenny AI",
  },
  description: siteDescription,
  keywords: [
    "expense tracker",
    "AI expense tracker",
    "agentic expense tracker",
    "Sage AI assistant",
    "WhatsApp expense tracker",
    "Gmail expense sync",
    "voice expense logging",
    "receipt scanner",
    "bank statement parser",
    "personal finance AI",
    "conversational expense tracker",
    "AI personal finance",
    "automatic expense tracking",
    "spending insights",
    "expense analytics",
    "UPI expense tracker",
    "India expense tracker",
    "money management AI",
  ],
  authors: [{ name: "Spenny AI", url: siteUrl }],
  creator: "Spenny AI",
  publisher: "Spenny AI",
  category: "Finance",
  applicationName: "Spenny AI",
  generator: "Next.js",
  referrer: "origin-when-cross-origin",
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // ── Open Graph ───────────────────────────────────────────────────────────
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName,
    title: siteTitle,
    description: siteDescription,
    images: [ogImage],
  },

  // ── Twitter / X ───────────────────────────────────────────────────────────
  twitter: {
    card: "summary_large_image",
    site: "@spennyai",
    creator: "@spennyai",
    title: siteTitle,
    description: siteDescription,
    images: [{ url: ogImageUrl, alt: ogImage.alt }],
  },

  alternates: {
    canonical: siteUrl,
  },

  icons: {
    icon: [{ url: "/logo-icon.png", sizes: "512x512", type: "image/png" }],
    apple: { url: "/logo-icon.png", sizes: "512x512", type: "image/png" },
    shortcut: "/logo-icon.png",
  },

  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Spenny AI",
    statusBarStyle: "black-translucent",
  },
};

// ── JSON-LD structured data ───────────────────────────────────────────────────
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Spenny AI",
  alternateName: "Spenny",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web, iOS, Android",
  description: siteDescription,
  url: siteUrl,
  image: `${siteUrl}/og-thumbnail.png`,
  screenshot: `${siteUrl}/screenshot-sage.png`,
  offers: [
    {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      name: "Free Plan",
      description: "Full Sage AI chat, voice, receipt scanning, bank statement parsing, and spending Q&A — free forever.",
    },
    {
      "@type": "Offer",
      price: "9",
      priceCurrency: "USD",
      name: "Pro Plan",
      billingIncrement: "P1M",
      description: "Everything in Free plus WhatsApp integration, Gmail auto-sync, and Telegram — hands-free automatic expense ingestion.",
    },
  ],
  featureList: [
    "Natural language expense logging",
    "Voice input",
    "Receipt and screenshot scanning",
    "Bank statement PDF parsing",
    "WhatsApp integration",
    "Gmail auto-sync",
    "Telegram integration",
    "Spending analytics and insights",
    "Generative UI responses",
    "CSV and PDF export",
  ],
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "5",
    reviewCount: "10",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* JSON-LD structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        {/* ── og:logo — used by Google Search, LinkedIn, WhatsApp business previews */}
        <meta property="og:logo" content={logoUrl} />

        {/* ── Absolute og:image fallback for parsers that ignore metadataBase ── */}
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:image:secure_url" content={ogImageUrl} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:alt" content={ogImage.alt} />

        {/* ── Twitter / X explicit absolute URLs ────────────────────────────── */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@spennyai" />
        <meta name="twitter:creator" content="@spennyai" />
        <meta name="twitter:title" content={siteTitle} />
        <meta name="twitter:description" content={siteDescription} />
        <meta name="twitter:image" content={ogImageUrl} />
        <meta name="twitter:image:alt" content={ogImage.alt} />

        {/* ── LinkedIn explicit tags (reads og: but double-specify for safety) ─ */}
        <meta property="og:site_name" content={siteName} />

        {/* ── WhatsApp / iMessage / Telegram fallbacks ─────────────────────── */}
        <meta name="image" content={ogImageUrl} />
        <meta name="thumbnail" content={ogImageUrl} />
        <meta name="description" content={siteDescription} />

        {/* ── PWA / mobile chrome ───────────────────────────────────────────── */}
        <meta name="theme-color" content="#030c07" />
        <meta name="msapplication-TileColor" content="#030c07" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Spenny AI" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
