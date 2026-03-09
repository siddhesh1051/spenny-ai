import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms and conditions for using Spenny AI — the agentic expense tracker powered by Sage.",
};

const LAST_UPDATED = "March 9, 2026";

export default function TermsPage() {
  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(180deg, #030c07 0%, #050f08 100%)" }}
    >
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b" style={{ borderColor: "rgba(26,138,90,0.1)", background: "rgba(3,12,7,0.85)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 cursor-pointer">
            <Image src="/logo.png" alt="Spenny AI" width={28} height={28} className="rounded-lg" />
            <span className="font-semibold text-lg tracking-tight text-white">
              Spenny <span style={{ background: "linear-gradient(135deg,#3dd68c,#1a8a5a)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>AI</span>
            </span>
          </Link>
          <span className="text-sm ml-2" style={{ color: "rgba(255,255,255,0.3)" }}>/ Terms of Service</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16 pb-32">
        {/* Header */}
        <div className="mb-12">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-5"
            style={{ background: "rgba(3,43,34,0.5)", border: "1px solid rgba(26,138,90,0.25)", color: "#3dd68c" }}
          >
            Last updated: {LAST_UPDATED}
          </div>
          <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">Terms of Service</h1>
          <p style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>
            Please read these Terms of Service (&ldquo;Terms&rdquo;) carefully before using Spenny AI. By accessing or using our service, you agree to be bound by these Terms.
          </p>
        </div>

        <div className="space-y-10" style={{ color: "rgba(255,255,255,0.75)", lineHeight: 1.8 }}>

          <Section title="1. Acceptance of Terms">
            <p>By creating an account, joining the waitlist, or using Spenny AI in any way, you agree to these Terms and our <Link href="/privacy" className="underline" style={{ color: "#3dd68c" }}>Privacy Policy</Link>. If you do not agree, please do not use the service.</p>
            <p>We may update these Terms from time to time. Continued use of Spenny AI after changes constitutes acceptance of the updated Terms.</p>
          </Section>

          <Section title="2. Description of Service">
            <p>Spenny AI provides an AI-powered personal expense tracking service, including:</p>
            <ul>
              <li><strong>Sage</strong> — a conversational AI assistant for logging expenses via text, voice, receipts, and bank statement PDFs.</li>
              <li><strong>Spending analytics</strong> — natural language queries that return charts, metrics, and insights about your financial data.</li>
              <li><strong>Integrations (Pro)</strong> — WhatsApp and Telegram bots for on-the-go logging; Gmail sync for automatic expense extraction from bank notification emails.</li>
              <li><strong>Export</strong> — CSV and PDF export of your expense data for any time range or category.</li>
            </ul>
            <p className="mt-3">Spenny AI is currently in <strong>early access / beta</strong>. Features may change, be temporarily unavailable, or be discontinued at our discretion.</p>
          </Section>

          <Section title="3. Eligibility">
            <ul>
              <li>You must be at least 13 years old to use Spenny AI.</li>
              <li>You must provide accurate information when creating an account.</li>
              <li>You are responsible for maintaining the security of your account credentials.</li>
              <li>One person or legal entity may not maintain more than one free account.</li>
            </ul>
          </Section>

          <Section title="4. Free & Pro Plans">
            <h3 className="font-semibold text-white mb-2">Free Plan</h3>
            <p>The Free plan includes Sage AI chat, natural language logging, voice input, receipt scanning, bank statement PDF parsing, spending Q&A, and CSV/PDF export — free forever with no credit card required.</p>

            <h3 className="font-semibold text-white mt-4 mb-2">Pro Plan</h3>
            <p>The Pro plan is billed at <strong>$9/month</strong> and includes everything in Free plus WhatsApp integration, Gmail auto-sync, Telegram integration, and priority AI model access.</p>
            <ul>
              <li>Subscriptions are billed monthly and renew automatically.</li>
              <li>You may cancel at any time; cancellation takes effect at the end of the current billing period.</li>
              <li>We do not offer refunds for partial billing periods except where required by law.</li>
              <li>Prices are in USD and may be subject to local taxes.</li>
            </ul>

            <h3 className="font-semibold text-white mt-4 mb-2">Beta Pricing</h3>
            <p>During early access, pricing is subject to change. We will provide at least 30 days notice before any price increases to existing subscribers.</p>
          </Section>

          <Section title="5. Acceptable Use">
            <p>You agree not to:</p>
            <ul>
              <li>Use Spenny AI for any illegal purpose or in violation of any applicable laws.</li>
              <li>Upload content that infringes intellectual property rights or contains malware.</li>
              <li>Attempt to reverse engineer, scrape, or copy Spenny AI&apos;s systems or AI models.</li>
              <li>Use automated scripts or bots to interact with Spenny AI in ways not intended by the product.</li>
              <li>Resell or sublicense access to Spenny AI without our written consent.</li>
              <li>Share your account credentials with others.</li>
              <li>Attempt to circumvent rate limits, security measures, or access controls.</li>
            </ul>
          </Section>

          <Section title="6. Your Data & Content">
            <p>You retain full ownership of all expense data, receipts, and other content you upload to Spenny AI. By using the service, you grant us a limited licence to process your data solely for the purpose of providing the service to you.</p>
            <p>You are responsible for ensuring that any data you provide — including bank statement PDFs and email access — is your own and that you have the right to share it with us.</p>
            <p>You can export or delete your data at any time. See our <Link href="/privacy" className="underline" style={{ color: "#3dd68c" }}>Privacy Policy</Link> for full details.</p>
          </Section>

          <Section title="7. Gmail Integration">
            <p>The Gmail auto-sync feature (Pro) uses Google OAuth with read-only access restricted to bank and payment alert emails. By enabling Gmail sync, you authorise us to access your Gmail account subject to these Terms and our Privacy Policy.</p>
            <p>You can revoke this access at any time from your Google Account settings or within Spenny AI. Revoking access will disable automatic Gmail sync but will not delete previously extracted transactions.</p>
          </Section>

          <Section title="8. AI-Generated Content">
            <p>Sage&apos;s responses — including expense categorisation, spending summaries, charts, and insights — are generated by AI and may not always be accurate. You should:</p>
            <ul>
              <li>Review AI-categorised expenses and correct any errors.</li>
              <li>Not rely solely on Sage for financial decisions.</li>
              <li>Consult a qualified financial advisor for material financial decisions.</li>
            </ul>
            <p>Spenny AI is a personal tracking tool, not a licensed financial advisor.</p>
          </Section>

          <Section title="9. Intellectual Property">
            <p>Spenny AI, Sage, and all associated software, designs, and trademarks are owned by Spenny AI and protected by applicable intellectual property laws. These Terms do not grant you any rights in our intellectual property.</p>
            <p>Feedback, suggestions, or bug reports you submit may be used by us to improve the product without any obligation to compensate you.</p>
          </Section>

          <Section title="10. Availability & Uptime">
            <p>We aim to keep Spenny AI available and performant, but we do not guarantee uninterrupted access. We may perform maintenance, push updates, or experience downtime without prior notice. We are not liable for any losses caused by service unavailability.</p>
            <p>During the early access / beta period, disruptions are more likely as we rapidly iterate on the product.</p>
          </Section>

          <Section title="11. Disclaimer of Warranties">
            <p>Spenny AI is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, express or implied, including but not limited to merchantability, fitness for a particular purpose, or non-infringement.</p>
            <p>We do not warrant that Sage&apos;s expense categorisation, insights, or financial calculations are accurate or complete.</p>
          </Section>

          <Section title="12. Limitation of Liability">
            <p>To the maximum extent permitted by law, Spenny AI and its founders, employees, and partners shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the service — including but not limited to financial loss, data loss, or loss of business.</p>
            <p>Our total liability to you for any claim arising from these Terms or your use of the service shall not exceed the amount you paid us in the 12 months preceding the claim, or $50, whichever is greater.</p>
          </Section>

          <Section title="13. Termination">
            <p>You may stop using Spenny AI and delete your account at any time.</p>
            <p>We may suspend or terminate your access if you violate these Terms, engage in abusive behaviour, or if we discontinue the service. We will provide reasonable notice where possible.</p>
            <p>Upon termination, your right to use Spenny AI ceases immediately. Your data will be deleted within 30 days per our Privacy Policy.</p>
          </Section>

          <Section title="14. Governing Law">
            <p>These Terms are governed by and construed in accordance with the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts of Mumbai, India.</p>
          </Section>

          <Section title="15. Contact">
            <p>Questions about these Terms? Contact us at:</p>
            <p><a href="mailto:hello@spenny.ai" className="underline font-medium" style={{ color: "#3dd68c" }}>hello@spenny.ai</a></p>
          </Section>

        </div>

        <div className="mt-16 pt-8 border-t flex items-center justify-between text-sm" style={{ borderColor: "rgba(26,138,90,0.12)", color: "rgba(255,255,255,0.3)" }}>
          <span>© 2026 Spenny AI</span>
          <Link href="/privacy" className="hover:text-white transition-colors" style={{ color: "rgba(255,255,255,0.4)" }}>Privacy Policy →</Link>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b" style={{ borderColor: "rgba(26,138,90,0.15)" }}>
        {title}
      </h2>
      <div className="space-y-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_strong]:text-white">
        {children}
      </div>
    </section>
  );
}
