# Mock Proposals Card vs Real Data Implementation

## 1. Mock Proposals Card: Data Structure

The `ProposalCard` component (`ui/components/ProposalCard.tsx`) uses the following data fields from mock proposals:

### Data Fields Used:

#### **Proposal ID** (`id`)
- **Example**: `"ZC-4"`, `"SHIRTLESS-1"`, `"PERC-2"`
- **Source**: Hardcoded in `MOCK_PROPOSALS` array
- **Usage**: Displayed in proposal title (e.g., "ZC-4: Beach Community Expansion")
- **Mock Example**:
  ```typescript
  {
    id: '4',
    title: 'SHIRTLESS-1: Beach Community Expansion',
    // ...
  }
  ```

#### **Token Name Info** (`tokenSymbol`)
- **Example**: `"$ZC"`, `"$SHIRTLESS"`, `"$PERC"`, `"$OOGWAY"`
- **Source**: Hardcoded `tokenSymbol` field in mock proposals
- **Usage**: Displayed as a tag badge on the proposal card
- **Mock Example**:
  ```typescript
  {
    tokenSymbol: '$SHIRTLESS',
    // ...
  }
  ```

#### **Ticker Info** (derived from `tokenSymbol`)
- **Example**: `"$ZC"` → ticker is `"ZC"`
- **Source**: Extracted from `tokenSymbol` by removing `$` prefix
- **Usage**: Used to filter proposals by token and match with real token data
- **Mock Example**:
  ```typescript
  const rawSymbol = token.token_symbol || ''; // "ZC"
  const tokenSymbolWithDollar = rawSymbol.startsWith('$') ? rawSymbol : `$${rawSymbol}`; // "$ZC"
  const tokenProposals = MOCK_PROPOSALS.filter(
    (proposal) => proposal.tokenSymbol === tokenSymbolWithDollar
  );
  ```

#### **Time Left / Time Passed** (`timeAgo`)
- **Example**: `"2 days left"` (for Active), `"5 days ago"` (for Passed/Failed)
- **Source**: Hardcoded string in mock proposals
- **Usage**: 
  - For **Active** proposals: Shows countdown (e.g., "2 days left", "5 hours left")
  - For **Passed/Failed** proposals: Shows time since completion (e.g., "2 days ago", "1 day ago")
- **Mock Example**:
  ```typescript
  {
    status: 'Active',
    timeAgo: '2 days left',  // For active proposals
    // ...
  }
  {
    status: 'Passed',
    timeAgo: '5 days ago',   // For completed proposals
    // ...
  }
  ```

#### **TWAP Pass-Fail Gap Data** (`twapGap`)
- **Example**: `8.67`, `5.25`, `3.45` (percentage values)
- **Source**: Hardcoded number in mock proposals
- **Usage**: 
  - Displayed as a badge showing percentage (e.g., "8.67%")
  - Label changes based on status:
    - **Active**: "Current TWAP Pass-Fail Gap"
    - **Passed/Failed**: "Final TWAP Pass-Fail Gap"
- **Mock Example**:
  ```typescript
  {
    twapGap: 8.67,  // Displayed as "8.67%"
    status: 'Passed',
    // ...
  }
  ```

#### **Additional Fields**:
- **Title** (`title`): Full proposal title (e.g., "ZC-1: Update Staking Vault Rewards & Parameters")
- **Status** (`status`): `'Active' | 'Passed' | 'Failed'` - determines card styling and behavior
- **Summary** (`summary`): Description text displayed in the card
- **GitHub URL** (`githubUrl`): Link to GitHub PR

### Mock Data Example (Complete):

```typescript
{
  id: '4',
  title: 'SHIRTLESS-1: Beach Community Expansion',
  status: 'Active',
  tokenSymbol: '$SHIRTLESS',
  summary: 'Proposal to expand the Shirtless community by organizing beach events...',
  twapGap: 4.23,                    // → Displayed as "4.23%"
  timeAgo: '2 days left',           // → Shows "2 days left" (Active)
  githubUrl: 'https://github.com/shirtless/shirtless/pull/1'
}
```

---

## 2. Real Data Implementation: How It Would Work

### Current State: ❌ **NOT IMPLEMENTED**

Currently, proposals are **always mock data**. There is no database table, API endpoint, or real data fetching for proposals.

### Proposed Real Data Structure:

#### **Database Schema** (to be created):

```sql
CREATE TABLE proposals (
  id SERIAL PRIMARY KEY,
  proposal_id VARCHAR(50) NOT NULL UNIQUE,  -- e.g., "ZC-4", "SHIRTLESS-1"
  token_address VARCHAR(44) NOT NULL,       -- Links to token_launches table
  title VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL,             -- 'Active', 'Passed', 'Failed'
  summary TEXT,
  twap_gap DECIMAL(10, 2),                  -- Calculated from market data
  github_url VARCHAR(255),
  created_at TIMESTAMP NOT NULL,
  voting_start_at TIMESTAMP,
  voting_end_at TIMESTAMP,                   -- Used to calculate time left/passed
  passed_at TIMESTAMP,                       -- When proposal passed (if applicable)
  failed_at TIMESTAMP,                       -- When proposal failed (if applicable)
  FOREIGN KEY (token_address) REFERENCES token_launches(token_address)
);
```

#### **TypeScript Interface** (to be added to `lib/db/types.ts`):

```typescript
export interface Proposal {
  id?: number;
  proposal_id: string;              // "ZC-4", "SHIRTLESS-1"
  token_address: string;
  title: string;
  status: 'Active' | 'Passed' | 'Failed';
  summary: string;
  twap_gap?: number;
  github_url?: string;
  created_at: Date;
  voting_start_at?: Date;
  voting_end_at?: Date;
  passed_at?: Date;
  failed_at?: Date;
}
```

---

## 3. Comparison: Mock vs Real Data

### **Proposal ID**

| Aspect | Mock Data | Real Data |
|--------|-----------|-----------|
| **Source** | Hardcoded string in `MOCK_PROPOSALS` | Auto-generated or from GitHub PR number |
| **Example** | `id: '4'` | `proposal_id: 'ZC-4'` (from database) |
| **Generation** | Manual entry | Automatic: `{tokenSymbol}-{sequenceNumber}` or from GitHub PR |
| **Uniqueness** | Not enforced | Enforced by `UNIQUE` constraint in database |

**Real Implementation**:
```typescript
// Auto-generate proposal ID
const lastProposal = await getLastProposalForToken(tokenAddress);
const sequenceNumber = lastProposal ? parseInt(lastProposal.proposal_id.split('-')[1]) + 1 : 1;
const proposalId = `${tokenSymbol}-${sequenceNumber}`; // "ZC-4"
```

---

### **Token Name & Ticker Info**

| Aspect | Mock Data | Real Data |
|--------|-----------|-----------|
| **Source** | Hardcoded `tokenSymbol: '$ZC'` | Fetched from `token_launches` table via JOIN |
| **Token Name** | Not stored (derived from title) | `token_name` from `token_launches` table |
| **Ticker** | Hardcoded `tokenSymbol` | `token_symbol` from `token_launches` table |
| **Matching** | Filter by `tokenSymbol` string | JOIN on `token_address` foreign key |

**Real Implementation**:
```typescript
// Fetch proposals with token info
const proposals = await db.query(`
  SELECT 
    p.*,
    t.token_name,
    t.token_symbol
  FROM proposals p
  JOIN token_launches t ON p.token_address = t.token_address
  WHERE p.token_address = $1
`, [tokenAddress]);

// Token symbol is automatically available
proposal.tokenSymbol = `$${proposal.token_symbol}`; // "$ZC"
```

---

### **Time Left / Time Passed**

| Aspect | Mock Data | Real Data |
|--------|-----------|-----------|
| **Source** | Hardcoded string: `"2 days left"` | Calculated from `voting_end_at` timestamp |
| **Active Proposals** | Static string | Real-time countdown: `voting_end_at - now()` |
| **Passed/Failed** | Static string: `"5 days ago"` | Calculated: `now() - passed_at` or `now() - failed_at` |
| **Accuracy** | Never updates | Updates in real-time on each render |

