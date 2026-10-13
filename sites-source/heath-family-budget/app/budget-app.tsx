"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Download,
  FileUp,
  Landmark,
  LayoutDashboard,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Repeat2,
  PiggyBank,
  ShieldCheck,
  Target,
  Trash2,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Progress } from "../components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { toast, Toaster } from "sonner";
type Tx = {
  id: number;
  date: string;
  description: string;
  category: string;
  amount: number;
  type: string;
  account: string;
};
type B = { id: number; month: string; category: string; amount: number };
type R = {
  id: number;
  name: string;
  amount: number;
  category: string;
  dueDay: number;
  type: string;
  active: boolean;
};
type G = {
  id: number;
  name: string;
  target: number;
  saved: number;
  targetDate: string;
};
type D = {
  id: number;
  name: string;
  kind: string;
  balance: number;
  apr: number;
  dueDay: number;
  minPayment: number;
  sourceUpdated: string;
};
type A = {
  id: number;
  name: string;
  checking: number;
  savings: number;
  snapshotDate: string;
};
type BP = {
  id: number;
  month: string;
  recurringId: number;
  paid: boolean;
  paidDate: string;
  actualAmount: number;
};
type P = {
  id: string;
  name: string;
  amount: number;
  anchorDate: string;
  intervalDays: number;
  purpose: string;
  destinationAccountId: number;
};
type AccountRule = {
  accountId: number;
  role: string;
  categories: string[];
};
type PaycheckAllocation = {
  id: string;
  scheduleId: string;
  paycheckDate: string;
  total: number;
  currentMonth: string;
  currentMonthAmount: number;
  nextMonth: string;
  nextMonthAmount: number;
  note?: string;
};
type Data = {
  transactions: Tx[];
  budgets: B[];
  recurring: R[];
  goals: G[];
  debts: D[];
  accounts: A[];
  billPayments: BP[];
  paySchedules: P[];
  customCategories: string[];
  accountRules: AccountRule[];
  paycheckAllocations: PaycheckAllocation[];
  workbookUpdated?: string;
  workbookName?: string;
  workbookSheet?: string;
  financeSyncUpdated?: string;
  financeSyncAsOf?: string;
  financeSyncAccounts?: number;
  financeSyncTransactions?: number;
};
const cats = [
    "Housing",
    "Utilities",
    "Groceries",
    "Dining",
    "Transportation",
    "Gas",
    "Insurance",
    "Medical",
    "Giving",
    "Debt",
    "Shopping",
    "Entertainment",
    "Personal",
    "Pets",
    "Education",
    "Savings",
    "Other",
  ],
  colors = [
    "#24544c",
    "#d58b48",
    "#658397",
    "#80779a",
    "#b06d73",
    "#6c8f7d",
    "#bd9f5c",
    "#5f6d52",
  ],
  usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const now = () => new Date().toISOString().slice(0, 7),
  label = (m: string) =>
    new Date(m + "-02T12:00:00").toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    }),
  shift = (m: string, n: number) => {
    const d = new Date(m + "-15T12:00:00");
    d.setMonth(d.getMonth() + n);
    return d.toISOString().slice(0, 7);
  };
const datesFor = (month: string, p: P) => {
  const [year, mon] = month.split("-").map(Number),
    start = Date.UTC(year, mon - 1, 1),
    end = Date.UTC(year, mon, 0),
    anchor = Date.parse(p.anchorDate + "T12:00:00Z"),
    step = p.intervalDays * 86400000,
    first = Math.ceil((start - anchor) / step),
    last = Math.floor((end - anchor) / step),
    dates: string[] = [];
  for (let i = first; i <= last; i++)
    dates.push(new Date(anchor + i * step).toISOString().slice(0, 10));
  return dates;
};
const isTransferTx = (transaction: Tx) =>
  transaction.type === "transfer" ||
  transaction.category.toLowerCase() === "transfer" ||
  /\b(transfer|xfer|internal transfer)\b|\bto (checking|savings)\b|\bfrom (checking|savings)\b/i.test(
    transaction.description,
  );
const matchWords = (value: string) =>
  value
    .toLowerCase()
    .replace(/\b(payment|autopay|online|debit|credit|bill|withdrawal|purchase|pos)\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
type BillInstance = { bill: R; month: string; due: string; manualPaid: boolean };
type BillMatch = { transaction: Tx; confidence: "strong" | "likely" };
const reconcileBills = (instances: BillInstance[], transactions: Tx[]) => {
  const dueTimes = instances.map((instance) => Date.parse(instance.due + "T12:00:00")),
    earliest = Math.min(...dueTimes) - 45 * 86400000,
    latest = Math.max(...dueTimes) + 40 * 86400000,
    used = new Set<number>(),
    matches = new Map<string, BillMatch>(),
    candidates = transactions.filter(
      (transaction) =>
        transaction.type === "expense" &&
        !isTransferTx(transaction) &&
        transaction.account.toLowerCase() !== "recurring" &&
        Date.parse(transaction.date + "T12:00:00") >= earliest &&
        Date.parse(transaction.date + "T12:00:00") <= latest,
    );
  [...instances]
    .filter((instance) => !instance.manualPaid)
    .sort((a, b) => a.due.localeCompare(b.due))
    .forEach((instance) => {
      const words = matchWords(instance.bill.name),
        dueTime = Date.parse(instance.due + "T12:00:00"),
        ranked = candidates
          .filter((transaction) => !used.has(transaction.id))
          .map((transaction) => {
            const descriptionWords = matchWords(transaction.description),
              shared = words.filter((word) => descriptionWords.includes(word)).length,
              nameScore = words.length ? shared / words.length : 0,
              amountGap = Math.abs(transaction.amount - instance.bill.amount),
              amountScore = amountGap <= 0.01 ? 1 : amountGap <= Math.max(5, instance.bill.amount * 0.1) ? 0.65 : 0,
              days = Math.abs(Date.parse(transaction.date + "T12:00:00") - dueTime) / 86400000,
              dateScore = days <= 7 ? 1 : days <= 21 ? 0.6 : days <= 40 ? 0.25 : 0,
              score = nameScore * 0.55 + amountScore * 0.3 + dateScore * 0.15;
            return { transaction, score, nameScore, amountScore };
          })
          .filter(
            (candidate) =>
              candidate.score >= 0.48 &&
              (candidate.nameScore >= 0.34 || candidate.amountScore === 1),
          )
          .sort((a, b) => b.score - a.score);
      const best = ranked[0];
      if (!best) return;
      used.add(best.transaction.id);
      matches.set(`${instance.month}-${instance.bill.id}`, {
        transaction: best.transaction,
        confidence: best.score >= 0.72 ? "strong" : "likely",
      });
    });
  return matches;
};
const auto = (v: string) => {
  v = v.toLowerCase();
  for (const [keys, c] of [
    [["kroger", "walmart", "food city", "aldi", "publix"], "Groceries"],
    [["shell", "exxon", "marathon", "pilot", "chevron"], "Transportation"],
    [["amazon", "target", "etsy"], "Shopping"],
    [["restaurant", "cafe", "coffee", "pizza", "doordash"], "Dining"],
    [["electric", "water", "internet", "verizon", "at&t"], "Utilities"],
    [["insurance"], "Insurance"],
    [["church", "tithe", "mission"], "Giving"],
    [["vet", "pet", "chewy"], "Pets"],
  ] as [string[], string][])
    if (keys.some((k) => v.includes(k))) return c;
  return "Other";
};
function csv(text: string) {
  const rows = text.replace(/\r/g, "").split("\n").filter(Boolean),
    split = (s: string) => {
      let a: string[] = [],
        v = "",
        q = false;
      for (let i = 0; i < s.length; i++) {
        if (s[i] == '"') q = !q;
        else if (s[i] == "," && !q) {
          a.push(v.trim());
          v = "";
        } else v += s[i];
      }
      a.push(v.trim());
      return a;
    },
    h = split(rows[0]).map((x) => x.toLowerCase().replace(/[^a-z]/g, "")),
    ix = (x: string[]) => h.findIndex((v) => x.includes(v)),
    di = ix(["date", "transactiondate", "posteddate"]),
    ni = ix(["description", "merchant", "memo", "payee", "name"]),
    ai = ix(["amount", "transactionamount"]),
    de = ix(["debit", "withdrawal"]),
    cr = ix(["credit", "deposit"]),
    ci = ix(["category"]),
    ac = ix(["account", "accountname"]),
    ti = ix(["type"]);
  return rows
    .slice(1)
    .map((s) => {
      const v = split(s),
        credit = cr >= 0 ? +(v[cr] || "").replace(/[$,]/g, "") : 0,
        debit = de >= 0 ? +(v[de] || "").replace(/[$,]/g, "") : 0,
        raw = ai >= 0 ? +(v[ai] || "").replace(/[$,()]/g, "") : credit - debit,
        d = new Date(v[di]);
      return {
        date: isNaN(+d) ? v[di] : d.toISOString().slice(0, 10),
        description: v[ni],
        amount: Math.abs(raw),
        type: /\b(transfer|xfer|internal transfer)\b/i.test(v[ni] || "")
          ? "transfer"
          : (v[ti] || "").toLowerCase().includes("income") || credit > 0
            ? "income"
            : "expense",
        category: v[ci] || auto(v[ni] || ""),
        account: v[ac] || "Imported",
      };
    })
    .filter((x) => x.date && x.description && x.amount);
}
function ofx(text: string) {
  const blocks =
    text.match(/<STMTTRN>[\s\S]*?(?=<STMTTRN>|<\/BANKTRANLIST>|$)/gi) || [];
  return blocks
    .map((block) => {
      const get = (tag: string) =>
          block.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, "i"))?.[1]?.trim() ||
          "",
        raw = Number(get("TRNAMT")),
        stamp = get("DTPOSTED").slice(0, 8);
      return {
        date: stamp
          ? `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`
          : "",
        description: get("NAME") || get("MEMO") || "Bank transaction",
        amount: Math.abs(raw),
        type: raw >= 0 ? "income" : "expense",
        category: auto(`${get("NAME")} ${get("MEMO")}`),
        account: "Bank import",
      };
    })
    .filter((x) => x.date && x.amount);
}
const clean = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
async function budgetWorkbook(file: File, current: D[]) {
  const XLSX = await import("xlsx"),
    book = XLSX.read(await file.arrayBuffer(), {
      type: "array",
      cellDates: true,
    }),
    dated = book.SheetNames.filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n)).sort(),
    sheet = book.SheetNames.includes("2026-09-01")
      ? "2026-09-01"
      : dated.at(-1) || book.SheetNames[0],
    ws = book.Sheets[sheet];
  if (!ws) throw Error("No worksheet was found.");
  const value = (address: string) => ws[address]?.v,
    number = (address: string) => Number(value(address)) || 0,
    text = (address: string) => String(value(address) || "").trim(),
    month = sheet.slice(0, 7),
    day = (row: number, fallback = 1) => {
      const match = text(`J${row}`).match(/\d{1,2}\/(\d{1,2})/);
      return match ? Math.min(31, +match[1]) : fallback;
    },
    apr = (name: string) =>
      current.find(
        (d) =>
          clean(d.name).includes(clean(name).slice(0, 12)) ||
          clean(name).includes(clean(d.name).slice(0, 12)),
      )?.apr || 0;
  const debts = [...Array(8)]
    .map((_, i) => i + 3)
    .concat([12, 15, 30, 32])
    .map((row) => {
      const name = text(`C${row}`),
        kind =
          row <= 10
            ? "Credit card"
            : row === 12 || row === 15
              ? "Mortgage"
              : "Vehicle",
        fallback = row === 30 ? 15 : row === 32 ? 22 : row === 15 ? 17 : 1;
      return {
        name,
        kind,
        balance: number(`D${row}`),
        apr: apr(name),
        dueDay: day(row, fallback),
        minPayment: number(`G${row}`) || number(`F${row}`),
        sourceUpdated: sheet,
      };
    })
    .filter((d) => d.name && d.balance > 0);
  const recurring: Array<{
    name: string;
    amount: number;
    category: string;
    dueDay: number;
    type: string;
  }> = [];
  const category = (row: number, name: string) => {
    const type = text(`A${row}`).toLowerCase(),
      lower = name.toLowerCase();
    if (lower.includes("ministry")) return "Giving";
    if (
      lower.includes("exp reality") ||
      lower.includes("life 360") ||
      lower.includes("logos")
    )
      return "Personal";
    if (type.includes("insurance")) return "Insurance";
    if (
      type.includes("internet") ||
      type.includes("electric") ||
      type.includes("cell phone") ||
      lower.includes("electric") ||
      lower.includes("utilities") ||
      lower.includes("verizon") ||
      lower.includes("broadband")
    )
      return "Utilities";
    if (type.includes("home bills") || type.includes("campground"))
      return "Housing";
    if (
      type.includes("credit card") ||
      type.includes("payment") ||
      type === "car" ||
      row <= 10
    )
      return "Debt";
    return auto(name);
  };
  for (let row = 3; row <= 36; row++) {
    const name = text(`C${row}`),
      amount = number(`G${row}`);
    if (name && amount > 0)
      recurring.push({
        name,
        amount,
        category: category(row, name),
        dueDay: day(row, row === 30 ? 15 : row === 32 ? 22 : 1),
        type: "expense",
      });
  }
  const sums = new Map<string, number>();
  recurring
    .filter((r) => r.type === "expense")
    .forEach((r) =>
      sums.set(r.category, (sums.get(r.category) || 0) + r.amount),
    );
  const budgets = [...sums].map(([category, amount]) => ({
      month,
      category,
      amount,
    })),
    accounts = [14, 15]
      .map((row) => ({
        name: text(`N${row}`),
        checking: number(`R${row}`),
        savings: 0,
        snapshotDate: sheet,
      }))
      .filter((a) => a.name && a.checking);
  return {
    action: "workbook-import",
    fileName: file.name,
    sheet,
    debts,
    recurring,
    budgets,
    accounts,
  };
}

