"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import FeaturesSection from "@/components/FeaturesSection";
import IntegrationsSection from "@/components/IntegrationsSection";
import PricingSection from "@/components/PricingSection";
import FAQSection from "@/components/FAQSection";
import Footer from "@/components/Footer";
import WaitlistModal from "@/components/WaitlistModal";

export default function Home() {
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [interestedInPro, setInterestedInPro] = useState(false);

  const openWaitlist = () => { setInterestedInPro(false); setWaitlistOpen(true); };
  const openProWaitlist = () => { setInterestedInPro(true); setWaitlistOpen(true); };

  return (
    <main>
      <Navbar onOpenWaitlist={openWaitlist} />
      <HeroSection onOpenWaitlist={openWaitlist} />
      <FeaturesSection />
      <IntegrationsSection />
      <PricingSection onOpenWaitlist={openWaitlist} onOpenProWaitlist={openProWaitlist} />
      <FAQSection />
      <Footer onOpenWaitlist={openWaitlist} />
      <WaitlistModal
        open={waitlistOpen}
        onClose={() => setWaitlistOpen(false)}
        interestedInPro={interestedInPro}
      />
    </main>
  );
}
