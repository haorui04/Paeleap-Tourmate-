import ChatShell from "../components/ChatShell.jsx";
import GuideSelector from "../components/GuideSelector.jsx";
import { CHINA_TRAVEL_SLUG, DEFAULT_PERSONA_ID, ENTRY_PERSONA_ID } from "../lib/client/personas.js";
import { MUSEUM_GUIDE_ID } from "../lib/museum-guide.js";

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

  return <GuideSelector />;
}
