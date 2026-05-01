import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCheckoutSession } from "@/lib/stripe";

interface CheckoutRequestBody {
  priceId?: string;
}

export async function POST(request: Request) {
  let body: CheckoutRequestBody = {};
  try {
    body = (await request.json()) as CheckoutRequestBody;
  } catch {
    body = {};
  }

  const supabase = createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.email) {
    return NextResponse.json({ error: "Missing user email." }, { status: 400 });
  }

  const priceId = body.priceId ?? process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    return NextResponse.json({ error: "Missing Stripe price ID." }, { status: 400 });
  }

  try {
    const session = await createCheckoutSession(user.id, user.email, priceId);
    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
