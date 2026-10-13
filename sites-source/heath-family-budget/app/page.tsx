import BudgetApp from "./budget-app";
import PinGate from "./pin-gate";
import { headers } from "next/headers";
import { isBudgetSessionValid } from "./auth";
export const dynamic = "force-dynamic";
export default async function Home() {
  const requestHeaders = await headers();
  const authorized = await isBudgetSessionValid(requestHeaders.get("cookie") || "");
  return authorized ? <BudgetApp /> : <PinGate />;
}
