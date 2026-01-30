# CardXC Architecture & UX Analysis

## Executive Summary
CardXC is a fintech platform enabling digital banking operations. This document provides a systems-level architectural analysis with UX considerations, designed to guide both developers and designers.

---

## 1. Application Architecture Diagram (Logical)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Landing   │    │    Auth     │    │  Dashboard  │    │   Admin     │  │
│  │   (Home)    │───▶│  (SignIn/   │───▶│  (Protected │───▶│  (Admin     │  │
│  │             │    │   SignUp)   │    │   Routes)   │    │   Routes)   │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│         │                  │                  │                  │          │
│         └──────────────────┴──────────────────┴──────────────────┘          │
│                                     │                                        │
│                          ┌──────────▼──────────┐                            │
│                          │   React Context     │                            │
│                          │  ┌───────────────┐  │                            │
│                          │  │ AuthContext   │  │                            │
│                          │  │ ToastContext  │  │                            │
│                          │  │ CurrencyCtx   │  │                            │
│                          │  └───────────────┘  │                            │
│                          └──────────┬──────────┘                            │
│                                     │                                        │
│                          ┌──────────▼──────────┐                            │
│                          │   API Client Layer  │                            │
│                          │  (lib/api.ts)       │                            │
│                          └──────────┬──────────┘                            │
└─────────────────────────────────────┼───────────────────────────────────────┘
                                      │ HTTPS
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY LAYER                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Express.js Server (Port 3001)                    │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  Middleware Stack:                                                   │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │ Helmet   │▶│  CORS    │▶│  Rate    │▶│ Security │▶│  Auth    │   │   │
│  │  │ Headers  │ │ Policy   │ │ Limiter  │ │ Checks   │ │ JWT/2FA  │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                     │                                        │
│  ┌──────────────────────────────────┴──────────────────────────────────┐   │
│  │                         Route Handlers                               │   │
│  ├──────────┬──────────┬──────────┬──────────┬──────────┬──────────────┤   │
│  │   Auth   │  User    │  Trans   │  Cards   │ Payments │   Admin      │   │
│  │ /auth/*  │ /user/*  │ /trans/* │ /cards/* │ /pay/*   │  /admin/*    │   │
│  └──────────┴──────────┴──────────┴──────────┴──────────┴──────────────┘   │
│                                     │                                        │
└─────────────────────────────────────┼───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             SERVICE LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Email     │  │   Fraud     │  │    2FA      │  │   Background Jobs   │ │
│  │  Service    │  │  Detection  │  │  Service    │  │   (Cron Tasks)      │ │
│  │             │  │             │  │             │  │   - Recurring xfers │ │
│  │ - Templates │  │ - Velocity  │  │ - TOTP      │  │   - Roundups        │ │
│  │ - SMTP      │  │ - Patterns  │  │ - QR Codes  │  │   - Cashback        │ │
│  │ - Queuing   │  │ - Risk Calc │  │             │  │   - Cleanup         │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────────┬───────────┘ │
│         │                │                │                   │             │
│         └────────────────┴────────────────┴───────────────────┘             │
│                                     │                                        │
└─────────────────────────────────────┼───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA LAYER                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    PostgreSQL (Neon-backed)                          │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │   Tables:                                                            │   │
│  │   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │   │  users   │ │ wallets  │ │ ledger   │ │  cards   │ │  audit   │  │   │
│  │   │          │ │          │ │ entries  │ │          │ │  logs    │  │   │
│  │   └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │   │
│  │                                                                      │   │
│  │   Connection Pool: max=20, idleTimeout=30s, connectTimeout=5s        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL SERVICES                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Stripe    │  │   SMTP      │  │  Gemini AI  │  │   MCP Server        │ │
│  │  Payments   │  │  (Email)    │  │  Analysis   │  │   (Port 8080)       │ │
│  │             │  │             │  │             │  │   - AI Tools        │ │
│  │ - Deposits  │  │ - Hostinger │  │ - Code Gen  │  │   - File Ops        │ │
│  │ - Webhooks  │  │ - Templates │  │ - Error Fix │  │   - DB Queries      │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. User Journey Flows

### 2.1 New User Acquisition Flow
```
ENTRY                    ENGAGEMENT                 CONVERSION
─────                    ──────────                 ──────────

Landing Page ──▶ Feature Discovery ──▶ Sign Up CTA
     │                                      │
     ▼                                      ▼
  [Home /]                            [/signup]
     │                                      │
     │         ┌────────────────────────────┤
     │         │                            │
     │         ▼                            ▼
     │    Google OAuth              Email/Password
     │         │                            │
     │         └────────────────────────────┤
     │                                      ▼
     │                              Email Verification
     │                                      │
     │                                      ▼
     └─────────────────────────────▶ Onboarding Slides
                                            │
                                            ▼
                                    Dashboard (First Visit)
                                            │
                                            ▼
                                    Account Setup Wizard
                                    ├─ Complete Profile
                                    ├─ Verify Email ✓
                                    ├─ Add Payment Method
                                    └─ Enable 2FA

FRICTION POINTS:
• Email verification delay (user may abandon)
• Payment method setup complexity
• 2FA setup requires authenticator app download

LIFT OPPORTUNITIES:
• Skip-able onboarding with progressive disclosure
• Social proof during signup (user count, testimonials)
• Guided payment setup with visual instructions
```

### 2.2 Deposit Flow (Primary Conversion)
```
                    AWARENESS              ACTION                 CONFIRMATION
                    ─────────              ──────                 ────────────

Dashboard ──▶ "Deposit" Button ──▶ Payment Method Selection ──▶ Amount Entry
    │                                       │                         │
    │                                       ├─ Card Payment           │
    │                                       ├─ Bank Transfer          │
    │                                       └─ Crypto                 │
    │                                                                 │
    │                                       ┌─────────────────────────┘
    │                                       ▼
    │                               Processing Screen
    │                               (Loading State)
    │                                       │
    │                                       ▼
    │                               Success/Failure
    │                                       │
    │                                       ▼
    └───────────────────────────── Return to Dashboard
                                    (Updated Balance)

FRICTION POINTS:
• KYC verification required before first deposit
• Payment processing wait time
• Stripe redirect breaks flow continuity

LIFT OPPORTUNITIES:
• Real-time balance preview during entry
• Save payment methods for one-click deposits
• Clear fee disclosure upfront
```

### 2.3 Transfer Flow (P2P)
```
Dashboard ──▶ "Send" ──▶ Recipient Selection ──▶ Amount ──▶ Confirm ──▶ Success
    │                         │                     │          │
    │                         ├─ Email              │          │
    │                         ├─ Phone              │          │
    │                         └─ Address Book       │          │
    │                                               │          │
    │                         ┌─────────────────────┘          │
    │                         ▼                                │
    │                   Insufficient Funds?                    │
    │                         │                                │
    │                         ├─ YES ──▶ Prompt Deposit        │
    │                         │                                │
    │                         └─ NO ──▶ Continue ──────────────┘

FRICTION POINTS:
• Recipient validation delay
• 2FA confirmation for large amounts
• Fee calculation complexity

LIFT OPPORTUNITIES:
• Recent recipients quick-select
• Smart amount suggestions based on history
• Instant confirmation with animation
```

### 2.4 Admin Flow
```
Admin Login ──▶ 2FA Verification ──▶ Admin Dashboard
                                           │
                ┌──────────────────────────┼──────────────────────────┐
                ▼                          ▼                          ▼
          User Management           Transaction Monitor         Analytics
                │                          │                          │
                ├─ View Users              ├─ All Transactions        ├─ Revenue
                ├─ KYC Approval            ├─ Fraud Flags             ├─ User Growth
                ├─ Account Status          ├─ Pending Reviews         ├─ System Health
                └─ Role Management         └─ Manual Overrides        └─ Reports
```

---

## 3. Data Flow Diagrams

### 3.1 Authentication Flow
```
┌─────────┐      ┌─────────┐      ┌─────────┐      ┌─────────┐
│  User   │      │  React  │      │ Express │      │   DB    │
│ Browser │      │   App   │      │   API   │      │         │
└────┬────┘      └────┬────┘      └────┬────┘      └────┬────┘
     │                │                │                │
     │ Enter Creds    │                │                │
     │───────────────▶│                │                │
     │                │ POST /auth/login               │
     │                │───────────────▶│                │
     │                │                │ Query user     │
     │                │                │───────────────▶│
     │                │                │◀───────────────│
     │                │                │                │
     │                │                │ Validate pwd   │
     │                │                │ (bcrypt)       │
     │                │                │                │
     │                │                │ Check 2FA      │
     │                │◀───────────────│                │
     │                │ 2FA Required   │                │
     │◀───────────────│                │                │
     │                │                │                │
     │ Enter TOTP     │                │                │
     │───────────────▶│                │                │
     │                │ POST /auth/verify-2fa          │
     │                │───────────────▶│                │
     │                │                │ Verify TOTP    │
     │                │                │ Create session │
     │                │◀───────────────│                │
     │                │ JWT Token      │                │
     │◀───────────────│                │                │
     │                │                │                │
     │                │ Store in       │                │
     │                │ AuthContext    │                │
     │                │                │                │
```

### 3.2 Transaction Flow
```
┌─────────┐      ┌─────────┐      ┌─────────┐      ┌─────────┐      ┌─────────┐
│  User   │      │  React  │      │ Express │      │ Fraud   │      │   DB    │
│ Action  │      │   UI    │      │   API   │      │ Service │      │         │
└────┬────┘      └────┬────┘      └────┬────┘      └────┬────┘      └────┬────┘
     │                │                │                │                │
     │ Initiate       │                │                │                │
     │ Transfer       │                │                │                │
     │───────────────▶│                │                │                │
     │                │ POST /transfer │                │                │
     │                │───────────────▶│                │                │
     │                │                │ Rate limit     │                │
     │                │                │ check          │                │
     │                │                │                │                │
     │                │                │ Validate input │                │
     │                │                │                │                │
     │                │                │ Fraud check    │                │
     │                │                │───────────────▶│                │
     │                │                │                │ Analyze        │
     │                │                │                │ velocity,      │
     │                │                │                │ patterns       │
     │                │                │◀───────────────│                │
     │                │                │                │                │
     │                │                │ Check balance  │                │
     │                │                │───────────────────────────────▶│
     │                │                │◀───────────────────────────────│
     │                │                │                │                │
     │                │                │ BEGIN TRANSACTION              │
     │                │                │───────────────────────────────▶│
     │                │                │ Debit sender   │                │
     │                │                │ Credit receiver│                │
     │                │                │ Create ledger  │                │
     │                │                │ COMMIT         │                │
     │                │                │◀───────────────────────────────│
     │                │                │                │                │
     │                │◀───────────────│                │                │
     │◀───────────────│ Success        │                │                │
     │                │                │                │                │
     │                │                │ Async: Send    │                │
     │                │                │ notification   │                │
     │                │                │ email          │                │
```

---

## 4. Performance, Scalability & Security Risks

### 4.1 Performance Risks

| Risk | Severity | Location | Impact |
|------|----------|----------|--------|
| Polling-based real-time updates | Medium | `useRealtimeBalance.ts`, `useRealtimeTransactions.ts` | High server load with many concurrent users |
| Unoptimized database queries | Medium | Various routes | Slow response times on large datasets |
| Synchronous email sending | Low | `emailService.ts` | Request blocking during email dispatch |
| Large bundle size | Medium | Frontend | Slow initial load, especially on mobile |
| No response caching | Medium | API routes | Repeated identical queries hit database |

### 4.2 Scalability Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Single Node.js process | High | Implement clustering or use PM2 |
| Database connection pool limit (20) | Medium | Increase pool size or add read replicas |
| In-memory rate limiting | High | Use Redis for distributed rate limiting |
| Background jobs on main thread | Medium | Move to separate worker process |
| No horizontal scaling capability | High | Containerize and use load balancer |

### 4.3 Security Risks

| Risk | Severity | Current State | Recommendation |
|------|----------|---------------|----------------|
| JWT secret in fallback | High | Falls back to hardcoded value | Fail startup if missing |
| SQL injection | Low | ✅ Parameterized queries | Maintain current practice |
| XSS attacks | Low | ✅ DOMPurify + CSP | Maintain current practice |
| Rate limiting bypass | Medium | IP-based only | Add user-based limiting |
| Session hijacking | Medium | ✅ Secure cookies | Add session binding |
| MCP server exposure | Medium | API key auth only | Add IP whitelist option |

---

## 5. Suggested Architectural Improvements

### 5.1 Immediate (High Impact, Low Effort)

#### 1. Replace Polling with WebSockets
```
Current: setInterval(fetchBalance, 30000)  // 30s polling
Target:  WebSocket subscription to balance changes

Benefits:
- 90% reduction in API calls
- Real-time updates (sub-second)
- Better battery life on mobile
```

#### 2. Implement Response Caching
```typescript
// Add Redis caching layer
const cached = await redis.get(`user:${userId}:balance`);
if (cached) return JSON.parse(cached);

const balance = await db.query(...);
await redis.setex(`user:${userId}:balance`, 60, JSON.stringify(balance));
return balance;
```

#### 3. Async Email Sending
```typescript
// Current: await sendEmail(...)
// Target: Queue-based
await emailQueue.add('send', { to, subject, html });
// Process in background worker
```

### 5.2 Short-term (1-2 Sprints)

#### 1. API Response Optimization
- Implement GraphQL or selective field loading
- Add pagination to all list endpoints
- Compress responses with gzip/brotli

#### 2. Frontend Performance
- Code splitting by route (already using lazy())
- Implement virtual scrolling for transaction lists
- Add service worker for offline capability
- Preload critical assets

#### 3. Database Optimization
- Add indexes on frequently queried columns
- Implement query result caching
- Set up read replica for analytics queries

### 5.3 Long-term (Strategic)

#### 1. Microservices Migration Path
```
Current Monolith:
[Express Server] ──▶ [PostgreSQL]

Target Architecture:
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   API GW    │───▶│   Auth      │───▶│   Redis     │
│  (Kong/AWS) │    │  Service    │    │   Cache     │
└─────────────┘    └─────────────┘    └─────────────┘
       │
       ├──────────▶ Transaction Service ──▶ PostgreSQL
       │
       ├──────────▶ Card Service ──▶ PostgreSQL
       │
       ├──────────▶ Notification Service ──▶ Queue
       │
       └──────────▶ Analytics Service ──▶ ClickHouse
```

#### 2. Event-Driven Architecture
- Implement event bus (RabbitMQ/Kafka)
- Decouple services via events
- Enable event sourcing for audit trail

#### 3. Observability Stack
```
Metrics:    Prometheus + Grafana
Logging:    ELK Stack (Elasticsearch, Logstash, Kibana)
Tracing:    Jaeger/Zipkin
Alerting:   PagerDuty/Opsgenie
```

---

## 6. UX Improvement Recommendations

### 6.1 Reduce Friction

| Current State | Friction Point | Improvement |
|---------------|----------------|-------------|
| Email verification required | User abandonment | Progressive verification (verify later) |
| Multi-step deposit | Too many clicks | One-page deposit with saved methods |
| 2FA every login | Inconvenient | Remember device for 30 days |
| KYC before deposit | Blocks first action | Allow small deposits without KYC |
| Complex forms | Overwhelming | Progressive disclosure, smart defaults |

### 6.2 Increase Clarity

| Screen | Issue | Solution |
|--------|-------|----------|
| Dashboard | Information overload | Card-based hierarchy, collapsible sections |
| Transactions | No search/filter | Add search, date range, type filters |
| Fees | Hidden until checkout | Show fees upfront, calculator tool |
| Errors | Generic messages | Specific, actionable error messages |
| Loading | No feedback | Skeleton loaders, progress indicators |

### 6.3 Increase Lift (Conversion)

| Opportunity | Implementation |
|-------------|----------------|
| Onboarding completion | Gamification (progress bar, rewards) |
| First deposit | Welcome bonus, reduced fees |
| Referral program | Easy sharing, clear incentives |
| Feature discovery | Contextual tooltips, feature highlights |
| Re-engagement | Push notifications, email campaigns |

---

## 7. Metrics to Track

### Business Metrics
- User Acquisition Cost (UAC)
- Customer Lifetime Value (CLV)
- Activation Rate (signup → first deposit)
- Retention Rate (7-day, 30-day)
- Transaction Volume

### Technical Metrics
- API Response Time (p50, p95, p99)
- Error Rate
- Time to First Byte (TTFB)
- Largest Contentful Paint (LCP)
- Database Query Performance

### UX Metrics
- Task Completion Rate
- Time on Task
- User Error Rate
- System Usability Scale (SUS)
- Net Promoter Score (NPS)

---

## 8. Quick Wins Checklist

- [ ] Replace polling with WebSocket for balances
- [ ] Add loading skeletons to all data-fetching pages
- [ ] Implement "Remember this device" for 2FA
- [ ] Add search to transactions page
- [ ] Show fees before checkout confirmation
- [ ] Add "Save payment method" option
- [ ] Implement error boundary with retry button
- [ ] Add progress indicator to multi-step flows
- [ ] Create "Quick Actions" widget on dashboard
- [ ] Add haptic feedback on mobile for confirmations

---

*Document generated for CardXC architecture review. Last updated: January 2026*
