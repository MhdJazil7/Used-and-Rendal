import { NextResponse } from 'next/server';
import crypto from 'crypto';

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  );
}

export function apiError(message: string, code = 'BAD_REQUEST', status = 400) {
  const correlationId = `req_${crypto.randomUUID().slice(0, 10)}`;
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        correlationId,
      },
    },
    { status }
  );
}

export function apiUnauthorized(message = 'Authentication required') {
  return apiError(message, 'UNAUTHORIZED', 401);
}

export function apiForbidden(message = 'You do not have permission to perform this action') {
  return apiError(message, 'FORBIDDEN', 403);
}

export function apiNotFound(message = 'Resource not found') {
  return apiError(message, 'NOT_FOUND', 404);
}
