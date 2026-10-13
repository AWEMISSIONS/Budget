const encoder = new TextEncoder();

const hex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");

async function signature(value: string) {
  const secret = process.env.BUDGET_SESSION_SECRET || "";
  if (!secret) return "";
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

export async function createBudgetSession() {
  const expires = String(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return `${expires}.${await signature(expires)}`;
}

export async function isBudgetSessionValid(cookieHeader: string) {
  const token = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("budget_session="))
    ?.slice("budget_session=".length);
  if (!token) return false;
  const [expires, supplied] = token.split(".");
  if (!expires || !supplied || Number(expires) < Date.now()) return false;
  const expected = await signature(expires);
  if (!expected || supplied.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < supplied.length; index++)
    difference |= supplied.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}

export const budgetPinMatches = (pin: string) =>
  /^\d{6}$/.test(pin) && pin === process.env.BUDGET_PIN;
