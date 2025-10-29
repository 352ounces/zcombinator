# PR #3 Review Guide

## Quick Review Checklist

### Part 1: High-Level Review (5 minutes)
- [ x] Review PR description on GitHub
- [ x] Check commit messages make sense
- [ x] Verify file changes look reasonable
- [x] Check REFACTORING_VERIFICATION.md

### Part 2: Refactoring Verification (10 minutes)
- [ x] Verify route URLs unchanged
- [ ] Check code compilation
- [ ] Review new file structure
- [ ] Verify no logic changes

### Part 3: Emission Splits Feature Review (15 minutes)
- [ ] Review emission split logic
- [ ] Check authorization flow
- [ ] Verify backwards compatibility
- [ ] Review security considerations

### Part 4: Testing (20 minutes)
- [ ] Test with emission splits
- [ ] Test without emission splits
- [ ] Test unauthorized access
- [ ] Verify split percentages

---

## Part 1: High-Level Review

### 1.1 View the PR on GitHub
```bash
gh pr view 3 --web
```

**What to check:**
- ✅ PR title describes the change
- ✅ Description is comprehensive
- ✅ All commits are logical and well-documented
- ✅ Changes count looks reasonable (2,803 additions, 2,058 deletions)

### 1.2 Review File Changes
```bash
# View all changed files
gh pr diff 3 --name-only

# Expected files:
# - api-server.ts (modified)
# - lib/db.ts (modified)
# - lib/claimService.ts (new)
# - lib/presaleService.ts (new)
# - routes/claims.ts (new)
# - routes/presale.ts (new)
# - REFACTORING_VERIFICATION.md (new)
```

### 1.3 Read the Verification Document
```bash
cat REFACTORING_VERIFICATION.md
```

**What to check:**
- ✅ All route URLs listed and verified
- ✅ Critical logic patterns verified
- ✅ Storage sharing documented
- ✅ Compilation verified

---

## Part 2: Refactoring Verification

### 2.1 Verify Code Compiles
```bash
# TypeScript compilation should pass
npm run build 2>&1 | grep -i error

# If no errors shown, compilation passed
```

### 2.2 Check Route Mapping
```bash
# Extract all routes from new files
echo "=== CLAIMS ROUTES ==="
grep "^router\.\(get\|post\)(" routes/claims.ts | sed 's/,.*$//'

echo ""
echo "=== PRESALE ROUTES ==="
grep "^router\.\(get\|post\)(" routes/presale.ts | sed 's/,.*$//'

echo ""
echo "=== API-SERVER MOUNTS ==="
grep "app.use.*Router" api-server.ts
```

**Expected output:**
```
Claims Routes:
- router.get('/:tokenAddress'        → /claims/:tokenAddress
- router.post('/mint'                → /claims/mint
- router.post('/confirm'             → /claims/confirm

Presale Routes (mounted at /presale):
- router.get('/:tokenAddress/claims/:wallet'
- router.post('/:tokenAddress/claims/prepare'
- router.post('/:tokenAddress/claims/confirm'
- router.get('/:tokenAddress/stats'
- router.get('/:tokenAddress/bids'
- router.post('/:tokenAddress/bids'
- router.post('/:tokenAddress/launch'
- router.post('/:tokenAddress/launch-confirm'

API Server Mounts:
- app.use('/claims', claimsRouter);
- app.use('/presale', presaleRouter);
```

### 2.3 Verify Imports/Exports
```bash
# Check claimService exports
echo "=== CLAIM SERVICE EXPORTS ==="
grep "^export" lib/claimService.ts

# Check presaleService exports
echo ""
echo "=== PRESALE SERVICE EXPORTS ==="
grep "^export" lib/presaleService.ts

# Check claims routes imports from claimService
echo ""
echo "=== CLAIMS ROUTES IMPORTS ==="
grep "from.*claimService" routes/claims.ts

# Check presale routes imports from presaleService
echo ""
echo "=== PRESALE ROUTES IMPORTS ==="
grep "from.*presaleService" routes/presale.ts
```