**Real Implementation**:
```typescript
// Calculate time left/passed
function calculateTimeAgo(proposal: Proposal): string {
  if (proposal.status === 'Active' && proposal.voting_end_at) {
    const now = new Date();
    const end = new Date(proposal.voting_end_at);
    const diff = end.getTime() - now.getTime();
    
    if (diff <= 0) {
      return 'Voting ended';
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} left`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} left`;
    return 'Less than 1 hour left';
  }
  
  if (proposal.status === 'Passed' && proposal.passed_at) {
    const now = new Date();
    const passed = new Date(proposal.passed_at);
    const diff = now.getTime() - passed.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
  
  // Similar for Failed status
  return 'Unknown';
}
```

---

### **TWAP Pass-Fail Gap Data**

| Aspect | Mock Data | Real Data |
|--------|-----------|-----------|
| **Source** | Hardcoded number: `twapGap: 8.67` | Calculated from real market data (TWAP algorithm) |
| **Calculation** | Static value | Dynamic calculation based on token price history |
| **Updates** | Never changes | Updates periodically (e.g., every block or every hour) |
| **Algorithm** | N/A | TWAP (Time-Weighted Average Price) calculation |

**Real Implementation**:
```typescript
// Calculate TWAP Gap from market data
async function calculateTWAPGap(tokenAddress: string): Promise<number> {
  // 1. Fetch price history from Birdeye API or Helius
  const priceHistory = await fetchPriceHistory(tokenAddress, {
    interval: '1h',
    lookback: '7d'  // Last 7 days
  });
  
  // 2. Calculate TWAP (Time-Weighted Average Price)
  const twap = calculateTWAP(priceHistory);
  
  // 3. Get current price
  const currentPrice = await getCurrentPrice(tokenAddress);
  
  // 4. Calculate gap percentage
  const gap = ((currentPrice - twap) / twap) * 100;
  
  return Math.abs(gap); // Return absolute value as percentage
}

// Update proposal TWAP gap periodically
async function updateProposalTWAPGaps() {
  const activeProposals = await getActiveProposals();
  
  for (const proposal of activeProposals) {
    const twapGap = await calculateTWAPGap(proposal.token_address);
    await updateProposal(proposal.id, { twap_gap: twapGap });
  }
}
```

---

### **Status Determination**

| Aspect | Mock Data | Real Data |
|--------|-----------|-----------|
| **Source** | Hardcoded: `status: 'Active'` | Determined by voting logic and timestamps |
| **Active** | Static | `voting_end_at > now()` AND voting not completed |
| **Passed** | Static | Votes in favor >= threshold AND `voting_end_at < now()` |
| **Failed** | Static | Votes against >= threshold OR `voting_end_at < now()` without passing |

**Real Implementation**:
```typescript
// Determine proposal status
async function updateProposalStatus(proposalId: string): Promise<void> {
  const proposal = await getProposal(proposalId);
  const now = new Date();
  
  if (proposal.voting_end_at && new Date(proposal.voting_end_at) > now) {
    // Still active
    if (proposal.status !== 'Active') {
      await updateProposal(proposalId, { status: 'Active' });
    }
    return;
  }
  
  // Voting ended, check results
  const votes = await getProposalVotes(proposalId);
  const totalVotes = votes.reduce((sum, v) => sum + v.weight, 0);
  const votesFor = votes.filter(v => v.vote === 'for').reduce((sum, v) => sum + v.weight, 0);
  const votesAgainst = votes.filter(v => v.vote === 'against').reduce((sum, v) => sum + v.weight, 0);
  
  const threshold = 0.5; // 50% threshold
  const passed = votesFor / totalVotes >= threshold;
  
  if (passed) {
    await updateProposal(proposalId, {
      status: 'Passed',
      passed_at: now
    });
  } else {
    await updateProposal(proposalId, {
      status: 'Failed',
      failed_at: now
    });
  }
}
```

---

## 4. API Endpoint Structure (To Be Implemented)

### **GET /api/proposals**

**Query Parameters**:
- `tokenAddress` (optional): Filter by token address
- `status` (optional): Filter by status ('Active', 'Passed', 'Failed')
- `limit` (optional): Number of results (default: 100)

**Response**:
```json
{
  "proposals": [
    {
      "id": 1,
      "proposal_id": "ZC-4",
      "token_address": "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
      "token_name": "Z Combinator",
      "token_symbol": "ZC",
      "title": "ZC-4: Update Staking Vault Rewards & Parameters",
      "status": "Active",
      "summary": "This proposal authorizes...",
      "twap_gap": 8.67,
      "github_url": "https://github.com/zcombinatorio/zcombinator/pull/4",
      "created_at": "2025-01-15T10:00:00Z",
      "voting_start_at": "2025-01-15T10:00:00Z",
      "voting_end_at": "2025-01-22T10:00:00Z",
      "time_ago": "2 days left"  // Calculated on server
    }
  ],
  "count": 1
}
```

---

## 5. Frontend Changes Required

### **Current Implementation** (Mock):
```typescript
// ui/app/(vscode)/decisions/page.tsx
import { MOCK_PROPOSALS } from '@/lib/mock/mockProposals';

const mockProposals: Proposal[] = MOCK_PROPOSALS as Proposal[];
```

### **Real Implementation** (To Be):
```typescript
// ui/app/(vscode)/decisions/page.tsx
const [proposals, setProposals] = useState<Proposal[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  async function fetchProposals() {
    try {
      const response = await fetch('/api/proposals?status=all');
      const data = await response.json();
      setProposals(data.proposals);
    } catch (error) {
      console.error('Failed to fetch proposals:', error);
    } finally {
      setLoading(false);
    }
  }
  
  fetchProposals();
}, []);
```

---

## Summary

### **Mock Proposals Card**:
- ✅ Uses hardcoded data from `MOCK_PROPOSALS` array
- ✅ All fields are static (never update)
- ✅ No database or API calls required
- ✅ Perfect for demos and development

### **Real Data Implementation** (To Be):
- 🔄 Fetches from PostgreSQL database
- 🔄 Token info comes from `token_launches` table via JOIN
- 🔄 TWAP Gap calculated from real market data
- 🔄 Time left/passed calculated from timestamps in real-time
- 🔄 Status determined by voting logic and timestamps
- 🔄 Updates automatically as data changes

### **Key Differences**:
1. **Data Source**: Hardcoded array → Database + Market APIs
2. **Token Info**: Static string → JOIN with `token_launches` table
3. **TWAP Gap**: Static number → Calculated from price history
4. **Time Display**: Static string → Real-time calculation from timestamps
5. **Status**: Static value → Determined by voting results and time
6. **Updates**: Never changes → Updates in real-time

---

# Mock Projects Card vs Real Data Implementation

## 1. Mock Projects Card: Data Structure

The `ProjectCard` component (`ui/components/ProjectCard.tsx`) uses the following data fields from mock projects:

### Data Fields Used:

#### **Token Name** (`tokenName`)
- **Example**: `"Z Combinator"`, `"Shirtless"`, `"Percent"`, `"Oogway"`
- **Source**: Hardcoded `token_name` field in `MOCK_TOKENS` array or from metadata
- **Usage**: Displayed as the main title on the project card
- **Fallback**: Uses `metadata?.name` if `tokenName` is null, or `'Unknown'` if both are null
- **Mock Example**:
  ```typescript
  {
    token_name: 'Z Combinator',
    // ...
  }
  ```

#### **Token Symbol / Ticker** (`tokenSymbol`)
- **Example**: `"ZC"`, `"SHIRTLESS"`, `"PERC"`, `"OOGWAY"`
- **Source**: Hardcoded `token_symbol` field in `MOCK_TOKENS` array or from metadata
- **Usage**: Displayed next to token name in uppercase
- **Fallback**: Uses `metadata?.symbol` if `tokenSymbol` is null
- **Mock Example**:
  ```typescript
  {
    token_symbol: 'ZC',
    // ...
  }
  ```

