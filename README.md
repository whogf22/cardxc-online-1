# CardXC - Modern Fintech Platform

CardXC is a secure, scalable fintech application for digital payments, virtual cards, gift cards, and wallet management. Built with React, Node.js, and PostgreSQL.

## Key Features

- **Multi-Currency Wallet**: USD, EUR, GBP, NGN, BDT support with real-time balance tracking
- **Virtual Cards**: Instant issuance via Stripe Issuing, freeze/unfreeze, spending limits
- **Gift Cards**: Buy and sell gift cards with integrated marketplace
- **Deposits**: Stripe Checkout with OTP email verification for security
- **Transactions**: P2P transfers, payment links, QR payments
- **Crypto**: Deposit and withdrawal support
- **Savings**: Vaults, budgets, and round-up savings
- **Rewards**: Cashback, referral bonuses, subscription detection
- **Security**: 2FA, fraud detection, device fingerprinting, rate limiting
- **Real-time**: WebSocket notifications via Socket.IO
- **Admin**: Full admin dashboard with analytics, user management, and security monitoring

## Technology Stack

- **Frontend**: React 19, TypeScript, Vite, TailwindCSS
- **Backend**: Node.js, Express, TypeScript (ESM)
- **Database**: PostgreSQL
- **Payments**: Stripe (Checkout, Issuing, 3DS2)
- **Real-time**: Socket.IO

## Project Structure

```
├── src/                  # Frontend (React + Vite)
│   ├── components/       # Shared UI components
│   ├── pages/            # Page components
│   ├── contexts/         # React contexts
│   ├── hooks/            # Custom hooks
│   ├── lib/              # API client, utilities
│   └── router/           # Route configuration
├── server/               # Backend (Express)
│   ├── routes/           # API route handlers
│   ├── services/         # Business logic services
│   ├── db/               # Database pool, init, migrations
│   ├── middleware/        # Auth, rate limiting, logging
│   └── config/           # Swagger, environment config
├── scripts/              # Utility scripts
└── public/               # Static assets
```

## Setup

### Prerequisites

- Node.js v20+
- PostgreSQL 16+

### Environment Variables

Create a `.env` file with:

```env
DATABASE_URL=<your-database-url>
SESSION_SECRET=<your-session-secret-64-chars-min>
JWT_SECRET=<your-jwt-secret>
STRIPE_SECRET_KEY=<your-stripe-secret-key>
STRIPE_PUBLISHABLE_KEY=<your-stripe-public-key>
SMTP_HOST=<your-smtp-host>
SMTP_USER=<your-smtp-user>
SMTP_PASS=<your-smtp-password>
NODE_ENV=production
```

### Installation

```bash
npm install
npm run build
npm start
```

### Development

```bash
npm run dev
```

## API Documentation

Swagger docs available at `/api-docs` when the server is running.

---

*Maintained by the CardXC Team*
