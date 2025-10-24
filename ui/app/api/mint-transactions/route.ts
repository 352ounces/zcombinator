import { NextRequest, NextResponse } from 'next/server';
import { getCachedMintTransactions } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tokenAddress } = body;

    if (!tokenAddress) {
      return NextResponse.json(
        { error: 'Token address is required' },
        { status: 400 }
      );
    }

    const transactions = await getCachedMintTransactions(tokenAddress);

    // Convert BigInt to string for JSON serialization
    const serializedTransactions = transactions.map(tx => ({
      ...tx,
      amount: tx.amount.toString()
    }));

    return NextResponse.json({
      transactions: serializedTransactions,
      count: transactions.length
    });

  } catch (error) {
    console.error('Error fetching mint transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch mint transactions' },
      { status: 500 }
    );
  }
}