#### **Token Address** (`tokenAddress`)
- **Example**: `"5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d"`
- **Source**: Hardcoded `token_address` field in `MOCK_TOKENS` array
- **Usage**: 
  - Displayed as shortened format: `"5eyk...2N9d"` (first 4 + last 4 characters)
  - Copyable to clipboard on click
- **Mock Example**:
  ```typescript
  {
    token_address: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',
    // ...
  }
  ```

#### **Creator Social Info** (`creatorTwitter`, `creatorGithub`)
- **Example**: `creatorTwitter: "zcombinator"`, `creatorGithub: "zcombinatorio"`
- **Source**: Hardcoded `creator_twitter` and `creator_github` fields in `MOCK_TOKENS` array
- **Usage**: 
  - Used to build social media links (Twitter/X, GitHub)
  - Displayed as social buttons on the card
  - Twitter: `https://x.com/{username}`
  - GitHub: `https://github.com/{username}` or full URL if starts with `http`
- **Mock Example**:
  ```typescript
  {
    creator_twitter: 'zcombinator',
    creator_github: 'zcombinatorio',
    // ...
  }
  ```

#### **Token Metadata** (`metadata`)
- **Source**: Fetched from `token_metadata_url` (IPFS or mock endpoint)
- **Fields**:
  - `name`: Token name (fallback for `tokenName`)
  - `symbol`: Token symbol (fallback for `tokenSymbol`)
  - `image`: Token image URL (defaults to `/zcombinator-logo.png`)
  - `website`: Project website URL
  - `twitter`: Twitter/X URL
  - `discord`: Discord invite URL
  - `github`: GitHub repository URL
  - `description`: Token description
- **Usage**: 
  - Image displayed as 80x80px rounded card
  - Social links built from metadata or creator socials
  - Social buttons shown in order: Website, X, Discord, GitHub
- **Mock Example**:
  ```typescript
  {
    token_metadata_url: '/api/mock-ipfs/QmMockHashZC',
    // Fetched metadata:
    {
      name: 'Z Combinator',
      symbol: 'ZC',
      image: '/z-pfp.jpg',
      website: 'https://zcombinator.io',
      twitter: 'https://x.com/zcombinator',
      discord: 'https://discord.com/invite/MQfcX9QM2r'
    }
  }
  ```

#### **Launch Time** (`launchTime`)
- **Example**: `"2025-10-15T14:30:00Z"`
- **Source**: Hardcoded `launch_time` field in `MOCK_TOKENS` array
- **Usage**: 
  - Calculated as "X days ago" from current time
  - Displayed below token address
- **Mock Example**:
  ```typescript
  {
    launch_time: '2025-10-15T14:30:00Z',
    // Displayed as: "45 days ago" (calculated)
  }
  ```

#### **Market Cap** (`marketCap`)
- **Example**: `640000`, `50000`, `150000`
- **Source**: From `MOCK_MARKET_DATA` or calculated from mock Birdeye API
- **Usage**: 
  - Formatted as: `"$640k"`, `"$50k"`, `"$0.6m"` (if >= 1M), `"$150.00"` (if < 1K)
  - Displayed prominently on the right side of card
- **Mock Example**:
  ```typescript
  {
    market_cap: 640000,  // → Displayed as "$640k"
    // ...
  }
  ```

#### **Price Change 24h** (`priceChange`)
- **Example**: `8.5`, `-3.2`, `15.7`
- **Source**: From mock Birdeye API (randomized: `-10%` to `+10%`)
- **Usage**: 
  - Formatted as: `"+8.5%"` (green) or `"-3.2%"` (red)
  - Displayed below market cap
  - Color: Green for positive, red for negative
- **Mock Example**:
  ```typescript
  {
    price_change_24h: 8.5,  // → Displayed as "+8.5%" (green)
    // ...
  }
  ```

#### **Proposals Count** (`activeProposals`, `passedProposals`, `failedProposals`)
- **Example**: `activeProposals: 2`, `passedProposals: 3`, `failedProposals: 1`
- **Source**: Calculated from `MOCK_PROPOSALS` filtered by token symbol
- **Usage**: 
  - Active proposals shown as blue badge: `"2 active proposals"`
  - Passed/Failed shown as text: `"3 passed / 1 Failed"`
  - Displayed on the right side of card
- **Mock Example**:
  ```typescript
  // Calculated from MOCK_PROPOSALS
  const tokenProposals = MOCK_PROPOSALS.filter(
    (p) => p.tokenSymbol === '$ZC'
  );
  // Result: { active: 1, passed: 2, failed: 0 }
  ```

#### **Verified Status** (`verified`)
- **Example**: `true`, `false`
- **Source**: Hardcoded `verified` field in `MOCK_TOKENS` array
- **Usage**: 
  - Shows green checkmark badge next to token name if `verified === true`
  - Indicates token has been verified by the platform
- **Mock Example**:
  ```typescript
  {
    verified: true,  // → Shows green checkmark badge
    // ...
  }
  ```

### Mock Data Example (Complete):

```typescript
{
  id: 1,
  launch_time: '2025-10-15T14:30:00Z',
  creator_wallet: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
  token_address: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',
  token_metadata_url: '/api/mock-ipfs/QmMockHashZC',
  token_name: 'Z Combinator',
  token_symbol: 'ZC',
  creator_twitter: 'zcombinator',
  creator_github: 'zcombinatorio',
  created_at: '2025-10-15T14:30:00Z',
  verified: true,
  // Market data (from MOCK_MARKET_DATA):
  market_cap: 640000,        // → "$640k"
  price_change_24h: 8.5,    // → "+8.5%" (green)
  // Proposals (calculated from MOCK_PROPOSALS):
  activeProposals: 1,       // → "1 active proposals" (blue badge)
  passedProposals: 2,       // → "2 passed / 0 Failed"
  failedProposals: 0
}
```

---

## 2. Real Data Implementation: How It Works

### Current State: ✅ **PARTIALLY IMPLEMENTED**

Projects (tokens) have **real database integration** with mock fallback. Most data comes from PostgreSQL, but some fields still use mock data.

### Real Data Structure:

#### **Database Schema** (existing `token_launches` table):

```sql
CREATE TABLE token_launches (
  id SERIAL PRIMARY KEY,
  launch_time TIMESTAMP NOT NULL,
  creator_wallet VARCHAR(44) NOT NULL,
  token_address VARCHAR(44) NOT NULL UNIQUE,
  token_metadata_url TEXT NOT NULL,
  token_name VARCHAR(255),
  token_symbol VARCHAR(255),
  creator_twitter VARCHAR(255),
  creator_github VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  verified BOOLEAN DEFAULT FALSE
);
```

#### **TypeScript Interface** (existing in `lib/db/types.ts`):

```typescript
export interface TokenLaunch {
  id?: number;
  launch_time: Date;
  creator_wallet: string;
  token_address: string;
  token_metadata_url: string;
  token_name?: string;
  token_symbol?: string;
  creator_twitter?: string;
  creator_github?: string;
  created_at?: Date;
  verified?: boolean;
}
```

---

## 3. Comparison: Mock vs Real Data

### **Token Name & Symbol**

| Aspect | Mock Data | Real Data |
|--------|-----------|-----------|
| **Source** | Hardcoded in `MOCK_TOKENS` array | Fetched from `token_launches` table |
| **Storage** | In-memory JavaScript array | PostgreSQL database |
| **Fallback** | Uses metadata if null | Uses metadata from IPFS if null |
| **Updates** | Never changes | Can be updated via database |

**Real Implementation**:
```typescript
// Fetch from database
const tokens = await getTokenLaunches();

// Token name/symbol from database
token.token_name  // From token_launches.token_name
token.token_symbol  // From token_launches.token_symbol

// Fallback to metadata if null
const displayName = token.token_name || metadata?.name || 'Unknown';
const displaySymbol = token.token_symbol || metadata?.symbol || '';
```

---

### **Token Address**

