/**
 * Lightweight Bible-reference parser.
 * Recognizes: "John 3:16", "1 Corinthians 13:4-7", "Psalm 23:1", "Romans 8:28–30".
 * Returns a flat list of {book, chapter, verse} for every verse in every range.
 *
 * Book-name normalization is permissive: we lowercase + strip spaces and compare
 * against a canonical alias table. Unknown books pass through with their text.
 */

const BOOK_ALIASES: Record<string, string> = {
  // Pentateuch
  genesis: "Genesis", gen: "Genesis",
  exodus: "Exodus", exo: "Exodus", ex: "Exodus",
  leviticus: "Leviticus", lev: "Leviticus",
  numbers: "Numbers", num: "Numbers",
  deuteronomy: "Deuteronomy", deut: "Deuteronomy", dt: "Deuteronomy",
  // History
  joshua: "Joshua", josh: "Joshua",
  judges: "Judges", judg: "Judges",
  ruth: "Ruth",
  "1samuel": "1 Samuel", "1sam": "1 Samuel", isamuel: "1 Samuel",
  "2samuel": "2 Samuel", "2sam": "2 Samuel", iisamuel: "2 Samuel",
  "1kings": "1 Kings", "1kgs": "1 Kings",
  "2kings": "2 Kings", "2kgs": "2 Kings",
  "1chronicles": "1 Chronicles", "1chr": "1 Chronicles",
  "2chronicles": "2 Chronicles", "2chr": "2 Chronicles",
  ezra: "Ezra",
  nehemiah: "Nehemiah", neh: "Nehemiah",
  esther: "Esther", est: "Esther",
  // Wisdom
  job: "Job",
  psalm: "Psalms", psalms: "Psalms", ps: "Psalms", psa: "Psalms",
  proverbs: "Proverbs", prov: "Proverbs", pro: "Proverbs", prv: "Proverbs",
  ecclesiastes: "Ecclesiastes", eccl: "Ecclesiastes", ecc: "Ecclesiastes",
  songofsolomon: "Song of Solomon", song: "Song of Solomon", sos: "Song of Solomon",
  songofsongs: "Song of Solomon",
  // Major prophets
  isaiah: "Isaiah", isa: "Isaiah",
  jeremiah: "Jeremiah", jer: "Jeremiah",
  lamentations: "Lamentations", lam: "Lamentations",
  ezekiel: "Ezekiel", ezek: "Ezekiel",
  daniel: "Daniel", dan: "Daniel",
  // Minor prophets
  hosea: "Hosea", hos: "Hosea",
  joel: "Joel",
  amos: "Amos",
  obadiah: "Obadiah", obad: "Obadiah",
  jonah: "Jonah",
  micah: "Micah", mic: "Micah",
  nahum: "Nahum", nah: "Nahum",
  habakkuk: "Habakkuk", hab: "Habakkuk",
  zephaniah: "Zephaniah", zeph: "Zephaniah",
  haggai: "Haggai", hag: "Haggai",
  zechariah: "Zechariah", zech: "Zechariah",
  malachi: "Malachi", mal: "Malachi",
  // Gospels
  matthew: "Matthew", matt: "Matthew", mt: "Matthew",
  mark: "Mark", mk: "Mark",
  luke: "Luke", lk: "Luke",
  john: "John", jn: "John",
  // Acts + Pauline
  acts: "Acts",
  romans: "Romans", rom: "Romans",
  "1corinthians": "1 Corinthians", "1cor": "1 Corinthians",
  "2corinthians": "2 Corinthians", "2cor": "2 Corinthians",
  galatians: "Galatians", gal: "Galatians",
  ephesians: "Ephesians", eph: "Ephesians",
  philippians: "Philippians", phil: "Philippians", php: "Philippians",
  colossians: "Colossians", col: "Colossians",
  "1thessalonians": "1 Thessalonians", "1thess": "1 Thessalonians",
  "2thessalonians": "2 Thessalonians", "2thess": "2 Thessalonians",
  "1timothy": "1 Timothy", "1tim": "1 Timothy",
  "2timothy": "2 Timothy", "2tim": "2 Timothy",
  titus: "Titus",
  philemon: "Philemon", phlm: "Philemon",
  // General + Revelation
  hebrews: "Hebrews", heb: "Hebrews",
  james: "James", jas: "James",
  "1peter": "1 Peter", "1pet": "1 Peter",
  "2peter": "2 Peter", "2pet": "2 Peter",
  "1john": "1 John", "1jn": "1 John",
  "2john": "2 John", "2jn": "2 John",
  "3john": "3 John", "3jn": "3 John",
  jude: "Jude",
  revelation: "Revelation", rev: "Revelation",
};

export type VerseRef = { book: string; chapter: number; verse: number };

export function canonicalizeBook(raw: string): string | null {
  const key = raw.toLowerCase().replace(/[\s.]+/g, "");
  return BOOK_ALIASES[key] ?? null;
}

// Matches: optional leading numeral, book name (letters/spaces/.), chapter:verse, optional range
const REF_RE =
  /\b((?:[123]\s*)?[A-Za-z][A-Za-z.]*(?:\s+(?:of\s+)?[A-Za-z][A-Za-z.]*){0,3})\s+(\d{1,3}):(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?\b/g;

export type FoundRef = { raw: string; refs: VerseRef[]; start: number; end: number };

export function extractRefs(text: string): FoundRef[] {
  const out: FoundRef[] = [];
  for (const m of text.matchAll(REF_RE)) {
    const book = canonicalizeBook(m[1].trim());
    if (!book) continue;
    const ch = parseInt(m[2], 10);
    const v1 = parseInt(m[3], 10);
    const v2 = m[4] ? parseInt(m[4], 10) : v1;
    if (v2 < v1 || v2 - v1 > 50) continue;
    const refs: VerseRef[] = [];
    for (let v = v1; v <= v2; v++) refs.push({ book, chapter: ch, verse: v });
    out.push({ raw: m[0], refs, start: m.index!, end: m.index! + m[0].length });
  }
  return out;
}

const refKey = (r: VerseRef) => `${r.book}|${r.chapter}|${r.verse}`;

/**
 * Strip any reference mention whose verses are NOT entirely in the allowed set.
 * Returns the cleaned text and the list of stripped raw strings.
 */
export function stripUnsanctionedRefs(
  answer: string,
  allowed: VerseRef[],
): { clean: string; stripped: string[] } {
  const allowSet = new Set(allowed.map(refKey));
  const found = extractRefs(answer);
  const stripped: string[] = [];
  // Walk back-to-front so indices stay valid.
  let out = answer;
  for (const f of [...found].reverse()) {
    const ok = f.refs.every((r) => allowSet.has(refKey(r)));
    if (!ok) {
      stripped.push(f.raw);
      const replacement = "[reference removed: not in retrieved set]";
      out = out.slice(0, f.start) + replacement + out.slice(f.end);
    }
  }
  return { clean: out, stripped };
}
