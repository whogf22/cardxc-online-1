# Security Implementation Guide

## Overview
This document outlines the comprehensive security measures implemented to protect the CardXC platform from various attack vectors.

## Security Layers

### 1. **Rate Limiting & DDoS Protection**
- **Authentication endpoints**: 5 attempts per 15 minutes (production)
- **API endpoints**: 100 requests per minute
- **Sensitive operations**: 10 requests per minute
- **Financial operations**: 5 requests per minute (strictest)
- **Password reset**: 3 attempts per hour
- **IP-based blocking**: Automatic blocking after 5 failed attempts for 15 minutes

### 2. **Input Validation & Sanitization**
- **SQL Injection Protection**: 
  - Parameterized queries (all database operations)
  - Pattern detection for SQL injection attempts
  - Automatic blocking of suspicious inputs
  
- **XSS Protection**:
  - DOMPurify for HTML sanitization
  - Content Security Policy (CSP) headers
  - Input escaping on all user inputs
  
- **Path Traversal Protection**:
  - Detection and blocking of `../` patterns
  - URL encoding detection

### 3. **Security Headers**
- `X-Content-Type-Options: nosniff` - Prevents MIME type sniffing
- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-XSS-Protection: 1; mode=block` - XSS protection
- `Strict-Transport-Security` - HSTS for HTTPS enforcement
- `Content-Security-Policy` - Restricts resource loading
- `Referrer-Policy` - Controls referrer information
- `Permissions-Policy` - Restricts browser features

### 4. **Authentication Security**
- **Password Security**:
  - bcrypt hashing with 12 rounds
  - Minimum 8 characters required
  - Account locking after 5 failed attempts (30 minutes)
  
- **Session Management**:
  - JWT tokens with expiration (24 hours)
  - Session validation on every request
  - Automatic session cleanup for expired sessions
  - Session invalidation on logout
  
- **Two-Factor Authentication**:
  - TOTP-based 2FA support
  - QR code generation for setup
  - Backup codes support

### 5. **Brute Force Protection**
- **IP-based tracking**: Failed attempts tracked per IP
- **Account locking**: Automatic lock after 5 failed login attempts
- **Progressive delays**: Increasing delays for repeated failures
- **Security logging**: All failed attempts logged with severity levels

### 6. **Request Validation**
- **Size limits**: 
  - JSON body: 50KB max
  - URL-encoded: 10KB max
  - Parameter limit: 20 parameters max
  
- **Type validation**: Strict JSON parsing
- **Malicious input detection**: Real-time pattern matching

### 7. **Financial Security**
- **Integer cents storage**: All money stored as BIGINT (no floating point)
- **Idempotency keys**: Unique constraints prevent duplicate transactions
- **Database transactions**: Atomic operations for financial updates
- **Audit logging**: All financial operations logged
- **Rate limiting**: Stricter limits on financial operations

### 8. **Security Monitoring**
- **Real-time logging**: All security events logged with severity levels
- **Admin dashboard**: Security events visible to admins
- **Rate limit monitoring**: Track and clear rate limit violations
- **IP tracking**: Monitor suspicious IPs and their activities

## Security Endpoints

### Admin Security Endpoints
- `GET /api/admin/security/events` - View security events
- `GET /api/admin/security/rate-limits` - View rate limit violations
- `POST /api/admin/security/rate-limits/clear` - Clear rate limits

## Attack Vector Protection

### ✅ SQL Injection
- **Protection**: Parameterized queries, pattern detection
- **Status**: Fully protected

### ✅ Cross-Site Scripting (XSS)
- **Protection**: Input sanitization, CSP headers, output escaping
- **Status**: Fully protected

### ✅ Cross-Site Request Forgery (CSRF)
- **Protection**: SameSite cookies, origin validation
- **Status**: Protected

### ✅ Brute Force Attacks
- **Protection**: Rate limiting, account locking, IP blocking
- **Status**: Fully protected

### ✅ DDoS Attacks
- **Protection**: Rate limiting, request size limits, connection limits
- **Status**: Protected (consider CDN for production)

### ✅ Path Traversal
- **Protection**: Pattern detection, path validation
- **Status**: Fully protected

### ✅ Session Hijacking
- **Protection**: Secure cookies, session validation, IP tracking
- **Status**: Protected

### ✅ Man-in-the-Middle (MITM)
- **Protection**: HSTS headers, HTTPS enforcement
- **Status**: Protected (requires HTTPS in production)

## Security Best Practices

### For Developers
1. **Never log sensitive data** (passwords, tokens, credit cards)
2. **Always use parameterized queries** - Never concatenate SQL
3. **Validate all inputs** - Use express-validator
4. **Sanitize outputs** - Escape HTML, use DOMPurify
5. **Use HTTPS in production** - Never transmit sensitive data over HTTP
6. **Keep dependencies updated** - Regularly update npm packages
7. **Review security logs** - Monitor for suspicious activity

### For Administrators
1. **Monitor security events** - Check `/api/admin/security/events` regularly
2. **Review rate limit violations** - Identify potential attacks
3. **Audit user activities** - Review audit logs for suspicious behavior
4. **Keep secrets secure** - Rotate secrets regularly
5. **Enable 2FA** - Require 2FA for admin accounts
6. **Regular backups** - Ensure database backups are working

## Incident Response

### If Attack Detected
1. **Immediate Actions**:
   - Check security events endpoint
   - Identify affected IPs/users
   - Block suspicious IPs if needed
   - Review audit logs

2. **Investigation**:
   - Analyze security event logs
   - Check rate limit violations
   - Review user activity patterns
   - Identify attack vector

3. **Remediation**:
   - Block malicious IPs
   - Reset affected user sessions
   - Update security rules if needed
   - Notify affected users if required

## Security Checklist

- [x] Rate limiting implemented
- [x] Input validation on all endpoints
- [x] SQL injection protection
- [x] XSS protection
- [x] CSRF protection
- [x] Brute force protection
- [x] Security headers configured
- [x] Session management secure
- [x] Password hashing (bcrypt)
- [x] Audit logging enabled
- [x] Security monitoring dashboard
- [x] Financial transaction security
- [x] Request size limits
- [x] Path traversal protection
- [x] Malicious input detection

## Environment Variables

Required security environment variables:
- `SESSION_SECRET` - JWT secret (must be strong, random)
- `DATABASE_URL` - Database connection (keep secure)
- `BOOTSTRAP_SUPER_ADMIN_EMAIL` - Admin email
- `BOOTSTRAP_SUPER_ADMIN_PASSWORD` - Admin password (min 8 chars)

## Reporting Security Issues

If you discover a security vulnerability:
1. **DO NOT** create a public issue
2. Contact the security team immediately
3. Provide detailed information about the vulnerability
4. Allow time for the fix before public disclosure

## Updates

This security implementation is continuously improved. Last updated: 2026-01-27
