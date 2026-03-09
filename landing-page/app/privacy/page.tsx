import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Spenny AI collects, uses, and protects your personal and financial data.",
};

const LAST_UPDATED = "March 9, 2026";

export default function PrivacyPage() {
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
          <span className="text-sm ml-2" style={{ color: "rgba(255,255,255,0.3)" }}>/ Privacy Policy</span>
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
          <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">Privacy Policy</h1>
          <p style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>
            Spenny AI (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) is committed to protecting your privacy. This policy explains what data we collect, how we use it, and your rights — written in plain language, not legalese.
          </p>
        </div>

        <div className="space-y-10" style={{ color: "rgba(255,255,255,0.75)", lineHeight: 1.8 }}>

          <Section title="1. Who We Are">
            <p>Spenny AI is an agentic expense tracker that helps you log, understand, and manage your personal finances through natural conversation with Sage — our AI assistant. We are currently in early access / beta and operate as an independent product.</p>
            <p>Contact: <a href="mailto:hello@spenny.ai" className="underline" style={{ color: "#3dd68c" }}>hello@spenny.ai</a></p>
          </Section>

          <Section title="2. Information We Collect">
            <h3 className="font-semibold text-white mb-2">Information you provide directly</h3>
            <ul>
              <li><strong>Account information:</strong> Email address and optional mobile number when you join the waitlist or sign up.</li>
              <li><strong>Expense data:</strong> Text messages, voice recordings (transcribed and then discarded), receipt images, and bank statement PDFs you share with Sage.</li>
              <li><strong>Chat history:</strong> Your conversations with Sage, including expense logs and spending queries.</li>
            </ul>
            <h3 className="font-semibold text-white mt-4 mb-2">Information collected automatically</h3>
            <ul>
              <li><strong>Usage data:</strong> Pages visited, features used, session duration, and crash reports — collected anonymously to improve the product.</li>
              <li><strong>Device information:</strong> Browser type, operating system, and IP address for security and rate limiting.</li>
            </ul>
            <h3 className="font-semibold text-white mt-4 mb-2">Information from integrations (Pro)</h3>
            <ul>
              <li><strong>Gmail (read-only):</strong> We access only bank and payment alert emails to extract transaction data. We never read personal emails and we do not store email content — only the extracted transaction fields (amount, merchant, date).</li>
              <li><strong>WhatsApp / Telegram:</strong> Messages you send to the Spenny bot are processed to log expenses or answer queries. They are not stored beyond what is needed to respond.</li>
            </ul>
          </Section>

          <Section title="3. How We Use Your Information">
            <ul>
              <li>To provide, operate, and improve Spenny AI and Sage.</li>
              <li>To process and categorise your expense data and generate insights.</li>
              <li>To communicate product updates, early access invites, and important notices.</li>
              <li>To detect and prevent fraud, abuse, and security incidents.</li>
              <li>To comply with legal obligations.</li>
            </ul>
            <p className="mt-3">We do <strong>not</strong> sell your data to third parties. We do not use your financial data to train general-purpose AI models or for advertising.</p>
          </Section>

          <Section title="4. Data Storage & Security">
            <ul>
              <li>Expense data is stored in a secure database (Supabase / PostgreSQL) with row-level security.</li>
              <li>Data is encrypted in transit (TLS) and at rest.</li>
              <li>Receipt images and bank statement PDFs are processed immediately and not permanently stored — only the extracted transaction records are saved.</li>
              <li>Voice input is transcribed by Whisper AI and the audio is discarded immediately after transcription.</li>
              <li>We apply strict access controls — only you can access your expense data.</li>
            </ul>
          </Section>

          <Section title="5. Third-Party Services">
            <p>We use the following third-party services to operate Spenny AI:</p>
            <ul>
              <li><strong>Supabase</strong> — database and authentication</li>
              <li><strong>Groq / Llama</strong> — AI inference for Sage responses and receipt parsing</li>
              <li><strong>Vercel</strong> — hosting and edge delivery</li>
              <li><strong>Airtable</strong> — waitlist management</li>
              <li><strong>WhatsApp Business API / Telegram Bot API</strong> — messaging integrations (Pro)</li>
              <li><strong>Google OAuth</strong> — Gmail integration (Pro, read-only scope)</li>
            </ul>
            <p className="mt-3">Each of these services has their own privacy policy. We share only the minimum data necessary for them to function.</p>
          </Section>

          <Section title="6. Gmail Integration">
            <p>Our use of Gmail data via Google OAuth is limited to the following:</p>
            <ul>
              <li>We request <strong>read-only</strong> access restricted to emails matching bank and payment alert patterns.</li>
              <li>Gmail data is used solely to extract expense transactions for your personal dashboard.</li>
              <li>We do <strong>not</strong> store raw email content — only extracted fields (merchant, amount, date, category).</li>
              <li>We do <strong>not</strong> use Gmail data to serve advertising or for any purpose unrelated to expense tracking.</li>
              <li>You can revoke Gmail access at any time from your Google Account settings or from within Spenny AI.</li>
            </ul>
            <p className="mt-3">Our use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" className="underline" style={{ color: "#3dd68c" }} target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
          </Section>

          <Section title="7. Data Retention">
            <ul>
              <li>Your expense records are retained as long as your account is active.</li>
              <li>If you delete your account, all personal data is deleted within 30 days.</li>
              <li>Anonymised, aggregated usage statistics may be retained indefinitely for product analytics.</li>
            </ul>
          </Section>

          <Section title="8. Your Rights">
            <p>You have the right to:</p>
            <ul>
              <li><strong>Access</strong> all expense and personal data we hold about you.</li>
              <li><strong>Export</strong> your data as CSV or PDF at any time from within the app.</li>
              <li><strong>Correct</strong> inaccurate data.</li>
              <li><strong>Delete</strong> your account and all associated data.</li>
              <li><strong>Withdraw consent</strong> for any integration (Gmail, WhatsApp, Telegram) at any time.</li>
            </ul>
            <p className="mt-3">To exercise these rights, email us at <a href="mailto:hello@spenny.ai" className="underline" style={{ color: "#3dd68c" }}>hello@spenny.ai</a>.</p>
          </Section>

          <Section title="9. Children's Privacy">
            <p>Spenny AI is not intended for users under the age of 13. We do not knowingly collect personal data from children. If you believe a child has provided us data, please contact us and we will delete it promptly.</p>
          </Section>

          <Section title="10. Changes to This Policy">
            <p>We may update this policy from time to time. When we do, we will update the &ldquo;Last updated&rdquo; date at the top and notify users by email for material changes. Continued use of Spenny AI after changes constitutes acceptance of the updated policy.</p>
          </Section>

          <Section title="11. Contact">
            <p>Questions, concerns, or requests? Reach us at:</p>
            <p><a href="mailto:hello@spenny.ai" className="underline font-medium" style={{ color: "#3dd68c" }}>hello@spenny.ai</a></p>
          </Section>
        </div>

        <div className="mt-16 pt-8 border-t flex items-center justify-between text-sm" style={{ borderColor: "rgba(26,138,90,0.12)", color: "rgba(255,255,255,0.3)" }}>
          <span>© 2026 Spenny AI</span>
          <Link href="/terms" className="hover:text-white transition-colors" style={{ color: "rgba(255,255,255,0.4)" }}>Terms of Service →</Link>
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