| Aspect | Mock Data | Real Data |
|--------|-----------|-----------|
| **Source** | Hardcoded in `MOCK_TOKENS` | Fetched from `token_launches.token_address` |
| **Uniqueness** | Not enforced | Enforced by `UNIQUE` constraint |
| **Validation** | None | Validated as Solana address (44 chars) |

**Real Implementation**:
```typescript
// From database
const token = await getTokenLaunchByAddress(tokenAddress);

// Address is always from database
token.token_address  // "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d"

// Format for display
const formatAddress = (address: string) => {
  const start = address.slice(0, 4);
  const end = address.slice(-4);
  return `${start}...${end}`;
};
```

---

### **Creator Social Info**

| Aspect | Mock Data | Real Data |
|--------|-----------|-----------|
| **Source** | Hardcoded `creator_twitter`, `creator_github` | From `token_launches` table columns |
| **Twitter** | Static string: `"zcombinator"` | From `token_launches.creator_twitter` |
| **GitHub** | Static string: `"zcombinatorio"` | From `token_launches.creator_github` |
| **URL Building** | Same logic: `https://x.com/{username}` | Same logic: `https://x.com/{username}` |

**Real Implementation**:
```typescript
// From database
const token = await getTokenLaunchByAddress(tokenAddress);

// Creator socials from database
const creatorTwitter = token.creator_twitter;  // "zcombinator"
const creatorGithub = token.creator_github;    // "zcombinatorio"

// Build URLs (same as mock)
const twitterUrl = creatorTwitter 
  ? `https://x.com/${creatorTwitter.replace('@', '')}` 
  : metadata?.twitter || null;

const githubUrl = creatorGithub
  ? (creatorGithub.startsWith('http') 
      ? creatorGithub 
      : `https://github.com/${creatorGithub}`)
  : metadata?.github || null;
```

---

### **Token Metadata**

| Aspect | Mock Data | Real Data |
|--------|-----------|-----------|
| **Source** | Mock IPFS endpoint: `/api/mock-ipfs/{hash}` | Real IPFS via Pinata or other gateway |
| **URL** | `token_metadata_url: '/api/mock-ipfs/QmMockHashZC'` | `token_metadata_url: 'https://gateway.pinata.cloud/ipfs/Qm...'` |
| **Fetching** | Returns hardcoded JSON | Fetches from IPFS gateway |
| **Image** | Always `/z-pfp.jpg` | Real image from IPFS |
| **Social Links** | Hardcoded in mock metadata | Real links from IPFS metadata |

**Real Implementation**:
```typescript
// Fetch metadata from IPFS
const metadataUrl = token.token_metadata_url;  // From database
// "https://gateway.pinata.cloud/ipfs/QmHash..."

const metadataResponse = await fetch(metadataUrl);
const metadata = await metadataResponse.json();

// Real metadata structure
{
  name: 'Z Combinator',
  symbol: 'ZC',
  image: 'https://gateway.pinata.cloud/ipfs/QmImageHash...',
  website: 'https://zcombinator.io',
  twitter: 'https://x.com/zcombinator',
  discord: 'https://discord.gg/...',
  github: 'https://github.com/zcombinatorio/zcombinator'
}
```

---

### **Launch Time**

| Aspect | Mock Data | Real Data |
|--------|-----------|-----------|
| **Source** | Hardcoded ISO string: `"2025-10-15T14:30:00Z"` | From `token_launches.launch_time` (TIMESTAMP) |
| **Format** | ISO string | PostgreSQL TIMESTAMP |
| **Calculation** | Same: `now() - launch_time` | Same: `now() - launch_time` |
| **Display** | Same: `"X days ago"` | Same: `"X days ago"` |

**Real Implementation**:
```typescript
// From database
const token = await getTokenLaunchByAddress(tokenAddress);

// Launch time is Date object from database
const launchTime = token.launch_time;  // Date object

// Format function (same as mock)
const formatTime = (timestamp: Date | string) => {
  const date = typeof timestamp === 'string' 
    ? new Date(timestamp) 
    : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return `${diffDays} days ago`;
};
```

---

### **Market Cap & Price Change**

| Aspect | Mock Data | Real Data |
|--------|-----------|-----------|
| **Source** | `MOCK_MARKET_DATA` or mock Birdeye API | Real Birdeye API (`https://public-api.birdeye.so`) |
| **Market Cap** | Hardcoded or randomized: `640000` | Real-time from Birdeye: `marketCap` or `market_cap` |
| **Price Change** | Randomized: `-10%` to `+10%` | Real 24h change: `priceChange24h` or `price_change_24h` |
| **Updates** | Static or slight randomization | Real-time updates from market |
| **API Key** | Not required | Requires `BIRDEYE_API_KEY` |

**Real Implementation**:
```typescript
// Fetch from real Birdeye API
const response = await fetch(
  `https://public-api.birdeye.so/defi/v3/token/market-data?address=${tokenAddress}`,
  {
    headers: {
      'accept': 'application/json',
      'x-chain': 'solana',
      'X-API-KEY': process.env.BIRDEYE_API_KEY
    }
  }
);

const data = await response.json();

// Real market data
{
  price: 0.0075,
  marketCap: 640000,           // or market_cap
  priceChange24h: 8.5,         // or price_change_24h
  liquidity: 320000,
  fdv: 750000,
  // ...
}
```

---

### **Proposals Count**

| Aspect | Mock Data | Real Data |
|--------|-----------|-----------|
| **Source** | Calculated from `MOCK_PROPOSALS` filtered by symbol | ❌ **NOT IMPLEMENTED** - Still uses `MOCK_PROPOSALS` |
| **Active** | Count from mock array | Would count from `proposals` table WHERE `status = 'Active'` |
| **Passed** | Count from mock array | Would count from `proposals` table WHERE `status = 'Passed'` |
| **Failed** | Count from mock array | Would count from `proposals` table WHERE `status = 'Failed'` |

**Current Implementation** (uses mock):
```typescript
// Still uses MOCK_PROPOSALS even with real tokens
const tokenProposals = MOCK_PROPOSALS.filter(
  (proposal) => proposal.tokenSymbol === tokenSymbolWithDollar
);

const active = tokenProposals.filter(p => p.status === 'Active').length;
const passed = tokenProposals.filter(p => p.status === 'Passed').length;
const failed = tokenProposals.filter(p => p.status === 'Failed').length;
```

**Real Implementation** (to be):
```typescript
// Would fetch from proposals table
const proposals = await db.query(`
  SELECT status, COUNT(*) as count
  FROM proposals
  WHERE token_address = $1
  GROUP BY status
`, [tokenAddress]);

// Count by status
const active = proposals.find(p => p.status === 'Active')?.count || 0;
const passed = proposals.find(p => p.status === 'Passed')?.count || 0;
const failed = proposals.find(p => p.status === 'Failed')?.count || 0;
```

---

### **Verified Status**

| Aspect | Mock Data | Real Data |
|--------|-----------|-----------|
| **Source** | Hardcoded `verified: true` in `MOCK_TOKENS` | From `token_launches.verified` (BOOLEAN) |
| **Default** | `true` for all mock tokens | `FALSE` by default in database |
| **Updates** | Never changes | Can be updated via database (admin action) |

**Real Implementation**:
```typescript
// From database
const token = await getTokenLaunchByAddress(tokenAddress);

// Verified status from database
const verified = token.verified || false;  // BOOLEAN from PostgreSQL

// Display checkmark if verified
{verified && (
  <div className="verified-badge">
    {/* Green checkmark SVG */}
  </div>
)}
```

---

## 4. API Endpoint Structure

### **POST /api/tokens**

**Request Body**:
```json
{
  "refresh": false
}
```

**Response**:
```json
{
  "tokens": [
    {
      "id": 1,
      "launch_time": "2025-10-15T14:30:00Z",
      "creator_wallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      "token_address": "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
      "token_metadata_url": "https://gateway.pinata.cloud/ipfs/QmHash...",
      "token_name": "Z Combinator",
      "token_symbol": "ZC",
      "creator_twitter": "zcombinator",
      "creator_github": "zcombinatorio",
      "created_at": "2025-10-15T14:30:00Z",
      "verified": true
    }
  ],
  "cached": false
}
```

### **POST /api/market-data/{tokenAddress}**

**Request Body**:
```json
{
  "tokenAddress": "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "price": 0.0075,
    "liquidity": 320000,
    "total_supply": 100000000,
    "circulating_supply": 85000000,
    "fdv": 750000,
    "market_cap": 640000,
    "price_change_24h": 8.5
  }
}
```

---

## 5. Frontend Implementation

### **Current Implementation** (Real + Mock Hybrid):

```typescript
// ui/app/(vscode)/projects/page.tsx

