# Contributing

This project uses **market-based governance**. Your PRs become decision markets that determine what gets merged.

**[MARKET GOVERNANCE IS STILL BEING BUILT. IN THE MEANTIME, REWARDS ARE DETERMINED BY THE ZC TEAM]**

## How It Works

1. **Submit a PR** — Describe the change, why it matters, and expected impact
2. **Market opens** — A decision market, powered by percent, is automatically created for your PR
3. **Community trades** — Token holders bet on whether merging will increase token value
4. **Resolution** — After [X hours], market resolves based on the price gap between the yes market and no market
5. **Merge or close** — If market resolves positive, PR merges and you earn [Y%] of the native ZC token, minted directly to your wallet
6. **Claim rewards** — Contributor rewards vest over [Z days]

## Before You Contribute

**This is experimental.** Your PR may be excellent code but fail to merge if markets predict negative impact. Your work may be rejected by traders, not maintainers.

**You're building in public view.** Markets react to your reputation, communication, and technical credibility—not just code quality.

**Align with token holders.** They want token value to increase. If your PR doesn't clearly serve that goal, it won't trade well.

## What Makes a Good PR

Markets favor:
- **Clear impact story**: "This reduces latency 40%, enabling [use case]"
- **Data-backed claims**: Benchmarks, user demand signals, competitive analysis
- **Minimal risk**: Well-tested, backwards compatible, incremental

Markets punish:
- **Vague benefits**: "Makes code cleaner" without measurable outcomes
- **Breaking changes**: Unless absolutely necessary and well-communicated
- **Technical debt**: Refactors that don't unlock new value
- **Poor communication**: Markets can't price what they don't understand

## Technical Requirements

- **Documentation**: Update all relevant docs in same PR
- **No merge conflicts**: Rebase on main before submission
- **Conventional commits**: Follow semantic commit messages
- **License agreement**: By submitting, you agree to [LICENSE]

## Market Mechanics

**Resolution Criteria**: If the TWAP of the PASS market exceeds the TWAP of the FAIL market by at least the % threshold specified at the beginning of the decision market, then the market passes, otherwise it fails.

**Dispute Process**: If you believe market resolution was incorrect, re-open the PR.

**Vesting**: Contributor rewards vest linearly over [Z days] to align long-term incentives

## Market Manipulation Policy

**We highly encourage**:
- Self-trading on your own PRs
- Coordinated pump/dump schemes  
- Wash trading to fake volume

What typically seem like negative behavior actually make information markets stronger! If you attempt to manipulate, we will dump on your head, profit wildly, and buyback our token!

## Types of Contributions

**Feature additions** — Highest reward potential, highest market scrutiny

**Bug fixes** — Fast-track process for critical issues, smaller markets

**Documentation** — Lower trading volume, but still valuable

**Refactoring** — Hardest to get merged unless you demonstrate clear value unlock

**Infrastructure** — Bundle with feature that showcases the improvement

## Getting Started

1. Join [Discord] to discuss your idea before coding
2. Check existing PRs and markets to understand what trades well
3. For large changes, create an RFC issue first to gather early signal
4. Start small—build credibility with smaller PRs before attempting major features

## FAQ

**Q: What if nobody trades on my PR?**  
A: Illiquid markets make worse decisions. Promote your PR to create liquidity. The wider the gap in the market, the more you get paid!

**Q: Can maintainers override markets?**  
A: Only for [security/legal/critical bugs]. Otherwise, markets decide.

**Q: What if the market is wrong?**  
A: Markets aggregate collective intelligence. If you're consistently "right" and markets are "wrong," you'll profit by trading against them.

**Q: Can I contribute anonymously?**  
A: Yes, but markets may discount anonymous contributors. Reputation matters.

## Support

- **Technical questions**: [Discord #dev-help]
- **Market questions**: [Discord #markets]  
- **Dispute resolution**: [governance forum]
- **Bug reports**: [Issue tracker]

---

By contributing, you acknowledge this is an experimental governance model. You may invest significant effort into PRs that don't merge. Trade accordingly.