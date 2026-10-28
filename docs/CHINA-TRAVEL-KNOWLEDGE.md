# China travel knowledge expansion — 28 October 2026

## Purpose and separation

The target bank is 1,000 bilingual FAQs: the original 100 retain their identifiers, 500 additional FAQs cover 25 practical topics, and 400 cover 40 destinations. The separate planning library contains 40 destination profiles and 12 multi-city route outlines. This is retrieval reference material; it does not train or fine-tune the model.

The libraries have different jobs:
- FAQ: answer an individual travel problem, such as passport-name matching, an airport transfer or a declined mobile payment.
- Destination: propose an adaptable grouping of sights, with transport, access and pacing cautions.
- Route: suggest combinations of cities; the model asks about dates, nights, interests and mobility before allocating days.
- Source catalogue: record where research was discovered and distinguish official guidance, commercial material and traveller reports.

## Research method and limits

Research covered national travel services and 40 destination searches, alongside operator itineraries and public traveller discussions. The catalogue contains 268 URLs: 62 official sources, 154 commercial/operator sources and 52 traveller-report sources. These are discovery counts, not 268 independently verified full-page readings or a statistical sample of all travellers. Selected primary pages were opened and read; most catalogue records are explicitly labelled search-excerpt discoveries.

Representative operators included China Discovery, Travel China Guide and China Highlights. Public Reddit and TripAdvisor reports informed the practical problem taxonomy: passport identity checks, payment verification, phone OTPs, precise pickup addresses, ticket release/sell-out problems, station confusion, excessive hotel changes, altitude and incomplete step-free access. Reports are anecdotes, not official rules or measured incident frequencies. There is no assertion that every agency package, social-media platform or Chinese destination has been collected.

Source precedence:
1. Current official immigration, rail, aviation, destination and venue notices for rules.
2. Agency route descriptions for destination combinations and inspiration, not guaranteed access or availability.
3. Traveller reports for friction and question selection, not legal entitlements or facts about every visitor.

