import { asc, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { accounts, appMeta, debts, transactions } from "../../db/schema";

export const dynamic = "force-dynamic";

type SyncAccount = {
  name: string;
  institution?: string;
  mask?: string;
  type: "depository" | "credit" | "loan" | "investment" | "other";
  subtype?: string;
  current: number;
  available?: number;
  apr?: number;
  minimumPayment?: number;
  dueDay?: number;
};

type SyncTransaction = {
  date: string;
  description: string;
  amount: number;
  flowType: "expense" | "income" | "transfer";
  category?: string;
  accountName: string;
  pending?: boolean;
};

const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: { "cache-control": "private, no-store" },
  });

const rpcError = (id: unknown, code: number, message: string) =>
  json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

const normalized = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const finiteMoney = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.abs(number) : 0;
};

const fingerprint = (date: string, name: string, amount: number, account: string) =>
  `${date}|${name.trim().toLowerCase()}|${amount.toFixed(2)}|${account.toLowerCase()}`;

const categoryName = (value = "") => {
  const key = value.toLowerCase().replace(/[ &-]+/g, "_");
  const map: Record<string, string> = {
    bills_utilities: "Utilities",
    groceries: "Groceries",
    dining_drinks: "Dining",
    transportation: "Transportation",
    education: "Education",
    health_wellness: "Medical",
    entertainment: "Entertainment",
    shopping: "Shopping",
    pets: "Pets",
    housing: "Housing",
    gifts_donations: "Giving",
    financial: "Debt",
    income: "Other",
    transfers: "Transfer",
  };
  return map[key] || "Other";
};

function authorized(request: Request) {
  const email = request.headers.get("oai-authenticated-user-email")?.toLowerCase();
  const expected = process.env.BUDGET_OWNER_EMAIL?.toLowerCase();
  return Boolean(email && expected && email === expected);
}

