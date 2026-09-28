import { dbQuery } from '../db';
import { UserRole, Profile } from '../types';
import crypto from 'crypto';

export interface UserSession {
  userId: string;
  phone: string;
  fullName: string;
  displayName: string;
  roles: UserRole[];
  primaryRole: UserRole;
  expiresAt: number;
}

// In-memory brute force & rate limiting table for OTP requests
interface OtpState {
  otp: string;
  expiresAt: number;
  attempts: number;
  cooldownUntil: number;
}

const otpStore = new Map<string, OtpState>();

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_32_characters_long!';

export class AuthService {
  /**
   * Request OTP with brute force and rate limiting protection
   */
  static async requestOtp(phone: string): Promise<{ success: boolean; message: string; devOtp?: string }> {
    const formattedPhone = phone.trim();
    const now = Date.now();
    const existing = otpStore.get(formattedPhone);

    if (existing && existing.cooldownUntil > now) {
      const waitMins = Math.ceil((existing.cooldownUntil - now) / 60000);
      throw new Error(`Too many attempts. Account on cooldown. Please retry in ${waitMins} minute(s).`);
    }

    // Test phone numbers and test environment use deterministic 123456 OTP for testing and staging
    const isTestNumber = formattedPhone.startsWith('+9198460') || formattedPhone.startsWith('+9199999') || process.env.NODE_ENV === 'test';
    const otp = isTestNumber ? '123456' : crypto.randomInt(100000, 999999).toString();

    otpStore.set(formattedPhone, {
      otp,
      expiresAt: now + 5 * 60 * 1000, // 5 mins
      attempts: 0,
      cooldownUntil: 0,
    });

    return {
      success: true,
      message: 'OTP sent successfully to registered mobile number',
      devOtp: isTestNumber || process.env.NODE_ENV !== 'production' ? otp : undefined,
    };
  }

  /**
   * Verify OTP and return signed session token
   */
  static async verifyOtp(phone: string, submittedOtp: string): Promise<{ sessionToken: string; user: UserSession }> {
    const formattedPhone = phone.trim();
    const state = otpStore.get(formattedPhone);
    const now = Date.now();

    if (!state) {
      throw new Error('No OTP requested or session expired. Please request a new OTP.');
    }

    if (state.expiresAt < now) {
      otpStore.delete(formattedPhone);
      throw new Error('OTP has expired. Please request a new one.');
    }

    if (state.otp !== submittedOtp) {
      state.attempts++;
      if (state.attempts >= 3) {
        state.cooldownUntil = now + 15 * 60 * 1000; // 15 mins cooldown
        throw new Error('Too many invalid attempts. Account locked for 15 minutes.');
      }
      throw new Error(`Invalid OTP. ${3 - state.attempts} attempt(s) remaining.`);
    }

    // Success! Clear OTP
    otpStore.delete(formattedPhone);

    // Fetch user or create if new
    let userRes = await dbQuery(
      `SELECT p.*, ARRAY_AGG(r.role) as roles 
       FROM profiles p
       LEFT JOIN user_roles r ON r.user_id = p.id
       WHERE p.phone = $1
       GROUP BY p.id`,
      [formattedPhone]
    );

    let profile: any;
    let roles: UserRole[] = [];

    if (userRes.rows.length === 0) {
      // New user signup: default role is CUSTOMER. PRIVILEGED ROLES CANNOT BE SELF-ASSIGNED.
      const newUserId = `usr_${crypto.randomUUID()}`;
      await dbQuery(
        `INSERT INTO profiles (id, phone, full_name, display_name, address_district, preferred_language)
         VALUES ($1, $2, 'Kerala User', 'User', 'Ernakulam', 'en')`,
        [newUserId, formattedPhone]
      );

      await dbQuery(
        `INSERT INTO user_roles (id, user_id, role)
         VALUES ($1, $2, 'CUSTOMER')`,
        [`role_${crypto.randomUUID()}`, newUserId]
      );

      profile = {
        id: newUserId,
        phone: formattedPhone,
        full_name: 'Kerala User',
        display_name: 'User',
      };
      roles = ['CUSTOMER'];
    } else {
      profile = userRes.rows[0];
      roles = profile.roles.filter(Boolean) as UserRole[];
      if (roles.length === 0) {
        roles = ['CUSTOMER'];
      }
    }

    // Determine primary role
    const primaryRole: UserRole = roles.includes('SUPER_ADMIN')
      ? 'SUPER_ADMIN'
      : roles.includes('ADMIN')
      ? 'ADMIN'
      : roles.includes('OWNER')
      ? 'OWNER'
      : 'CUSTOMER';

    const expiresAt = now + 24 * 60 * 60 * 1000; // 24 hours
    const userSession: UserSession = {
      userId: profile.id,
      phone: profile.phone,
      fullName: profile.full_name,
      displayName: profile.display_name || profile.full_name,
      roles,
      primaryRole,
      expiresAt,
    };

    // Create HMAC signed session token
    const payloadJson = JSON.stringify(userSession);
    const payloadBase64 = Buffer.from(payloadJson).toString('base64url');
    const signature = crypto.createHmac('sha256', JWT_SECRET).update(payloadBase64).digest('base64url');
    const sessionToken = `${payloadBase64}.${signature}`;

    return { sessionToken, user: userSession };
  }

  /**
   * Verify session token from Authorization header or cookie
   */
  static verifySessionToken(token?: string): UserSession | null {
    if (!token) return null;

    try {
      const parts = token.replace('Bearer ', '').trim().split('.');
      if (parts.length !== 2) return null;

      const [payloadBase64, signature] = parts;
      const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(payloadBase64).digest('base64url');

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        return null;
      }

      const session: UserSession = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf-8'));
      if (session.expiresAt < Date.now()) {
        return null; // Expired
      }

      return session;
    } catch {
      return null;
    }
  }
}
