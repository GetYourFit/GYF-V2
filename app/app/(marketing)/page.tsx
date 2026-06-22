import SplashScreen from "@/components/SplashScreen";
import CustomCursor from "@/components/CustomCursor";
import Hero from "@/components/sections/Hero";
import Problem from "@/components/sections/Problem";
import WhatWeDo from "@/components/sections/WhatWeDo";
import HowItWorks from "@/components/sections/HowItWorks";
import Vision from "@/components/sections/Vision";
import Intelligence from "@/components/sections/Intelligence";
import CTABanner from "@/components/sections/CTABanner";

export default function Home() {
  return (
    <>
      <SplashScreen />
      <CustomCursor />
      <div id="page">
        <Hero />
        <Problem />
        <HowItWorks />
        <WhatWeDo />
        <Vision />
        <Intelligence />
        <CTABanner />
      </div>
    </>
  );
}
