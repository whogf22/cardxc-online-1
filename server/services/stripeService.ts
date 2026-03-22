import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

let stripe: Stripe | null = null;

if (stripeSecretKey) {
  stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2026-01-28.clover' as any,
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

export async function createCheckoutSession(
  amountCents: number,
  currency: string,
  orderId: string,
  userEmail: string,
  returnUrl: string
): Promise<{ clientSecret: string; sessionId: string }> {
  if (!stripe) {
    throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY.');
  }

  const session = await stripe.checkout.sessions.create({
    ui_mode: 'embedded',
    mode: 'payment',
    line_items: [
      {
        price_data: {
          product_data: {
            name: 'CardXC Wallet Deposit',
          },
          unit_amount: amountCents,
          currency: currency.toLowerCase(),
        },
        quantity: 1,
      },
    ],
    metadata: {
      orderId,
      source: 'card_deposit',
    },
    customer_email: userEmail,
    return_url: returnUrl,
  });

  return {
    clientSecret: session.client_secret!,
    sessionId: session.id,
  };
}

export async function getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
  if (!stripe) {
    throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY.');
  }

  return await stripe.checkout.sessions.retrieve(sessionId);
}

export function constructWebhookEvent(
  payload: Buffer | string,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  if (!stripe) {
    throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY.');
  }

  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

export function getStripePublishableKey(): string | undefined {
  return process.env.STRIPE_PUBLISHABLE_KEY;
}
