// Original decorative vector artwork; no external images or tracking requests.
export default function TravelScene() {
  return <svg className="travel-scene" viewBox="0 0 400 280" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="travel-sky" x1="190" y1="20" x2="190" y2="250" gradientUnits="userSpaceOnUse"><stop stopColor="#EAF3FF"/><stop offset="1" stopColor="#F8FBFF"/></linearGradient>
      <linearGradient id="travel-mountain" x1="170" y1="100" x2="170" y2="240" gradientUnits="userSpaceOnUse"><stop stopColor="#A9CCFC"/><stop offset="1" stopColor="#D7E9FF"/></linearGradient>
    </defs>
    <circle cx="210" cy="137" r="115" fill="url(#travel-sky)"/>
    <circle cx="280" cy="77" r="24" fill="#D8E9FF"/>
    <path d="M61 219 143 105a8 8 0 0 1 13 0l82 114" fill="url(#travel-mountain)"/>
    <path d="m119 139 24-34a8 8 0 0 1 13 0l25 35-18-8-14 12-13-12-17 7Z" fill="#F5FAFF"/>
    <path d="m166 224 67-89a7 7 0 0 1 11 0l68 89" fill="#BED9FC"/>
    <path d="M48 227c62-27 105 24 165 0s99-4 139 5" stroke="#8CB8F4" strokeWidth="2" strokeLinecap="round"/>
    <path d="M69 247c74-19 98 17 164 0s90 0 105 2" stroke="#D9E9FE" strokeWidth="2" strokeLinecap="round"/>
    <path d="M95 89c-23-43 44-67 104-47 65 23 111 32 128-3" stroke="#5F98EC" strokeWidth="1.5" strokeDasharray="4 6" strokeLinecap="round"/>
    <g transform="translate(316 21) rotate(-12)"><path d="m0 14 25-9-9 24-4-10-12-5Z" fill="#3478DC"/><path d="m12 19 13-14" stroke="white" strokeWidth="1.3"/></g>
    <g transform="translate(246 156)">
      <path d="M9 65h61V30H9v35Z" fill="#EBF3FF" stroke="#92BAF1" strokeWidth="1.4"/>
      <path d="M22 31V12h35v19" fill="#E2EEFF" stroke="#92BAF1" strokeWidth="1.4"/>
      <path d="M2 33c17-3 22-10 22-10h32s7 7 22 10H2ZM15 14C29 11 39 2 39 2s10 9 26 12H15Z" fill="#4D89DF"/>
      <path d="M33 65V46h13v19M20 42v13M58 42v13M32 20v8M47 20v8" stroke="#76A6E9" strokeWidth="2"/>
      <path d="M2 67h76" stroke="#6499E1" strokeWidth="2" strokeLinecap="round"/>
    </g>
    <g transform="translate(67 167)"><rect width="48" height="48" rx="14" fill="white" stroke="#DCE9FB"/><circle cx="24" cy="24" r="13" stroke="#AACAF6"/><path d="m29 16-2 11-9 5 2-11 9-5Z" fill="#3E80DE"/><circle cx="24" cy="24" r="2" fill="white"/></g>
    <path d="M287 118h27M301 105v26" stroke="#C2D9F9" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="66" cy="125" r="3" fill="#96BDF2"/><circle cx="338" cy="177" r="4" fill="#BDD7FA"/>
    <path d="M188 79c4-9 16-10 21 0 7-4 16 1 16 8h-51c0-7 7-11 14-8Z" fill="white"/>
  </svg>;
}