// 1. Fetch real tokens from database
const fetchTokens = async () => {
  const response = await fetch('/api/tokens', {
    method: 'POST',
    body: JSON.stringify({ refresh: false })
  });
  const data = await response.json();
  setTokens(data.tokens);  // Real tokens from database
};

// 2. Fetch metadata from IPFS (or mock)
tokens.forEach((token) => {
  fetchTokenMetadata(token.token_address, token.token_metadata_url);
});

// 3. Fetch market data (real Birdeye or mock)
const fetchMarketDataBatch = async (addresses: string[]) => {
  addresses.forEach(async (tokenAddress) => {
    const response = await fetch(`/api/market-data/${tokenAddress}`, {
      method: 'POST',
      body: JSON.stringify({ tokenAddress })
    });
    const data = await response.json();
    setMarketData(prev => ({
      ...prev,
      [tokenAddress]: data.data  // Real or mock market data
    }));
  });
};

// 4. Calculate proposals (still uses MOCK_PROPOSALS)
const tokenProposals = MOCK_PROPOSALS.filter(
  (proposal) => proposal.tokenSymbol === tokenSymbolWithDollar
);
```

---

## Summary

### **Mock Projects Card**:
- ✅ Token info from `MOCK_TOKENS` array
- ✅ Market data from `MOCK_MARKET_DATA` or mock Birdeye
- ✅ Proposals count from `MOCK_PROPOSALS` filtered by symbol
- ✅ Metadata from mock IPFS endpoint
- ✅ All data is static (never updates)

### **Real Data Implementation**:
- ✅ Token info from PostgreSQL `token_launches` table
- ✅ Market data from real Birdeye API (with mock fallback)
- ❌ Proposals count still uses `MOCK_PROPOSALS` (not implemented)
- ✅ Metadata from real IPFS gateway (with mock fallback)
- 🔄 Data updates in real-time from database and APIs

### **Key Differences**:
1. **Token Data**: Mock array → PostgreSQL database
2. **Market Data**: Mock values → Real Birdeye API
3. **Metadata**: Mock IPFS → Real IPFS gateway
4. **Proposals**: Still mock (not implemented in database)
5. **Verified Status**: Mock boolean → Database BOOLEAN column
6. **Updates**: Static → Real-time from database and APIs

---

# Mock Portfolio Tokens vs Real Data Implementation

## 1. Mock Portfolio Tokens: Data Structure

The Portfolio page (`ui/app/(vscode)/portfolio/page.tsx`) displays tokens in two tabs: **Held Tokens** and **Created Tokens**. Each token card uses the following data fields:

### Data Fields Used:

#### **Token Name & Symbol** (`name`, `symbol`)
- **Example**: `name: "Z Combinator"`, `symbol: "ZC"`
- **Source**: From `token_launches` table (`token_name`, `token_symbol`) or from metadata
- **Usage**: Displayed as main title on token card
- **Fallback**: Uses `metadata?.name` or `metadata?.symbol` if database fields are null
- **Mock Example**:
  ```typescript
  {
    token_name: 'Z Combinator',
    token_symbol: 'ZC',
    // ...
  }
  ```

#### **Token Address** (`tokenAddress`)
- **Example**: `"5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d"`
- **Source**: From `token_launches.token_address`
- **Usage**: 
  - Displayed as shortened format: `"5eyk...2N9d"` (first 4 + last 4 characters)
  - Copyable to clipboard on click
- **Mock Example**:
  ```typescript
  {
    token_address: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',
    // ...
  }
  ```

#### **Token Balance** (`balance`)
- **Example**: `"1.5M"`, `"250.5K"`, `"1,234.56"`
- **Source**: Fetched from Solana blockchain via `/api/balance/{tokenAddress}/{walletAddress}`
- **Usage**: 
  - Formatted: `>= 1M` → `"X.XXM"`, `>= 1K` → `"X.XXK"`, else → `"X,XXX.XX"`
  - Displayed as: `"1.5M $ZC"`
  - Only tokens with `balance > 0` are shown
- **Calculation**: 
  - Real: From Solana token account balance
  - Mock: Calculated from mock transaction history (sum of transfers)
- **Mock Example**:
  ```typescript
  // From mock Helius API
  {
    balance: "1500000",  // → Displayed as "1.5M"
    // ...
  }
  ```

#### **USD Value** (`usdValue`, `usdValueNumber`)
- **Example**: `"$11,250.00 USD"`, `"$1,875.50 USD"`
- **Source**: Calculated as `balance * price` from market data
- **Usage**: 
  - Displayed below balance: `"$11,250.00 USD"`
  - Used for sorting tokens (highest USD value first)
- **Calculation**:
  ```typescript
  const price = marketData.price;  // From Birdeye API
  const usdValueNumber = balance * price;
  const usdValue = `$${usdValueNumber.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })} USD`;
  ```
- **Mock Example**:
  ```typescript
  {
    balance: 1500000,
    price: 0.0075,  // From MOCK_MARKET_DATA
    usdValueNumber: 11250,  // 1500000 * 0.0075
    usdValue: "$11,250.00 USD"
  }
  ```

#### **Token Image** (`image`)
- **Example**: `"/z-pfp.jpg"`, `"https://gateway.pinata.cloud/ipfs/QmImageHash..."`
- **Source**: From token metadata (`metadata.image`)
- **Usage**: 
  - Displayed as 42x42px rounded icon
  - Fallback: `/logos/z-logo-white.png` if no image
- **Mock Example**:
  ```typescript
  {
    metadata: {
      image: '/z-pfp.jpg',  // From mock IPFS
      // ...
    }
  }
  ```

#### **Claimable Token Info** (`claimLabel`, `claimableTokens`)
- **Example**: `claimLabel: "Claim 500K $ZC"`
- **Source**: Calculated from claim eligibility API (`/api/claims/{tokenAddress}`)
- **Usage**: 
  - Shown in special purple gradient card for claimable tokens
  - Button text: `"Claim {amount} ${symbol}"`
  - Only displayed if user has unclaimed tokens
- **Mock Example**:
  ```typescript
  {
    claimLabel: "Claim 500K $ZC",
    balance: "500000",
    // ...
  }
  ```

#### **Created Token Socials** (`socials`)
- **Example**: 
  ```typescript
  {
    website: 'https://zcombinator.io',
    twitter: 'https://x.com/zcombinator',
    devTwitter: 'https://x.com/dev',
    discord: 'https://discord.gg/...',
    github: 'https://github.com/zcombinatorio/zcombinator',
    devGithub: 'https://github.com/dev'
  }
  ```
- **Source**: From token metadata or manually edited in modal
- **Usage**: 
  - Editable via "Edit socials" button
  - Stored in metadata (IPFS) or database
- **Mock Example**:
  ```typescript
  {
    socials: {
      website: 'https://zcombinator.io',
      twitter: 'https://x.com/zcombinator',
      // ...
    }
  }
  ```

### Mock Data Example (Complete Held Token):

```typescript
{
  tokenAddress: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',
  name: 'Z Combinator',
  symbol: 'ZC',
  balance: '1.5M',              // Formatted: "1.5M"
  usdValue: '$11,250.00 USD',   // Calculated: 1500000 * 0.0075
  usdValueNumber: 11250,        // For sorting
  image: '/z-pfp.jpg'           // From metadata
}
```

---

## 2. Real Data Implementation: How It Works

### Current State: ✅ **FULLY IMPLEMENTED**

Portfolio tokens use **real blockchain data** for balances and **real database** for token info. Market data can be real or mock depending on API key availability.

### Real Data Structure:

#### **Token Info** (from `token_launches` table):
- Same as Projects section - fetched from PostgreSQL database

#### **Token Balance** (from Solana blockchain):

**Real Implementation**:
```typescript
// ui/lib/token-balance.ts
export async function getWalletTokenBalance(
  walletAddress: string,
  tokenAddress: string
): Promise<string> {
  const walletPubkey = new PublicKey(walletAddress);
  const mintPubkey = new PublicKey(tokenAddress);

  // Get the associated token account address
  const tokenAccount = await getAssociatedTokenAddress(mintPubkey, walletPubkey);

  // Get account info from Solana blockchain
  const accountInfo = await connection.getAccountInfo(tokenAccount, 'confirmed');

  if (!accountInfo) {
    return '0';  // Account doesn't exist
  }

  // Get token decimals
  const mintInfo = await getMint(connection, mintPubkey);
  const decimals = mintInfo.decimals;

  // Parse token account data to get balance
  const accountData = AccountLayout.decode(accountInfo.data);
  const balance = Number(accountData.amount) / Math.pow(10, decimals);

  return balance.toString();
}
```

#### **USD Value Calculation**:

**Real Implementation**:
```typescript
// Fetch market data (real Birdeye or mock)
const marketResponse = await fetch(`/api/market-data/${tokenAddress}`, {
  method: 'POST',
  body: JSON.stringify({ tokenAddress })
});

