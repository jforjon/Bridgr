import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!webhookSecret) {
  throw new Error("Missing STRIPE_WEBHOOK_SECRET");
}
if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing Supabase service role credentials.");
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
const stripeWebhookSecret = webhookSecret;

export const config = {
  api: {
    bodyParser: false
  }
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = headers().get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe signature." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, stripeWebhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook signature error";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const customerId =
      typeof session.customer === "string" ? session.customer : session.customer?.id;

    if (userId && customerId) {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({
          subscription_status: "pro",
          stripe_customer_id: customerId
        })
        .eq("id", userId);

      if (error) {
        console.error("Failed to mark user as pro:", error);
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id;

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ subscription_status: "free" })
      .eq("stripe_customer_id", customerId);

    if (error) {
      console.error("Failed to downgrade user:", error);
    }
  }

  return NextResponse.json({ received: true });
}
