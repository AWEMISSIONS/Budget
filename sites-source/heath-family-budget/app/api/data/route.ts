import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  accounts,
  appMeta,
  billPayments,
  budgets,
  debts,
  goals,
  recurring,
  transactions,
} from "../../../db/schema";
import { isBudgetSessionValid } from "../../auth";

const unauthorized = () => Response.json({ error: "Locked" }, { status: 401 });

const fp = (date: string, name: string, amount: number, account: string) =>
  `${date}|${name.trim().toLowerCase()}|${amount.toFixed(2)}|${account.toLowerCase()}`;
const num = (value: unknown) => Math.max(0, Number(value) || 0);
const transactionType = (type: unknown, description: unknown) =>
  String(type).toLowerCase() === "transfer" ||
  /\b(transfer|xfer|internal transfer)\b|\bto (checking|savings)\b|\bfrom (checking|savings)\b/i.test(
    String(description),
  )
    ? "transfer"
    : String(type).toLowerCase() === "income"
      ? "income"
      : "expense";
const defaultPaySchedules = [
  {
    id: "american-airlines",
    name: "American Airlines",
    amount: 3400,
    anchorDate: "2026-09-17",
    intervalDays: 14,
    purpose: "Bills",
    destinationAccountId: 0,
  },
  {
    id: "enrichment",
    name: "Enrichment",
    amount: 733,
    anchorDate: "2026-09-17",
    intervalDays: 14,
    purpose: "Everyday expenses",
    destinationAccountId: 0,
  },
];
const defaultCustomCategories = ["Education"];
const payDates = (month: string, anchorDate: string, intervalDays: number) => {
  const [year, mon] = month.split("-").map(Number),
    start = Date.UTC(year, mon - 1, 1),
    end = Date.UTC(year, mon, 0),
    anchor = Date.parse(anchorDate + "T12:00:00Z"),
    step = intervalDays * 86400000,
    first = Math.ceil((start - anchor) / step),
    last = Math.floor((end - anchor) / step),
    dates: string[] = [];
  for (let i = first; i <= last; i++)
    dates.push(new Date(anchor + i * step).toISOString().slice(0, 10));
  return dates;
};

