const API_BIBLE_BASE = "https://api.scripture.api.bible/v1";

export interface ApiBibleVerse {
  id: string;
  orgId: string;
  bookId: string;
  chapterId: string;
  bibleId: string;
  reference: string;
  content: string;
  verseCount: number;
  copyright: string;
}

export interface ApiBiblePassage {
  data: {
    id: string;
    orgId: string;
    bibleId: string;
    bookId: string;
    chapterIds: string[];
    reference: string;
    content: string;
    verseCount: number;
    copyright: string;
  };
}

function apiBibleHeaders(apiKey: string) {
  return {
    "api-key": apiKey,
    "Content-Type": "application/json",
  };
}

export async function fetchApiBibleVerse(
  apiKey: string,
  bibleId: string,
  verseId: string,
): Promise<ApiBibleVerse> {
  const res = await fetch(`${API_BIBLE_BASE}/bibles/${bibleId}/verses/${verseId}`, {
    headers: apiBibleHeaders(apiKey),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API.Bible ${res.status}: ${body}`);
  }
  const json = (await res.json()) as { data: ApiBibleVerse };
  return json.data;
}

export async function fetchApiBiblePassage(
  apiKey: string,
  bibleId: string,
  passageId: string,
): Promise<ApiBiblePassage["data"]> {
  const res = await fetch(
    `${API_BIBLE_BASE}/bibles/${bibleId}/passages/${passageId}?include-verse-numbers=true`,
    { headers: apiBibleHeaders(apiKey) },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API.Bible ${res.status}: ${body}`);
  }
  const json = (await res.json()) as ApiBiblePassage;
  return json.data;
}

export async function fetchApiBibleChapter(
  apiKey: string,
  bibleId: string,
  chapterId: string,
): Promise<{ reference: string; content: string; verseCount: number }> {
  const res = await fetch(
    `${API_BIBLE_BASE}/bibles/${bibleId}/chapters/${chapterId}?include-verse-numbers=true`,
    { headers: apiBibleHeaders(apiKey) },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API.Bible ${res.status}: ${body}`);
  }
  const json = (await res.json()) as {
    data: {
      id: string;
      bibleId: string;
      number: string;
      bookId: string;
      reference: string;
      content: string;
      verseCount: number;
      copyright: string;
    };
  };
  return {
    reference: json.data.reference,
    content: json.data.content,
    verseCount: json.data.verseCount,
  };
}

// Map WEB (World English Bible) to API.Bible bible IDs.
// Common free IDs: "9879dbb7cfe39e4d-01" (WEB), "06125adad2d5898a-01" (KJV)
const DEFAULT_API_BIBLE_ID = "9879dbb7cfe39e4d-01";

export function getApiBibleIdForVersion(abbreviation?: string): string {
  switch (abbreviation?.toUpperCase()) {
    case "KJV":
      return "de4e12af7f1f3f3d-01";
    case "WEB":
    default:
      return DEFAULT_API_BIBLE_ID;
  }
}
