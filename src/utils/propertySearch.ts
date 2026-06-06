export const normalizeSearchText = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const levenshteinDistance = (a: string, b: string): number => {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array<number>(n + 1).fill(0)
  );

  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
};

const isCloseMatch = (queryToken: string, candidateToken: string): boolean => {
  if (candidateToken.includes(queryToken)) return true;
  if (queryToken.length < 5 || candidateToken.length < 5) return false;
  if (!candidateToken.startsWith(queryToken.slice(0, 3))) return false;

  const distance = levenshteinDistance(queryToken, candidateToken);
  return distance <= 1;
};

export const matchesPropertyQuery = (query: string, fields: string[]): boolean => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  const normalizedFields = fields.map((field) => normalizeSearchText(field || ""));
  const allowFuzzy = normalizedQuery.length >= 4;

  return queryTokens.every((qToken) =>
    normalizedFields.some((field) => {
      if (!field) return false;
      if (field.includes(qToken)) return true;
      if (!allowFuzzy) return false;

      const fieldTokens = field.split(" ").filter(Boolean);
      return fieldTokens.some((fToken) => isCloseMatch(qToken, fToken));
    })
  );
};
