import { budgetPinMatches, createBudgetSession } from "../../auth";

export async function POST(request: Request) {
  const { pin } = (await request.json()) as { pin?: string };
  if (!budgetPinMatches(String(pin || "")))
    return Response.json({ error: "Invalid PIN" }, { status: 401 });
  const session = await createBudgetSession();
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "content-type": "application/json",
      "set-cookie": `budget_session=${session}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`,
    },
  });
}