Selected primary references:
- [China Railway English FAQ](https://www.12306.cn/en/faq.html?item=1)
- [State Council payment-service guide](https://english.www.gov.cn/news/202404/11/content_WS6617c858c6d0868f4e8e5f4d.html)
- [NIA accommodation-registration policy interpretation](https://en.nia.gov.cn/n147418/n147463/c197328/content.html)
- [CAAC air-travel guidance](https://www.caac.gov.cn/INDEX/HLFW/HKLXCS/202303/t20230316_217597.html)
- [UNESCO China properties](https://whc.unesco.org/en/statesparties/cn/)
- [Representative Yunnan package](https://www.chinadiscovery.com/yunnan-tours/classic-yunnan-tour.html)

Old brochures and dated posts are not used to promise current prices, train numbers, visa durations or booking availability. Original summaries and suggested clusters are stored instead of reproducing brochures, review text or photographs. The catalogue's evidence_scope states when a URL was only discovered through a search excerpt. checked_on is the research date, not a guarantee that every underlying fact is current.

Draft FAQs were model-assisted using the researched topic notes and excerpts. They require structural, duplicate, safety and retrieval checks before publication. Automated checks and selected editorial review do not constitute expert verification of every factual claim. A qualified editor should review high-impact entry, health, accessibility and transport details before a public launch.

## Coverage

Practical topics: entry preparation; arrival/customs; payments; connectivity/apps; accommodation; rail booking; rail stations; onboard rail; rail disruption; family/accessibility on rail; multi-city transport; flight booking; airport connections; flight baggage; metro/buses; taxis/ride hailing; regional roads/ferries; attraction booking; food/diet; health/safety; families/seniors; accessibility; budgets/packages; seasons/crowds; culture/responsible travel.

Destinations: Beijing, Shanghai, Xian, Chengdu, Chongqing, Guilin, Yangshuo, Hangzhou, Suzhou, Huangshan, Zhangjiajie, Kunming, Dali, Lijiang, Shangri-La, Guangzhou, Shenzhen, Hong Kong, Macao, Xiamen, Quanzhou, Nanjing, Changsha, Qingdao, Harbin, Datong, Pingyao, Luoyang, Dunhuang, Zhangye, Lhasa, Urumqi, Turpan, Kashgar, Jiuzhaigou, Leshan, Wulong, Sanya, Haikou and Chengde.

Routes: Golden Triangle; Jiangnan; Sichuan–Chongqing; Yunnan; Guilin–Yangshuo; Gansu Silk Road segment; Xinjiang; Shanxi heritage; Fujian coast; Greater Bay Area; Shanghai–Huangshan–Hangzhou; Hainan.

Hong Kong and Macao are explicitly treated as separate entry, payment and transport jurisdictions. Mountain outings and remote excursions include access, weather, altitude or transfer cautions. No accessibility guarantee is inferred from the existence of a lift or cableway.

## Database and runtime

Apply supabase/knowledge-schema.sql once. It adds tourism_faq_v2, travel_destinations, travel_itinerary_routes and travel_knowledge_sources. The original tourism_faq table remains unchanged for rollback. Accounts, chat history and quota tables are not reseeded.

All new tables enable RLS. PUBLIC, anon and authenticated have no table privileges. Only server service_role can select/upsert; no browser writes are introduced. The application reads a fixed set of table paths with bounded responses, timeouts and no redirects. The model receives selected text as untrusted reference data and has no arbitrary SQL, browsing or database-write tool.

The FAQ reader retrieves fixed pages of 500, checks the complete expected count and unique sequential IDs, then sorts IDs numerically (CN1000 must not sort between CN100 and CN101). It fails closed if the selected bank is missing or invalid.

Only default TourMate generated-mode planning requests use the destination/route library. Museum companions retain their own published knowledge scope. Authentication, quotas, ownership, input safety, persona and output checks remain in place before/after retrieval. Citation URLs are displayed as references; the app does not fetch their contents.

## Maintenance and reproducibility

- data/china-tourism-faq.js: original 100 plus imported expansion.
- data/china-tourism-faq-expanded.json: additional 900 with bilingual answers and provenance.
- data/travel-destinations.json: 40 original planning profiles.
- data/travel-itinerary-routes.json: 12 original route outlines.
- data/travel-knowledge-sources.json: labelled discovery catalogue.
- node scripts/knowledge-check.mjs: counts, source identity, canonical bilingual retrieval and safety screening.
- npm run faq:export: generate supabase/faq-seed-v2.sql for a reproducible upsert.

Review volatile topics when official services change and before travel dates. Recheck source links and remove obsolete guidance rather than silently treating an old search date as fresh evidence. User uploads do not automatically enter these libraries. Do not publish scraped private posts, personal information, or unreviewed instructions.

Rollback uses the previous application revision, which reads the retained tourism_faq table. Never delete visitor conversations to roll back knowledge content.

## Recorded verification

- 1,000 records, all sequential IDs present; no duplicate English or Chinese questions.
- All 2,000 canonical language variants passed input-safety, stored-answer output and exact retrieval checks.
- The full automated suite passed 7,122 tests. It includes the original security regressions plus expanded canonical coverage; the strict harness now runs 2,300 cases in each of five simulated-provider modes. These are fixtures, not proof of live-model safety.
- Production compilation passed, all 82 JavaScript syntax checks passed, and the dependency audit reported no vulnerabilities.
- Supabase publication was verified against the local canonical seed using SHA-256: d3bc96ed667a5da30135ffe9a26ee808e6239cc12067835724b34f571a084501.
- PostgreSQL-engine tests and deployed grants confirm that the four new tables are service-only. Supabase's RLS-without-policy information is intentional for these server-only tables.
- The existing Auth advisory about disabled leaked-password protection is separate from this migration; see [Supabase password-security guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Regression work also corrected static weather-preparation questions being routed to the live-weather tool, and blocked bare confirmations that continue an unsafe earlier request. Ordinary direct weather lookups and clear new travel questions retain their existing paths.