async function seedWorkbook() {
  return;
  const db = getDb();
  if (
    (
      await db
        .select()
        .from(appMeta)
        .where(eq(appMeta.key, "2026-workbook-import"))
    ).length
  )
    return;
  await db.insert(debts).values([
    {
      name: "Sommer Capital One",
      kind: "Credit card",
      balance: 1450,
      apr: 25.49,
      dueDay: 28,
      minPayment: 41,
      sourceUpdated: "2026-09-09",
    },
    {
      name: "Heath Capital One •2690",
      kind: "Credit card",
      balance: 9973.93,
      apr: 28.99,
      dueDay: 7,
      minPayment: 357,
      sourceUpdated: "2026-09-09",
    },
    {
      name: "Heath Capital One •1281",
      kind: "Credit card",
      balance: 15071.4,
      apr: 24.49,
      dueDay: 28,
      minPayment: 474,
      sourceUpdated: "2026-09-09",
    },
    {
      name: "Lowe’s Pro",
      kind: "Credit card",
      balance: 513,
      apr: 0,
      dueDay: 28,
      minPayment: 30,
      sourceUpdated: "2026-09-09",
    },
    {
      name: "Amazon",
      kind: "Credit card",
      balance: 2163.28,
      apr: 0,
      dueDay: 28,
      minPayment: 73,
      sourceUpdated: "2026-09-09",
    },
    {
      name: "Costco",
      kind: "Credit card",
      balance: 9451,
      apr: 26.74,
      dueDay: 1,
      minPayment: 432.24,
      sourceUpdated: "2026-09-09",
    },
    {
      name: "Fifth Third Mortgage",
      kind: "Mortgage",
      balance: 301989.95,
      apr: 3.875,
      dueDay: 1,
      minPayment: 1960,
      sourceUpdated: "2026-09-09",
    },
    {
      name: "OURFSB Second Mortgage",
      kind: "Mortgage",
      balance: 40000,
      apr: 8,
      dueDay: 17,
      minPayment: 380,
      sourceUpdated: "2026-09-09",
    },
    {
      name: "Huntington RV",
      kind: "Vehicle",
      balance: 27434.56,
      apr: 5.99,
      dueDay: 15,
      minPayment: 306.92,
      sourceUpdated: "2026-09-09",
    },
    {
      name: "ORNL Palisade",
      kind: "Vehicle",
      balance: 57783.6,
      apr: 7.75,
      dueDay: 22,
      minPayment: 878.36,
      sourceUpdated: "2026-09-09",
    },
  ]);
  await db.insert(accounts).values([
    {
      name: "Enrichment",
      checking: 2175.01,
      savings: 8629.72,
      snapshotDate: "2026-04-17",
    },
    {
      name: "AA Credit Union",
      checking: 2898.94,
      savings: 3887.65,
      snapshotDate: "2026-04-17",
    },
  ]);
  await db.insert(recurring).values([
    {
      name: "Mortgage",
      amount: 1960,
      category: "Housing",
      dueDay: 1,
      type: "expense",
    },
    {
      name: "Electric · PVEC",
      amount: 380,
      category: "Utilities",
      dueDay: 1,
      type: "expense",
    },
    {
      name: "Claiborne Utilities",
      amount: 80,
      category: "Utilities",
      dueDay: 1,
      type: "expense",
    },
    {
      name: "Sommer Capital One",
      amount: 41,
      category: "Debt",
      dueDay: 28,
      type: "expense",
    },
    {
      name: "Capital One •2690",
      amount: 357,
      category: "Debt",
      dueDay: 7,
      type: "expense",
    },
    {
      name: "Capital One •1281",
      amount: 474,
      category: "Debt",
      dueDay: 28,
      type: "expense",
    },
    {
      name: "Lowe’s Pro",
      amount: 30,
      category: "Debt",
      dueDay: 28,
      type: "expense",
    },
    {
      name: "Amazon",
      amount: 73,
      category: "Debt",
      dueDay: 28,
      type: "expense",
    },
    {
      name: "Costco",
      amount: 432.24,
      category: "Debt",
      dueDay: 1,
      type: "expense",
    },
    {
      name: "Children Bible Ministry",
      amount: 25.95,
      category: "Giving",
      dueDay: 1,
      type: "expense",
    },
    {
      name: "eXp Realty",
      amount: 92.86,
      category: "Personal",
      dueDay: 1,
      type: "expense",
    },
    {
      name: "Life360",
      amount: 16.23,
      category: "Personal",
      dueDay: 1,
      type: "expense",
    },
    {
      name: "Logos Online",
      amount: 153.75,
      category: "Personal",
      dueDay: 1,
      type: "expense",
    },
    {
      name: "Banner Life",
      amount: 46.44,
      category: "Insurance",
      dueDay: 1,
      type: "expense",
    },
    {
      name: "TruStage",
      amount: 3.75,
      category: "Insurance",
      dueDay: 1,
      type: "expense",
    },
    {
      name: "Point Broadband",
      amount: 140.92,
      category: "Utilities",
      dueDay: 1,
      type: "expense",
    },
    {
      name: "Bunch Hollow",
      amount: 350,
      category: "Housing",
      dueDay: 1,
      type: "expense",
    },
    {
      name: "Huntington RV",
      amount: 306.92,
      category: "Debt",
      dueDay: 15,
      type: "expense",
    },
    {
      name: "RV Electric · PVEC",
      amount: 50,
      category: "Utilities",
      dueDay: 1,
      type: "expense",
    },
    {
      name: "Palisade",
      amount: 878.36,
      category: "Debt",
      dueDay: 22,
      type: "expense",
    },
    {
      name: "Verizon",
      amount: 194.53,
      category: "Utilities",
      dueDay: 1,
      type: "expense",
    },
    {
      name: "State Farm",
      amount: 414,
      category: "Insurance",
      dueDay: 1,
      type: "expense",
    },
    {
      name: "OURFSB pay",
      amount: 300,
      category: "Other",
      dueDay: 15,
      type: "income",
    },
    {
      name: "AA pay",
      amount: 6809.92,
      category: "Other",
      dueDay: 15,
      type: "income",
    },
    {
      name: "Enrichment pay",
      amount: 1557.05,
      category: "Other",
      dueDay: 15,
      type: "income",
    },
  ]);
  await db
    .insert(budgets)
    .values([
      { month: "2026-09", category: "Housing", amount: 2310 },
      { month: "2026-09", category: "Utilities", amount: 845.45 },
      { month: "2026-09", category: "Insurance", amount: 464.19 },
      { month: "2026-09", category: "Debt", amount: 2592.52 },
      { month: "2026-09", category: "Giving", amount: 25.95 },
      { month: "2026-09", category: "Personal", amount: 262.84 },
    ])
    .onConflictDoNothing();
  await db
    .insert(appMeta)
    .values({ key: "2026-workbook-import", value: "2026-09-09" });
}

