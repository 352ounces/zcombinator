# Codebase Setup Guide

Get the Z Combinator UI running locally in under 2 minutes. No database or API keys required.

## Quick Setup with Claude Code

**Just prompt Claude Code:**

```
Set up the Z Combinator development environment. Navigate to the ui directory, install dependencies with pnpm, and give me the command to start the dev server. Tell me exactly how to navigate to the ui directory and what command i should type in. The app should run in mock mode without requiring any API keys or database setup.
```

Claude Code will:
- Navigate to the `ui/` directory
- Run `pnpm install`
- Start the dev server with `pnpm run dev`
- Explain what's happening

**That's it!** Open http://localhost:3000 when Claude says it's ready.

You'll see a yellow "🔧 Demo Mode" banner at the top—this means you're running with mock data. Everything works, no setup needed.

## Manual Setup (if not using Claude Code)

**Prerequisites:**
- Node.js 18+ installed
- pnpm package manager (`npm install -g pnpm`)

**Setup (from the root `zcombinator` directory):**

```bash
cd ui
pnpm install
pnpm run dev
```

Open http://localhost:3000 in your browser.

## Understanding Mock Mode

The app **automatically detects** when you're missing API keys or database credentials and switches to mock mode.

### What Gets Mocked

When environment variables are missing, these services use realistic mock data:

- **Database** (PostgreSQL) → In-memory mock with sample tokens, holders, presales
- **Helius API** (on-chain data) → Mock transaction history and blockchain data
- **Birdeye API** (market data) → Mock prices, market cap, liquidity
- **Pinata** (IPFS uploads) → Mock metadata storage
- **Privy** (wallet auth) → Mock wallet connections

### What You Get for Free

In mock mode, you can:
- Browse sample tokens with market data
- View transaction history
- See holder lists and stats
- Test presale functionality
- Navigate all pages and features
- Develop UI components without backend dependencies

**No database setup. No API keys. No blockchain RPC. Just run and build.**

## Optional: Running the API Server

The UI runs at `localhost:3000` by default. If you need the standalone API server:

```bash
# In a separate terminal
cd ui
pnpm api        # Runs at localhost:3001
# OR
pnpm api:watch  # Auto-reloads on changes
```

This is optional—most development only needs `pnpm run dev`.

## Optional: Connecting Real Services

Want to connect to real blockchain data and a production database? You'll need to get your own API keys.

**We do not provide API keys.** You must sign up for these services yourself.

### Quick Setup with Claude Code

**Prompt Claude Code:**

```
Create a .env.local file in the ui/ directory and explain what API keys I need to get for Helius, Birdeye, Pinata, Privy, and the database. Include signup links for each service.
```

Claude Code will create the file and guide you through what keys you need.

### Manual Setup

**Step 1: Create Your Environment File**

Navigate to the `ui/` directory and create a `.env.local` file:

```bash
cd ui
touch .env.local
```

Or manually create a new file named `.env.local` in the `ui/` directory.

### Step 2: Get Your API Keys

Sign up for the services you need:

#### Helius (Blockchain Data)
- Sign up: https://www.helius.dev/
- Get your API key from the dashboard
- Add to `.env.local`:
```bash
HELIUS_API_KEY=your_helius_api_key_here
```

#### Birdeye (Market Data)
- Sign up: https://birdeye.so/
- Get your API key from the dashboard
- Add to `.env.local`:
```bash
BIRDEYE_API_KEY=your_birdeye_api_key_here
```

#### Pinata (IPFS Storage)
- Sign up: https://www.pinata.cloud/
- Get your JWT token from API Keys section
- Add to `.env.local`:
```bash
PINATA_JWT=your_pinata_jwt_token_here
```

#### Privy (Wallet Auth)
- Sign up: https://www.privy.io/
- Create an app and get credentials
- Add to `.env.local`:
```bash
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id_here
PRIVY_APP_SECRET=your_privy_secret_here
```

#### Database (PostgreSQL)
- Set up your own PostgreSQL database
- Add connection string to `.env.local`:
```bash
DB_URL=postgresql://user:password@host:5432/database
```

### Step 3: Restart the Dev Server

```bash
pnpm run dev
```

The yellow "Demo Mode" banner will disappear automatically when real credentials are detected.

### Partial Setup is Fine

You can mix and match! For example:
- Add only `BIRDEYE_API_KEY` → Real market data, mock everything else
- Add only `DB_URL` → Real database, mock APIs
- Add nothing → Full mock mode (recommended for contributors)

The app adapts automatically.

## Project Structure

```
zcombinator/
├── ui/                    # Main Next.js application
│   ├── app/              # Next.js 15 app router pages
│   ├── components/       # React components
│   ├── lib/              # Utilities and services
│   │   ├── mock/        # Mock implementations
│   │   └── db.ts        # Database functions
│   ├── .env.local       # Your local environment vars (create this)
│   └── package.json     # UI dependencies
└── guides/              # Documentation (you are here)
```

## Common Issues

**Issue:** `pnpm: command not found`
**Fix:** Install pnpm globally: `npm install -g pnpm`

---

**Issue:** Port 3000 already in use
**Fix:** Kill the process or change port:
```bash
PORT=3001 pnpm run dev
```

---

**Issue:** "Mock Mode" banner won't go away after adding env vars
**Fix:**
1. Verify `.env.local` is in the `ui/` directory (not root)
2. Restart the dev server (`Ctrl+C` then `pnpm run dev`)
3. Check that env values aren't empty strings

---

**Issue:** Changes not showing up
**Fix:** Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows/Linux)

---

**Issue:** Need to reset mock data
**Fix:** Mock data regenerates on each restart. Just restart: `pnpm run dev`

## Next Steps

- **[Zero to PR Guide](./ZERO-TO-PR_GUIDE.md)** - Submit your first pull request
- **[ZC Prompting Guide](./ZC_PROMPTING_GUIDE.md)** - How to work effectively with Claude Code
- **[PR to Paid Guide](./PR-TO-PAID_GUIDE.md)** - Understand how payments work

## Tips

- **Start in mock mode** - Don't waste time setting up services you don't need yet
- **Use Claude Code** - Let Claude handle setup issues: "Why is mock mode not activating?"
- **Check the console** - Mock mode logs show exactly what's being mocked
- **Build features first** - Add real services only when you need to test production behavior

---

**Need help?** Join the Discord: https://discord.gg/MQfcX9QM2r
