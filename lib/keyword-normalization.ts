const ALIASES: Record<string, string> = {
  "amazon web services": "aws",
  "aws cloud": "aws",
  "reactjs": "react",
  "react.js": "react",
  "nodejs": "node.js",
  "node js": "node.js",
  "typescript/javascript": "typescript",
  "javascript/typescript": "javascript",
  "js": "javascript",
  "ts": "typescript",
  "large language models": "llm",
  "large language model": "llm",
  "generative ai": "llm",
  "machine learning": "ml",
  "artificial intelligence": "ai",
  "continuous integration": "ci/cd",
  "continuous deployment": "ci/cd",
  "version control": "git",
  "rest api": "rest apis",
  "restful api": "rest apis",
  "computer aided design": "cad",
};

export function normalizeKeyword(value: string) {
  const clean = value.toLowerCase().replace(/[()]/g, " ").replace(/[^a-z0-9+#./-]+/g, " ").replace(/\s+/g, " ").trim();
  return ALIASES[clean] ?? clean.replace(/\bframeworks?\b|\btools?\b/g, "").replace(/\s+/g, " ").trim();
}

export function uniqueKeywords(values: string[]) {
  const seen = new Set<string>();
  return values.filter(value => {
    const key = normalizeKeyword(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function corpusContains(corpus: string, keyword: string) {
  const normalizedCorpus = normalizeKeyword(corpus);
  const normalizedKeyword = normalizeKeyword(keyword);
  if (!normalizedKeyword) return false;
  const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9+#])${escaped}(?=$|[^a-z0-9+#])`, "i").test(normalizedCorpus);
}
