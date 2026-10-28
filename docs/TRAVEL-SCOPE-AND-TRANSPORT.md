# China travel scope and transport references

TourMate explicitly supports China itineraries, multi-city planning, and comparisons of conventional rail, high-speed rail and flights. FAQ matches are optional evidence, not an allowlist. A city plus trip length is sufficient for an undated draft; missing city information prompts clarification, not an out-of-scope refusal. Museum-specific personas retain their venue restrictions.

Intercity questions prioritize transport FAQs and directional route records ahead of city-name sightseeing matches. data/travel-transport.json is a versioned backend reference library, bundled with the server; existing FAQ and destination libraries continue to load from Supabase. No live booking search or additional account/key is required.

Initial reviewed duration coverage is Hangzhou–Beijing and Beijing–Shanghai, in both directions. Other routes remain in scope: offer general comparison guidance and acknowledge missing verified durations rather than invent hours. Extend the JSON with researched directional records, date checked and HTTPS sources. Do not imply every mode operates on every city pair.

Duration options are rendered from the route record so the model cannot swap modes or alter the numbers. The model may add compatible explanatory prose and draft itineraries using references. Numerical output checks for unsupported fares, schedules and other claims remain enabled. Provider failure or a mistaken model refusal can fall back to labelled reference guidance for a reviewed route.

Times are approximate reference ranges, not live availability or guarantees. Rail times are station-to-station; flying time excludes airport transfers, check-in and waiting. Reverse-direction conventional-train ranges can differ.

Research checked 28 October 2026:
- https://www.travelchinaguide.com/china-trains/beijing-hangzhou.htm — direction-specific G/conventional examples and flight comparison. The page has inconsistent summary ranges, so the current directional examples guide the rounded conventional ranges.
- https://www.travelchinaguide.com/china-trains/beijing-shanghai-highspeed.htm — G, overnight D and conventional reference ranges.
- https://www.travelchinaguide.com/cityguides/beijing/train-flight-shanghai.htm — approximate flight duration; older comparison, not a live schedule.

Auth, ownership, quotas, persona boundaries and prompt-injection checks precede generated responses. Visitor instructions cannot redefine these rules or publish new transport records.