const marketResult = await marketResponse.json();
if (marketResult.success && marketResult.data) {
  const price = marketResult.data.price || 0;  // Real price from Birdeye
  const balance = parseFloat(balanceString);
  const usdValueNumber = balance * price;
  const usdValue = `$${usdValueNumber.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })} USD`;
}
```

---

## 3. Comparison: Mock vs Real Data

### **Token Balance**

| Aspect | Mock Data | Real Data |
|--------|-----------|-----------|
| **Source** | Calculated from mock transaction history | Fetched from Solana blockchain |
| **Method** | Sum of transfers in mock transactions | Query token account on Solana |
| **Accuracy** | Approximate (based on mock transfers) | Exact (real blockchain state) |
| **Updates** | Static (never changes) | Real-time (updates with transactions) |
| **API** | Mock Helius: `getTokenAccountBalance()` | Solana RPC: `getAccountInfo()` |

**Real Implementation**:
```typescript
// Real: Query Solana blockchain
const connection = new Connection(
  process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com',
  'confirmed'
);

const tokenAccount = await getAssociatedTokenAddress(mintPubkey, walletPubkey);
const accountInfo = await connection.getAccountInfo(tokenAccount, 'confirmed');

// Parse balance from account data
const accountData = AccountLayout.decode(accountInfo.data);
const balance = Number(accountData.amount) / Math.pow(10, decimals);
```

**Mock Implementation**:
```typescript
// Mock: Calculate from transaction history
async getTokenAccountBalance(tokenAddress: string, walletAddress: string): Promise<string> {
  const transactions = this.transactionCache.get(tokenAddress) || [];
  let balance = 0;

  transactions.forEach((tx) => {
    tx.tokenTransfers?.forEach((transfer) => {
      if (transfer.fromUserAccount === walletAddress) {
        balance -= transfer.tokenAmount;
      }
      if (transfer.toUserAccount === walletAddress) {
        balance += transfer.tokenAmount;
      }
    });
  });

  return Math.max(0, balance).toString();
}
```

---

### **USD Value**

| Aspect | Mock Data | Real Data |
|--------|-----------|-----------|
| **Source** | `balance * mockPrice` (from `MOCK_MARKET_DATA`) | `balance * realPrice` (from Birdeye API) |
| **Price** | Hardcoded: `0.0075`, `0.0006`, etc. | Real-time from Birdeye API |
| **Updates** | Static | Updates with market price changes |
| **Calculation** | Same formula: `balance * price` | Same formula: `balance * price` |

**Real Implementation**:
```typescript
// Fetch real market price
const marketData = await fetch(`/api/market-data/${tokenAddress}`, {
  method: 'POST',
  body: JSON.stringify({ tokenAddress })
});

const { price } = await marketData.json().data;

// Calculate USD value
const usdValueNumber = parseFloat(balance) * price;
const usdValue = `$${usdValueNumber.toLocaleString('en-US', { 
  minimumFractionDigits: 2, 
  maximumFractionDigits: 2 
})} USD`;
```

---

### **Token Sorting**

| Aspect | Mock Data | Real Data |
|--------|-----------|-----------|
| **Method** | Sort by `usdValueNumber` (descending) | Same: Sort by `usdValueNumber` (descending) |
| **Order** | Highest USD value first | Highest USD value first |
| **Updates** | Static order | Dynamic (updates as prices change) |

**Implementation** (same for both):
```typescript
// Sort tokens by USD value (descending - highest first)
tokensWithBalances.sort((a, b) => {
  return b.usdValueNumber - a.usdValueNumber;
});
```

---

### **Claimable Tokens**

| Aspect | Mock Data | Real Data |
|--------|-----------|-----------|
| **Source** | ❌ **NOT IMPLEMENTED** - No mock claimable tokens | Calculated from emission splits and claim records |
| **Eligibility** | N/A | Based on `emission_splits` table and `claim_records` |
| **Amount** | N/A | Calculated from split percentage and total available |

**Real Implementation**:
```typescript
// Fetch claim eligibility
const claimInfoResponse = await fetch(`/api/claims/${tokenAddress}`, {
  method: 'POST',
  body: JSON.stringify({
    tokenAddress,
    wallet: wallet.toString()
  })
});

const claimInfo = await claimInfoResponse.json();

if (claimInfo.canClaimNow && claimInfo.availableToClaim > 0) {
  // Show claimable token card
  const claimableToken: ClaimableToken = {
    tokenAddress,
    name,
    symbol,
    balance: formatBalance(claimInfo.availableToClaim),
    usdValue: calculateUSDValue(claimInfo.availableToClaim, price),
    claimLabel: `Claim ${formatBalance(claimInfo.availableToClaim)} $${symbol}`
  };
}
```

---

### **Created Tokens**

| Aspect | Mock Data | Real Data |
|--------|-----------|-----------|
| **Source** | ❌ **NOT IMPLEMENTED** - Empty array | Fetched from `token_launches` WHERE `creator_wallet = wallet` |
| **Filtering** | No tokens shown | Filter by `creator_wallet` matching connected wallet |
| **Socials** | Editable in modal (stored in state only) | Editable in modal (should update metadata/IPFS) |

**Real Implementation** (to be):
```typescript
// Fetch created tokens
const response = await fetch('/api/launches', {
  method: 'POST',
  body: JSON.stringify({
    creator: wallet.toString()
  })
});

const data = await response.json();
const createdTokens = data.launches.map(launch => ({
  id: launch.id.toString(),
  name: launch.token_name || metadata?.name || 'Unknown',
  symbol: launch.token_symbol || metadata?.symbol || 'UNKNOWN',
  tokenAddress: launch.token_address,
  claimLabel: 'Manage claims',
  socialsLabel: 'Edit socials',
  image: metadata?.image,
  socials: {
    website: metadata?.website,
    twitter: metadata?.twitter,
    discord: metadata?.discord,
    github: metadata?.github
  }
}));
```

---

## 4. API Endpoint Structure

### **POST /api/balance/{tokenAddress}/{walletAddress}**

**Request Body**:
```json
{
  "tokenAddress": "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
  "walletAddress": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
}
```

**Response**:
```json
{
  "walletAddress": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "tokenAddress": "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
  "balance": "1500000"
}
```

### **POST /api/claims/{tokenAddress}**

**Request Body**:
```json
{
  "tokenAddress": "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
  "wallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
}
```

**Response**:
```json
{
  "canClaimNow": true,
  "availableToClaim": "500000",
  "timeUntilNextClaim": null,
  "walletSplitPercentage": 10,
  "totalAlreadyClaimedByWallet": "0"
}
```

---

## 5. Frontend Implementation

### **Current Implementation** (Real + Mock Hybrid):

```typescript
// ui/app/(vscode)/portfolio/page.tsx