export default function App() {
  const [data, setData] = useState<Data>({
      transactions: [],
      budgets: [],
      recurring: [],
      goals: [],
      debts: [],
      accounts: [],
      billPayments: [],
      paySchedules: [],
      customCategories: [],
      accountRules: [],
      paycheckAllocations: [],
    }),
    [month, setMonth] = useState(now()),
    [loading, setLoading] = useState(true),
    [dialog, setDialog] = useState<string | null>(null),
    [tab, setTab] = useState("overview"),
    [txFilter, setTxFilter] = useState("all"),
    [editingTx, setEditingTx] = useState<Tx | null>(null),
    [editingDebt, setEditingDebt] = useState<D | null>(null),
    [editingRecurring, setEditingRecurring] = useState<R | null>(null),
    [debtView, setDebtView] = useState("all"),
    [incomeOpen, setIncomeOpen] = useState(false),
    [incomeEditor, setIncomeEditor] = useState<P | "new" | null>(null),
    [scenarioExpense, setScenarioExpense] = useState(0),
    [scenarioIncome, setScenarioIncome] = useState(0),
    [scenarioDebt, setScenarioDebt] = useState(0),
    [newCategory, setNewCategory] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const load = async () => {
    try {
      const r = await fetch("/api/data"),
        j = await r.json();
      if (!r.ok) throw 0;
      setData(j);
    } catch {
      toast.error("Budget data is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const post = async (x: any) => {
    const r = await fetch("/api/data", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(x),
      }),
      j = await r.json();
    if (!r.ok) throw Error(j.error);
    await load();
    return j;
  };
  const del = async (type: string, id: number) => {
    await fetch(`/api/data?type=${type}&id=${id}`, { method: "DELETE" });
    load();
  };
  const categories = [...new Set([...cats, ...data.customCategories])].sort(),
    tx = data.transactions.filter((x) => x.date.startsWith(month)),
    countedTx = tx.filter((x) => !isTransferTx(x)),
    visibleTx = tx.filter(
      (x) =>
        txFilter === "all" || x.type === txFilter || x.category === txFilter,
    ),
    paymentActivity = tx.filter(
      (x) =>
        x.type === "transfer" ||
        x.category === "Debt" ||
        /\b(payment|autopay|mortgage|loan|credit card|affirm)\b/i.test(
          x.description,
        ),
    ),
    income = countedTx
      .filter((x) => x.type === "income")
      .reduce((s, x) => s + x.amount, 0),
    spent = countedTx
      .filter((x) => x.type === "expense")
      .reduce((s, x) => s + x.amount, 0),
    bs = data.budgets.filter((x) => x.month === month),
    planned = bs.reduce((s, x) => s + x.amount, 0),
    plannedIncome = data.paySchedules.reduce(
      (sum, p) => sum + datesFor(month, p).length * p.amount,
      0,
    ),
    actualIncomeRows = countedTx.filter((x) => x.type === "income"),
    scheduledIncomeRows = actualIncomeRows.filter((transaction) =>
      data.paySchedules.some((schedule) => {
        const scheduleWords = matchWords(schedule.name),
          transactionWords = matchWords(transaction.description);
        return (
          scheduleWords.some((word) => transactionWords.includes(word)) ||
          Math.abs(transaction.amount - schedule.amount) <= 1
        );
      }),
    ),
    scheduledIncomeActual = scheduledIncomeRows.reduce(
      (sum, row) => sum + row.amount,
      0,
    ),
    oneTimeIncomeRows = actualIncomeRows.filter(
      (row) => !scheduledIncomeRows.some((scheduled) => scheduled.id === row.id),
    ),
    oneTimeIncome = oneTimeIncomeRows.reduce((sum, row) => sum + row.amount, 0),
    plannedBills = data.recurring
      .filter((x) => x.type === "expense")
      .reduce((s, x) => s + x.amount, 0),
    totalDebt = data.debts.reduce((s, x) => s + x.balance, 0),
    minimums = data.debts.reduce((s, x) => s + x.minPayment, 0),
    paydays = data.paySchedules
      .flatMap((p) => datesFor(month, p).map((date) => ({ ...p, date })))
      .sort((a, b) => a.date.localeCompare(b.date)),
    paydayGroups = [...new Set(paydays.map((p) => p.date))].map((date) => {
      const deposits = paydays.filter((p) => p.date === date);
      return {
        date,
        deposits,
        total: deposits.reduce((sum, p) => sum + p.amount, 0),
      };
    }),
    byCat = categories
      .map((category, i) => ({
        category,
        budget: bs.find((b) => b.category === category)?.amount || 0,
        spent: countedTx
          .filter((t) => t.type === "expense" && t.category === category)
          .reduce((s, t) => s + t.amount, 0),
        fill: colors[i % colors.length],
      }))
      .filter((x) => x.budget || x.spent);
  const cashOnHand = data.accounts.reduce(
      (sum, account) => sum + account.checking + account.savings,
      0,
    ),
    selectedPayments = data.billPayments.filter((p) => p.month === month),
    expenseBills = data.recurring.filter((r) => r.type === "expense"),
    dashboardInstances: BillInstance[] = [
      ...data.billPayments
        .filter((p) => p.month < month && !p.paid)
        .map((p) => {
          const bill = expenseBills.find((r) => r.id === p.recurringId);
          if (!bill) return null;
          const last = new Date(+p.month.slice(0, 4), +p.month.slice(5, 7), 0).getDate();
          return {
            bill,
            month: p.month,
            due: `${p.month}-${String(Math.min(last, bill.dueDay)).padStart(2, "0")}`,
            manualPaid: false,
          };
        })
        .filter((item): item is BillInstance => Boolean(item)),
      ...expenseBills.map((bill) => {
        const last = new Date(+month.slice(0, 4), +month.slice(5, 7), 0).getDate(),
          record = selectedPayments.find((p) => p.recurringId === bill.id);
        return {
          bill,
          month,
          due: `${month}-${String(Math.min(last, bill.dueDay)).padStart(2, "0")}`,
          manualPaid: Boolean(record?.paid),
        };
      }),
    ],
    dashboardMatches = reconcileBills(dashboardInstances, data.transactions),
    unmatchedPriorInstances = dashboardInstances.filter(
      (instance) =>
        instance.month < month &&
        !dashboardMatches.has(`${instance.month}-${instance.bill.id}`),
    ),
    priorUnpaidTotal = unmatchedPriorInstances.reduce(
      (sum, instance) => sum + instance.bill.amount,
      0,
    ),
    unpaidBills = expenseBills
      .filter((r) => !selectedPayments.find((p) => p.recurringId === r.id)?.paid)
      .filter((r) => !dashboardMatches.has(`${month}-${r.id}`)),
    reservedBills =
      priorUnpaidTotal + unpaidBills.reduce((sum, r) => sum + r.amount, 0),
    protectedNextMonthReserve = data.paycheckAllocations
      .filter((allocation) => allocation.currentMonth === month)
      .reduce((sum, allocation) => sum + allocation.nextMonthAmount, 0),
    today = new Date().toISOString().slice(0, 10),
    asOf = month === today.slice(0, 7) ? today : `${month}-01`,
    upcomingPaydays = paydayGroups.filter((p) => p.date >= asOf),
    nextPayday = upcomingPaydays[0]?.date || "",
    dueBeforeNextPay =
      priorUnpaidTotal +
      unpaidBills
        .filter((r) => {
          const last = new Date(
              +month.slice(0, 4),
              +month.slice(5, 7),
              0,
            ).getDate(),
            due = `${month}-${String(Math.min(last, r.dueDay)).padStart(2, "0")}`;
          return !nextPayday || due <= nextPayday;
        })
        .reduce((sum, r) => sum + r.amount, 0),
    remainingPay = upcomingPaydays.reduce((sum, p) => sum + p.total, 0),
    safeToSpend = cashOnHand - dueBeforeNextPay - protectedNextMonthReserve,
    projectedMonthEnd =
      cashOnHand + remainingPay - reservedBills - protectedNextMonthReserve,
    savingsTotal = data.accounts.reduce(
      (sum, account) => sum + account.savings,
      0,
    ),
    budgetOverages = byCat.filter((c) => c.budget && c.spent > c.budget),
    overdueBills = unpaidBills.filter(
      (r) =>
        month < today.slice(0, 7) ||
        (month === today.slice(0, 7) && r.dueDay < Number(today.slice(8))),
    ),
    healthScore = Math.max(
      0,
      Math.min(
        100,
        100 -
          overdueBills.length * 10 -
          budgetOverages.length * 7 -
          (safeToSpend < 0 ? 25 : 0) -
          (savingsTotal < plannedBills ? 10 : 0),
      ),
    ),
    actionItems = [
      overdueBills.length
        ? `Pay or update ${overdueBills.length} overdue bill${overdueBills.length === 1 ? "" : "s"}.`
        : "",
      dueBeforeNextPay > 0
        ? `Reserve ${usd.format(dueBeforeNextPay)} for bills due before the next paycheck.`
        : "",
      budgetOverages.length
        ? `${budgetOverages[0].category} is ${usd.format(budgetOverages[0].spent - budgetOverages[0].budget)} over budget.`
        : "",
      savingsTotal < plannedBills
        ? `Build savings toward one month of regular bills (${usd.format(plannedBills)}).`
        : "",
      data.debts.some((d) => d.apr >= 20)
        ? "Direct extra debt money to the highest-APR account."
        : "",
    ].filter(Boolean),
    forecast = [0, 1, 2].map((offset) => {
      const forecastMonth = shift(month, offset),
        income = data.paySchedules.reduce(
          (sum, p) => sum + datesFor(forecastMonth, p).length * p.amount,
          0,
        );
      return {
        month: label(forecastMonth).split(" ")[0],
        income,
        bills: plannedBills,
        ending: cashOnHand + income - plannedBills,
      };
    }),
    scenarioResult =
      projectedMonthEnd + scenarioIncome - scenarioExpense - scenarioDebt;
  const scheduledCategories = [...new Set(expenseBills.map((r) => r.category))],
    everydayDefaults = [
      "Groceries",
      "Dining",
      "Transportation",
      "Shopping",
      "Entertainment",
      "Personal",
      "Pets",
      "Medical",
      "Other",
    ],
    resolvedAccountRules = data.accounts.map((account) => {
      const saved = data.accountRules.find((rule) => rule.accountId === account.id);
      if (saved) return saved;
      const lower = account.name.toLowerCase();
      if (lower.includes("aa"))
        return { accountId: account.id, role: "Bills", categories: scheduledCategories };
      if (lower.includes("enrichment"))
        return {
          accountId: account.id,
          role: "Everyday expenses",
          categories: everydayDefaults.filter((category) => categories.includes(category)),
        };
      return { accountId: account.id, role: "Mixed", categories };
    }),
    routingSummary = data.accounts.map((account) => {
      const rule = resolvedAccountRules.find((item) => item.accountId === account.id)!,
        routedIncome = data.paySchedules
          .filter((schedule) => schedule.destinationAccountId === account.id)
          .reduce(
            (sum, schedule) =>
              sum +
              datesFor(month, schedule).filter((date) => date >= asOf).length *
                schedule.amount,
            0,
          ),
        billNeed = unpaidBills
          .filter((bill) => rule.categories.includes(bill.category))
          .reduce((sum, bill) => sum + bill.amount, 0),
        spendingNeed = byCat
          .filter((item) => rule.categories.includes(item.category))
          .reduce((sum, item) => sum + Math.max(0, item.budget - item.spent), 0),
        assignedNeed =
          rule.role === "Bills"
            ? billNeed
            : rule.role === "Everyday expenses"
              ? spendingNeed
              : rule.role === "Savings"
                ? 0
                : billNeed + spendingNeed,
        cash = account.checking + account.savings;
      return {
        account,
        rule,
        cash,
        routedIncome,
        assignedNeed,
        afterPlan: cash + routedIncome - assignedNeed,
      };
    });
  const openTransactions = (filter = "all") => {
    setTxFilter(filter);
    setTab("transactions");
  };
  const debtRows = [...data.debts]
      .filter((d) => debtView !== "credit" || d.kind === "Credit card")
      .sort((a, b) =>
        debtView === "payments" ? b.minPayment - a.minPayment : b.apr - a.apr,
      ),
    debtViewTitle =
      debtView === "credit"
        ? "Credit card accounts"
        : debtView === "payments"
          ? "Accounts making up monthly minimums"
          : "All debt accounts";
  const daily = useMemo(() => {
    const m = new Map<string, any>();
    countedTx.forEach((t) => {
      const k = t.date.slice(8),
        r = m.get(k) || { day: k, income: 0, spent: 0 };
      r[t.type === "income" ? "income" : "spent"] += t.amount;
      m.set(k, r);
    });
    return [...m.values()].sort((a, b) => a.day.localeCompare(b.day));
  }, [countedTx]);
  const exp = () => {
    const rows = [
        ["Date", "Description", "Category", "Amount", "Type", "Account"],
        ...data.transactions.map((t) => [
          t.date,
          t.description,
          t.category,
          t.amount,
          t.type,
          t.account,
        ]),
      ],
      a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob(
        [
          rows
            .map((r) =>
              r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(","),
            )
            .join("\n"),
        ],
        { type: "text/csv" },
      ),
    );
    a.download = "family-budget.csv";
    a.click();
  };
  if (loading)
    return (
      <div className="loading">
        <CircleDollarSign />
        <p>Loading your budget…</p>
      </div>
    );
  return (
    <main>
      <Toaster richColors />
      <header>
        <div className="brand">
          <i>
            <Landmark />
          </i>
          <span>
            <b>Family Budget</b>
            <small>Household money, clearly organized</small>
          </span>
        </div>
        <div className="month">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMonth(shift(month, -1))}
          >
            <ChevronLeft />
          </Button>
          <b>{label(month)}</b>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMonth(shift(month, 1))}
          >
            <ChevronRight />
          </Button>
        </div>
        <div className="actions">
          <input
            hidden
            ref={file}
            type="file"
            accept=".xlsx,.xls,.csv,.ofx,.qfx"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.currentTarget.value = "";
              if (!f) return;
              try {
                const ext = f.name.split(".").pop()?.toLowerCase();
                if (ext === "xlsx" || ext === "xls") {
                  if (
                    !window.confirm(
                      "Replace the current budget plan, recurring items, account snapshot, and debt balances with this workbook? Transactions and savings goals will stay.",
                    )
                  )
                    return;
                  const j = await post(await budgetWorkbook(f, data.debts));
                  setMonth(String(j.sheet).slice(0, 7));
                  toast.success(
                    `${j.sheet} imported: ${j.recurring} recurring items and ${j.debts} debts.`,
                  );
                } else {
                  const rows =
                      ext === "ofx" || ext === "qfx"
                        ? ofx(await f.text())
                        : csv(await f.text()),
                    j = await post({ action: "import", rows });
                  toast.success(
                    `${j.added} transactions added. Duplicates skipped.`,
                  );
                }
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "That file could not be imported.",
                );
              }
            }}
          />
          <Button variant="outline" onClick={() => file.current?.click()}>
            <FileUp />
            Import file
          </Button>
          <Button onClick={() => setDialog("transaction")}>
            <Plus />
            Add transaction
          </Button>
        </div>
      </header>
      <Tabs value={tab} onValueChange={setTab} className="shell">
        <aside>
          <TabsList>
            <TabsTrigger value="overview">
              <LayoutDashboard />
              Overview
            </TabsTrigger>
            <TabsTrigger value="bills">
              <CalendarCheck2 />
              Bill tracker
            </TabsTrigger>
            <TabsTrigger value="transactions">
              <ReceiptText />
              Transactions
            </TabsTrigger>
            <TabsTrigger value="plan">
              <WalletCards />
              Budget plan
            </TabsTrigger>
            <TabsTrigger value="recurring">
              <Repeat2 />
              Recurring
            </TabsTrigger>
            <TabsTrigger value="debt">
              <CreditCard />
              Debt payoff
            </TabsTrigger>
            <TabsTrigger value="goals">
              <PiggyBank />
              Savings goals
            </TabsTrigger>
          </TabsList>
          <div>
            <Button variant="ghost" onClick={exp}>
              <Download />
              Export CSV
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                post({ action: "post-recurring", month }).then(() =>
                  toast.success("Monthly items added."),
                )
              }
            >
              <RefreshCw />
              Add monthly bills
            </Button>
          </div>
        </aside>
        <section className="content">
          <TabsContent value="overview">
            <Title
              over="MONTHLY OVERVIEW"
              title={label(month)}
              action={
                <Button
                  variant="outline"
                  onClick={() =>
                    post({
                      action: "rollover",
                      from: shift(month, -1),
                      to: month,
                    }).then(() => toast.success("Last month copied."))
                  }
                >
                  <RefreshCw />
                  Copy last month
                </Button>
              }
            />
            <div className="source">
              <FileUp />
              {data.workbookName} · tab {data.workbookSheet} · imported{" "}
              {data.workbookUpdated
                ? new Date(data.workbookUpdated).toLocaleDateString()
                : ""}
            </div>
            <section className="finance-sync-card">
              <div>
                <span className={`sync-dot${data.financeSyncUpdated ? " current" : ""}`} />
                <div>
                  <b>ChatGPT financial sync</b>
                  <small>
                    {data.financeSyncUpdated
                      ? `Last synced ${new Date(data.financeSyncUpdated).toLocaleString()} · ${data.financeSyncAccounts || 0} accounts · ${data.financeSyncTransactions || 0} new transactions`
                      : "Not synced yet. Use your connected ChatGPT Finances accounts without sharing bank passwords."}
                  </small>
                </div>
              </div>
              <Button onClick={() => setDialog("finance-sync")}>
                <RefreshCw />
                Sync through ChatGPT
              </Button>
            </section>
            <div className="metrics">
              <Metric
                n="Planned income"
                v={usd.format(plannedIncome)}
                s={`${paydayGroups.length} scheduled paydays · one-time deposits kept separate`}
                icon={<ArrowUpRight />}
                onClick={() => setIncomeOpen(true)}
              />
              <Metric
                n="Planned bills"
                v={usd.format(plannedBills)}
                s={
                  data.recurring.filter((x) => x.type === "expense").length +
                  " automated bills · open list"
                }
                icon={<ArrowDownRight />}
                onClick={() => setTab("recurring")}
              />
              <Metric
                n="After regular bills"
                v={usd.format(plannedIncome - plannedBills)}
                s="Open this month's transactions"
                icon={<CircleDollarSign />}
                onClick={() => openTransactions()}
              />
              <Metric
                n="Total debt"
                v={usd.format(totalDebt)}
                s={usd.format(minimums) + " monthly minimums · open list"}
                icon={<CreditCard />}
                onClick={() => setTab("debt")}
              />
            </div>
            <button
              type="button"
              className={`safe-to-spend-hero${safeToSpend < 0 ? " danger" : ""}`}
              onClick={() => setTab("bills")}
            >
              <span>
                <small>SAFE TO SPEND UNTIL NEXT PAYCHECK</small>
                <b>{usd.format(safeToSpend)}</b>
              </span>
              <span>
                {usd.format(cashOnHand)} cash − {usd.format(dueBeforeNextPay)} unpaid and carryover bills
                <small>{nextPayday ? `Next scheduled pay: ${new Date(nextPayday + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "No upcoming payday found"}</small>
              </span>
            </button>
            <section className="command-center">
              <div className="command-head">
                <div>
                  <p>HOUSEHOLD POSITION</p>
                  <h2>What your money needs to do next</h2>
                </div>
                <div className="health-score">
                  <ShieldCheck />
                  <span>
                    <small>Financial health</small>
                    <b>{healthScore}/100</b>
                  </span>
                </div>
              </div>
              <div className="command-metrics">
                <article>
                  <span>Cash available</span>
                  <b>{usd.format(cashOnHand)}</b>
                  <small>Checking and savings</small>
                </article>
                <article>
                  <span>Reserved until next check</span>
                  <b>{usd.format(dueBeforeNextPay)}</b>
                  <small>{nextPayday ? `Through ${new Date(nextPayday + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "No upcoming payday"}</small>
                </article>
                <article className={safeToSpend < 0 ? "danger" : "good"}>
                  <span>Safe to spend until next paycheck</span>
                  <b>{usd.format(safeToSpend)}</b>
                  <small>Before the next paycheck</small>
                </article>
                <article className={projectedMonthEnd < 0 ? "danger" : "good"}>
                  <span>Projected month end</span>
                  <b>{usd.format(projectedMonthEnd)}</b>
                  <small>After remaining regular bills</small>
                </article>
              </div>
              <div className="command-grid">
                <div className="action-plan">
                  <h3>Household action plan</h3>
                  {actionItems.length ? (
                    actionItems.slice(0, 5).map((item, index) => (
                      <div key={item}>
                        <i>{index + 1}</i>
                        <span>{item}</span>
                      </div>
                    ))
                  ) : (
                    <p className="all-clear">Nothing urgent. Your current plan is on track.</p>
                  )}
                </div>
                <div className="forecast">
                  <h3>90-day forecast</h3>
                  {forecast.map((item) => (
                    <div key={item.month}>
                      <b>{item.month}</b>
                      <span>Income {usd.format(item.income)}</span>
                      <span>Bills {usd.format(item.bills)}</span>
                      <strong className={item.ending < 0 ? "negative" : ""}>
                        {usd.format(item.ending)}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            </section>
            <Panel title="What-if planner" sub="Test a decision without changing your real budget">
              <div className="scenario-grid">
                <Label>
                  One-time expense
                  <Input type="number" min="0" step="25" value={scenarioExpense || ""} placeholder="$0" onChange={(e) => setScenarioExpense(Number(e.target.value))} />
                </Label>
                <Label>
                  Extra income
                  <Input type="number" min="0" step="25" value={scenarioIncome || ""} placeholder="$0" onChange={(e) => setScenarioIncome(Number(e.target.value))} />
                </Label>
                <Label>
                  Extra debt payment
                  <Input type="number" min="0" step="25" value={scenarioDebt || ""} placeholder="$0" onChange={(e) => setScenarioDebt(Number(e.target.value))} />
                </Label>
                <div className={`scenario-result${scenarioResult < 0 ? " danger" : ""}`}>
                  <span>New month-end projection</span>
                  <b>{usd.format(scenarioResult)}</b>
                  <small>{scenarioResult >= 0 ? "The scenario stays cash-flow positive." : "This scenario creates a projected shortage."}</small>
                </div>
              </div>
            </Panel>
            <Panel
              title="Money routing"
              sub="See whether each account can cover the jobs assigned to it"
            >
              <div className="routing-summary">
                {routingSummary.map((route) => (
                  <article className="route-card" key={route.account.id}>
                    <div className="route-card-head">
                      <span>
                        <b>{route.account.name}</b>
                        <small>{route.rule.role}</small>
                      </span>
                      <em className={route.afterPlan < 0 ? "short" : "covered"}>
                        {route.afterPlan < 0 ? "Short" : "Covered"}
                      </em>
                    </div>
                    <div className="route-math">
                      <span>Current cash <b>{usd.format(route.cash)}</b></span>
                      <span>Incoming pay <b>+{usd.format(route.routedIncome)}</b></span>
                      <span>Assigned need <b>−{usd.format(route.assignedNeed)}</b></span>
                      <strong>After plan <b>{usd.format(route.afterPlan)}</b></strong>
                    </div>
                  </article>
                ))}
              </div>
              <Button variant="outline" onClick={() => setTab("plan")}>
                <WalletCards /> Manage account rules
              </Button>
            </Panel>
            <div className="grid">
              <Panel title="Cash flow" sub="Income and spending by day">
                {daily.length ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={daily}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="day" />
                      <YAxis tickFormatter={(v) => "$" + v} />
                      <Tooltip formatter={(v: any) => usd.format(+v)} />
                      <Area dataKey="income" stroke="#24544c" fill="#d9e7e2" />
                      <Area
                        dataKey="spent"
                        stroke="#d58b48"
                        fill="transparent"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <Empty text="Import a bank CSV, QFX, or OFX file to see cash flow." />
                )}
              </Panel>
              <Panel
                title="Paydays"
                sub="Every 14 days · last paid September 17"
              >
                {paydays.map((p, i) => (
                  <div className="due" key={p.name + p.date + i}>
                    <i>{p.date.slice(8)}</i>
                    <span>
                      <b>{p.name}</b>
                      <small>
                        {new Date(p.date + "T12:00:00").toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric", year: "numeric" },
                        )}
                      </small>
                    </span>
                    <strong>{usd.format(p.amount)}</strong>
                  </div>
                ))}
              </Panel>
            </div>
            <div className="grid lower">
              <Panel title="Budget health" sub="Planned versus spent">
                {byCat.length ? (
                  byCat.slice(0, 7).map((x) => (
                    <div className="budget" key={x.category}>
                      <p>
                        <span>{x.category}</span>
                        <b>
                          {usd.format(x.spent)}{" "}
                          <small>of {usd.format(x.budget)}</small>
                        </b>
                      </p>
                      <Progress
                        value={
                          x.budget
                            ? Math.min(100, (x.spent / x.budget) * 100)
                            : 100
                        }
                      />
                    </div>
                  ))
                ) : (
                  <Empty text="Import a workbook or set category budgets." />
                )}
              </Panel>
              <Panel title="Recurring bills" sub="Regular monthly commitments">
                {data.recurring
                  .filter((r) => r.type === "expense")
                  .slice(0, 6)
                  .map((r) => (
                    <div className="due" key={r.id}>
                      <i>{r.dueDay}</i>
                      <span>
                        <b>{r.name}</b>
                        <small>{r.category}</small>
                      </span>
                      <strong>{usd.format(r.amount)}</strong>
                    </div>
                  ))}
              </Panel>
            </div>
          </TabsContent>
          <TabsContent value="transactions">
            <Title
              over="MONEY ACTIVITY"
              title="Transactions"
              action={
                <>
                  <Select value={txFilter} onValueChange={setTxFilter}>
                    <SelectTrigger className="filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All transactions</SelectItem>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expenses</SelectItem>
                      <SelectItem value="transfer">Transfers</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    onClick={() => file.current?.click()}
                  >
                    <FileUp />
                    Import bank file
                  </Button>
                  <Button onClick={() => setDialog("transaction")}>
                    <Plus />
                    Add
                  </Button>
                </>
              }
            />
            <div className="safe-note">
              <b>Tap any transaction to edit it.</b> The Source column shows
              which connected account the charge, deposit, or payment came from.
            </div>
            <Panel
              title="Payments and connected debts"
              sub="Balances and payment activity found through the connected accounts"
            >
              <div className="source-ledger">
                <div>
                  <h3>Debt balances</h3>
                  {data.debts.map((debt) => (
                    <article key={debt.id}>
                      <span>
                        <b>{debt.name}</b>
                        <small>{debt.sourceUpdated || "Budget entry"}</small>
                      </span>
                      <strong>{usd.format(debt.balance)}</strong>
                    </article>
                  ))}
                </div>
                <div>
                  <h3>Payments and transfers</h3>
                  {paymentActivity.length ? (
                    paymentActivity.map((item) => (
                      <article key={item.id}>
                        <span>
                          <b>{item.description}</b>
                          <small>{item.date} · from {item.account}</small>
                        </span>
                        <strong>{usd.format(item.amount)}</strong>
                      </article>
                    ))
                  ) : (
                    <small>No payment activity found this month.</small>
                  )}
                </div>
              </div>
            </Panel>
            <Panel title="" sub="">
              {visibleTx.length ? (
                <div className="table transaction-table">
                  <div className="row table-head" aria-hidden="true">
                    <span>Date</span>
                    <b>Description</b>
                    <em>Category</em>
                    <span>Source account</span>
                    <strong>Amount</strong>
                    <span />
                  </div>
                  {visibleTx.map((t) => (
                    <div
                      className="row clickable"
                      key={t.id}
                      onClick={() => setEditingTx(t)}
                    >
                      <span>{t.date.slice(5)}</span>
                      <b>{t.description}</b>
                      <em>{t.category}</em>
                      <span>{t.account}</span>
                      <strong className={t.type}>
                        {t.type === "income" ? "+" : t.type === "transfer" ? "↔ " : "−"}
                        {usd.format(t.amount)}
                      </strong>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          del("transaction", t.id);
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty text="No transactions match this view." />
              )}
            </Panel>
          </TabsContent>
          <TabsContent value="plan">
            <Title
              over="MONTHLY PLAN"
              title={"Budget for " + label(month)}
              action={
                <Button
                  variant="outline"
                  onClick={() =>
                    post({
                      action: "rollover",
                      from: shift(month, -1),
                      to: month,
                    })
                  }
                >
                  <RefreshCw />
                  Copy last month
                </Button>
              }
            />
            <div className="budget-upload">
              <div>
                <b>Update from your Excel budget</b>
                <span>
                  Choose the workbook and the app will use tab 2026-09-01, or
                  the newest date tab.
                </span>
              </div>
              <Button onClick={() => file.current?.click()}>
                <FileUp />
                Choose Excel file
              </Button>
            </div>
            <Panel
              title="Account spending rules"
              sub="Assign each account a job and the categories it is allowed to pay"
            >
              <div className="routing-editor">
                {data.accounts.map((account) => {
                  const rule = resolvedAccountRules.find(
                    (item) => item.accountId === account.id,
                  )!;
                  const saveRule = (role: string, nextCategories: string[]) =>
                    post({
                      action: "account-rule",
                      accountId: account.id,
                      role,
                      categories: nextCategories,
                    }).then(() => toast.success(`${account.name} routing saved.`));
                  return (
                    <article className="rule-card" key={account.id}>
                      <div className="rule-card-head">
                        <span>
                          <b>{account.name}</b>
                          <small>{usd.format(account.checking + account.savings)} available</small>
                        </span>
                        <Select
                          value={rule.role}
                          onValueChange={(role) => saveRule(role, rule.categories)}
                        >
                          <SelectTrigger aria-label={`Purpose for ${account.name}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {["Bills", "Everyday expenses", "Savings", "Mixed"].map((role) => (
                              <SelectItem key={role} value={role}>{role}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="category-checks">
                        {categories.map((category) => {
                          const checked = rule.categories.includes(category);
                          return (
                            <label key={category}>
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(value) =>
                                  saveRule(
                                    rule.role,
                                    value
                                      ? [...rule.categories, category]
                                      : rule.categories.filter((item) => item !== category),
                                  )
                                }
                              />
                              {category}
                            </label>
                          );
                        })}
                      </div>
                    </article>
                  );
                })}
              </div>
            </Panel>
            <Panel
              title="Categories"
              sub="Create household-specific categories, then use them on bills and transactions"
            >
              <div className="category-manager">
                <div>
                  <Input
                    value={newCategory}
                    placeholder="New category, such as Childcare"
                    onChange={(event) => setNewCategory(event.target.value)}
                  />
                  <Button
                    disabled={!newCategory.trim()}
                    onClick={() =>
                      post({ action: "category-add", category: newCategory.trim() }).then(() => {
                        toast.success(`${newCategory.trim()} added.`);
                        setNewCategory("");
                      })
                    }
                  >
                    <Plus /> Add category
                  </Button>
                </div>
                <div className="category-chips">
                  {categories.map((category) => (
                    <span className="category-chip" key={category}>
                      {category}
                      {data.customCategories.includes(category) && category !== "Education" && (
                        <button
                          aria-label={`Delete ${category}`}
                          onClick={() =>
                            window.confirm(
                              `Remove ${category} from the category list? Existing items keep their current label until you reclassify them.`,
                            ) && post({ action: "category-delete", category })
                          }
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                <small>Education is available for Logos and other school-related spending. Built-in categories stay available so older records remain readable.</small>
              </div>
            </Panel>
            <div className="plans">
              {categories.map((c, i) => {
                const b = bs.find((x) => x.category === c)?.amount || 0,
                  a = tx
                    .filter((x) => x.type === "expense" && x.category === c)
                    .reduce((s, x) => s + x.amount, 0);
                return (
                  <div className="plan" key={c}>
                    <i style={{ background: colors[i % colors.length] }}>
                      {c[0]}
                    </i>
                    <span>
                      <b>{c}</b>
                      <small>{usd.format(a)} spent</small>
                    </span>
                    <Label>
                      Monthly limit
                      <Input
                        defaultValue={b || ""}
                        placeholder="$0"
                        onBlur={(e) =>
                          post({
                            action: "budget",
                            month,
                            category: c,
                            amount: e.target.value,
                          })
                        }
                      />
                    </Label>
                  </div>
                );
              })}
            </div>
          </TabsContent>
          <TabsContent value="bills">
            <BillTracker
              data={data}
              month={month}
              setMonth={setMonth}
              post={post}
              onAdd={() => setDialog("recurring")}
              onDelete={(r) => {
                if (
                  window.confirm(
                    `Delete ${r.name}? This removes it from future months and clears its bill history.`,
                  )
                )
                  del("recurring", r.id);
              }}
            />
          </TabsContent>
          <TabsContent value="recurring">
            <Title
              over="AUTOMATION"
              title="Recurring income and bills"
              action={
                <>
                  <Button
                    variant="outline"
                    onClick={() =>
                      post({ action: "post-recurring", month }).then(() =>
                        toast.success("Monthly items added."),
                      )
                    }
                  >
                    <RefreshCw />
                    Post month
                  </Button>
                  <Button onClick={() => setDialog("recurring")}>
                    <Plus />
                    Add
                  </Button>
                </>
              }
            />
            <Panel
              title="Income schedules"
              sub="These schedules drive planned income, forecasts and payday planning"
            >
              <div className="income-schedules">
                {data.paySchedules.map((schedule) => (
                  <article key={schedule.id}>
                    <div>
                      <b>{schedule.name}</b>
                      <small>
                        Every {schedule.intervalDays} days · next dates calculated
                        from {new Date(schedule.anchorDate + "T12:00:00").toLocaleDateString()}
                      </small>
                      <small>
                        {schedule.purpose} · deposits to {data.accounts.find((account) => account.id === schedule.destinationAccountId)?.name || "Unassigned account"}
                      </small>
                    </div>
                    <strong>{usd.format(schedule.amount)}</strong>
                    <Button variant="outline" size="sm" onClick={() => setIncomeEditor(schedule)}>
                      <Pencil />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${schedule.name} schedule`}
                      onClick={() => {
                        if (window.confirm(`Delete the ${schedule.name} income schedule?`))
                          post({ action: "income-schedule-delete", id: schedule.id }).then(() =>
                            toast.success("Income schedule deleted."),
                          );
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </article>
                ))}
                <Button variant="outline" onClick={() => setIncomeEditor("new")}>
                  <Plus />
                  Add income schedule
                </Button>
              </div>
            </Panel>
            <div className="recurring-list">
              {data.recurring.length ? (
                data.recurring.map((r) => (
                  <article className="recurring-card" key={r.id}>
                    <div className="recurring-head">
                      <div>
                        <b>{r.name}</b>
                        <small>
                          {r.type} · due day {r.dueDay}
                        </small>
                      </div>
                      <strong>{usd.format(r.amount)}</strong>
                    </div>
                    <div className="recurring-controls">
                      <Label>
                        Category
                        <Select
                          value={r.category}
                          onValueChange={(category) =>
                            post({
                              action: "recurring-category",
                              id: r.id,
                              category,
                            }).then(() =>
                              toast.success(`${r.name} moved to ${category}.`),
                            )
                          }
                        >
                          <SelectTrigger aria-label={`Category for ${r.name}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Label>
                      <Button
                        variant="outline"
                        onClick={() => setEditingRecurring(r)}
                      >
                        <Pencil />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${r.name}`}
                        onClick={() => del("recurring", r.id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </article>
                ))
              ) : (
                <Empty text="Add each regular bill or paycheck once." />
              )}
            </div>
          </TabsContent>
          <TabsContent value="debt">
            <Title
              over="PAYOFF CENTER"
              title="Debt balances"
              action={
                <Button onClick={() => setDialog("debt")}>
                  <Plus />
                  Add debt
                </Button>
              }
            />
            <div className="debt-summary">
              <Metric
                n="All debt"
                v={usd.format(totalDebt)}
                s={data.debts.length + " accounts · view details"}
                icon={<Landmark />}
                onClick={() => setDebtView("all")}
              />
              <Metric
                n="Credit cards"
                v={usd.format(
                  data.debts
                    .filter((d) => d.kind === "Credit card")
                    .reduce((s, d) => s + d.balance, 0),
                )}
                s="View accounts in this total"
                icon={<CreditCard />}
                onClick={() => setDebtView("credit")}
              />
              <Metric
                n="Monthly minimums"
                v={usd.format(minimums)}
                s="View payments in this total"
                icon={<ArrowDownRight />}
                onClick={() => setDebtView("payments")}
              />
            </div>
            {data.debts.length > 0 && (
              <div className="strategy-grid">
                <article>
                  <Target />
                  <div>
                    <span>Snowball target</span>
                    <b>
                      {[...data.debts]
                        .filter((d) => d.balance > 0)
                        .sort((a, b) => a.balance - b.balance)[0]?.name}
                    </b>
                    <small>Smallest balance first for faster wins</small>
                  </div>
                </article>
                <article>
                  <TrendingUp />
                  <div>
                    <span>Avalanche target</span>
                    <b>
                      {[...data.debts]
                        .filter((d) => d.balance > 0)
                        .sort((a, b) => b.apr - a.apr)[0]?.name}
                    </b>
                    <small>Highest APR first to reduce interest</small>
                  </div>
                </article>
                <article>
                  <CircleDollarSign />
                  <div>
                    <span>Recommended next payment</span>
                    <b>{usd.format(minimums + Math.max(0, scenarioDebt))}</b>
                    <small>Minimums plus the extra amount tested on Overview</small>
                  </div>
                </article>
              </div>
            )}
            <Panel
              title={debtViewTitle}
              sub="Each account below contributes to the selected total; tap Edit to change it"
            >
              <div className="debt-list">
                {debtRows.map((d) => (
                  <div className="debt-row" key={d.id}>
                    <span>
                      <b>{d.name}</b>
                      <small>
                        {d.kind} · due day {d.dueDay}
                      </small>
                    </span>
                    <em className={d.apr >= 20 ? "hot" : ""}>{d.apr}% APR</em>
                    <span className="debt-money">
                      <small>Balance</small>
                      <b>{usd.format(d.balance)}</b>
                    </span>
                    <span className="debt-money">
                      <small>Payment</small>
                      <b>{usd.format(d.minPayment)}</b>
                    </span>
                    <div className="debt-actions">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingDebt(d)}
                      >
                        <Pencil />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => del("debt", d.id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </TabsContent>
          <TabsContent value="goals">
            <Title
              over="LOOKING AHEAD"
              title="Savings goals"
              action={
                <Button onClick={() => setDialog("goal")}>
                  <Plus />
                  Add goal
                </Button>
              }
            />
            <div className="goals">
              {data.goals.length ? (
                data.goals.map((g) => (
                  <Panel
                    title={g.name}
                    sub={usd.format(g.saved) + " of " + usd.format(g.target)}
                    key={g.id}
                  >
                    <Progress
                      value={Math.min(100, (g.saved / g.target) * 100)}
                    />
                    {g.targetDate && (
                      <div className="goal-guidance">
                        <span>Suggested monthly contribution</span>
                        <b>
                          {usd.format(
                            Math.max(0, g.target - g.saved) /
                              Math.max(
                                1,
                                Math.ceil(
                                  (new Date(g.targetDate + "T12:00:00").getTime() -
                                    Date.now()) /
                                    (30.44 * 86400000),
                                ),
                              ),
                          )}
                        </b>
                      </div>
                    )}
                    <Label>
                      Current saved amount
                      <Input
                        defaultValue={g.saved}
                        onBlur={(e) =>
                          post({
                            action: "goal-progress",
                            id: g.id,
                            saved: e.target.value,
                          })
                        }
                      />
                    </Label>
                    <Button variant="ghost" onClick={() => del("goal", g.id)}>
                      <Trash2 />
                      Delete
                    </Button>
                  </Panel>
                ))
              ) : (
                <Empty text="Track an emergency fund, RV, vacation, or any family goal." />
              )}
            </div>
          </TabsContent>
        </section>
      </Tabs>
      <Dialog open={dialog === "finance-sync"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sync connected bank data</DialogTitle>
            <DialogDescription>
              This app never receives your bank username, password, or Plaid token. ChatGPT reads the accounts you already connected and sends only the balances and transactions needed for your budget.
            </DialogDescription>
          </DialogHeader>
          <div className="sync-steps">
            <span><b>1</b> Open ChatGPT using the button below.</span>
            <span><b>2</b> Send: “Sync my connected finances to Family Budget.”</span>
            <span><b>3</b> Return here and refresh; bills and balances will reconcile automatically.</span>
          </div>
          <div className="dialog-actions">
            <Button
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText("Sync my connected finances to Family Budget. Include current depository balances, liabilities, and posted transactions from the last 90 days. Exclude pending transactions and identify transfers between my own accounts.");
                toast.success("Sync request copied.");
              }}
            >
              Copy sync request
            </Button>
            <Button onClick={() => window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer")}>
              Open ChatGPT
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={incomeEditor !== null}
        onOpenChange={(open) => !open && setIncomeEditor(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {incomeEditor === "new" ? "Add income schedule" : "Edit income schedule"}
            </DialogTitle>
            <DialogDescription>
              The app will calculate every future payday from one known payday.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const values = Object.fromEntries(new FormData(event.currentTarget));
              await post({
                action: "income-schedule",
                id: incomeEditor === "new" ? "" : incomeEditor?.id,
                ...values,
              });
              setIncomeEditor(null);
              toast.success("Income schedule saved.");
            }}
          >
            <Field n="Income source">
              <Input
                name="name"
                defaultValue={incomeEditor === "new" ? "" : incomeEditor?.name}
                required
              />
            </Field>
            <Field n="Deposit amount">
              <Input
                name="amount"
                type="number"
                min="0"
                step=".01"
                defaultValue={incomeEditor === "new" ? "" : incomeEditor?.amount}
                required
              />
            </Field>
            <Field n="Known payday">
              <Input
                name="anchorDate"
                type="date"
                defaultValue={
                  incomeEditor === "new"
                    ? new Date().toISOString().slice(0, 10)
                    : incomeEditor?.anchorDate
                }
                required
              />
            </Field>
            <Field n="Days between deposits">
              <Input
                name="intervalDays"
                type="number"
                min="1"
                defaultValue={incomeEditor === "new" ? 14 : incomeEditor?.intervalDays}
                required
              />
            </Field>
            <Field n="Purpose">
              <Choice
                n="purpose"
                items={["Bills", "Everyday expenses", "Savings", "Mixed"]}
                value={incomeEditor === "new" ? "Bills" : incomeEditor?.purpose}
              />
            </Field>
            <Field n="Deposit account">
              <Select
                name="destinationAccountId"
                defaultValue={String(
                  incomeEditor === "new"
                    ? data.accounts[0]?.id || 0
                    : incomeEditor?.destinationAccountId || data.accounts[0]?.id || 0,
                )}
              >
                <SelectTrigger><SelectValue placeholder="Choose an account" /></SelectTrigger>
                <SelectContent>
                  {data.accounts.map((account) => (
                    <SelectItem key={account.id} value={String(account.id)}>{account.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Button type="submit">Save schedule</Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={incomeOpen} onOpenChange={setIncomeOpen}>
        <DialogContent className="income-dialog">
          <DialogHeader>
            <DialogTitle>{label(month)} income</DialogTitle>
            <DialogDescription>
              Every scheduled deposit used to calculate planned income.
            </DialogDescription>
          </DialogHeader>
          <div className="income-equation">
            <span>{paydayGroups.length} paydays</span>
            <b>{usd.format(plannedIncome)}</b>
          </div>
          <div className="income-classification">
            <div>
              <span>Scheduled income received</span>
              <b>{usd.format(scheduledIncomeActual)}</b>
            </div>
            <div>
              <span>One-time deposits</span>
              <b>{usd.format(oneTimeIncome)}</b>
              {oneTimeIncomeRows.slice(0, 3).map((row) => (
                <small key={row.id}>{row.description} · {usd.format(row.amount)}</small>
              ))}
            </div>
          </div>
          <div className="income-breakdown">
            {paydayGroups.map((group) => (
              <section key={group.date}>
                <div className="income-date">
                  <b>
                    {new Date(group.date + "T12:00:00").toLocaleDateString(
                      "en-US",
                      { weekday: "short", month: "short", day: "numeric" },
                    )}
                  </b>
                  <strong>{usd.format(group.total)}</strong>
                </div>
                {group.deposits.map((deposit) => (
                  <div
                    className="income-deposit"
                    key={deposit.name + deposit.date}
                  >
                    <span>{deposit.name}</span>
                    <span>{usd.format(deposit.amount)}</span>
                  </div>
                ))}
              </section>
            ))}
          </div>
          <div className="income-total">
            <span>Monthly planned income</span>
            <strong>{usd.format(plannedIncome)}</strong>
          </div>
          <small className="income-note">
            Based on the September 17 payday and a 14-day schedule. Some months
            have three paydays.
          </small>
        </DialogContent>
      </Dialog>
      <Entry
        type={dialog}
        month={month}
        categories={categories}
        close={() => setDialog(null)}
        save={async (x) => {
          if (x.action === "recurring") {
            const normalized = String(x.name || "")
                .trim()
                .toLowerCase()
                .replace(/\s+/g, " "),
              match = data.recurring.find(
                (r) =>
                  r.name.trim().toLowerCase().replace(/\s+/g, " ") ===
                  normalized,
              );
            if (
              match &&
              !window.confirm(
                `A bill named “${match.name}” already exists. Add another one anyway?`,
              )
            )
              return;
          }
          await post(x);
          setDialog(null);
          toast.success("Saved.");
        }}
      />
      <Entry
        type={editingTx ? "transaction-update" : null}
        month={month}
        categories={categories}
        transaction={editingTx}
        close={() => setEditingTx(null)}
        save={async (x) => {
          await post(x);
          setEditingTx(null);
          toast.success("Transaction updated.");
        }}
      />
      <Entry
        type={editingDebt ? "debt-update" : null}
        month={month}
        categories={categories}
        debt={editingDebt}
        close={() => setEditingDebt(null)}
        save={async (x) => {
          await post(x);
          setEditingDebt(null);
          toast.success("Debt updated.");
        }}
      />
      <Entry
        type={editingRecurring ? "recurring-update" : null}
        month={month}
        categories={categories}
        recurring={editingRecurring}
        close={() => setEditingRecurring(null)}
        save={async (x) => {
          await post(x);
          setEditingRecurring(null);
          toast.success("Recurring item updated.");
        }}
      />
    </main>
  );
}
function BillTracker({
  data,
  month,
  setMonth,
  post,
  onAdd,
  onDelete,
}: {
  data: Data;
  month: string;
  setMonth: (month: string) => void;
  post: (x: any) => Promise<any>;
  onAdd: () => void;
  onDelete: (bill: R) => void;
}) {
  const [receiptDrafts, setReceiptDrafts] = useState<Record<string, string>>({});
  const [allocationDraft, setAllocationDraft] = useState("");
  const persistedMatches = useRef("");
  useEffect(() => {
    post({ action: "bill-month-init", month });
  }, [month]);
  const today = new Date().toISOString().slice(0, 10),
    asOf = month === today.slice(0, 7) ? today : `${month}-01`,
    payment = (id: number, rowMonth = month) =>
      data.billPayments.find(
        (p) => p.month === rowMonth && p.recurringId === id,
      ),
    bills = data.recurring.filter((r) => r.type === "expense"),
    dueDate = (r: R, rowMonth = month) => {
      const last = new Date(
        +rowMonth.slice(0, 4),
        +rowMonth.slice(5, 7),
        0,
      ).getDate();
      return `${rowMonth}-${String(Math.min(last, r.dueDay)).padStart(2, "0")}`;
    };
  const rows = [...bills].sort(
      (a, b) =>
        a.dueDay - b.dueDay ||
        a.name.localeCompare(b.name),
    ),
    carryovers = data.billPayments
      .filter((p) => p.month < month && !p.paid)
      .map((p) => ({ p, r: bills.find((r) => r.id === p.recurringId) }))
      .filter((x): x is { p: BP; r: R } => Boolean(x.r))
      .sort(
        (a, b) =>
          a.p.month.localeCompare(b.p.month) || a.r.dueDay - b.r.dueDay,
      );
  const reconciliationInstances: BillInstance[] = [
      ...carryovers.map(({ p, r }) => ({
        bill: r,
        month: p.month,
        due: dueDate(r, p.month),
        manualPaid: Boolean(p.paid),
      })),
      ...bills.map((bill) => ({
        bill,
        month,
        due: dueDate(bill),
        manualPaid: Boolean(payment(bill.id)?.paid),
      })),
    ],
    reconciled = reconcileBills(reconciliationInstances, data.transactions),
    effectivePaid = (r: R, rowMonth = month) =>
      Boolean(payment(r.id, rowMonth)?.paid) ||
      reconciled.has(`${rowMonth}-${r.id}`);
  const matchesToPersist = [...reconciled.entries()]
      .map(([key, match]) => {
        const instance = reconciliationInstances.find(
          (item) => `${item.month}-${item.bill.id}` === key,
        );
        if (!instance || payment(instance.bill.id, instance.month)?.paid)
          return null;
        return {
          month: instance.month,
          recurringId: instance.bill.id,
          paid: true,
          paidDate: match.transaction.date,
          actualAmount: match.transaction.amount,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    matchSignature = matchesToPersist
      .map((item) => `${item.month}-${item.recurringId}-${item.paidDate}-${item.actualAmount}`)
      .join("|");
  useEffect(() => {
    if (!matchSignature || persistedMatches.current === matchSignature) return;
    persistedMatches.current = matchSignature;
    post({ action: "bill-payments-sync", entries: matchesToPersist }).then(() =>
      toast.success(
        `${matchesToPersist.length} matched bill${matchesToPersist.length === 1 ? "" : "s"} marked paid.`,
      ),
    );
  }, [matchSignature]);
  rows.sort(
    (a, b) =>
      Number(effectivePaid(a)) - Number(effectivePaid(b)) ||
      a.dueDay - b.dueDay ||
      a.name.localeCompare(b.name),
  );
  const allPaydays = [month, shift(month, 1)]
      .flatMap((m) =>
        data.paySchedules.flatMap((p) =>
          datesFor(m, p).map((date) => ({ ...p, date })),
        ),
      )
      .filter((p) => p.date > asOf)
      .sort((a, b) => a.date.localeCompare(b.date)),
    nextDate = allPaydays[0]?.date || "",
    nextPayAmount = allPaydays
      .filter((p) => p.date === nextDate)
      .reduce((s, p) => s + p.amount, 0);
  const reserveMonths = nextDate
      ? [...new Set([month, nextDate.slice(0, 7)])]
      : [month],
    reserveInstances: BillInstance[] = reserveMonths.flatMap((rowMonth) =>
      bills.map((bill) => ({
        bill,
        month: rowMonth,
        due: dueDate(bill, rowMonth),
        manualPaid: Boolean(payment(bill.id, rowMonth)?.paid),
      })),
    ),
    reserveMatches = reconcileBills(reserveInstances, data.transactions),
    dueInWindow = reserveInstances.filter(
      (instance) =>
        (!nextDate || instance.due <= nextDate) &&
        !instance.manualPaid &&
        !reserveMatches.has(`${instance.month}-${instance.bill.id}`),
    ),
    nextWindowBills = dueInWindow.reduce(
      (sum, instance) =>
        sum +
        (payment(instance.bill.id, instance.month)?.actualAmount ||
          reserveMatches.get(`${instance.month}-${instance.bill.id}`)?.transaction.amount ||
          instance.bill.amount),
      0,
    );
  const amountFor = (r: R, rowMonth = month) =>
      payment(r.id, rowMonth)?.actualAmount ||
      reconciled.get(`${rowMonth}-${r.id}`)?.transaction.amount ||
      r.amount,
    unpaid = bills.filter((r) => !effectivePaid(r)),
    unpaidTotal = unpaid.reduce((s, r) => s + amountFor(r), 0),
    dueBeforePay =
      carryovers
        .filter((item) => !reconciled.has(`${item.p.month}-${item.r.id}`))
        .reduce((sum, item) => sum + item.r.amount, 0) +
      nextWindowBills,
    bankTotal = data.accounts.reduce((s, a) => s + a.checking + a.savings, 0),
    billRuleIds = data.accountRules
      .filter((rule) => rule.role === "Bills")
      .map((rule) => rule.accountId),
    everydayRuleIds = data.accountRules
      .filter((rule) => rule.role === "Everyday expenses")
      .map((rule) => rule.accountId),
    billAccounts = data.accounts.filter((account) =>
      billRuleIds.length
        ? billRuleIds.includes(account.id)
        : account.name.toLowerCase().includes("aa"),
    ),
    everydayAccounts = data.accounts.filter((account) =>
      everydayRuleIds.length
        ? everydayRuleIds.includes(account.id)
        : account.name.toLowerCase().includes("enrichment"),
    ),
    billCash = billAccounts.reduce((sum, account) => sum + account.checking, 0),
    everydayCash = everydayAccounts.reduce(
      (sum, account) => sum + account.checking,
      0,
    ),
    everydayCategories = [
      ...new Set(
        data.accountRules
          .filter((rule) => rule.role === "Everyday expenses")
          .flatMap((rule) => rule.categories),
      ),
    ],
    envelopeCategories = everydayCategories.length
      ? everydayCategories
      : ["Gas", "Groceries", "Dining", "Transportation", "Personal", "Other"],
    envelopeRows = envelopeCategories.map((category) => {
      const budget =
          data.budgets.find((item) => item.month === month && item.category === category)
            ?.amount || 0,
        spent = data.transactions
          .filter(
            (item) =>
              item.date.startsWith(month) &&
              item.type === "expense" &&
              !isTransferTx(item) &&
              item.category === category,
          )
          .reduce((sum, item) => sum + item.amount, 0);
      return { category, budget, spent, left: budget - spent };
    }),
    envelopeBudget = envelopeRows.reduce((sum, item) => sum + item.budget, 0),
    envelopeSpent = envelopeRows.reduce((sum, item) => sum + item.spent, 0),
    envelopeRemaining = envelopeRows.reduce(
      (sum, item) => sum + Math.max(0, item.left),
      0,
    ),
    foodTransportationRows = data.transactions
      .filter(
        (item) =>
          item.date.startsWith(month) &&
          item.type === "expense" &&
          !isTransferTx(item) &&
          ["Groceries", "Dining", "Transportation", "Gas"].includes(
            item.category,
          ),
      )
      .sort((a, b) => b.date.localeCompare(a.date)),
    foodTransportationTotal = foodTransportationRows.reduce(
      (sum, item) => sum + item.amount,
      0,
    ),
    remainingEverydayIncome = data.paySchedules
      .filter(
        (schedule) =>
          schedule.purpose === "Everyday expenses" ||
          everydayAccounts.some((account) => account.id === schedule.destinationAccountId),
      )
      .reduce(
        (sum, schedule) =>
          sum +
          datesFor(month, schedule).filter((date) => date > asOf).length *
            schedule.amount,
        0,
      ),
    remainingIncome = data.paySchedules.reduce(
      (sum, p) =>
        sum + datesFor(month, p).filter((d) => d > asOf).length * p.amount,
      0,
    ),
    billsLeftBeforeCheck = billCash - dueBeforePay,
    monthOutlook = everydayCash + remainingEverydayIncome - envelopeRemaining,
    paidCount = bills.length - unpaid.length,
    missingBills = reconciliationInstances.filter(
      (instance) =>
        !effectivePaid(instance.bill, instance.month) &&
        instance.due < today,
    );
  const extraPaycheck = data.paySchedules
      .filter(
        (schedule) =>
          schedule.purpose === "Bills" ||
          billAccounts.some((account) => account.id === schedule.destinationAccountId),
      )
      .flatMap((schedule) =>
        datesFor(month, schedule).map((date, index) => ({ schedule, date, index })),
      )
      .find((item) => item.index === 2),
    savedAllocation = extraPaycheck
      ? data.paycheckAllocations.find(
          (item) =>
            item.scheduleId === extraPaycheck.schedule.id &&
            item.paycheckDate === extraPaycheck.date,
        )
      : undefined,
    earlierBillIncome = extraPaycheck
      ? data.paySchedules
          .filter(
            (schedule) =>
              schedule.purpose === "Bills" ||
              billAccounts.some((account) => account.id === schedule.destinationAccountId),
          )
          .reduce(
            (sum, schedule) =>
              sum +
              datesFor(month, schedule).filter(
                (date) => date > asOf && date < extraPaycheck.date,
              ).length * schedule.amount,
            0,
          )
      : 0,
    suggestedCurrentAmount = extraPaycheck
      ? Math.min(
          extraPaycheck.schedule.amount,
          Math.max(0, unpaidTotal - billCash - earlierBillIncome),
        )
      : 0,
    currentAllocationAmount = savedAllocation
      ? savedAllocation.currentMonthAmount
      : suggestedCurrentAmount,
    nextAllocationAmount = extraPaycheck
      ? Math.max(0, extraPaycheck.schedule.amount - currentAllocationAmount)
      : 0;
  const savePayment = (r: R, rowMonth: string, changes: Partial<BP>) => {
    const p = payment(r.id, rowMonth);
    return post({
      action: "bill-payment",
      month: rowMonth,
      recurringId: r.id,
      paid: p?.paid || false,
      paidDate: p?.paidDate || "",
      actualAmount: p?.actualAmount || r.amount,
      ...changes,
    });
  };
  const billCard = (r: R, rowMonth: string, carryover = false) => {
    const p = payment(r.id, rowMonth),
      match = reconciled.get(`${rowMonth}-${r.id}`),
      paid = Boolean(p?.paid) || Boolean(match),
      actualAmount = p?.actualAmount || match?.transaction.amount || r.amount,
      paidDate = p?.paidDate || match?.transaction.date || "",
      status = paid
        ? actualAmount > r.amount + 0.01
          ? "OVER BUDGET"
          : "PAID"
        : dueDate(r, rowMonth) < today
          ? "MISSING"
          : "DUE";
    return (
      <article
        className={`bill-card${paid ? " paid" : ""} status-${status.toLowerCase().replace(" ", "-")}`}
        key={`${rowMonth}-${r.id}`}
      >
        <div className="bill-check">
          <Checkbox
            checked={paid}
            onCheckedChange={(checked) =>
              savePayment(r, rowMonth, {
                paid: Boolean(checked),
                paidDate: checked ? paidDate || today : p?.paidDate || "",
                actualAmount,
              }).then(() =>
                toast.success(
                  checked
                    ? `${r.name} marked paid.`
                    : `${r.name} moved back to unpaid.`,
                ),
              )
            }
          />
        </div>
        <div className="bill-name">
          <b>{r.name}</b>
          <small>
            {carryover ? `${label(rowMonth)} carryover · ` : ""}
            {r.category} · due{" "}
            {new Date(
              dueDate(r, rowMonth) + "T12:00:00",
            ).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </small>
          {match && !p?.paid && (
            <small className="auto-match">
              Auto-matched: {match.transaction.description} · {match.confidence}
            </small>
          )}
        </div>
        <Label>
          Paid date
          <Input
            type="date"
            value={paidDate}
            onChange={(e) =>
              savePayment(r, rowMonth, { paidDate: e.target.value })
            }
          />
        </Label>
        <Label>
          Amount
          <Input
            type="number"
            step=".01"
            key={`${rowMonth}-${r.id}-${actualAmount}`}
            defaultValue={actualAmount}
            onBlur={(e) =>
              savePayment(r, rowMonth, {
                actualAmount: Number(e.target.value),
              })
            }
          />
        </Label>
        <div className="bill-status">
          <strong>{status}</strong>
          {!carryover && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Delete ${r.name}`}
              onClick={() => onDelete(r)}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      </article>
    );
  };
  return (
    <>
      <Title
        over="BILL TRACKER"
        title={`${label(month)} bills`}
        action={
          <div className="bill-toolbar">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous month"
              onClick={() => setMonth(shift(month, -1))}
            >
              <ChevronLeft />
            </Button>
            <span className="bill-count">
              {paidCount} of {bills.length} paid
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next month"
              onClick={() => setMonth(shift(month, 1))}
            >
              <ChevronRight />
            </Button>
            <Button onClick={onAdd}>
              <Plus />
              Add bill
            </Button>
          </div>
        }
      />
      <div className="bill-summary">
        <Metric
          n="Current bank balance"
          v={usd.format(bankTotal)}
          s="Checking and savings entered below"
          icon={<Landmark />}
        />
        <Metric
          n="Due before next check"
          v={usd.format(dueBeforePay)}
          s={
            nextDate
              ? `Next paycheck ${new Date(nextDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${usd.format(nextPayAmount)}${nextDate.slice(0, 7) !== month ? " · includes next-month bills due by then" : ""}`
              : "No later paycheck found"
          }
          icon={<CalendarCheck2 />}
        />
        <Metric
          n="Left before next check"
          v={usd.format(billsLeftBeforeCheck)}
          s={
            billsLeftBeforeCheck >= 0
              ? "Bills account is funded through the next check"
              : "Short for bills due in this range"
          }
          icon={<CircleDollarSign />}
        />
        <Metric
          n="Month outlook"
          v={usd.format(monthOutlook)}
          s="Everyday-expense money after remaining envelopes"
          icon={<ArrowUpRight />}
        />
      </div>
      {extraPaycheck && (
        <Panel
          title="Split extra paycheck"
          sub={`${extraPaycheck.schedule.name} · ${new Date(extraPaycheck.date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })}`}
        >
          <div className="paycheck-allocation">
            <div className="allocation-total">
              <span>Paycheck</span>
              <strong>{usd.format(extraPaycheck.schedule.amount)}</strong>
              <small>This is one deposit with two assignments—not extra income.</small>
            </div>
            <Label>
              Keep for {label(month)}
              <Input
                type="number"
                min="0"
                max={extraPaycheck.schedule.amount}
                step=".01"
                value={allocationDraft || String(currentAllocationAmount)}
                onChange={(event) => setAllocationDraft(event.target.value)}
              />
              <small>Suggested from the remaining bills shortfall</small>
            </Label>
            <div className="allocation-next">
              <span>Reserve for {label(shift(month, 1))}</span>
              <strong>
                {usd.format(
                  Math.max(
                    0,
                    extraPaycheck.schedule.amount -
                      Number(allocationDraft || currentAllocationAmount),
                  ),
                )}
              </strong>
              <small>Protected from {label(month)} safe-to-spend</small>
            </div>
            <Button
              onClick={() => {
                const currentAmount = Math.max(
                  0,
                  Math.min(
                    extraPaycheck.schedule.amount,
                    Number(allocationDraft || currentAllocationAmount),
                  ),
                );
                post({
                  action: "paycheck-allocation",
                  id: savedAllocation?.id,
                  scheduleId: extraPaycheck.schedule.id,
                  paycheckDate: extraPaycheck.date,
                  total: extraPaycheck.schedule.amount,
                  currentMonth: month,
                  currentMonthAmount: currentAmount,
                  nextMonth: shift(month, 1),
                  note: "Extra paycheck split",
                }).then(() => {
                  setAllocationDraft("");
                  toast.success("Paycheck split saved.");
                });
              }}
            >
              Save split
            </Button>
          </div>
          <div className="allocation-summary">
            {savedAllocation ? "Saved" : "Suggested"}: {usd.format(currentAllocationAmount)} for {label(month)} · {usd.format(nextAllocationAmount)} reserved for {label(shift(month, 1))}
          </div>
        </Panel>
      )}
      {missingBills.length > 0 && (
        <div className="reconciliation-warning">
          <b>{missingBills.length} expected bill{missingBills.length === 1 ? "" : "s"} have no matching transaction.</b>
          <span>Check the imported transactions or enter the paid date and actual amount manually.</span>
        </div>
      )}
      <div className="status-legend" aria-label="Bill status legend">
        <span className="paid">PAID</span>
        <span className="due">DUE</span>
        <span className="missing">MISSING</span>
        <span className="over-budget">OVER BUDGET</span>
      </div>
      <div className="bill-calculations">
        <div>
          <b>Left before next check</b>
          <span>{usd.format(billCash)} bills checking − {usd.format(dueBeforePay)} bills due = <strong>{usd.format(billsLeftBeforeCheck)}</strong></span>
        </div>
        <div>
          <b>Everyday month outlook</b>
          <span>{usd.format(everydayCash)} available + {usd.format(remainingEverydayIncome)} income − {usd.format(envelopeRemaining)} envelopes left = <strong>{usd.format(monthOutlook)}</strong></span>
        </div>
      </div>
      <Panel
        title="Current bank balances"
        sub="Update these whenever your bank balance changes"
      >
        <div className="bank-balances">
          {data.accounts.map((a) => (
            <article key={a.id}>
              <div>
                <b>{a.name}</b>
                <small>Updated {a.snapshotDate || "—"}</small>
              </div>
              <Label>
                Checking
                <Input
                  type="number"
                  step=".01"
                  defaultValue={a.checking}
                  onBlur={(e) =>
                    post({
                      action: "account-balance",
                      id: a.id,
                      checking: e.target.value,
                      savings: a.savings,
                    }).then(() => toast.success(`${a.name} balance updated.`))
                  }
                />
              </Label>
              <Label>
                Savings
                <Input
                  type="number"
                  step=".01"
                  defaultValue={a.savings}
                  onBlur={(e) =>
                    post({
                      action: "account-balance",
                      id: a.id,
                      checking: a.checking,
                      savings: e.target.value,
                    }).then(() => toast.success(`${a.name} balance updated.`))
                  }
                />
              </Label>
            </article>
          ))}
        </div>
      </Panel>
      <Panel
        title="Everyday expense envelopes"
        sub="Set a monthly amount, add each receipt, and see what is still available"
      >
        <div className="envelope-totals">
          <span>Budgeted <b>{usd.format(envelopeBudget)}</b></span>
          <span>Receipts <b>{usd.format(envelopeSpent)}</b></span>
          <span>Still available <b>{usd.format(envelopeRemaining)}</b></span>
        </div>
        <div className="envelope-grid">
          {envelopeRows.map((envelope) => (
            <article className={`envelope-card${envelope.left < 0 ? " over" : ""}`} key={envelope.category}>
              <div className="envelope-head">
                <b>{envelope.category}</b>
                <strong>{usd.format(envelope.left)}</strong>
              </div>
              <div className="envelope-progress">
                <i style={{ width: `${Math.min(100, envelope.budget ? (envelope.spent / envelope.budget) * 100 : 0)}%` }} />
              </div>
              <div className="envelope-math">
                <span>{usd.format(envelope.spent)} spent</span>
                <span>of {usd.format(envelope.budget)}</span>
              </div>
              <Label>
                Monthly envelope
                <Input
                  type="number"
                  min="0"
                  step=".01"
                  defaultValue={envelope.budget || ""}
                  placeholder="$0"
                  onBlur={(event) =>
                    post({
                      action: "budget",
                      month,
                      category: envelope.category,
                      amount: event.target.value,
                    })
                  }
                />
              </Label>
              <div className="receipt-entry">
                <Input
                  aria-label={`Receipt total for ${envelope.category}`}
                  type="number"
                  min="0"
                  step=".01"
                  placeholder="Receipt total"
                  value={receiptDrafts[envelope.category] || ""}
                  onChange={(event) =>
                    setReceiptDrafts((current) => ({
                      ...current,
                      [envelope.category]: event.target.value,
                    }))
                  }
                />
                <Button
                  variant="outline"
                  disabled={!Number(receiptDrafts[envelope.category])}
                  onClick={() =>
                    post({
                      action: "transaction",
                      date: month === today.slice(0, 7) ? today : `${month}-01`,
                      description: `${envelope.category} receipt`,
                      amount: receiptDrafts[envelope.category],
                      type: "expense",
                      category: envelope.category,
                      account: everydayAccounts[0]?.name || "Everyday spending",
                    }).then(() => {
                      setReceiptDrafts((current) => ({ ...current, [envelope.category]: "" }));
                      toast.success(`${envelope.category} receipt added.`);
                    })
                  }
                >
                  <ReceiptText /> Add receipt
                </Button>
              </div>
            </article>
          ))}
        </div>
      </Panel>
      <Panel
        title="Food and transportation activity"
        sub={`${usd.format(foodTransportationTotal)} spent this month · each item shows its source account`}
      >
        {foodTransportationRows.length ? (
          <div className="everyday-activity">
            {foodTransportationRows.map((item) => (
              <article key={item.id}>
                <span>{item.date.slice(5)}</span>
                <b>{item.description}</b>
                <em>{item.category}</em>
                <small>From {item.account}</small>
                <strong>{usd.format(item.amount)}</strong>
              </article>
            ))}
          </div>
        ) : (
          <Empty text="No food or transportation expenses found for this month." />
        )}
      </Panel>
      {carryovers.length > 0 && (
        <section className="carryover">
          <div className="carryover-title">
            <div>
              <b>Prior month carryover</b>
              <small>
                Unpaid bills from earlier months stay here until marked paid.
              </small>
            </div>
            <span>{carryovers.length} unpaid</span>
          </div>
          <div className="bill-list">
            {carryovers.map(({ p, r }) => billCard(r, p.month, true))}
          </div>
        </section>
      )}
      <div className="bill-list">
        {rows.map((r) => billCard(r, month))}
      </div>
    </>
  );
}
const Metric = ({
  n,
  v,
  s,
  icon,
  onClick,
}: {
  n: string;
  v: string;
  s: string;
  icon: any;
  onClick?: () => void;
}) => (
  <button
    type="button"
    className={`metric${onClick ? " metric-link" : ""}`}
    onClick={onClick}
  >
    <div>
      <span>{n}</span>
      <b>{v}</b>
      <small>{s}</small>
    </div>
    <i>{icon}</i>
  </button>
);
const Title = ({
  over,
  title,
  action,
}: {
  over: string;
  title: string;
  action: any;
}) => (
  <div className="title">
    <div>
      <p>{over}</p>
      <h1>{title}</h1>
    </div>
    <div className="actions">{action}</div>
  </div>
);
const Panel = ({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: any;
}) => (
  <section className="panel">
    {title && (
      <div className="paneltitle">
        <b>{title}</b>
        <small>{sub}</small>
      </div>
    )}
    {children}
  </section>
);
const Empty = ({ text }: { text: string }) => (
  <div className="empty">
    <ReceiptText />
    <p>{text}</p>
  </div>
);
function Entry({
  type,
  month,
  categories,
  transaction,
  debt,
  recurring,
  close,
  save,
}: {
  type: string | null;
  month: string;
  categories: string[];
  transaction?: Tx | null;
  debt?: D | null;
  recurring?: R | null;
  close: () => void;
  save: (x: any) => Promise<void>;
}) {
  const isTx = type === "transaction" || type === "transaction-update",
    isDebt = type === "debt" || type === "debt-update",
    isRecurring = type === "recurring" || type === "recurring-update",
    submit = async (e: any) => {
      e.preventDefault();
      await save({
        action: type,
        ...Object.fromEntries(new FormData(e.currentTarget)),
      });
    };
  return (
    <Dialog open={!!type} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {type === "transaction-update"
              ? "Edit transaction"
              : type === "debt-update"
                ? "Edit debt"
                : type === "recurring-update"
                  ? "Edit recurring item"
                  : type === "transaction"
                    ? "Add transaction"
                    : type === "recurring"
                      ? "Add recurring item"
                      : type === "debt"
                        ? "Add debt"
                        : "Add savings goal"}
          </DialogTitle>
          <DialogDescription>Enter the details below.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          {isTx && (
            <>
              <input type="hidden" name="id" value={transaction?.id || ""} />
              <Field n="Date">
                <Input
                  name="date"
                  type="date"
                  defaultValue={transaction?.date || month + "-01"}
                  required
                />
              </Field>
              <Field n="Description">
                <Input
                  name="description"
                  defaultValue={transaction?.description || ""}
                  required
                />
              </Field>
              <Field n="Amount">
                <Input
                  name="amount"
                  type="number"
                  step=".01"
                  defaultValue={transaction?.amount || ""}
                  required
                />
              </Field>
              <Choice
                n="type"
                items={["expense", "income", "transfer"]}
                value={transaction?.type}
              />
              <Choice n="category" items={categories} value={transaction?.category} />
              <Field n="Account">
                <Input
                  name="account"
                  defaultValue={transaction?.account || "Checking"}
                />
              </Field>
            </>
          )}
          {isRecurring && (
            <>
              <input type="hidden" name="id" value={recurring?.id || ""} />
              <Field n="Name">
                <Input
                  name="name"
                  defaultValue={recurring?.name || ""}
                  required
                />
              </Field>
              <Field n="Amount">
                <Input
                  name="amount"
                  type="number"
                  step=".01"
                  defaultValue={recurring?.amount || ""}
                  required
                />
              </Field>
              <Field n="Day of month">
                <Input
                  name="dueDay"
                  type="number"
                  min="1"
                  max="31"
                  defaultValue={recurring?.dueDay || 1}
                  required
                />
              </Field>
              <Choice
                n="type"
                items={["expense", "income"]}
                value={recurring?.type}
              />
              <Choice n="category" items={categories} value={recurring?.category} />
            </>
          )}
          {isDebt && (
            <>
              <input type="hidden" name="id" value={debt?.id || ""} />
              <Field n="Account name">
                <Input name="name" defaultValue={debt?.name || ""} required />
              </Field>
              <Choice
                n="kind"
                items={["Credit card", "Mortgage", "Vehicle", "Other"]}
                value={debt?.kind}
              />
              <Field n="Balance">
                <Input
                  name="balance"
                  type="number"
                  step=".01"
                  defaultValue={debt?.balance || ""}
                  required
                />
              </Field>
              <Field n="APR %">
                <Input
                  name="apr"
                  type="number"
                  step=".001"
                  defaultValue={debt?.apr || ""}
                  required
                />
              </Field>
              <Field n="Due day">
                <Input
                  name="dueDay"
                  type="number"
                  min="1"
                  max="31"
                  defaultValue={debt?.dueDay || 1}
                  required
                />
              </Field>
              <Field n="Monthly payment">
                <Input
                  name="minPayment"
                  type="number"
                  step=".01"
                  defaultValue={debt?.minPayment || ""}
                  required
                />
              </Field>
            </>
          )}
          {type === "goal" && (
            <>
              <Field n="Goal name">
                <Input name="name" required />
              </Field>
              <Field n="Target amount">
                <Input name="target" type="number" step=".01" required />
              </Field>
              <Field n="Already saved">
                <Input name="saved" type="number" step=".01" defaultValue="0" />
              </Field>
              <Field n="Target date">
                <Input name="targetDate" type="date" />
              </Field>
            </>
          )}
          <Button type="submit">Save</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
const Field = ({ n, children }: { n: string; children: any }) => (
  <Label className="field">
    {n}
    {children}
  </Label>
);
const Choice = ({
  n,
  items,
  value,
}: {
  n: string;
  items: string[];
  value?: string;
}) => (
  <Field n={n[0].toUpperCase() + n.slice(1)}>
    <Select name={n} defaultValue={value || items[0]}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((x) => (
          <SelectItem key={x} value={x}>
            {x[0].toUpperCase() + x.slice(1)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </Field>
);