async function refreshSeptemberWorkbook() {
  const db = getDb(),
    key = "workbook-2026-09-01-exact-v1";
  if ((await db.select().from(appMeta).where(eq(appMeta.key, key))).length)
    return;
  await db.delete(recurring);
  await db.delete(budgets);
  await db.delete(debts);
  await db.delete(accounts);
  await db.insert(debts).values([
    {
      name: "Sommer - CAPTIAL ONE",
      kind: "Credit card",
      balance: 1450,
      apr: 25.49,
      dueDay: 28,
      minPayment: 41,
      sourceUpdated: "2026-09-01",
    },
    {
      name: "Heath - CAPTIAL ONE-2690",
      kind: "Credit card",
      balance: 9973.93,
      apr: 28.99,
      dueDay: 7,
      minPayment: 357,
      sourceUpdated: "2026-09-01",
    },
    {
      name: "heath - CAPTIAL ONE-1281",
      kind: "Credit card",
      balance: 15071.4,
      apr: 24.49,
      dueDay: 28,
      minPayment: 474,
      sourceUpdated: "2026-09-01",
    },
    {
      name: "Heath - Lowes Pro - 4455",
      kind: "Credit card",
      balance: 513,
      apr: 0,
      dueDay: 8,
      minPayment: 30,
      sourceUpdated: "2026-09-01",
    },
    {
      name: "Heath - Amazon",
      kind: "Credit card",
      balance: 2163.28,
      apr: 0,
      dueDay: 24,
      minPayment: 73,
      sourceUpdated: "2026-09-01",
    },
    {
      name: "Heath Costco-4621",
      kind: "Credit card",
      balance: 9451,
      apr: 26.74,
      dueDay: 1,
      minPayment: 432.24,
      sourceUpdated: "2026-09-01",
    },
    {
      name: "tjx",
      kind: "Credit card",
      balance: 216.19,
      apr: 0,
      dueDay: 8,
      minPayment: 27,
      sourceUpdated: "2026-09-01",
    },
    {
      name: "MORTGAGE -53RD",
      kind: "Mortgage",
      balance: 301989.95,
      apr: 3.875,
      dueDay: 1,
      minPayment: 1960,
      sourceUpdated: "2026-09-01",
    },
    {
      name: "OURFSB",
      kind: "Mortgage",
      balance: 40000,
      apr: 8,
      dueDay: 17,
      minPayment: 380,
      sourceUpdated: "2026-09-01",
    },
    {
      name: "PAYMENT-HUNTINGTON",
      kind: "Vehicle",
      balance: 27434.56,
      apr: 5.99,
      dueDay: 15,
      minPayment: 306.92,
      sourceUpdated: "2026-09-01",
    },
    {
      name: "ORNL FCU - PALISADE",
      kind: "Vehicle",
      balance: 57783.6,
      apr: 7.75,
      dueDay: 22,
      minPayment: 878.36,
      sourceUpdated: "2026-09-01",
    },
  ]);
  const refreshRecurring = [
    {
      name: "Sommer - CAPTIAL ONE",
      amount: 41,
      category: "Debt",
      dueDay: 28,
      type: "expense",
    },
    {
      name: "Heath - CAPTIAL ONE-2690",
      amount: 357,
      category: "Debt",
      dueDay: 7,
      type: "expense",
    },
    {
      name: "heath - CAPTIAL ONE-1281",
      amount: 474,
      category: "Debt",
      dueDay: 28,
      type: "expense",
    },
    {
      name: "Heath - Lowes Pro - 4455",
      amount: 30,
      category: "Debt",
      dueDay: 8,
      type: "expense",
    },
    {
      name: "Heath - Amazon",
      amount: 73,
      category: "Debt",
      dueDay: 24,
      type: "expense",
    },
    {
      name: "Heath Costco-4621",
      amount: 432.24,
      category: "Debt",
      dueDay: 1,
      type: "expense",
    },
    {
      name: "home depot",
      amount: 82.45,
      category: "Debt",
      dueDay: 8,
      type: "expense",
    },
    { name: "tjx", amount: 27, category: "Debt", dueDay: 8, type: "expense" },
    {
      name: "MORTGAGE -53RD",
      amount: 1960,
      category: "Housing",
      dueDay: 1,
      type: "expense",
    },
    {
      name: "ELECTRIC-PVEC",
      amount: 380,
      category: "Utilities",
      dueDay: 1,
      type: "expense",
    },
    {
      name: "UTILITIES-CLAIBORNE CNTY",
      amount: 80,
      category: "Utilities",
      dueDay: 1,
      type: "expense",
    },
    {
      name: "children bible ministry",
      amount: 25.95,
      category: "Giving",
      dueDay: 1,
      type: "expense",
    },
    {
      name: "exp reality llc",
      amount: 92.86,
      category: "Personal",
      dueDay: 1,
      type: "expense",
    },
    {
      name: "life 360",
      amount: 16.23,
      category: "Personal",
      dueDay: 1,
      type: "expense",
    },
    {
      name: "LOGOS ONLINE",
      amount: 153.75,
      category: "Personal",
      dueDay: 1,
      type: "expense",
    },
    {
      name: "BANNER LIFE",
      amount: 46.44,
      category: "Insurance",
      dueDay: 1,
      type: "expense",
    },
    {
      name: "TRU STAGE",
      amount: 3.75,
      category: "Insurance",
      dueDay: 1,
      type: "expense",
    },
    {
      name: "POINT BROADBAND",
      amount: 140.92,
      category: "Utilities",
      dueDay: 1,
      type: "expense",
    },
    {
      name: "BUNCH HOLLOW",
      amount: 350,
      category: "Housing",
      dueDay: 1,
      type: "expense",
    },
    {
      name: "PAYMENT-HUNTINGTON",
      amount: 306.92,
      category: "Debt",
      dueDay: 15,
      type: "expense",
    },
    {
      name: "PVEC",
      amount: 50,
      category: "Utilities",
      dueDay: 1,
      type: "expense",
    },
    {
      name: "ORNL FCU - PALISADE",
      amount: 878.36,
      category: "Debt",
      dueDay: 22,
      type: "expense",
    },
    {
      name: "Verizon",
      amount: 194.53,
      category: "Utilities",
      dueDay: 1,
      type: "expense",
    },
    {
      name: "StateFarm",
      amount: 414,
      category: "Insurance",
      dueDay: 1,
      type: "expense",
    },
    {
      name: "OURFSB pay",
      amount: 300,
      category: "Other",
      dueDay: 15,
      type: "income",
    },
    {
      name: "AA CHECK pay",
      amount: 6800,
      category: "Other",
      dueDay: 15,
      type: "income",
    },
    {
      name: "ENRICHMENT pay",
      amount: 3368.82,
      category: "Other",
      dueDay: 15,
      type: "income",
    },
  ];
  for (let i = 0; i < refreshRecurring.length; i += 10)
    await db.insert(recurring).values(refreshRecurring.slice(i, i + 10));
  await db.insert(budgets).values([
    { month: "2026-09", category: "Debt", amount: 2701.97 },
    { month: "2026-09", category: "Housing", amount: 2310 },
    { month: "2026-09", category: "Utilities", amount: 845.45 },
    { month: "2026-09", category: "Giving", amount: 25.95 },
    { month: "2026-09", category: "Personal", amount: 262.84 },
    { month: "2026-09", category: "Insurance", amount: 464.19 },
  ]);
  await db.insert(accounts).values([
    {
      name: "AA CHECK",
      checking: 2099,
      savings: 0,
      snapshotDate: "2026-09-01",
    },
    {
      name: "ENRICHMENT",
      checking: 2175,
      savings: 0,
      snapshotDate: "2026-09-01",
    },
  ]);
  for (const [metaKey, value] of [
    [key, "complete"],
    ["last-workbook-import", "2026-09-01T12:00:00.000Z"],
    ["last-workbook-name", "2026.xlsx"],
    ["last-workbook-sheet", "2026-09-01"],
  ])
    await db
      .insert(appMeta)
      .values({ key: metaKey, value })
      .onConflictDoUpdate({ target: appMeta.key, set: { value } });
}

