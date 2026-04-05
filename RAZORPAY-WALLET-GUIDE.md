# Razorpay Wallet System - Implementation Guide

## Part 1: Installation & Setup

### Step 1: Install Dependencies
```bash
cd backend
npm install razorpay
```

### Step 2: Add Environment Variables
Add to `backend/.env`:
```env
RAZORPAY_KEY_ID=your_test_key_id
RAZORPAY_KEY_SECRET=your_test_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

Get test credentials from: https://dashboard.razorpay.com/app/keys

### Step 3: Run Database Migration
```bash
mysql -u root -p skillverse < database/migration_razorpay_wallet.sql
```

Verify:
```sql
USE skillverse;
SHOW TABLES LIKE '%wallet%';
SELECT * FROM point_packages;
SELECT COUNT(*) FROM wallets;
```

### Step 4: Add Razorpay Script to Frontend
Add to `frontend/public/index.html` before closing `</head>`:
```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

### Step 5: Update Frontend Routes
Add to `frontend/src/App.jsx`:
```jsx
import Wallet from './pages/Wallet';

// In routes:
<Route path="/wallet" element={<Wallet />} />
```

### Step 6: Restart Backend
```bash
cd backend
npm start
```

---

## Part 2: Testing the Implementation

### Test 1: Check API Endpoints
```bash
# Get point packages (public)
curl http://localhost:5000/api/payments/packages

# Get wallet (requires auth)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/wallet
```

### Test 2: Create Test Order
```bash
curl -X POST http://localhost:5000/api/payments/create-order \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"package_id": 1}'
```

### Test 3: Frontend Flow
1. Navigate to `/wallet`
2. Click "Buy Points"
3. Select a package
4. Complete Razorpay test payment
5. Verify points credited

### Test 4: Course Enrollment with Wallet
1. Go to any course page
2. Click "Enroll" (requires wallet balance)
3. Verify points deducted
4. Check transaction history

---

## Part 3: Webhook Configuration

### Step 1: Setup Webhook URL
In Razorpay Dashboard:
1. Go to Settings → Webhooks
2. Add webhook URL: `https://yourdomain.com/api/payments/webhook`
3. Select events: `payment.captured`, `payment.failed`
4. Copy webhook secret to `.env`

### Step 2: Test Webhook Locally (Optional)
Use ngrok for local testing:
```bash
ngrok http 5000
# Copy HTTPS URL to Razorpay webhook
```

### Step 3: Verify Webhook
Check backend logs after test payment:
```
Webhook processed: Payment pay_xyz - 500 points credited to user 1
```

---

## Part 4: Security Checklist

✅ Razorpay signature verification in `verifyPayment`
✅ Webhook signature verification in `handleWebhook`
✅ Unique constraint on `razorpay_payment_id` (prevents duplicate processing)
✅ Status check: `pending` → `success` only once
✅ Database transactions for atomic operations
✅ Row locking (`FOR UPDATE`) in wallet balance updates
✅ Rate limiting on payment endpoints
✅ Never trust frontend for price/points
✅ Server-side package validation

---

## Part 5: API Reference

### Payment Endpoints

**GET /api/payments/packages**
- Public endpoint
- Returns all active point packages
```json
{
  "success": true,
  "packages": [
    {
      "id": 1,
      "name": "Starter Pack",
      "points": 100,
      "price": 99.00,
      "bonus_points": 0
    }
  ]
}
```

**POST /api/payments/create-order**
- Protected (requires auth)
- Creates Razorpay order
```json
Request:
{
  "package_id": 1
}

Response:
{
  "success": true,
  "order": {
    "id": "order_xyz",
    "amount": 9900,
    "currency": "INR",
    "points": 100
  },
  "razorpay_key": "rzp_test_..."
}
```

**POST /api/payments/verify**
- Protected (requires auth)
- Verifies payment and credits points
```json
Request:
{
  "razorpay_order_id": "order_xyz",
  "razorpay_payment_id": "pay_abc",
  "razorpay_signature": "signature_hash"
}

Response:
{
  "success": true,
  "points_credited": 100,
  "new_balance": 350
}
```

**POST /api/payments/webhook**
- Public (verified by signature)
- Handles Razorpay webhooks
```json
Headers:
{
  "x-razorpay-signature": "webhook_signature"
}
```

### Wallet Endpoints

**GET /api/wallet**
- Protected
- Returns user wallet
```json
{
  "success": true,
  "wallet": {
    "user_id": 1,
    "balance": 250,
    "created_at": "...",
    "updated_at": "..."
  }
}
```

**GET /api/wallet/transactions**
- Protected
- Returns transaction history
- Query params: `page`, `limit`, `transaction_type`, `source`, `status`
```json
{
  "success": true,
  "transactions": [...],
  "pagination": {
    "currentPage": 1,
    "totalPages": 3,
    "totalTransactions": 45
  }
}
```

**GET /api/wallet/summary**
- Protected
- Returns wallet statistics
```json
{
  "success": true,
  "summary": {
    "current_balance": 250,
    "total_credits": 1000,
    "total_debits": 750,
    "total_purchases": 5,
    "total_enrollments": 10
  }
}
```

---

## Part 6: Error Handling

### Common Errors