**What to verify:**
- ✅ `claimTransactions` and `acquireClaimLock` exported from claimService
- ✅ `presaleClaimTransactions` and `acquirePresaleClaimLock` exported from presaleService
- ✅ All exports imported in respective routes files

### 2.4 Verify No Duplicate Code
```bash
# Check api-server.ts doesn't have old handlers
echo "Checking for leftover claim handlers in api-server.ts:"
grep -c "'/claims/\(mint\|confirm\)'" api-server.ts || echo "✓ None found (expected)"

echo ""
echo "Checking for leftover presale handlers in api-server.ts:"
grep -c "'/presale/:tokenAddress" api-server.ts || echo "✓ None found (expected)"
```

**Expected:** Both should return 0 or "None found"

---

## Part 3: Emission Splits Feature Review

### 3.1 Review the Core Logic

**File to review:** `routes/claims.ts`

**Key sections to examine:**

#### A. Split Distribution Logic (lines ~300-350)
```bash
# View the split calculation logic
sed -n '290,360p' routes/claims.ts | grep -A20 "Query emission splits"
```

**What to check:**
- ✅ Queries `getEmissionSplits()` to fetch splits
- ✅ Calculates proportional amounts using `BigInt` math
- ✅ Falls back to 100% creator if no splits
- ✅ Creates token accounts for all recipients
- ✅ Admin still gets 10% regardless of splits

#### B. Authorization Logic (lines ~240-260)
```bash
# View the authorization check
sed -n '230,270p' routes/claims.ts | grep -A10 "hasClaimRights"
```

**What to check:**
- ✅ Uses `hasClaimRights()` instead of creator-only check
- ✅ Allows any wallet with emission split OR creator
- ✅ Rejects wallets without claim rights

#### C. Transaction Creation (lines ~360-400)
```bash
# View transaction instruction creation
sed -n '360,410p' routes/claims.ts | grep -B5 -A5 "createMintToInstruction"
```

**What to check:**
- ✅ Loop creates instructions for each recipient
- ✅ Each recipient gets proportional amount
- ✅ Admin mint instruction added last
- ✅ All amounts include decimals

### 3.2 Review Database Functions

**File to review:** `lib/db.ts`

```bash
# View the new emission split functions
grep -A15 "export async function getWalletEmissionSplit" lib/db.ts
grep -A15 "export async function hasRecentClaimByWallet" lib/db.ts
grep -A15 "export async function getTotalClaimedByWallet" lib/db.ts
```

**What to check:**
- ✅ `getWalletEmissionSplit()` - gets specific wallet's split
- ✅ `hasRecentClaimByWallet()` - per-wallet cooldown check
- ✅ `getTotalClaimedByWallet()` - per-wallet claim tracking

**Note:** The last two are for future multi-signer work

### 3.3 Check Backwards Compatibility

```bash
# Search for creator fallback logic
grep -A10 "No splits configured" routes/claims.ts
```

**What to verify:**
- ✅ When no splits exist, 100% goes to creator
- ✅ Uses same token accounts as before
- ✅ Same transaction structure for non-split tokens

### 3.4 Security Review

```bash
# Check for security comments
grep -n "CRITICAL SECURITY\|SECURITY:" routes/claims.ts | head -10
```

