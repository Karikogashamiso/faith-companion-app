/**
 * Cheap, deterministic prefilter for high-stakes questions.
 * Returns one of: 'none' | 'pastoral' | 'crisis'.
 *
 * - 'crisis': self-harm / suicide / acute danger → response MUST lead with crisis resources.
 * - 'pastoral': grief, divorce, deconstruction, addiction, major life decision →
 *               response leads with a "talk to a real person" handoff before Scripture.
 * - 'none': normal study question.
 *
 * This is intentionally over-inclusive; false positives just add a gentle preamble.
 */

// Tuned to be over-inclusive: a false positive only adds a gentle, caring
// preamble, while a false negative could miss someone in real danger. We
// therefore err hard toward catching indirect, passive, and metaphorical
// phrasing — not just explicit keywords.
const CRISIS_PATTERNS: RegExp[] = [
  // Explicit self-harm / suicide.
  /\b(kill(ing)?|harm(ing)?|hurt(ing)?)\s+(myself|me)\b/i,
  /\bsuicid/i, // suicide, suicidal, common misspellings start the same
  /\bself[- ]?harm/i,
  /\b(cut|cutting|burn(ing)?)\s+myself\b/i,
  /\boverdos/i, // overdose, overdosing
  /\b(take|taking|swallow(ing)?)\s+(all\s+)?(my|the)?\s*pills\b/i,
  /\b(lethal|fatal)\s+(dose|amount)\b/i,
  // Ending one's life — direct and indirect.
  /\bend(ing)?\s+(my|it|this)\s*(life|all|now)?\b/i,
  /\btake\s+my\s+(own\s+)?life\b/i,
  /\b(want|wanting|wish|wishing|going|ready)\s+to\s+die\b/i,
  /\b(better off|everyone'?s better)\s+(without me|dead|if i (was|were)n'?t)/i,
  // Passive ideation / not wanting to exist.
  /\bdon'?t\s+want\s+to\s+(live|be\s+(alive|here)|exist|wake up|go on)\b/i,
  /\b(want|wanting)\s+to\s+(disappear|not (exist|wake up|be here)|vanish)\b/i,
  /\b(can'?t|cannot)\s+(do this|take this|go on|keep going)\s*(any\s*more|anymore)?\b/i,
  /\b(no (reason|point)\s+(to|in)\s+(living|going on|being here))\b/i,
  /\b(tired of|done with)\s+(living|life|being alive)\b/i,
  /\b(nothing (left )?to live for|life isn'?t worth)/i,
  /\b(dead inside|numb to everything)\b/i,
];

const PASTORAL_PATTERNS: RegExp[] = [
  /\b(grief|grieving|mourning|bereave|lost (my|someone)|passed away|died|death of|funeral)\b/i,
  /\b(divorce|divorcing|separating|separation|leaving my (husband|wife|spouse|partner)|my marriage is)\b/i,
  /\b(addict|addiction|relapse|relapsed|sober|sobriety|alcohol(ic|ism)?|drinking problem|porn|gambling)\b/i,
  /\b(abus(e|ed|ive)|assault|molest|trafficked|domestic violence)\b/i,
  /\b(deconstruct|losing my faith|lost my faith|doubt(ing)? god|leaving the church|don'?t believe anymore|is god (even )?real)\b/i,
  /\bshould i\s+(marry|divorce|leave|quit|move|adopt|forgive|report)\b/i,
  /\b(miscarriage|miscarried|stillborn|stillbirth|infertil)\b/i,
  /\b(terminal|cancer|hospice|dying|chronic(ally)? ill)\b/i,
  /\b(lost my job|got fired|laid off|bankrupt|homeless|evicted)\b/i,
  /\b(depress(ed|ion)|anxiety attack|panic attack|can'?t get out of bed|hopeless|worthless)\b/i,
];

export type CrisisLevel = "none" | "pastoral" | "crisis";

export function classifyCrisis(question: string): CrisisLevel {
  if (CRISIS_PATTERNS.some((re) => re.test(question))) return "crisis";
  if (PASTORAL_PATTERNS.some((re) => re.test(question))) return "pastoral";
  return "none";
}

export const CRISIS_RESOURCES = `If you are in immediate danger or thinking about harming yourself, please reach out right now:

• United States — call or text 988 (Suicide & Crisis Lifeline), or text HOME to 741741
• United Kingdom — call 116 123 (Samaritans)
• International — https://findahelpline.com

You are loved, and there are people trained to walk with you through this. Please talk to one of them, and to someone you trust in person.`;

export const PASTORAL_HANDOFF = `Before anything else: questions like this deserve a real person who knows you — a pastor, a wise friend, or a counselor. I can sit with you in Scripture, but I am not a substitute for that relationship. Please reach out to someone you trust this week.`;
