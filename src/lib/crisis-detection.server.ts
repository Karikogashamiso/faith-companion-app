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

const CRISIS_PATTERNS: RegExp[] = [
  /\b(kill|killing|harm(ing)?|hurt(ing)?)\s+(myself|me)\b/i,
  /\bsuicid(e|al)\b/i,
  /\bend(ing)?\s+(my|it all)\s*(life|self)?\b/i,
  /\bdon'?t\s+want\s+to\s+(live|be\s+(alive|here))\b/i,
  /\b(cut|cutting)\s+myself\b/i,
  /\bself[- ]?harm\b/i,
  /\boverdose\b/i,
];

const PASTORAL_PATTERNS: RegExp[] = [
  /\b(grief|grieving|mourning|loss|died|death of)\b/i,
  /\b(divorce|separating|leaving my (husband|wife|spouse))\b/i,
  /\b(addict|addiction|relapse|sober|alcohol|porn)\b/i,
  /\b(abuse|abusive|abused)\b/i,
  /\b(deconstruct|losing my faith|doubt(ing)? god|leaving the church)\b/i,
  /\b(should i (marry|divorce|leave|quit|move))\b/i,
  /\bmiscarriage|stillborn\b/i,
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