**Security aspects to verify:**
- ✅ Only authorized wallets can initiate claims
- ✅ Split validation happens at database level (PR #1)
- ✅ Transaction metadata is immutable once created
- ✅ All recipients receive tokens atomically
- ✅ Admin always receives 10% protocol fee

---

## Part 4: Testing

### 4.1 Setup Test Environment

```bash
# Start the API server
npm run api:watch

# In another terminal, prepare test data
```

### 4.2 Test Scenario 1: Claim with Emission Splits

**Setup:**
```sql
-- Connect to your database
-- Insert test splits for a token
INSERT INTO emission_splits (token_address, recipient_wallet, split_percentage, label, created_at)
VALUES
  ('YOUR_TEST_TOKEN', 'CREATOR_WALLET_ADDRESS', 70.00, 'Creator', NOW()),
  ('YOUR_TEST_TOKEN', 'TEAM_WALLET_ADDRESS', 30.00, 'Team Member', NOW());
```

**Test:**
```bash
# 1. Create mint transaction (as creator)
curl -X POST http://localhost:3001/claims/mint \
  -H "Content-Type: application/json" \
  -d '{
    "tokenAddress": "YOUR_TEST_TOKEN",
    "userWallet": "CREATOR_WALLET_ADDRESS",
    "claimAmount": "1000"
  }'

# Expected response:
# {
#   "success": true,
#   "transaction": "...",
#   "splitRecipients": [
#     {"wallet": "CREATOR_WALLET_ADDRESS", "amount": "630", "label": "Creator"},
#     {"wallet": "TEAM_WALLET_ADDRESS", "amount": "270", "label": "Team Member"}
#   ],
#   "adminAmount": "100"
# }
```

**Verify:**
- ✅ Response includes `splitRecipients` array
- ✅ Creator gets 630 tokens (70% of 900)
- ✅ Team gets 270 tokens (30% of 900)
- ✅ Admin gets 100 tokens (10% of 1000)
- ✅ Total = 1000 tokens

**Test variation: Claim initiated by team member**
```bash
# 2. Create mint transaction (as team member)
curl -X POST http://localhost:3001/claims/mint \
  -H "Content-Type: application/json" \
  -d '{
    "tokenAddress": "YOUR_TEST_TOKEN",
    "userWallet": "TEAM_WALLET_ADDRESS",
    "claimAmount": "1000"
  }'

# Expected: Same distribution (70/30 split)
```

**Verify:**
- ✅ Team member can initiate claim
- ✅ Distribution is still 70/30 (not 30/70)
- ✅ Creator gets 630, team gets 270

### 4.3 Test Scenario 2: Claim WITHOUT Emission Splits

**Setup:**
```sql
-- Use a token with NO emission splits
-- Or delete the splits from test token
DELETE FROM emission_splits WHERE token_address = 'YOUR_TEST_TOKEN';
```

**Test:**
```bash
curl -X POST http://localhost:3001/claims/mint \
  -H "Content-Type: application/json" \
  -d '{
    "tokenAddress": "YOUR_TEST_TOKEN",
    "userWallet": "CREATOR_WALLET_ADDRESS",
    "claimAmount": "1000"
  }'

# Expected response:
# {
#   "success": true,
#   "transaction": "...",
#   "splitRecipients": [
#     {"wallet": "CREATOR_WALLET_ADDRESS", "amount": "900", "label": "Creator"}
#   ],
#   "adminAmount": "100"
# }
```

**Verify:**
- ✅ Falls back to 100% creator
- ✅ Creator gets 900 tokens (90% of 1000)
- ✅ Admin gets 100 tokens (10% of 1000)
- ✅ Backwards compatible behavior

### 4.4 Test Scenario 3: Unauthorized Access

**Test:**
```bash
# Try to claim with random wallet (not creator, not in splits)
curl -X POST http://localhost:3001/claims/mint \
  -H "Content-Type: application/json" \
  -d '{
    "tokenAddress": "YOUR_TEST_TOKEN",
    "userWallet": "RANDOM_WALLET_ADDRESS",
    "claimAmount": "1000"
  }'

# Expected response:
# {
#   "error": "You do not have claim rights for this token"
# }
```

**Verify:**
- ✅ Request is rejected
- ✅ Returns 403 status code
- ✅ Error message is clear

### 4.5 Test Scenario 4: Split Percentage Validation

**Setup:**
```sql
-- Try to insert splits that exceed 100%
INSERT INTO emission_splits (token_address, recipient_wallet, split_percentage, label)
VALUES
  ('TEST_TOKEN', 'WALLET_A', 70.00, 'A'),
  ('TEST_TOKEN', 'WALLET_B', 40.00, 'B');  -- Total = 110%, should fail
```

**Verify:**
- ✅ Database trigger rejects this (from PR #1)
- ✅ Error message indicates percentage validation failed

---

## Part 5: Code Quality Review

### 5.1 Check Code Style

```bash
# Run linter (if available)
npm run lint 2>&1 | grep -i "error\|warning" | head -20
```

### 5.2 Check for TODOs or FIXMEs
```bash
# Search for unresolved TODOs
grep -rn "TODO\|FIXME\|XXX\|HACK" lib/claimService.ts lib/presaleService.ts routes/claims.ts routes/presale.ts
```

**Expected:** None, or only intentional ones

### 5.3 Check Error Handling
```bash
# Verify all error responses have proper format
grep -c "const errorResponse = { error:" routes/claims.ts
grep -c "res.status.*json(errorResponse)" routes/claims.ts
```

**Verify:**
- ✅ All errors have consistent format
- ✅ All errors return proper status codes
- ✅ All errors are logged

---

## Part 6: Final Verification

### 6.1 Compare with Original
```bash
# Check the original implementation (first commit)
git show da8deb5:ui/api-server.ts | grep -A20 "emission splits" | head -25

# Compare with current routes/claims.ts
grep -A20 "emission splits" routes/claims.ts | head -25
```

**Verify:**
- ✅ Logic is identical (only moved, not changed)

### 6.2 Check Git History
```bash
# View all commits in the PR
git log --oneline main..emission-split-claim-logic

# Expected:
# b2757f6 refactor: extract claims and presale routes to separate modules
# 91a9885 Merge branch 'main' of github.com:zcombinatorio/zcombinator into emission-split-claim-logic
# da8deb5 feat: implement emission splits in claim logic
```

### 6.3 Review Commit Messages
```bash
# View detailed commit messages
git log --format=fuller main..emission-split-claim-logic
```

**What to check:**
- ✅ Commits follow conventional commit format
- ✅ Messages are clear and descriptive
- ✅ Co-authored by Claude (for automated commits)

---

## Review Decision Matrix

### ✅ APPROVE if:
- [ ] All tests pass
- [ ] Refactoring verified (no logic changes)
- [ ] Emission splits work correctly with splits
- [ ] Backwards compatible (works without splits)
- [ ] Authorization works (rejects unauthorized)
- [ ] Code quality is good
- [ ] No security concerns
- [ ] Documentation is complete

### ⚠️ REQUEST CHANGES if:
- [ ] Tests fail
- [ ] Logic changes detected in refactoring
- [ ] Security vulnerabilities found
- [ ] Backwards compatibility broken
- [ ] Code quality issues

### 💬 COMMENT if:
- [ ] Minor suggestions
- [ ] Documentation improvements needed
- [ ] Questions about implementation choices

---

## Quick Commands Summary

```bash
# View PR
gh pr view 3 --web

# Check compilation
npm run build 2>&1 | grep -i error

# View refactoring verification
cat REFACTORING_VERIFICATION.md

# Test API
curl -X POST http://localhost:3001/claims/mint \
  -H "Content-Type: application/json" \
  -d '{"tokenAddress":"TOKEN","userWallet":"WALLET","claimAmount":"1000"}'

# View specific sections
sed -n '290,360p' routes/claims.ts  # Split logic
sed -n '230,270p' routes/claims.ts  # Authorization

# Check for issues
grep -rn "TODO\|FIXME" lib/ routes/
npm run lint
```

---

## Time Estimate

- **Quick Review:** 15-20 minutes (checklist + verification doc)
- **Thorough Review:** 45-60 minutes (includes testing)
- **Deep Dive Review:** 2-3 hours (includes all testing scenarios)

---

## Need Help?

If you find issues or have questions:

1. **Leave PR comments** on specific lines
2. **Request changes** with clear explanation
3. **Ask questions** in PR conversation
4. **Test locally** if uncertain about behavior

---

## Additional Resources

- **REFACTORING_VERIFICATION.md** - Detailed refactoring verification
- **PR #1** - Database foundation (already merged)
- **CONTRIBUTING.md** - Contribution guidelines
