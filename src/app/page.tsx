import { Hero } from "@/components/sections/Hero";
import { RateChecker } from "@/components/sections/RateChecker";
import { LiveMarket } from "@/components/sections/LiveMarket";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { WhyChooseUs } from "@/components/sections/WhyChooseUs";
import { SupportedPairs } from "@/components/sections/SupportedPairs";
import { Security } from "@/components/sections/Security";
import { Faq } from "@/components/sections/Faq";
import { Contact } from "@/components/sections/Contact";
import { ExchangeRequestModal } from "@/components/exchange/ExchangeRequestModal";

/**
 * Single-page composition. Section ids must match NAV_ITEMS hrefs:
 * #exchange, #market, #how-it-works, #security, #faq, #contact.
 * (Hero, WhyChooseUs and SupportedPairs are not nav targets.)
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <RateChecker />
      <LiveMarket />
      <HowItWorks />
      <WhyChooseUs />
      <SupportedPairs />
      <Security />
      <Faq />
      <Contact />
      <ExchangeRequestModal />
    </>
  );
}
