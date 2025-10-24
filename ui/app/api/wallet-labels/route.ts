import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const dbUrl = process.env.DB_URL;

    if (!dbUrl) {
      throw new Error('DB_URL environment variable is not set');
    }

    pool = new Pool({
      connectionString: dbUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  return pool;
}

export async function POST(request: NextRequest) {
  try {
    const { walletAddresses } = await request.json();

    if (!walletAddresses || !Array.isArray(walletAddresses)) {
      return NextResponse.json(
        { error: 'walletAddresses array is required' },
        { status: 400 }
      );
    }

    const pool = getPool();

    // Create placeholders for the IN clause
    const placeholders = walletAddresses.map((_, index) => `$${index + 1}`).join(',');

    const query = `
      SELECT wallet_address,
             COALESCE(
               CASE
                 WHEN custom_label IS NOT NULL AND custom_label != '' THEN custom_label
                 WHEN telegram_username IS NOT NULL AND telegram_username != '' THEN '@' || telegram_username
                 WHEN x_username IS NOT NULL AND x_username != '' THEN '@' || x_username
                 WHEN discord_username IS NOT NULL AND discord_username != '' THEN discord_username
                 ELSE NULL
               END,
               NULL
             ) as label
      FROM token_holders
      WHERE wallet_address IN (${placeholders})
    `;

    const result = await pool.query(query, walletAddresses);

    // Create a map of wallet address to label
    const labelMap: Record<string, string> = {};
    result.rows.forEach((row: { wallet_address: string; label: string | null }) => {
      if (row.label) {
        labelMap[row.wallet_address] = row.label;
      }
    });

    return NextResponse.json({ labels: labelMap });

  } catch (error) {
    console.error('Error fetching wallet labels:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wallet labels' },
      { status: 500 }
    );
  }
}