# Z Combinator

## What it is

Z Combinator allows developers to launch projects with tokens with controlled emission schedules. For the market, this enables long term, consistent funding while aligning incentives between the developer and their token. For the dev, this enables the ability to bootstrap attention and incentivize product growth dynamically, understanding the market and iterating on builds faster than otherwise possible.


## How to earn

Anyone can earn the native token, ZC, by making PRs to this codebase. Good code, good specs, and good tweets will be reviwed by the team and rewarded accordingly. Transparent and permissionless contribution will accelerate the growth of the ZC ecosystem.


## Code Description

### `ui/`
Main product.

**Setup:**
```bash
cd ui
pnpm install
pnpm dev
```

The app will run at `http://localhost:3000`

**Key scripts:**
- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm api` - Run API server
- `pnpm api:watch` - Run API server in watch mode

See `ui/README.md` for more details.

### `docs/`
Documentation site.

**Setup:**
```bash
npm i -g mint
cd docs
mint dev
```

The docs will run at `http://localhost:3000`

See `docs/README.md` for more details.
