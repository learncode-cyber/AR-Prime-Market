# 🚀 AR Prime Market Advanced Agents - Deployment Guide

## প্রি-রিকোয়ারমেন্ট

- [ ] Supabase প্রজেক্ট সেটআপ
- [ ] Node.js 18+ ইনস্টল
- [ ] Git সেটআপ
- [ ] Telegram বট টোকেন

## ডিপ্লয়মেন্ট স্টেপস

### 1. ডাটাবেস মাইগ্রেশন

```bash
supabase migration up
# বা ম্যানুয়ালি:
# database-migrations.sql চালান Supabase SQL এডিটরে
```

### 2. এজেন্ট ফাংশন ডিপ্লয় করুন

```bash
# মার্কেটিং এজেন্ট
supabase functions deploy marketing-agent-advanced

# সাপোর্ট এজেন্ট
supabase functions deploy customer-support-agent

# অন্যান্য এজেন্ট
supabase functions deploy learning-agent
supabase functions deploy inventory-agent
supabase functions deploy financial-agent
supabase functions deploy order-manager-agent
supabase functions deploy chro-agent
supabase functions deploy arq-master-orchestrator
```

### 3. এনভায়রনমেন্ট ভেরিয়েবল সেট করুন

```
SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_key
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_chat_id
RESEND_API_KEY=your_resend_key
```

### 4. ফ্রন্টএন্ড ডিপ্লয় করুন

```bash
npm install
npm run build
npm run deploy
```

### 5. Cron জব সেটআপ করুন

```bash
# Price optimization (hourly)
cron-job.org: POST /api/agents/marketing/optimize-price

# Demand forecasting (daily)
cron-job.org: POST /api/agents/learning/predict-demand

# Financial tracking (daily)
cron-job.org: POST /api/agents/financial/track-revenue
```

## যাচাই করুন

```bash
# স্বাস্থ্য পরীক্ষা
curl https://your-domain/health

# এজেন্ট স্ট্যাটাস
curl https://your-domain/api/agents/status
```

