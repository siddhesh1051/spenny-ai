import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://spenny.ai";
const siteName = "Spenny AI";
const siteTitle = "Spenny AI — Agentic Expense Tracker powered by Sage";
const siteDescription =
  "Track expenses the way you speak. Spenny AI's Sage assistant logs expenses from chat, voice, receipts & bank emails — then answers 'where did my money go?' instantly. No forms. Ever.";

const ogImage = {
  url: "/og-thumbnail.png",
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

  // ── Open Graph (Facebook, WhatsApp, LinkedIn, iMessage link previews) ──────
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName,
    title: siteTitle,
    description: siteDescription,
    images: [ogImage],
  },

  // ── Twitter / X card ──────────────────────────────────────────────────────
  // summary_large_image renders the full 1200×630 card on X, giving the same
  // rich preview on WhatsApp (falls back to og:image) and Telegram.
  twitter: {
    card: "summary_large_image",
    site: "@spennyai",
    creator: "@spennyai",
    title: siteTitle,
    description: siteDescription,
    images: [{ url: "/og-thumbnail.png", alt: ogImage.alt }],
  },

  // ── Canonical & alternates ────────────────────────────────────────────────
  alternates: {
    canonical: siteUrl,
  },

  // ── App icons ─────────────────────────────────────────────────────────────
  // app/icon.png is auto-picked by Next.js as the favicon.
  // These entries cover <link rel="icon"> fallbacks and Apple touch icon.
  icons: {
    icon: [
      { url: "/logo-icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: { url: "/logo-icon.png", sizes: "512x512", type: "image/png" },
    shortcut: "/logo-icon.png",
  },

  // ── PWA / mobile ──────────────────────────────────────────────────────────
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Spenny AI",
    statusBarStyle: "black-translucent",
  },

  // ── Verification placeholders (fill in when you connect to Search Console) ─
  // verification: {
  //   google: "YOUR_GOOGLE_SITE_VERIFICATION_TOKEN",
  // },
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
        {/* JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        {/* WhatsApp / iMessage / Slack use og: tags above, but these extras
            help some parsers that read <meta name="…"> instead of og: */}
        <meta name="description" content={siteDescription} />
        <meta name="image" content={`${siteUrl}/og-thumbnail.png`} />

        {/* LinkedIn — reads og: but also these: */}
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:type" content="image/png" />

        {/* Pinterest / Slack unfurl */}
        <meta name="thumbnail" content={`${siteUrl}/og-thumbnail.png`} />

        {/* iOS Safari smart-app banner */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Spenny AI" />

        {/* Theme colour — browser chrome (WhatsApp in-app browser, Android) */}
        <meta name="theme-color" content="#030c07" />
        <meta name="msapplication-TileColor" content="#030c07" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
