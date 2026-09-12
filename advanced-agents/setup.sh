#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# AR Prime Market - Advanced Agents Setup Script
# ═══════════════════════════════════════════════════════════════════════════

set -e

echo "🚀 AR Prime Market - Advanced Agents Setup"
echo "═══════════════════════════════════════════════════════════════════════════"

# 1️⃣ Check Prerequisites
echo "1️⃣ Checking prerequisites..."
command -v npm >/dev/null 2>&1 || { echo "npm is required but not installed."; exit 1; }
command -v supabase >/dev/null 2>&1 || { echo "supabase CLI is required."; echo "Installing..."; npm i -g supabase; }

# 2️⃣ Install Dependencies
echo "2️⃣ Installing dependencies..."
npm install

# 3️⃣ Create Environment File
echo "3️⃣ Setting up environment variables..."
if [ ! -f .env ]; then
  cat > .env << EOF
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
TELEGRAM_BOT_TOKEN=your_telegram_token
TELEGRAM_CHAT_ID=your_chat_id
RESEND_API_KEY=your_resend_key
NODE_ENV=production
EOF
  echo "✅ .env created. Please update with your values."
fi

# 4️⃣ Database Setup
echo "4️⃣ Setting up database..."
supabase migration up || echo "Database already up to date"

# 5️⃣ Deploy Functions
echo "5️⃣ Deploying edge functions..."
supabase functions deploy marketing-agent-advanced
supabase functions deploy customer-support-agent
supabase functions deploy learning-agent
supabase functions deploy inventory-agent
supabase functions deploy financial-agent
supabase functions deploy order-manager-agent
supabase functions deploy chro-agent
supabase functions deploy arq-master-orchestrator

# 6️⃣ Build Frontend
echo "6️⃣ Building frontend..."
npm run build

# 7️⃣ Test Setup
echo "7️⃣ Testing setup..."
curl -s http://localhost:3000/health || echo "⚠️ Server not running yet"

echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo "✅ Setup Complete!"
echo ""
echo "📖 Next Steps:"
echo "  1. Update .env with your configuration"
echo "  2. Run: npm start"
echo "  3. Visit: http://localhost:3000"
echo ""
echo "📊 Monitor:"
echo "  Dashboard: http://localhost:3000/dashboard"
echo "  API Status: http://localhost:3000/api/agents/status"
echo ""

