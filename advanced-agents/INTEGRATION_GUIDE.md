# 🔗 Complete Integration Guide

## আপনার Existing Project এ Advanced Agents যুক্ত করুন

---

## Step 1: ডাটাবেস মাইগ্রেশন

### 1a. Supabase SQL Editor এ যান

```bash
supabase console
# অথবা direct:
# https://app.supabase.com/project/YOUR_PROJECT/sql
```

### 1b. এই ফাইল চালান

```sql
-- database-migrations.sql কপি করে পেস্ট করুন
```

### 1c. যাচাই করুন

```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';
-- আপনি 12+ নতুন টেবিল দেখবেন
```

---

## Step 2: Edge Functions ডিপ্লয় করুন

### 2a. প্রতিটি এজেন্ট ফাইল কপি করুন

```bash
supabase/functions/_shared/
├── marketing-agent-advanced.ts
├── customer-support-agent.ts
├── learning-agent.ts
├── inventory-agent.ts
├── financial-agent.ts
├── order-manager-agent.ts
├── chro-agent.ts
└── arq-master-orchestrator.ts
```

### 2b. ডিপ্লয় করুন

```bash
supabase functions deploy marketing-agent-advanced
supabase functions deploy customer-support-agent
# ... অন্যান্য সব
```

### 2c. যাচাই করুন

```bash
supabase functions list
# সব 8টি ফাংশন দেখবেন
```

---

## Step 3: API Routes যুক্ত করুন

### 3a. API হ্যান্ডলার ইমপ্লিমেন্ট করুন

```typescript
// src/routes/api/agents/+server.ts
import { apiHandlers } from '@/lib/api-handlers';

export async function GET() {
  const status = await apiHandlers.getAgentStatus();
  return new Response(JSON.stringify(status));
}
```

### 3b. সব রুট যুক্ত করুন

```
GET  /api/agents/status           → getAgentStatus()
GET  /api/metrics/revenue          → getRevenueMetrics()
GET  /api/metrics/marketing        → getMarketingMetrics()
GET  /api/metrics/customer         → getCustomerMetrics()
GET  /api/inventory/status         → getInventoryStatus()
POST /api/agents/task              → runAgentTask()
POST /api/approval/request         → requestCEOApproval()
```

---

## Step 4: React কম্পোনেন্ট যুক্ত করুন

### 4a. কম্পোনেন্ট ফাইল কপি করুন

```bash
src/components/
├── ProductCard.tsx
├── RecommendedProducts.tsx
├── CustomerSegmentBanner.tsx
├── PaymentOptions.tsx
└── SupportChat.tsx
```

### 4b. পেজে ব্যবহার করুন

```typescript
import { ProductCard } from '@/components/ProductCard';
import { RecommendedProducts } from '@/components/RecommendedProducts';

export default function ProductPage({ product }) {
  return (
    <div>
      <ProductCard product={product} />
      <RecommendedProducts productId={product.id} />
    </div>
  );
}
```

---

## Step 5: Configuration সেট করুন

### 5a. Environment Variables

```bash
# .env.local
SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_key
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_chat_id
RESEND_API_KEY=your_key
```

### 5b. Agent Config

```typescript
// lib/agents-config.ts
export const AGENTS_CONFIG = {
  marketing: {
    enabled: true,
    auto_price_optimization: 'hourly',
    auto_campaign: 'daily',
  },
  support: {
    enabled: true,
    auto_segmentation: 'daily',
    auto_response_enabled: true,
  },
  // ... অন্যান্য এজেন্ট
};
```

---

## Step 6: Cron Jobs সেটআপ করুন

### 6a. cron-job.org এ রেজিস্টার করুন

https://cron-job.org

### 6b. এই জব তৈরি করুন

**Price Optimization (Hourly)**
```
URL: https://your-domain.com/api/agents/task
Method: POST
Body: {
  "agent_id": "marketing",
  "task_type": "optimize_price"
}
Frequency: Every hour
```

**Demand Forecasting (Daily)**
```
URL: https://your-domain.com/api/agents/task
Method: POST
Body: {
  "agent_id": "learning",
  "task_type": "predict_demand"
}
Frequency: Every day at 2 AM
```

**Financial Tracking (Daily)**
```
URL: https://your-domain.com/api/agents/task
Method: POST
Body: {
  "agent_id": "financial",
  "task_type": "track_revenue"
}
Frequency: Every day at midnight
```

---

## Step 7: Telegram Setup (CEO Approvals)

### 7a. Telegram Bot তৈরি করুন

1. @BotFather কে message করুন
2. `/newbot` টাইপ করুন
3. Bot name এবং username দিন
4. Token কপি করুন (আপনার `TELEGRAM_BOT_TOKEN`)

### 7b. Chat ID পান

1. @userinfobot এ message করুন
2. আপনার User ID কপি করুন (এটি `TELEGRAM_CHAT_ID`)

### 7c. Webhook সেটআপ করুন

