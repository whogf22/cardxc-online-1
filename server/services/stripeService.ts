import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

let stripe: Stripe | null = null;

if (stripeSecretKey) {
  stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2025-12-15.clover',
  });
}

export function isStripeConfigured(): boolean {
  return stripe !== null;
}

export async function createPaymentIntent(
  amountCents: number,
  currency: string = 'usd',
  metadata: Record<string, string> = {}
): Promise<{ clientSecret: string; paymentIntentId: string }> {
  if (!stripe) {
    throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY.');
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: currency.toLowerCase(),
    metadata,
    automatic_payment_methods: {
      enabled: true,
    },
  });

  return {
    clientSecret: paymentIntent.client_secret!,
    paymentIntentId: paymentIntent.id,
  };
}

export async function confirmPaymentIntent(paymentIntentId: string): Promise<{
  status: string;
  amountReceived: number;
}> {
  if (!stripe) {
    throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY.');
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

  return {
    status: paymentIntent.status,
    amountReceived: paymentIntent.amount_received,
  };
}

export async function getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
  if (!stripe) {
    throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY.');
  }

  return await stripe.paymentIntents.retrieve(paymentIntentId);
}
