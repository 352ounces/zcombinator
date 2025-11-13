/**
 * Mock proposals data
 * Shared between decisions page and project detail pages
 */

export interface MockProposal {
  id: string;
  title: string;
  status: 'Active' | 'Passed' | 'Failed';
  tokenSymbol?: string;
  summary: string;
  twapGap?: number;
  timeAgo: string;
  githubUrl?: string;
}

// Mock proposals - shared data for decisions page and project detail pages
export const MOCK_PROPOSALS: MockProposal[] = [
  {
    id: '1',
    title: 'ZC-1: Update Staking Vault Rewards & Parameters',
    status: 'Passed',
    tokenSymbol: '$ZC',
    summary: 'This proposal authorizes the ZCombinatorio Protocol to execute a controlled redistribution of the SolPay ($SP) token supply in response to a recent exploitative accumulation event.',
    twapGap: 8.67,
    timeAgo: '2 days ago',
    githubUrl: 'https://github.com/zcombinatorio/zcombinator/pull/1',
  },
  {
    id: '2',
    title: 'ZC-2: Implement Multi-Signature Wallet for Governance',
    status: 'Passed',
    tokenSymbol: '$ZC',
    summary: 'This proposal aims to enhance security by introducing a multi-signature wallet for governance decisions, ensuring that no single entity has full control over protocol assets.',
    twapGap: 5.25,
    timeAgo: '1 day ago',
    githubUrl: 'https://github.com/zcombinatorio/zcombinator/pull/2',
  },
  {
    id: '3',
    title: 'ZC-3: Increase Token Emission Rate',
    status: 'Active',
    tokenSymbol: '$ZC',
    summary: 'Proposal to increase the token emission rate by 20% to support ecosystem growth and incentivize participation.',
    twapGap: 3.45,
    timeAgo: '5 hours ago',
    githubUrl: 'https://github.com/zcombinatorio/zcombinator/pull/3',
  },
  {
    id: '4',
    title: 'SHIRTLESS-1: Beach Community Expansion',
    status: 'Active',
    tokenSymbol: '$SHIRTLESS',
    summary: 'Proposal to expand the Shirtless community by organizing beach events and partnerships with coastal venues. This will increase token utility and community engagement.',
    twapGap: 4.23,
    timeAgo: '2 days left',
    githubUrl: 'https://github.com/shirtless/shirtless/pull/1',
  },
  {
    id: '5',
    title: 'SHIRTLESS-2: Summer Festival Sponsorship',
    status: 'Passed',
    tokenSymbol: '$SHIRTLESS',
    summary: 'Proposal to sponsor major summer festivals and beach parties, creating brand awareness and driving adoption of the Shirtless token.',
    twapGap: 6.78,
    timeAgo: '5 days ago',
    githubUrl: 'https://github.com/shirtless/shirtless/pull/2',
  },
  {
    id: '6',
    title: 'SHIRTLESS-3: Merchandise Launch',
    status: 'Passed',
    tokenSymbol: '$SHIRTLESS',
    summary: 'Proposal to launch official Shirtless merchandise including beachwear, accessories, and branded items that can be purchased with SHIRTLESS tokens.',
    twapGap: 5.34,
    timeAgo: '8 days ago',
    githubUrl: 'https://github.com/shirtless/shirtless/pull/3',
  },
  {
    id: '7',
    title: 'SHIRTLESS-4: Staking Rewards Program',
    status: 'Active',
    tokenSymbol: '$SHIRTLESS',
    summary: 'Proposal to implement a staking program that rewards long-term holders with exclusive beach access, event tickets, and additional token rewards.',
    twapGap: 3.45,
    timeAgo: '1 day left',
    githubUrl: 'https://github.com/shirtless/shirtless/pull/4',
  },
  {
    id: '8',
    title: 'SHIRTLESS-5: NFT Collection Launch',
    status: 'Failed',
    tokenSymbol: '$SHIRTLESS',
    summary: 'This proposal sought to launch an NFT collection featuring beach-themed artwork, but was rejected due to concerns about market saturation.',
    twapGap: 1.23,
    timeAgo: '10 days ago',
    githubUrl: 'https://github.com/shirtless/shirtless/pull/5',
  },
  {
    id: '9',
    title: 'PERC-1: Yield Calculation Protocol',
    status: 'Active',
    tokenSymbol: '$PERC',
    summary: 'Proposal to implement a yield calculation protocol that automatically computes percentage-based rewards for stakers and liquidity providers.',
    twapGap: 4.56,
    timeAgo: '3 days left',
    githubUrl: 'https://github.com/percent/percent/pull/1',
  },
  {
    id: '10',
    title: 'PERC-2: Dynamic Fee Structure',
    status: 'Passed',
    tokenSymbol: '$PERC',
    summary: 'Proposal to introduce a dynamic fee structure that adjusts transaction fees based on network activity, calculated as a percentage of transaction volume.',
    twapGap: 7.12,
    timeAgo: '6 days ago',
    githubUrl: 'https://github.com/percent/percent/pull/2',
  },
  {
    id: '11',
    title: 'PERC-3: Governance Voting Thresholds',
    status: 'Passed',
    tokenSymbol: '$PERC',
    summary: 'Proposal to set governance voting thresholds as percentage-based requirements, ensuring fair representation of token holders in decision-making.',
    twapGap: 5.89,
    timeAgo: '9 days ago',
    githubUrl: 'https://github.com/percent/percent/pull/3',
  },
  {
    id: '18',
    title: 'OOGWAY-1: Wisdom Council Formation',
    status: 'Active',
    tokenSymbol: '$OOGWAY',
    summary: 'Proposal to form a Wisdom Council composed of long-term token holders who will provide guidance and strategic direction for the Oogway ecosystem.',
    twapGap: 4.78,
    timeAgo: '3 days left',
    githubUrl: 'https://github.com/oogway/oogway/pull/1',
  },
  {
    id: '19',
    title: 'OOGWAY-2: Mentorship Program Launch',
    status: 'Passed',
    tokenSymbol: '$OOGWAY',
    summary: 'Proposal to launch a mentorship program where experienced community members guide newcomers, fostering wisdom sharing and ecosystem growth.',
    twapGap: 7.34,
    timeAgo: '6 days ago',
    githubUrl: 'https://github.com/oogway/oogway/pull/2',
  },
  {
    id: '20',
    title: 'OOGWAY-3: Long-term Staking Rewards',
    status: 'Passed',
    tokenSymbol: '$OOGWAY',
    summary: 'Proposal to implement enhanced staking rewards for long-term holders, encouraging patience and wisdom in token holding strategies.',
    twapGap: 5.67,
    timeAgo: '11 days ago',
    githubUrl: 'https://github.com/oogway/oogway/pull/3',
  },
];

