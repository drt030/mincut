import Stripe from "stripe";
import { createUnlockGET } from "@/lib/unlockRoute";

export const GET = createUnlockGET({
  env: process.env,
  retrieveCheckoutSession: async (sessionId, secretKey) => {
    const stripe = new Stripe(secretKey);
    return stripe.checkout.sessions.retrieve(sessionId, { expand: ["line_items"] });
  },
});
