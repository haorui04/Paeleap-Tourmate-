"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CHINA_TRAVEL_SLUG, ENTRY_PERSONA_ID } from "../lib/client/personas.js";

const guides = [
  {
    href: `/?persona=${CHINA_TRAVEL_SLUG}`,
    title: "Travel in China",
    titleZh: "中国旅行",
    description: "Plan an itinerary, compare transport, or check the weather with TourMate.",
    descriptionZh: "与 TourMate 一起规划行程、比较交通和查询天气。",
    icon: "M22 2 9.3 14.7M22 2l-8.1 20-4.6-7.3L2 10.1 22 2Z",
    accent: "text-[#28576b]",
    glow: "bg-[radial-gradient(ellipse_at_15%_0%,#a8d4dc80,transparent_70%)]"
  },
  {
    href: `/?persona=${ENTRY_PERSONA_ID}`,
    title: "Explore Deshou Palace",
    titleZh: "探索德寿宫",
    description: "Take a guided tour, browse exhibits, or ask Little De Rabbit about an artifact.",
    descriptionZh: "跟随小德兔开启导览、浏览展品，或询问文物。",
    icon: "M2 9h20L12 3 2 9ZM4 21h16M6 12v6m4-6v6m4-6v6m4-6v6",
    accent: "text-[#315f4f]",
    glow: "bg-[radial-gradient(ellipse_at_15%_0%,#e7d3a48c,transparent_70%)]"
  }
];

const glassSpring = { type: "spring", stiffness: 300, damping: 20 };

function GlassCard({ guide, onSelect, reduceMotion }) {
  return (
    <motion.div
      className="min-w-0"
      whileHover={reduceMotion ? undefined : { scale: 1.02, y: -5 }}
      transition={glassSpring}
    >
      <Link
        href={guide.href}
        onNavigate={(event) => {
          event.preventDefault();
          onSelect(guide.href);
        }}
        className="group relative isolate flex h-full flex-col overflow-hidden rounded-2xl
          border border-solid border-white/30 bg-white/20 p-6 text-inherit no-underline
          shadow-[inset_0_1px_0_#ffffffc0,0_10px_30px_#23464013] backdrop-blur-lg
          transition-all duration-300 hover:border-white/80 hover:shadow-[0_18px_36px_#23464024]
          focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#285b51]
          motion-reduce:transition-none"
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity
            duration-300 group-hover:opacity-100 group-focus-visible:opacity-100
            motion-reduce:transition-none ${guide.glow}`}
        />
        <div className={`mb-6 flex items-center justify-between gap-4 ${guide.accent}`}>
          <span className="grid size-12 place-items-center rounded-xl border border-solid
            border-white/65 bg-white/35 shadow-[inset_0_1px_0_white]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={guide.icon} />
            </svg>
          </span>
          <span aria-hidden="true" className="text-2xl transition-transform duration-300
            motion-safe:group-hover:translate-x-[4px] motion-safe:group-focus-visible:translate-x-[4px]
            motion-reduce:transition-none">→</span>
        </div>
        <h2 className="m-0 font-[Georgia,'Songti_SC',serif] text-[1.625rem] leading-tight font-normal
          tracking-[-0.035em]">{guide.title}</h2>
        <p lang="zh" className={`mt-1 mb-0 text-sm font-semibold ${guide.accent}`}>{guide.titleZh}</p>
        <p className="mt-4 mb-5 text-[0.9375rem] leading-relaxed text-[#344f53]">{guide.description}</p>
        <p lang="zh" className="mt-auto mb-0 border-0 border-t border-solid border-[#2d544826] pt-4
          text-[0.8125rem] leading-relaxed text-[#415c58]">{guide.descriptionZh}</p>
      </Link>
    </motion.div>
  );
}

export default function GuideSelector() {
  const [selectedGuide, setSelectedGuide] = useState(null);
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  return (
    <div className="h-screen overflow-x-hidden overflow-y-auto bg-[#edf2ec] supports-[height:100dvh]:h-dvh">
      <AnimatePresence initial={false} onExitComplete={() => {
        if (selectedGuide) router.push(selectedGuide);
      }}>
        {selectedGuide === null && (
          <motion.main
            key="guide-selector"
            aria-labelledby="guide-selector-title"
            className="relative isolate flex min-h-screen w-full items-center justify-center
              overflow-hidden px-4 py-8 text-[#192f33] sm:px-8 sm:py-12
              supports-[height:100dvh]:min-h-dvh"
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, filter: "blur(10px)" }}
            transition={{ duration: reduceMotion ? 0 : 0.5, ease: "easeInOut" }}
          >
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
              <motion.div
                className="absolute -inset-[15%]
                  bg-[radial-gradient(ellipse_at_24%_18%,#fffdfa_0%,transparent_48%),radial-gradient(ellipse_at_76%_22%,#b9d6e5_0%,transparent_51%),radial-gradient(ellipse_at_25%_86%,#a9cbb9_0%,transparent_56%),linear-gradient(142deg,#e7efea,#edf1f7_54%,#f0e8d6)]"
                animate={reduceMotion ? undefined : { x: ["-2%", "3%", "-2%"], y: ["0%", "-3%", "0%"] }}
                transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
            <section className="w-full max-w-[58rem] rounded-3xl border-t border-l border-solid
              border-white/40 bg-white/10 p-5
              shadow-[0_30px_60px_rgba(0,0,0,0.1)] backdrop-blur-2xl sm:p-8 md:p-12">
              <header className="mb-7 sm:mb-9">
                <p className="mt-0 mb-6 text-sm font-bold tracking-tight text-[#27594f]">TourMate</p>
                <h1 id="guide-selector-title" className="m-0 font-[Georgia,'Songti_SC',serif]
                  text-[clamp(2.375rem,7vw,4.75rem)] leading-[1.04] font-normal tracking-[-0.055em]">
                  Choose your guide
                </h1>
                <p lang="zh" className="mt-3 mb-0 text-base text-[#284646]/80 sm:text-lg">选择你的导览助手</p>
              </header>
              <nav aria-labelledby="guide-selector-title" className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {guides.map((guide) => (
                  <GlassCard
                    key={guide.href}
                    guide={guide}
                    reduceMotion={reduceMotion}
                    onSelect={(href) => setSelectedGuide((current) => current ?? href)}
                  />
                ))}
              </nav>
            </section>
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
}
