import ChatShell from "../components/ChatShell.jsx";
import { CHINA_TRAVEL_SLUG, DEFAULT_PERSONA_ID, ENTRY_PERSONA_ID } from "../lib/client/personas.js";
import { MUSEUM_GUIDE_ID } from "../lib/museum-guide.js";
import styles from "./chooser.module.css";

const choices = [
  {
    persona: CHINA_TRAVEL_SLUG,
    name: "Travel in China",
    nameZh: "中国旅行",
    description: "Plan an itinerary, compare transport, or check the weather with TourMate.",
    descriptionZh: "与 TourMate 一起规划行程、比较交通和查询天气。",
    path: "M3 10.5l18-7-7 18-2.5-8.5L3 10.5zM11.5 13L21 3.5"
  },
  {
    persona: ENTRY_PERSONA_ID,
    name: "Explore Deshou Palace",
    nameZh: "探索德寿宫",
    description: "Take a guided tour, browse exhibits, or ask Little De Rabbit about an artifact.",
    descriptionZh: "跟随小德兔开启导览、浏览展品，或询问文物。",
    path: "M3 9h18L12 3 3 9zM5 21h14M7 12v6m5-6v6m5-6v6"
  }
];

export async function generateMetadata({ searchParams }) {
  const { persona } = await searchParams;
  if ([CHINA_TRAVEL_SLUG, DEFAULT_PERSONA_ID].includes(persona)) return {
    title: "TourMate · China Travel Assistant",
    description: "Plan a trip in China with TourMate."
  };
  if (persona !== undefined) return {};
  return {
    title: "TourMate · Travel & Museum Guides",
    description: "Choose TourMate for travel in China or Little De Rabbit for the Deshou Palace museum."
  };
}

export default async function Home({ searchParams }) {
  const { persona, artifact } = await searchParams;
  if (persona !== undefined || artifact !== undefined) {
    const requested = Array.isArray(persona) ? persona[0] : persona;
    const museumEntry = (requested ?? ENTRY_PERSONA_ID) === MUSEUM_GUIDE_ID;
    return <ChatShell initialPersonaId={museumEntry ? MUSEUM_GUIDE_ID : null} />;
  }

  return (
    <main className={styles.page}>
      <div className={styles.panel}>
        <header className={styles.header}>
          <p className={styles.brand}>TourMate</p>
          <h1>Choose your guide</h1>
          <p lang="zh" className={styles.subtitle}>选择你的导览助手</p>
        </header>
        <nav className={styles.choices} aria-label="Choose a guide">
          {choices.map(choice => (
            <a className={styles.choice} href={`/?persona=${choice.persona}`} key={choice.persona}>
              <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={choice.path} />
              </svg>
              <h2>{choice.name}</h2>
              <p className={styles.choiceZh} lang="zh">{choice.nameZh}</p>
              <p>{choice.description}</p>
              <p lang="zh">{choice.descriptionZh}</p>
              <span className={styles.arrow} aria-hidden="true">→</span>
            </a>
          ))}
        </nav>
      </div>
    </main>
  );
}