async function metaValues() {
  const rows = await getDb().select().from(appMeta);
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

async function setMeta(key: string, value: string) {
  await getDb()
    .insert(appMeta)
    .values({ key, value })
    .onConflictDoUpdate({ target: appMeta.key, set: { value } });
}

async function syncSnapshot(args: Record<string, unknown>) {
  const db = getDb();
  const incomingAccounts = (Array.isArray(args.accounts) ? args.accounts : []).slice(0, 100) as SyncAccount[];
  const incomingTransactions = (Array.isArray(args.transactions) ? args.transactions : []).slice(0, 2500) as SyncTransaction[];
  const asOf = String(args.asOf || new Date().toISOString());
  const existingAccounts = await db.select().from(accounts).orderBy(asc(accounts.id));
  const existingDebts = await db.select().from(debts).orderBy(asc(debts.id));

  const depositoryGroups = new Map<string, { name: string; checking: number; savings: number }>();
  for (const account of incomingAccounts.filter((item) => item.type === "depository")) {
    const groupName = String(account.institution || account.name || "Connected account").trim();
    const key = normalized(groupName);
    const current = depositoryGroups.get(key) || { name: groupName, checking: 0, savings: 0 };
    if (String(account.subtype).toLowerCase().includes("saving")) current.savings += finiteMoney(account.current);
    else current.checking += finiteMoney(account.current);
    depositoryGroups.set(key, current);
  }

  let accountUpdates = 0;
  for (const group of depositoryGroups.values()) {
    const match = existingAccounts.find((row) => {
      const left = normalized(row.name), right = normalized(group.name);
      return left === right || left.includes(right) || right.includes(left);
    });
    if (match) {
      await db.update(accounts).set({
        checking: group.checking,
        savings: group.savings,
        snapshotDate: asOf.slice(0, 10),
      }).where(eq(accounts.id, match.id));
    } else {
      await db.insert(accounts).values({
        name: group.name,
        checking: group.checking,
        savings: group.savings,
        snapshotDate: asOf.slice(0, 10),
      });
    }
    accountUpdates++;
  }

  let debtUpdates = 0;
  for (const account of incomingAccounts.filter((item) => item.type === "credit" || item.type === "loan")) {
    const mask = String(account.mask || "").replace(/\D/g, "");
    const name = String(account.name || account.institution || "Connected debt").trim();
    const match = existingDebts.find((row) => {
      const left = normalized(row.name), right = normalized(name);
      const existingWords = row.name
          .toLowerCase()
          .replace(/[^a-z0-9 ]/g, " ")
          .split(/\s+/)
          .filter((word) => word.length >= 5),
        incomingWords = name
          .toLowerCase()
          .replace(/[^a-z0-9 ]/g, " ")
          .split(/\s+/)
          .filter((word) => word.length >= 5),
        distinctiveMatch = incomingWords.some((word) =>
          existingWords.includes(word),
        );
      return (mask.length >= 3 && row.name.replace(/\D/g, "").endsWith(mask)) || left === right || left.includes(right) || right.includes(left) || distinctiveMatch;
    });
    if (!match) {
      await db.insert(debts).values({
        name: `${name}${mask ? ` •${mask}` : ""}`,
        kind: account.type === "credit" ? "Credit card" : "Loan",
        balance: finiteMoney(account.current),
        apr: finiteMoney(account.apr),
        dueDay: Math.max(1, Math.min(31, Number(account.dueDay) || 1)),
        minPayment: finiteMoney(account.minimumPayment),
        sourceUpdated: `Plaid · ${String(account.institution || "connected account")} · ${asOf.slice(0, 10)}`,
      });
      debtUpdates++;
      continue;
    }
    await db.update(debts).set({
      balance: finiteMoney(account.current),
      apr: Number.isFinite(Number(account.apr)) ? finiteMoney(account.apr) : match.apr,
      minPayment: Number.isFinite(Number(account.minimumPayment)) ? finiteMoney(account.minimumPayment) : match.minPayment,
      dueDay: Math.max(1, Math.min(31, Number(account.dueDay) || match.dueDay)),
      sourceUpdated: `Plaid · ${String(account.institution || "connected account")} · ${asOf.slice(0, 10)}`,
    }).where(eq(debts.id, match.id));
    debtUpdates++;
  }

  let transactionAdds = 0;
  for (const item of incomingTransactions) {
    const date = String(item.date || "").slice(0, 10);
    const description = String(item.description || "").trim();
    const accountName = String(item.accountName || "Connected account").trim();
    const amount = finiteMoney(item.amount);
    if (item.pending || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !description || !amount) continue;
    const flowType = item.flowType === "income" ? "income" : item.flowType === "transfer" ? "transfer" : "expense";
    const result = await db.insert(transactions).values({
      date,
      description,
      category: flowType === "transfer" ? "Transfer" : categoryName(item.category),
      amount,
      type: flowType,
      account: accountName,
      fingerprint: fingerprint(date, description, amount, accountName),
    }).onConflictDoNothing();
    if ((result.meta?.changes || 0) > 0) transactionAdds++;
  }

  const completedAt = new Date().toISOString();
  await Promise.all([
    setMeta("last-finance-sync", completedAt),
    setMeta("last-finance-sync-as-of", asOf),
    setMeta("last-finance-sync-accounts", String(accountUpdates)),
    setMeta("last-finance-sync-transactions", String(transactionAdds)),
  ]);
  return { completedAt, asOf, accountUpdates, debtUpdates, transactionAdds };
}

const tools = [
  {
    name: "get_sync_status",
    title: "Get Family Budget sync status",
    description: "Check when the Family Budget app was last updated from connected financial accounts.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "sync_financial_snapshot",
    title: "Sync finances to Family Budget",
    description: "After the user explicitly requests a sync, send current account balances, liabilities, and posted transactions to Family Budget. Mark transfers between the user's own accounts as flowType transfer. Use positive absolute amounts and identify direction with flowType. Do not include pending transactions or credentials.",
    inputSchema: {
      type: "object",
      required: ["asOf", "accounts", "transactions"],
      additionalProperties: false,
      properties: {
        asOf: { type: "string", description: "ISO date or datetime through which the source data is current." },
        accounts: {
          type: "array", maxItems: 100,
          items: {
            type: "object", required: ["name", "type", "current"], additionalProperties: false,
            properties: {
              name: { type: "string" }, institution: { type: "string" }, mask: { type: "string" },
              type: { type: "string", enum: ["depository", "credit", "loan", "investment", "other"] },
              subtype: { type: "string" }, current: { type: "number" }, available: { type: "number" },
              apr: { type: "number" }, minimumPayment: { type: "number" }, dueDay: { type: "integer", minimum: 1, maximum: 31 }
            }
          }
        },
        transactions: {
          type: "array", maxItems: 2500,
          items: {
            type: "object", required: ["date", "description", "amount", "flowType", "accountName"], additionalProperties: false,
            properties: {
              date: { type: "string" }, description: { type: "string" }, amount: { type: "number" },
              flowType: { type: "string", enum: ["expense", "income", "transfer"] },
              category: { type: "string" }, accountName: { type: "string" }, pending: { type: "boolean" }
            }
          }
        }
      }
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
];

export async function POST(request: Request) {
  let body: { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> };
  try { body = await request.json(); }
  catch { return rpcError(null, -32700, "Parse error"); }
  const id = body.id ?? null;
  if (body.method === "initialize") return json({ jsonrpc: "2.0", id, result: { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "family-budget", version: "1.0.0" } } });
  if (body.method === "notifications/initialized") return new Response(null, { status: 204 });
  if (body.method === "tools/list") return json({ jsonrpc: "2.0", id, result: { tools } });
  if (body.method !== "tools/call") return rpcError(id, -32601, "Method not found");
  if (!authorized(request)) return json({ jsonrpc: "2.0", id, error: { code: -32001, message: "This tool is limited to the Family Budget owner." } }, 403);
  const params = body.params || {};
  const name = String(params.name || "");
  const args = (params.arguments || {}) as Record<string, unknown>;
  try {
    if (name === "get_sync_status") {
      const meta = await metaValues();
      const status = {
        lastSync: meta["last-finance-sync"] || null,
        sourceAsOf: meta["last-finance-sync-as-of"] || null,
        accountsUpdated: Number(meta["last-finance-sync-accounts"] || 0),
        transactionsAdded: Number(meta["last-finance-sync-transactions"] || 0),
      };
      return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: status.lastSync ? `Family Budget was last synced ${status.lastSync}.` : "Family Budget has not been synced from ChatGPT yet." }], structuredContent: status } });
    }
    if (name === "sync_financial_snapshot") {
      const summary = await syncSnapshot(args);
      return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: `Family Budget sync completed: ${summary.accountUpdates} bank groups updated, ${summary.debtUpdates} debt balances matched, and ${summary.transactionAdds} new posted transactions added.` }], structuredContent: summary } });
    }
    return rpcError(id, -32602, "Unknown tool");
  } catch {
    return json({ jsonrpc: "2.0", id, result: { isError: true, content: [{ type: "text", text: "The Family Budget sync could not be completed. No bank credentials were stored." }] } });
  }
}
