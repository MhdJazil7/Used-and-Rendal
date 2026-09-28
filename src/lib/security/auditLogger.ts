import { dbQuery } from '../db';
import crypto from 'crypto';

export interface AuditLogInput {
  actorId?: string;
  actorRole?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  correlationId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
}

// Keys that must NEVER be persisted in audit logs
const SENSITIVE_KEYS = [
  'password',
  'secret',
  'token',
  'key',
  'aadhaar',
  'pan',
  'cvv',
  'card',
  'service_role',
  'authorization',
  'cookie',
  'signed_url',
];

function sanitizeAuditDetails(details?: Record<string, any>): Record<string, any> {
  if (!details) return {};
  const cleaned: Record<string, any> = {};

  for (const [key, value] of Object.entries(details)) {
    const lowerKey = key.toLowerCase();
    let isSensitive = false;
    for (const sens of SENSITIVE_KEYS) {
      if (lowerKey.includes(sens)) {
        isSensitive = true;
        break;
      }
    }

    if (isSensitive) {
      cleaned[key] = '[REDACTED_SENSITIVE_DATA]';
    } else if (typeof value === 'object' && value !== null) {
      cleaned[key] = sanitizeAuditDetails(value);
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

export async function logAuditEvent(input: AuditLogInput, queryFn = dbQuery) {
  const id = `aud_${crypto.randomUUID()}`;
  const safeDetails = sanitizeAuditDetails(input.details);

  // Mask IP for privacy (e.g. 192.168.1.100 -> 192.168.1.xxx)
  let maskedIp: string | null = null;
  if (input.ipAddress) {
    maskedIp = input.ipAddress.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)/, '$1.$2.$3.xxx');
  }

  await queryFn(
    `INSERT INTO audit_logs (
       id, actor_id, actor_role, action, resource_type, resource_id, correlation_id, details, ip_address_masked
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      input.actorId || null,
      input.actorRole || 'SYSTEM',
      input.action,
      input.resourceType,
      input.resourceId,
      input.correlationId || crypto.randomUUID(),
      JSON.stringify(safeDetails),
      maskedIp,
    ]
  );

  return { id };
}
