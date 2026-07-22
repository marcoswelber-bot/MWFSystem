export type NormalizedMessage = { raw: string; text: string; tokens: string[]; digits: string; isEmail: boolean; isAffirmative: boolean; isNegative: boolean };

const affirmative = new Set(["sim", "s", "isso", "correto", "exato", "quero", "pode", "pode ser", "confirmar", "confirmo", "ok", "e isso"]);
const negative = new Set(["nao", "n", "cancelar", "errado", "nao e isso", "voltar", "outra opcao"]);

export function normalizeMessage(value: string): NormalizedMessage {
  const text = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9@/+:\s.-]/g, " ").replace(/\s+/g, " ").trim();
  return { raw: value, text, tokens: text.split(" ").filter(Boolean), digits: value.replace(/\D/g, ""), isEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()), isAffirmative: affirmative.has(text), isNegative: negative.has(text) };
}

export function editDistance(left: string, right: string) {
  const a = normalizeMessage(left).text, b = normalizeMessage(right).text;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) { let diagonal = row[0]; row[0] = i; for (let j = 1; j <= b.length; j++) { const old = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)); diagonal = old; } }
  return row[b.length];
}

export function fuzzyScore(left: string, right: string) {
  const a = normalizeMessage(left).text, b = normalizeMessage(right).text;
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.startsWith(b) || b.startsWith(a)) return Math.min(a.length, b.length) / Math.max(a.length, b.length) * .25 + .72;
  if (a.includes(b) || b.includes(a)) return Math.min(a.length, b.length) / Math.max(a.length, b.length) * .2 + .68;
  return 1 - editDistance(a, b) / Math.max(a.length, b.length);
}
