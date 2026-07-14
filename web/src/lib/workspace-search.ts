export type WorkspaceSearchEntry = {
  source: "transcript" | "document" | "decision" | "assignment";
  meetingId: number;
  meetingTitle: string;
  location: string;
  text: string;
  searchText?: string;
};

export type WorkspaceSearchResult = WorkspaceSearchEntry & { score: number };

const compact = (text: string) => text.toLowerCase().replace(/[^0-9a-z\u0e00-\u0e7f]+/g, "");

function trigrams(text: string): Set<string> {
  if (text.length < 3) return new Set(text ? [text] : []);
  return new Set(Array.from({ length: text.length - 2 }, (_, index) => text.slice(index, index + 3)));
}

export function searchWorkspaceEntries(query: string, entries: WorkspaceSearchEntry[], limit = 12): WorkspaceSearchResult[] {
  const normalizedQuery = compact(query);
  if (!normalizedQuery || limit <= 0) return [];
  const queryTerms = query.toLowerCase().match(/[0-9a-z\u0e00-\u0e7f]+/g) ?? [];
  const queryGrams = trigrams(normalizedQuery);

  return entries
    .map((entry) => {
      const haystack = `${entry.meetingTitle} ${entry.text} ${entry.searchText ?? ""}`.toLowerCase();
      const normalizedText = compact(haystack);
      const termScore = new Set(queryTerms.filter((term) => haystack.includes(term) || normalizedText.includes(compact(term)))).size;
      const overlap = [...queryGrams].filter((gram) => normalizedText.includes(gram)).length / queryGrams.size;
      const baseScore = termScore || (overlap >= 0.35 ? overlap : 0);
      const sourceBoost = entry.source === "assignment" && /(งาน|ทำอะไร|มอบหมาย|assign|owner)/i.test(query) ? 0.25 : 0;
      return { ...entry, score: baseScore ? baseScore + sourceBoost : 0 };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.meetingId - right.meetingId)
    .slice(0, limit);
}
