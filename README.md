# CardXC - Modern Fintech Platform

CardXC is a secure, scalable, and feature-rich fintech application designed for modern banking operations. Built with React, Node.js, and PostgreSQL, it offers a complete suite of financial tools including virtual cards, P2P transfers, savings goals, and advanced fraud detection.

## 🚀 Key Features

* **Virtual Cards**: Instant issuance, freeze/unfreeze, and spending limits.
* **Transactions**: Real-time peer-to-peer transfers and payment processing.
* **Security**: Bank-grade security with 2FA, IP blocking, and fraud detection.
* **Analytics**: Admin dashboard for monitoring system health and transaction flows.
* **AI Integration**: Smart insights and financial advice powered by AI.

## 🛠️ Technology Stack

* **Frontend**: React 19, Vite, TailwindCSS, Framer Motion
* **Backend**: Node.js, Express, TypeScript
* **Database**: PostgreSQL
* **Tools**: MCP Server for remote management, Swagger for API docs

## ⚙️ Setup & Configuration

### Prerequisites

* Node.js v20+
* PostgreSQL 16+

### Environment Variables

Ensure the following variables are set in your `.env` file:

```env
DATABASE_URL=<your-database-url>
SESSION_SECRET=<your-session-secret-64-chars-min>
STRIPE_SECRET_KEY=<your-stripe-secret-key>
NODE_ENV=production
```

### Installation

```bash
npm install
npm run build
npm start
```

## 📡 API Documentation

The full API documentation is available at `/api-docs` when the server is running.

## 🔌 MCP Server

This project exposes a Model Context Protocol (MCP) server for remote administration.
**Tools:**

* `get_system_health`: Check API status.
* `query_database`: Run SQL queries.
* `check_logs`: View system logs.
* `list_files` / `read_file` / `write_file`: File system access.

---
*Maintained by the CardXC Team*

Auto-check test successful - 2026