// 1. Fetch all tokens from database
const fetchTokens = async () => {
  const response = await fetch('/api/tokens', {
    method: 'POST',
    body: JSON.stringify({ refresh: false })
  });
  const data = await response.json();
  setTokens(data.tokens);  // Real tokens from database
};

// 2. Fetch balances from Solana blockchain (or mock)
const fetchBalances = async () => {
  const walletAddress = wallet.toString();
  
  for (const token of tokens) {
    const balanceResponse = await fetch(
      `/api/balance/${token.token_address}/${walletAddress}`,
      {
        method: 'POST',
        body: JSON.stringify({
          tokenAddress: token.token_address,
          walletAddress: walletAddress
        })
      }
    );
    
    const balanceData = await balanceResponse.json();
    const balance = parseFloat(balanceData.balance || '0');
    
    // Only include tokens with balance > 0
    if (balance > 0) {
      // 3. Fetch market data for USD value
      const marketResponse = await fetch(`/api/market-data/${token.token_address}`, {
        method: 'POST',
        body: JSON.stringify({ tokenAddress: token.token_address })
      });
      
      const marketResult = await marketResponse.json();
      const price = marketResult.data.price || 0;
      const usdValueNumber = balance * price;
      
      const heldToken: HeldToken = {
        tokenAddress: token.token_address,
        name: token.token_name || metadata?.name || 'Unknown',
        symbol: token.token_symbol || metadata?.symbol || 'UNKNOWN',
        balance: formatBalance(balance),
        usdValue: `$${usdValueNumber.toLocaleString('en-US', { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        })} USD`,
        usdValueNumber,
        image: metadata?.image
      };
    }
  }
  
  // 4. Sort by USD value (descending)
  tokensWithBalances.sort((a, b) => b.usdValueNumber - a.usdValueNumber);
};
```

---

## Summary

### **Mock Portfolio Tokens**:
- ✅ Token info from `MOCK_TOKENS` array
- ✅ Balance calculated from mock transaction history
- ✅ Market data from `MOCK_MARKET_DATA` or mock Birdeye
- ✅ USD value calculated from mock price
- ❌ No claimable tokens (not implemented)
- ❌ No created tokens (empty array)
- ✅ All data is static (never updates)

### **Real Data Implementation**:
- ✅ Token info from PostgreSQL `token_launches` table
- ✅ Balance fetched from Solana blockchain (real-time)
- ✅ Market data from real Birdeye API (with mock fallback)
- ✅ USD value calculated from real price
- ✅ Claimable tokens calculated from emission splits
- ⚠️ Created tokens fetched from database (but socials editing not persisted)
- 🔄 Data updates in real-time from blockchain and APIs

### **Key Differences**:
1. **Balance**: Mock calculation → Real Solana blockchain query
2. **USD Value**: Mock price → Real Birdeye API price
3. **Updates**: Static → Real-time from blockchain
4. **Claimable Tokens**: Not implemented → Real eligibility calculation
5. **Created Tokens**: Empty → Fetched from database
6. **Accuracy**: Approximate → Exact (real blockchain state)

---

# Filter & Search States: Annotation

## Overview

The Z Combinator platform implements comprehensive filtering and search functionality across multiple pages. This annotation documents the state management, filtering logic, and user interaction patterns for search and filter systems.

---

## 1. Projects Page: Filter & Search States

### **State Variables**

#### **Search Query** (`searchQuery`)
- **Type**: `string`
- **Initial Value**: `''` (empty string)
- **Purpose**: Text input for searching tokens by name, symbol, or address
- **Placeholder**: `"Enter ticker, contract address..."`
- **Search Fields**:
  - Token name (`token_name`)
  - Token symbol (`token_symbol`)
  - Token address (`token_address`)
- **Case Sensitivity**: Case-insensitive (converted to lowercase for comparison)
- **Real-time**: Updates on every keystroke (`onChange` event)

**Implementation**:
```typescript
const [searchQuery, setSearchQuery] = useState('');

// Filter logic
if (searchQuery) {
  const query = searchQuery.toLowerCase();
  filtered = filtered.filter(token => {
    const name = (token.token_name || '').toLowerCase();
    const symbol = (token.token_symbol || '').toLowerCase();
    const address = token.token_address.toLowerCase();
    return name.includes(query) || symbol.includes(query) || address.includes(query);
  });
}
```

#### **View Mode** (`viewMode`)
- **Type**: `'all' | 'verified' | 'activeQM'`
- **Initial Value**: `'all'`
- **Purpose**: Filter tokens by verification status or active proposals
- **Options**:
  - `'all'`: Show all tokens (no filter)
  - `'verified'`: Show only verified tokens (`token.verified === true`)
  - `'activeQM'`: Show only tokens with active proposals (`activeProposals > 0`)
- **UI**: Displayed as filter chips/buttons
- **State Persistence**: Separate pagination state for `'verified'` vs `'all'` modes

**Implementation**:
```typescript
const [viewMode, setViewMode] = useState<'all' | 'verified' | 'activeQM'>('all');

// Filter logic
if (viewMode === 'verified') {
  filtered = filtered.filter(token => token.verified);
} else if (viewMode === 'activeQM') {
  filtered = filtered.filter(token => {
    const proposals = proposalsData[token.token_address];
    return proposals && proposals.active > 0;
  });
}
```

#### **Sort By** (`sortBy`)
- **Type**: `'mcapHigher' | 'mcapLower' | 'ageNewer' | 'ageOlder' | 'activeProposals'`
- **Initial Value**: `'mcapHigher'`
- **Purpose**: Sort filtered tokens by different criteria
- **Options**:
  - `'mcapHigher'`: Market cap descending (highest first)
  - `'mcapLower'`: Market cap ascending (lowest first)
  - `'ageNewer'`: Launch time descending (newest first)
  - `'ageOlder'`: Launch time ascending (oldest first)
  - `'activeProposals'`: Active proposals count descending (most active first)
- **UI**: Dropdown menu with "Filter by" button
- **Dropdown State**: Controlled by `isFilterDropdownOpen`

**Implementation**:
```typescript
const [sortBy, setSortBy] = useState<'mcapHigher' | 'mcapLower' | 'ageNewer' | 'ageOlder' | 'activeProposals'>('mcapHigher');

// Sort logic
const sorted = [...filtered].sort((a, b) => {
  if (sortBy === 'mcapHigher') {
    const mcapA = marketData[a.token_address]?.market_cap || 0;
    const mcapB = marketData[b.token_address]?.market_cap || 0;
    return mcapB - mcapA; // Descending
  } else if (sortBy === 'mcapLower') {
    // ... ascending
  } else if (sortBy === 'ageNewer') {
    // ... by launch_time descending
  } else if (sortBy === 'ageOlder') {
    // ... by launch_time ascending
  } else if (sortBy === 'activeProposals') {
    // ... by active proposals count descending
  }
});
```

#### **Filter Dropdown Open** (`isFilterDropdownOpen`)
- **Type**: `boolean`
- **Initial Value**: `false`
- **Purpose**: Control visibility of sort options dropdown
- **Behavior**: 
  - Opens on button click
  - Closes on option selection
  - Closes on click outside (via `useEffect` with `filterDropdownRef`)
- **UI**: Dropdown positioned below "Filter by" button

**Implementation**:
```typescript
const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
const filterDropdownRef = useRef<HTMLDivElement>(null);

// Close on outside click
useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
      setIsFilterDropdownOpen(false);
    }
  };
  if (isFilterDropdownOpen) {
    document.addEventListener('mousedown', handleClickOutside);
  }
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, [isFilterDropdownOpen]);
```

#### **Pagination States**
- **Type**: `number` (page numbers)
- **Separate States**: 
  - `allPage`: For `viewMode === 'all'`
  - `verifiedPage`: For `viewMode === 'verified'`
- **Purpose**: Maintain separate page numbers for different view modes
- **Reset**: Automatically resets when filters change (via `useEffect`)

**Implementation**:
```typescript
const [verifiedPage, setVerifiedPage] = useState(1);
const [allPage, setAllPage] = useState(1);

