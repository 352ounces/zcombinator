import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

// Simple admin authentication - in production use proper auth
const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN;

export async function POST(request: NextRequest) {
  // Check admin authentication
  const authHeader = request.headers.get('authorization');
  if (!ADMIN_TOKEN || authHeader !== `Bearer ${ADMIN_TOKEN}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const pool = getPool();
  const body = await request.json();

  // Query parameters
  const eventType = body.event_type;
  const tokenAddress = body.token_address;
  const walletAddress = body.wallet_address;
  const limit = parseInt(body.limit || '100');
  const offset = parseInt(body.offset || '0');

  try {
    let query = `
      SELECT
        id,
        event_type,
        token_address,
        wallet_address,
        social_twitter,
        social_github,
        ip_address,
        user_agent,
        error_message,
        metadata,
        created_at
      FROM verification_audit_logs
      WHERE 1=1
    `;

    const values: (string | number)[] = [];
    let paramCount = 0;

    if (eventType) {
      paramCount++;
      query += ` AND event_type = $${paramCount}`;
      values.push(eventType);
    }

    if (tokenAddress) {
      paramCount++;
      query += ` AND token_address = $${paramCount}`;
      values.push(tokenAddress);
    }

    if (walletAddress) {
      paramCount++;
      query += ` AND wallet_address = $${paramCount}`;
      values.push(walletAddress);
    }

    query += ` ORDER BY created_at DESC`;

    paramCount++;
    query += ` LIMIT $${paramCount}`;
    values.push(limit);

    paramCount++;
    query += ` OFFSET $${paramCount}`;
    values.push(offset);

    const result = await pool.query(query, values);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM verification_audit_logs
      WHERE 1=1
    `;

    if (eventType) countQuery += ` AND event_type = '${eventType}'`;
    if (tokenAddress) countQuery += ` AND token_address = '${tokenAddress}'`;
    if (walletAddress) countQuery += ` AND wallet_address = '${walletAddress}'`;

    const countResult = await pool.query(countQuery);
    const total = parseInt(countResult.rows[0].total);

    // Get event type statistics
    const statsQuery = `
      SELECT
        event_type,
        COUNT(*) as count
      FROM verification_audit_logs
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY event_type
      ORDER BY count DESC
    `;

    const statsResult = await pool.query(statsQuery);

    return NextResponse.json({
      logs: result.rows,
      pagination: {
        total,
        limit,
        offset,
        pages: Math.ceil(total / limit)
      },
      stats: {
        last24Hours: statsResult.rows
      }
    });

  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}