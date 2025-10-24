# Z Combinator

## What it is

Z Combinator allows developers to launch projects with tokens with controlled emission schedules. For the market, this aligns incentives between the developer and their token. For the dev, this enables long term, consistent funding, along with the ability to bootstrap attention and incentivize product growth dynamically. Devs can understand their market and iterate on builds faster than otherwise possible.


## How to Earn ZC Tokens

Earn ZC tokens by contributing code to this project. The ZC team reviews PRs and determines rewards based on quality and impact.

**Primary contribution:**
- **Submit Code** - Features, bug fixes, improvements, documentation

**Non-developer options:**
- **Request Work** - Propose features for the team to build
- **Submit Tweets** - Content for the official @zcombinatorio account

**Get Started:**
- **First time?** Read the [PR Guide](PR_GUIDE.md)
- **Ready to submit?** Choose a [PR template](.github/PULL_REQUEST_TEMPLATE.md)
- **Learn more:** See [CONTRIBUTING.md](CONTRIBUTING.md)

**Note**: Currently, the team reviews and rewards contributions. In the future, decision markets will determine merges and rewards.


## Code Description

### `ui/`
Main product.

**Setup:**
```bash
cd ui
pnpm install
```

**Running locally:**

The UI and API server are separate and must be run in different terminals:

```bash
# Terminal 1 - Start the Next.js dev server
pnpm dev
# Runs at http://localhost:3000

# Terminal 2 - Start the API server
pnpm api
# or pnpm api:watch for auto-reload
```

**Key scripts:**
- `pnpm dev` - Start Next.js development server
- `pnpm api` - Run standalone API server
- `pnpm api:watch` - Run API server with auto-reload
- `pnpm build` - Build for production

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
