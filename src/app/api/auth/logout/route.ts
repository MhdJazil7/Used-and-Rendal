import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api/response';

export async function POST(req: NextRequest) {
  const res = apiSuccess({ message: 'Logged out successfully' });
  res.cookies.delete('kvr_session');
  return res;
}