async function correctPaySchedule() {
  const db = getDb(),
    key = "correct-biweekly-pay-v2";
  if ((await db.select().from(appMeta).where(eq(appMeta.key, key))).length)
    return;
  await db.delete(recurring).where(eq(recurring.type, "income"));
  await db.insert(appMeta).values({ key, value: "2026-09-17" });
}

async function correctEducationCategory() {
  const db = getDb(),
    key = "logos-education-v1";
  if ((await db.select().from(appMeta).where(eq(appMeta.key, key))).length)
    return;
  const recurringRows = await db.select().from(recurring),
    transactionRows = await db.select().from(transactions);
  for (const row of recurringRows)
    if (row.name.toLowerCase().includes("logos"))
      await db
        .update(recurring)
        .set({ category: "Education" })
        .where(eq(recurring.id, row.id));
  for (const row of transactionRows)
    if (row.description.toLowerCase().includes("logos"))
      await db
        .update(transactions)
        .set({ category: "Education" })
        .where(eq(transactions.id, row.id));
  await db.insert(appMeta).values({ key, value: "complete" });
}

export async function GET(req: Request) {
  if (!(await isBudgetSessionValid(req.headers.get("cookie") || ""))) return unauthorized();
  try {
    await seedWorkbook();
    await refreshSeptemberWorkbook();
    await correctPaySchedule();
    await correctEducationCategory();
    const db = getDb();
    const [t, b, r, g, d, a, p, m] = await Promise.all([
      db
        .select()
        .from(transactions)
        .orderBy(desc(transactions.date), desc(transactions.id))
        .limit(2000),
      db.select().from(budgets).orderBy(desc(budgets.month)),
      db.select().from(recurring).orderBy(asc(recurring.dueDay)),
      db.select().from(goals),
      db.select().from(debts).orderBy(desc(debts.balance)),
      db.select().from(accounts),
      db.select().from(billPayments),
      db.select().from(appMeta),
    ]);
    const meta = Object.fromEntries(m.map((x) => [x.key, x.value]));
    const rawPaySchedules = JSON.parse(
      meta["pay-schedules"] || JSON.stringify(defaultPaySchedules),
      ),
      paySchedules = rawPaySchedules.map(
        (schedule: Record<string, unknown>) => ({
          ...schedule,
          purpose:
            schedule.purpose ||
            (String(schedule.name).toLowerCase().includes("enrichment")
              ? "Everyday expenses"
              : "Bills"),
          destinationAccountId:
            Number(schedule.destinationAccountId) ||
            (String(schedule.name).toLowerCase().includes("american airlines")
              ? a.find((account) => account.name.toLowerCase().includes("aa"))?.id
              : undefined) ||
            a.find((account) =>
              String(schedule.name)
                .toLowerCase()
                .includes(account.name.toLowerCase().split(" ")[0]),
            )?.id ||
            0,
        }),
      ),
      customCategories = JSON.parse(
        meta["custom-categories"] || JSON.stringify(defaultCustomCategories),
      ),
      accountRules = JSON.parse(meta["account-rules"] || "[]");
    return Response.json({
      transactions: t,
      budgets: b,
      recurring: r,
      goals: g,
      debts: d,
      accounts: a,
      billPayments: p,
      paySchedules,
      customCategories,
      accountRules,
      paycheckAllocations: JSON.parse(meta["paycheck-allocations"] || "[]"),
      workbookUpdated: meta["last-workbook-import"] || "2026-09-09",
      workbookName: meta["last-workbook-name"] || "2026.xlsx",
      workbookSheet: meta["last-workbook-sheet"] || "2026-09-01",
      financeSyncUpdated: meta["last-finance-sync"] || "",
      financeSyncAsOf: meta["last-finance-sync-as-of"] || "",
      financeSyncAccounts: Number(meta["last-finance-sync-accounts"] || 0),
      financeSyncTransactions: Number(meta["last-finance-sync-transactions"] || 0),
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Load failed" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  if (!(await isBudgetSessionValid(req.headers.get("cookie") || ""))) return unauthorized();
  try {
    const x = (await req.json()) as Record<string, unknown>,
      db = getDb(),
      action = String(x.action || "");
    if (action === "income-schedule") {
      const current = await db
          .select()
          .from(appMeta)
          .where(eq(appMeta.key, "pay-schedules")),
        schedules = current.length
          ? JSON.parse(current[0].value)
          : defaultPaySchedules,
        id = String(x.id || crypto.randomUUID()),
        item = {
          id,
          name: String(x.name),
          amount: num(x.amount),
          anchorDate: String(x.anchorDate),
          intervalDays: Math.max(1, Number(x.intervalDays) || 14),
          purpose: String(x.purpose || "Mixed"),
          destinationAccountId: Number(x.destinationAccountId) || 0,
        },
        next = schedules.some((p: { id: string }) => p.id === id)
          ? schedules.map((p: { id: string }) => (p.id === id ? item : p))
          : [...schedules, item];
      await db
        .insert(appMeta)
        .values({ key: "pay-schedules", value: JSON.stringify(next) })
        .onConflictDoUpdate({
          target: appMeta.key,
          set: { value: JSON.stringify(next) },
        });
    } else if (action === "paycheck-allocation") {
      const current = await db
          .select()
          .from(appMeta)
          .where(eq(appMeta.key, "paycheck-allocations")),
        allocations = current.length ? JSON.parse(current[0].value) : [],
        id = String(x.id || `${x.scheduleId}-${x.paycheckDate}`),
        total = Math.max(0, num(x.total)),
        currentMonthAmount = Math.max(0, Math.min(total, num(x.currentMonthAmount))),
        item = {
          id,
          scheduleId: String(x.scheduleId),
          paycheckDate: String(x.paycheckDate),
          total,
          currentMonth: String(x.currentMonth),
          currentMonthAmount,
          nextMonth: String(x.nextMonth),
          nextMonthAmount: Math.max(0, total - currentMonthAmount),
          note: String(x.note || ""),
        },
        next = allocations.some((row: { id: string }) => row.id === id)
          ? allocations.map((row: { id: string }) => (row.id === id ? item : row))
          : [...allocations, item];
      await db
        .insert(appMeta)
        .values({ key: "paycheck-allocations", value: JSON.stringify(next) })
        .onConflictDoUpdate({
          target: appMeta.key,
          set: { value: JSON.stringify(next) },
        });
    } else if (action === "account-rule") {
      const current = await db
          .select()
          .from(appMeta)
          .where(eq(appMeta.key, "account-rules")),
        rules = current.length ? JSON.parse(current[0].value) : [],
        accountId = Number(x.accountId),
        rule = {
          accountId,
          role: String(x.role || "Mixed"),
          categories: Array.isArray(x.categories)
            ? x.categories.map(String)
            : [],
        },
        next = rules.some(
          (item: { accountId: number }) => item.accountId === accountId,
        )
          ? rules.map((item: { accountId: number }) =>
              item.accountId === accountId ? rule : item,
            )
          : [...rules, rule];
      await db
        .insert(appMeta)
        .values({ key: "account-rules", value: JSON.stringify(next) })
        .onConflictDoUpdate({
          target: appMeta.key,
          set: { value: JSON.stringify(next) },
        });
    } else if (action === "category-add") {
      const current = await db
          .select()
          .from(appMeta)
          .where(eq(appMeta.key, "custom-categories")),
        categories = current.length
          ? JSON.parse(current[0].value)
          : defaultCustomCategories,
        name = String(x.category || x.name || "").trim(),
        next = name
          ? [...new Set([...categories, name])].sort()
          : categories;
      await db
        .insert(appMeta)
        .values({ key: "custom-categories", value: JSON.stringify(next) })
        .onConflictDoUpdate({
          target: appMeta.key,
          set: { value: JSON.stringify(next) },
        });
    } else if (action === "category-delete") {
      const current = await db
          .select()
          .from(appMeta)
          .where(eq(appMeta.key, "custom-categories")),
        categories = current.length
          ? JSON.parse(current[0].value)
          : defaultCustomCategories,
        next = categories.filter(
          (category: string) =>
            category !== String(x.category || x.name),
        );
      await db
        .insert(appMeta)
        .values({ key: "custom-categories", value: JSON.stringify(next) })
        .onConflictDoUpdate({
          target: appMeta.key,
          set: { value: JSON.stringify(next) },
        });
    } else if (action === "income-schedule-delete") {
      const current = await db
          .select()
          .from(appMeta)
          .where(eq(appMeta.key, "pay-schedules")),
        schedules = current.length
          ? JSON.parse(current[0].value)
          : defaultPaySchedules,
        next = schedules.filter(
          (p: { id: string }) => p.id !== String(x.id),
        );
      await db
        .insert(appMeta)
        .values({ key: "pay-schedules", value: JSON.stringify(next) })
        .onConflictDoUpdate({
          target: appMeta.key,
          set: { value: JSON.stringify(next) },
        });
    } else if (action === "transaction") {
      const amount = Math.abs(Number(x.amount)),
        account = String(x.account || "Checking");
      await db
        .insert(transactions)
        .values({
          date: String(x.date),
          description: String(x.description),
          category: String(x.category || "Other"),
          amount,
          type: transactionType(x.type, x.description),
          account,
          fingerprint: fp(
            String(x.date),
            String(x.description),
            amount,
            account,
          ),
        })
        .onConflictDoNothing();
    } else if (action === "transaction-update") {
      const amount = Math.abs(Number(x.amount)),
        account = String(x.account || "Checking");
      await db
        .update(transactions)
        .set({
          date: String(x.date),
          description: String(x.description),
          category: String(x.category || "Other"),
          amount,
          type: transactionType(x.type, x.description),
          account,
          fingerprint: fp(
            String(x.date),
            String(x.description),
            amount,
            account,
          ),
        })
        .where(eq(transactions.id, Number(x.id)));
    } else if (action === "budget") {
      await db
        .insert(budgets)
        .values({
          month: String(x.month),
          category: String(x.category),
          amount: num(x.amount),
        })
        .onConflictDoUpdate({
          target: [budgets.month, budgets.category],
          set: { amount: num(x.amount) },
        });
    } else if (action === "recurring") {
      await db
        .insert(recurring)
        .values({
          name: String(x.name),
          amount: Math.abs(Number(x.amount)),
          category: String(x.category || "Other"),
          dueDay: Math.max(1, Math.min(31, Number(x.dueDay))),
          type: x.type === "income" ? "income" : "expense",
        });
    } else if (action === "recurring-category") {
      await db
        .update(recurring)
        .set({ category: String(x.category || "Other") })
        .where(eq(recurring.id, Number(x.id)));
    } else if (action === "recurring-update") {
      await db
        .update(recurring)
        .set({
          name: String(x.name),
          amount: Math.abs(Number(x.amount)),
          category: String(x.category || "Other"),
          dueDay: Math.max(1, Math.min(31, Number(x.dueDay) || 1)),
          type: x.type === "income" ? "income" : "expense",
        })
        .where(eq(recurring.id, Number(x.id)));
    } else if (action === "bill-month-init") {
      const rows = await db
        .select()
        .from(recurring)
        .where(and(eq(recurring.active, true), eq(recurring.type, "expense")));
      for (const row of rows)
        await db
          .insert(billPayments)
          .values({
            month: String(x.month),
            recurringId: row.id,
            paid: false,
            paidDate: "",
            actualAmount: 0,
          })
          .onConflictDoNothing();
    } else if (action === "bill-payment") {
      await db
        .insert(billPayments)
        .values({
          month: String(x.month),
          recurringId: Number(x.recurringId),
          paid: Boolean(x.paid),
          paidDate: String(x.paidDate || ""),
          actualAmount: num(x.actualAmount),
        })
        .onConflictDoUpdate({
          target: [billPayments.month, billPayments.recurringId],
          set: {
            paid: Boolean(x.paid),
            paidDate: String(x.paidDate || ""),
            actualAmount: num(x.actualAmount),
          },
        });
    } else if (action === "bill-payments-sync") {
      const entries = Array.isArray(x.entries)
        ? (x.entries as Array<Record<string, unknown>>).slice(0, 100)
        : [];
      for (const entry of entries)
        await db
          .insert(billPayments)
          .values({
            month: String(entry.month),
            recurringId: Number(entry.recurringId),
            paid: true,
            paidDate: String(entry.paidDate || ""),
            actualAmount: num(entry.actualAmount),
          })
          .onConflictDoUpdate({
            target: [billPayments.month, billPayments.recurringId],
            set: {
              paid: true,
              paidDate: String(entry.paidDate || ""),
              actualAmount: num(entry.actualAmount),
            },
          });
    } else if (action === "account-balance") {
      await db
        .update(accounts)
        .set({
          checking: num(x.checking),
          savings: num(x.savings),
          snapshotDate: new Date().toISOString().slice(0, 10),
        })
        .where(eq(accounts.id, Number(x.id)));
    } else if (action === "goal") {
      await db
        .insert(goals)
        .values({
          name: String(x.name),
          target: Math.abs(Number(x.target)),
          saved: num(x.saved),
          targetDate: String(x.targetDate || ""),
        });
    } else if (action === "goal-progress") {
      await db
        .update(goals)
        .set({ saved: num(x.saved) })
        .where(eq(goals.id, Number(x.id)));
    } else if (action === "debt") {
      await db
        .insert(debts)
        .values({
          name: String(x.name),
          kind: String(x.kind || "Other"),
          balance: num(x.balance),
          apr: num(x.apr),
          dueDay: Math.max(1, Math.min(31, Number(x.dueDay) || 1)),
          minPayment: num(x.minPayment),
          sourceUpdated: "Manual",
        });
    } else if (action === "debt-update") {
      await db
        .update(debts)
        .set({
          name: String(x.name),
          kind: String(x.kind || "Other"),
          balance: num(x.balance),
          apr: num(x.apr),
          dueDay: Math.max(1, Math.min(31, Number(x.dueDay) || 1)),
          minPayment: num(x.minPayment),
          sourceUpdated: "Manual edit",
        })
        .where(eq(debts.id, Number(x.id)));
    } else if (action === "workbook-import") {
      const newDebts = (x.debts || []) as Array<{
        name: string;
        kind: string;
        balance: number;
        apr: number;
        dueDay: number;
        minPayment: number;
        sourceUpdated: string;
      }>;
      const newRecurring = (
        (x.recurring || []) as Array<{
          name: string;
          amount: number;
          category: string;
          dueDay: number;
          type: string;
        }>
      ).filter((row) => row.type !== "income");
      const newBudgets = (x.budgets || []) as Array<{
        month: string;
        category: string;
        amount: number;
      }>;
      const newAccounts = (x.accounts || []) as Array<{
        name: string;
        checking: number;
        savings: number;
        snapshotDate: string;
      }>;
      if (!newRecurring.length || !newBudgets.length)
        throw new Error("No usable budget rows were found in that worksheet.");
      await db.delete(billPayments);
      await db.delete(recurring);
      await db.delete(budgets);
      await db.delete(debts);
      await db.delete(accounts);
      if (newDebts.length) await db.insert(debts).values(newDebts);
      for (let i = 0; i < newRecurring.length; i += 10)
        await db.insert(recurring).values(newRecurring.slice(i, i + 10));
      for (let i = 0; i < newBudgets.length; i += 10)
        await db.insert(budgets).values(newBudgets.slice(i, i + 10));
      if (newAccounts.length) await db.insert(accounts).values(newAccounts);
      const stamp = new Date().toISOString();
      for (const [key, value] of [
        ["last-workbook-import", stamp],
        ["last-workbook-name", String(x.fileName || "Budget workbook")],
        ["last-workbook-sheet", String(x.sheet || "")],
      ])
        await db
          .insert(appMeta)
          .values({ key, value })
          .onConflictDoUpdate({ target: appMeta.key, set: { value } });
      return Response.json({
        ok: true,
        debts: newDebts.length,
        recurring: newRecurring.length,
        budgets: newBudgets.length,
        sheet: x.sheet,
      });
    } else if (action === "import") {
      let added = 0;
      for (const row of (
        (x.rows || []) as Array<Record<string, unknown>>
      ).slice(0, 2500)) {
        const amount = Math.abs(Number(row.amount)),
          account = String(row.account || "Imported");
        if (!row.date || !row.description || !amount) continue;
        const q = await db
          .insert(transactions)
          .values({
            date: String(row.date),
            description: String(row.description),
            category: String(row.category || "Other"),
            amount,
            type: transactionType(row.type, row.description),
            account,
            fingerprint: fp(
              String(row.date),
              String(row.description),
              amount,
              account,
            ),
          })
          .onConflictDoNothing();
        if ((q.meta?.changes || 0) > 0) added++;
      }
      return Response.json({ ok: true, added });
    } else if (action === "rollover") {
      const rows = await db
        .select()
        .from(budgets)
        .where(eq(budgets.month, String(x.from)));
      for (const row of rows)
        await db
          .insert(budgets)
          .values({
            month: String(x.to),
            category: row.category,
            amount: row.amount,
          })
          .onConflictDoNothing();
    } else if (action === "post-recurring") {
      const rows = await db
          .select()
          .from(recurring)
          .where(eq(recurring.active, true)),
        month = String(x.month);
      for (const row of rows) {
        const last = new Date(
            +month.slice(0, 4),
            +month.slice(5, 7),
            0,
          ).getDate(),
          date = `${month}-${String(Math.min(last, row.dueDay)).padStart(2, "0")}`;
        await db
          .insert(transactions)
          .values({
            date,
            description: row.name,
            category: row.category,
            amount: row.amount,
            type: row.type,
            account: "Recurring",
            fingerprint: fp(date, row.name, row.amount, "Recurring"),
          })
          .onConflictDoNothing();
      }
      const storedSchedules = await db
          .select()
          .from(appMeta)
          .where(eq(appMeta.key, "pay-schedules")),
        schedules = storedSchedules.length
          ? JSON.parse(storedSchedules[0].value)
          : defaultPaySchedules;
      for (const schedule of schedules)
        for (const date of payDates(
          month,
          schedule.anchorDate,
          schedule.intervalDays,
        ))
          await db
            .insert(transactions)
            .values({
              date,
              description: `${schedule.name} paycheck`,
              category: "Other",
              amount: schedule.amount,
              type: "income",
              account: "Pay schedule",
              fingerprint: fp(
                date,
                `${schedule.name} paycheck`,
                schedule.amount,
                "Pay schedule",
              ),
            })
            .onConflictDoNothing();
    }
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Save failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  if (!(await isBudgetSessionValid(req.headers.get("cookie") || ""))) return unauthorized();
  const u = new URL(req.url),
    id = Number(u.searchParams.get("id")),
    type = u.searchParams.get("type"),
    db = getDb();
  if (type === "transaction")
    await db.delete(transactions).where(eq(transactions.id, id));
  if (type === "recurring") {
    await db.delete(billPayments).where(eq(billPayments.recurringId, id));
    await db.delete(recurring).where(eq(recurring.id, id));
  }
  if (type === "goal") await db.delete(goals).where(eq(goals.id, id));
  if (type === "debt") await db.delete(debts).where(eq(debts.id, id));
  if (type === "budget")
    await db
      .delete(budgets)
      .where(
        and(
          eq(budgets.month, u.searchParams.get("month") || ""),
          eq(budgets.category, u.searchParams.get("category") || ""),
        ),
      );
  return Response.json({ ok: true });
}
