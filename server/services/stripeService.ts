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
  metadata: Record<string, string> = {},
  options?: {
    description?: string;
    statementDescriptor?: string;
  }
): Promise<{ clientSecret: string; paymentIntentId: string }> {
  if (!stripe) {
    throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY.');
  }

  // 3DS2 Configuration for high success rates and reduced decline rates
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: currency.toLowerCase(),
    metadata,
    description: options?.description || 'CardXC Wallet Deposit',
    statement_descriptor: options?.statementDescriptor || 'CARDXC DEPOSIT',
    capture_method: 'automatic',
    // Setup for future use (recurring payments)
    setup_future_usage: 'off_session',
    // Automatic payment methods with 3DS2 support
    automatic_payment_methods: {
      enabled: true,
      // Allow all payment methods including cards with 3DS2
      allow_redirects: 'always',
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
  returnUrl: string,
  merchantName: string = 'CardXC'
): Promise<{ clientSecret: string; sessionId: string }> {
  if (!stripe) {
    throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY.');
  }

  // Dynamic statement descriptor for bank history (max 22 chars)
  const statementDescriptor = merchantName.substring(0, 22).toUpperCase();

  const session = await stripe.checkout.sessions.create({
    ui_mode: 'embedded',
    mode: 'payment',
    line_items: [
      {
        price_data: {
          product_data: {
            name: 'CardXC Wallet Deposit',
            description: `Deposit to ${merchantName}`,
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
      merchantName,
    },
    customer_email: userEmail,
    return_url: returnUrl,
    // 3DS2 and high success rate configuration
    payment_method_options: {
      card: {
        // Enable 3DS2 authentication
        request_three_d_secure: 'any',
        // Store card for future use
        setup_future_usage: 'off_session',
      },
    } as any,
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