```typescript
async function setupTelegramWebhook() {
  const url = `${BASE_URL}/api/telegram/webhook`;
  await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${url}`
  );
}
```

---

## Step 8: সবকিছু পরীক্ষা করুন

### 8a. API পরীক্ষা করুন

```bash
# স্বাস্থ্য পরীক্ষা
curl http://localhost:3000/health

# এজেন্ট স্ট্যাটাস
curl http://localhost:3000/api/agents/status

# রাজস্ব মেট্রিক্স
curl http://localhost:3000/api/metrics/revenue
```

### 8b. Telegram পরীক্ষা করুন

```typescript
// API এ পাঠান
fetch('/api/approval/request', {
  method: 'POST',
  body: JSON.stringify({
    task_id: 'test-123',
    details: { test: true }
  })
});

// Telegram এ মেসেজ পাবেন
```

### 8c. একটি অর্ডার তৈরি করুন

1. পণ্য ব্রাউজ করুন (মূল্য অ্যাঙ্কারিং দেখবেন)
2. কার্টে যোগ করুন (বান্ডেল সুপারিশ দেখবেন)
3. চেকআউট করুন (নতুন পেমেন্ট অপশন দেখবেন)
4. অর্ডার সম্পন্ন করুন (সবকিছু স্বয়ংক্রিয় হবে)

---

## Step 9: মনিটরিং সেটআপ করুন

### 9a. Dashboard তৈরি করুন

```typescript
// src/pages/dashboard.tsx
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    async function loadMetrics() {
      const revenue = await fetch('/api/metrics/revenue').then(r => r.json());
      const marketing = await fetch('/api/metrics/marketing').then(r => r.json());
      const customers = await fetch('/api/metrics/customer').then(r => r.json());
      
      setMetrics({ revenue, marketing, customers });
    }
    loadMetrics();
  }, []);

  if (!metrics) return <div>Loading...</div>;

  return (
    <div className="dashboard">
      <h1>Agent Dashboard</h1>
      <div className="metrics">
        <div>Revenue: ${metrics.revenue.total_revenue}</div>
        <div>Customers: {metrics.customers.total_customers}</div>
        <div>Open Rate: {metrics.marketing.open_rate}</div>
      </div>
    </div>
  );
}
```

### 9b. Alerts সেটআপ করুন

```typescript
// মেট্রিক্স পরিবর্তন হলে alert পাঠান
async function checkMetrics() {
  const revenue = await fetch('/api/metrics/revenue').then(r => r.json());
  
  if (revenue.average_daily < THRESHOLD) {
    sendAlert('Revenue dropped below threshold');
  }
}
```

---

## Step 10: লাইভ চালু করুন

### 10a. উৎপাদন চেকলিস্ট

- [ ] সব environment variables সেট করেছেন
- [ ] ডাটাবেস মাইগ্রেশন চালিয়েছেন
- [ ] সব edge functions ডিপ্লয় করেছেন
- [ ] Cron jobs সেটআপ করেছেন
- [ ] Telegram webhook সেটআপ করেছেন
- [ ] API রুট পরীক্ষা করেছেন
- [ ] Dashboard চেক করেছেন
- [ ] একটি পূর্ণ অর্ডার সাইকেল পরীক্ষা করেছেন

### 10b. ডিপ্লয় করুন

```bash
npm run build
npm run deploy
```

### 10c. মনিটর করুন

- প্রথম 24 ঘন্টায় লগ চেক করুন
- কোন ত্রুটি লিখিত আছে কি দেখুন
- মেট্রিক্স দেখুন উন্নত হচ্ছে কি

---

## সমস্যা সমাধান

### সমস্যা: Edge Functions সংযোগ করতে পারছে না

**সমাধান:**
```bash
supabase functions list
supabase functions logs marketing-agent-advanced
# লগ দেখুন ত্রুটি খুঁজুন
```

### সমস্যা: Telegram notification পাচ্ছে না

**সমাধান:**
```typescript
// সরাসরি Telegram API টেস্ট করুন
curl -X POST https://api.telegram.org/botYOUR_TOKEN/sendMessage \
  -d "chat_id=YOUR_CHAT_ID&text=Test"
```

### সমস্যা: Cron job চলছে না

**সমাধান:**
```bash
# cron-job.org এ যান এবং লগ চেক করুন
# আপনার URL accessible কি তা যাচাই করুন
curl https://your-domain.com/health
```

---

## পরবর্তী পদক্ষেপ

1. **প্রথম সপ্তাহ**: দ্রুত জয়ের জন্য ফলাফল পর্যবেক্ষণ করুন
2. **দ্বিতীয় সপ্তাহ**: প্রথম ফলাফলের উপর ভিত্তি করে সামঞ্জস্য করুন
3. **তৃতীয় সপ্তাহ**: আরও এজেন্ট বৈশিষ্ট্য সক্ষম করুন
4. **মাস 2**: অন্যান্য বিভাগে সম্প্রসারণ করুন

---

## সহায়তা

- 📖 এজেন্ট ডকুমেন্টেশন দেখুন: `AGENTS_GUIDE.md`
- 📖 API রেফারেন্স: `API_REFERENCE.md`
- 📧 সমস্যা রিপোর্ট করুন