const currentPage = viewMode === 'verified' ? verifiedPage : allPage;
const setCurrentPage = viewMode === 'verified' ? setVerifiedPage : setAllPage;
```

---

## 2. Decisions Page: Filter & Search States

### **State Variables**

#### **Search Query** (`searchQuery`)
- **Type**: `string`
- **Initial Value**: `''` (empty string)
- **Purpose**: Text input for searching proposals
- **Placeholder**: `"Search proposals by title or ID..."`
- **Search Fields**:
  - Proposal title (`title`)
  - Proposal summary (`summary`)
  - Proposal ID (`id`)
- **Case Sensitivity**: Case-insensitive
- **Real-time**: Updates on every keystroke

**Implementation**:
```typescript
const [searchQuery, setSearchQuery] = useState('');

// Filter logic
if (searchQuery) {
  const query = searchQuery.toLowerCase();
  return (
    proposal.title.toLowerCase().includes(query) ||
    proposal.summary.toLowerCase().includes(query) ||
    proposal.id.toLowerCase().includes(query)
  );
}
```

#### **View Mode** (`viewMode`)
- **Type**: `'all' | 'active' | 'passed' | 'failed'`
- **Initial Value**: `'all'`
- **Purpose**: Filter proposals by status
- **Options**:
  - `'all'`: Show all proposals
  - `'active'`: Show only active proposals (`status === 'Active'`)
  - `'passed'`: Show only passed proposals (`status === 'Passed'`)
  - `'failed'`: Show only failed proposals (`status === 'Failed'`)
- **UI**: Displayed as filter chips/buttons

**Implementation**:
```typescript
const [viewMode, setViewMode] = useState<'all' | 'active' | 'passed' | 'failed'>('all');

// Filter logic
if (viewMode !== 'all' && proposal.status.toLowerCase() !== viewMode) {
  return false;
}
```

#### **Current Page** (`currentPage`)
- **Type**: `number`
- **Initial Value**: `1`
- **Purpose**: Track current page in pagination
- **Reset**: Automatically resets to `1` when `viewMode` or `searchQuery` changes

**Implementation**:
```typescript
const [currentPage, setCurrentPage] = useState(1);

// Reset on filter change
useEffect(() => {
  setCurrentPage(1);
}, [viewMode, searchQuery]);
```

---

## 3. Filter & Search State Flow

### **State Dependencies**

```
┌─────────────────┐
│  User Input     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  State Update   │
│  (setState)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  useMemo Hook   │
│  (Recompute)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Filter Logic   │
│  (Apply filters)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Sort Logic     │
│  (Apply sorting)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Pagination     │
│  (Slice array)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Render UI      │
└─────────────────┘
```

### **State Update Triggers**

1. **Search Query Change**:
   - Trigger: User types in search input
   - Updates: `searchQuery` state
   - Effect: Recomputes `filteredTokens` via `useMemo`
   - Side Effect: Resets pagination to page 1

2. **View Mode Change**:
   - Trigger: User clicks filter chip (All/Verified/Active QM)
   - Updates: `viewMode` state
   - Effect: Recomputes `filteredTokens` via `useMemo`
   - Side Effect: Switches pagination state (allPage vs verifiedPage)

3. **Sort By Change**:
   - Trigger: User selects option from dropdown
   - Updates: `sortBy` state
   - Effect: Recomputes `filteredTokens` via `useMemo`
   - Side Effect: Closes dropdown (`setIsFilterDropdownOpen(false)`)

4. **Pagination Change**:
   - Trigger: User clicks page number or Previous/Next
   - Updates: `currentPage` state (or `allPage`/`verifiedPage`)
   - Effect: Slices `filteredTokens` array for current page

---

## 4. Filter Combination Logic

### **Projects Page**

Filters are applied in sequence:

1. **View Mode Filter** (first):
   ```typescript
   if (viewMode === 'verified') {
     filtered = filtered.filter(token => token.verified);
   } else if (viewMode === 'activeQM') {
     filtered = filtered.filter(token => proposalsData[token.token_address]?.active > 0);
   }
   ```

2. **Search Query Filter** (second):
   ```typescript
   if (searchQuery) {
     filtered = filtered.filter(token => {
       // Match name, symbol, or address
     });
   }
   ```

3. **Sorting** (third):
   ```typescript
   const sorted = [...filtered].sort((a, b) => {
     // Sort by selected criteria
   });
   ```

4. **Pagination** (fourth):
   ```typescript
   const paginatedTokens = sorted.slice(startIndex, endIndex);
   ```

### **Decisions Page**

Filters are applied in sequence:

1. **View Mode Filter** (first):
   ```typescript
   if (viewMode !== 'all' && proposal.status !== viewMode) {
     return false;
   }
   ```

2. **Search Query Filter** (second):
   ```typescript
   if (searchQuery) {
     // Match title, summary, or ID
   }
   ```

3. **Sorting** (third):
   ```typescript
   // Sort: Active first, then by time
   ```

4. **Pagination** (fourth):
   ```typescript
   const paginatedProposals = filtered.slice(startIndex, endIndex);
   ```

---

## 5. State Persistence & Reset Behavior

### **State Persistence**

- **Within Session**: All filter/search states persist during user session
- **Between Pages**: States are page-specific (not shared across routes)
- **Page Refresh**: All states reset to initial values on page refresh

### **Automatic Reset Triggers**

1. **Pagination Reset**:
   - When `viewMode` changes → Reset to page 1
   - When `searchQuery` changes → Reset to page 1

2. **Dropdown Close**:
   - When sort option selected → Close dropdown
   - When clicking outside → Close dropdown

3. **Filter State Separation**:
   - `allPage` and `verifiedPage` maintain separate page numbers
   - Switching between view modes preserves respective page numbers

---

## 6. Performance Optimizations

### **Memoization**

- **Filtered Results**: Wrapped in `useMemo` to prevent unnecessary recalculations
- **Dependencies**: Only recomputes when relevant states change
- **Pagination Numbers**: Memoized to avoid recalculating page array

**Example**:
```typescript
const filteredTokens = useMemo(() => {
  // Filter and sort logic
}, [tokens, viewMode, searchQuery, proposalsData, marketData, sortBy]);
```

### **Batch Operations**

- **Market Data Fetching**: Batched to avoid excessive API calls
- **Balance Fetching**: Processed in batches of 10 tokens
- **Metadata Fetching**: Cached in state to avoid duplicate requests

---

## 7. Empty States & Loading States

### **Empty States**

1. **No Results**:
   - Trigger: `filteredTokens.length === 0` after applying filters
   - Message: `"No tokens launched yet"` or `"No proposals found"`
   - UI: Centered text message

2. **Loading State**:
   - Trigger: `loading === true` during data fetch
   - Message: `"Loading tokens..."` or `"Loading proposals..."`
   - UI: Centered text message

### **State Transitions**

```
Loading → Empty → Results
   │         │        │
   └─────────┴────────┘
      (Data loaded)
```

---

## Summary

### **Key State Variables**:

**Projects Page**:
- `searchQuery`: Text search input
- `viewMode`: Filter by verification/active proposals
- `sortBy`: Sort criteria selection
- `isFilterDropdownOpen`: Dropdown visibility
- `allPage` / `verifiedPage`: Separate pagination states

**Decisions Page**:
- `searchQuery`: Text search input
- `viewMode`: Filter by proposal status
- `currentPage`: Pagination state

### **State Management Patterns**:
1. **Sequential Filtering**: View mode → Search → Sort → Paginate
2. **Memoization**: Results computed only when dependencies change
3. **State Separation**: Different pagination states for different view modes
4. **Automatic Reset**: Pagination resets on filter changes
5. **Real-time Updates**: Search updates on every keystroke