**Insufficient Balance**
```json
{
  "success": false,
  "message": "Not enough points in wallet. You need 500 points but only have 100.",
  "required": 500,
  "available": 100
}
```

**Invalid Signature**
```json
{
  "success": false,
  "message": "Invalid payment signature"
}
```

**Duplicate Payment**
```json
{
  "success": true,
  "message": "Payment already processed",
  "already_processed": true
}
```

**Invalid Package**
```json
{
  "success": false,
  "message": "Invalid package selected"
}
```

---

## Part 7: Testing Scenarios

### Scenario 1: Successful Purchase
1. User clicks "Buy 500 Points"
2. Order created with `status=pending`
3. Razorpay checkout opens
4. User completes payment
5. Frontend calls `/payments/verify`
6. Signature verified
7. Transaction updated to `success`
8. Wallet balance increased by 500
9. Webhook arrives (idempotent - no duplicate credit)

### Scenario 2: Payment Failure
1. User initiates purchase
2. Payment fails on Razorpay
3. Transaction remains `pending`
4. User can retry

### Scenario 3: Duplicate Webhook
1. Payment successful
2. First webhook arrives → points credited
3. Second webhook arrives (duplicate)
4. Check `razorpay_payment_id` → already exists
5. Return success without duplicate credit

### Scenario 4: Concurrent Enrollments
1. User has 500 points
2. Enrolls in Course A (300 points) - Transaction starts
3. Simultaneously enrolls in Course B (300 points) - Transaction waits
4. Course A: Balance locked with `FOR UPDATE`
5. Course A: Points deducted (500 → 200)
6. Course A: Transaction commits
7. Course B: Gets lock, checks balance
8. Course B: Insufficient balance (200 < 300)
9. Course B: Returns error

---

## Part 8: Database Schema Reference

### wallets
```sql
id, user_id (UNIQUE), balance, created_at, updated_at
```

### wallet_transactions
```sql
id, user_id, transaction_type (credit/debit),
amount, balance_before, balance_after,
source (purchase/enrollment/refund/admin_adjustment/reward),
status (pending/success/failed/cancelled),
razorpay_order_id, razorpay_payment_id (UNIQUE),
razorpay_signature, package_id, course_id, metadata,
created_at, updated_at
```

### point_packages
```sql
id, name, points, price, bonus_points,
is_active, display_order, created_at, updated_at
```

---

## Part 9: Production Checklist

Before going live:

✅ Replace test Razorpay keys with live keys
✅ Configure production webhook URL
✅ Enable HTTPS for webhook endpoint
✅ Set up monitoring for failed payments
✅ Configure email notifications for purchases
✅ Add transaction receipts/invoices
✅ Implement refund handling (if needed)
✅ Set up backup for wallet_transactions table
✅ Test with real payment (small amount)
✅ Monitor logs for duplicate webhook handling
✅ Add analytics tracking for purchases
✅ Configure GST/tax handling (if applicable)

---

## Part 10: Maintenance & Monitoring

### Daily Checks
- Monitor webhook processing logs
- Check for stuck `pending` transactions
- Verify balance consistency

### Weekly Tasks
- Review failed payments
- Analyze purchase patterns
- Check for unusual transaction patterns

### Monthly Tasks
- Reconcile Razorpay settlements with DB
- Review and update point packages
- Analyze conversion rates

### Queries for Monitoring

```sql
-- Stuck pending transactions (>1 hour old)
SELECT * FROM wallet_transactions
WHERE status = 'pending'
AND created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR);

-- Daily revenue
SELECT DATE(created_at) as date,
       SUM(amount) as total_points_sold,
       COUNT(*) as transactions
FROM wallet_transactions
WHERE source = 'purchase' AND status = 'success'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Balance consistency check
SELECT u.id, u.email,
       w.balance as wallet_balance,
       SUM(CASE WHEN wt.transaction_type = 'credit' AND wt.status = 'success' THEN wt.amount ELSE 0 END) -
       SUM(CASE WHEN wt.transaction_type = 'debit' AND wt.status = 'success' THEN wt.amount ELSE 0 END) as calculated_balance
FROM users u
LEFT JOIN wallets w ON u.id = w.user_id
LEFT JOIN wallet_transactions wt ON u.id = wt.user_id
GROUP BY u.id, w.balance
HAVING wallet_balance != calculated_balance;
```

---

## Support & Troubleshooting

**Issue: Payment successful but points not credited**
- Check webhook logs
- Verify signature verification
- Run manual credit script if needed

**Issue: Duplicate point credit**
- Check `razorpay_payment_id` uniqueness
- Review transaction logs
- Manual debit if needed

**Issue: Enrollment fails despite sufficient balance**
- Check for race conditions
- Verify `FOR UPDATE` locking
- Review transaction isolation level

---

## Files Created

### Backend
- `database/migration_razorpay_wallet.sql`
- `backend/controllers/payment.controller.js`
- `backend/controllers/wallet.controller.js`
- `backend/routes/payment.routes.js`
- `backend/routes/wallet.routes.js`
- `backend/.env.razorpay.example`

### Frontend
- `frontend/src/pages/Wallet.jsx`

### Modified
- `backend/server.js` (added routes)
- `backend/controllers/enrollment.controller.js` (wallet integration)

---

End of Implementation Guide
