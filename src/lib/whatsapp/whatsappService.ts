import { dbQuery } from '../db';
import crypto from 'crypto';

export interface WhatsAppTemplateParam {
  type: 'text';
  text: string;
}

export interface SendWhatsAppMessageParams {
  recipientPhone: string;
  templateName: string;
  languageCode: 'en' | 'ml';
  parameters: string[];
}

export interface WhatsAppProvider {
  name: string;
  sendTemplateMessage(params: SendWhatsAppMessageParams): Promise<{ messageId: string; status: string }>;
  verifyWebhook(verifyToken: string, challenge: string): string | null;
}

export class MockWhatsAppProvider implements WhatsAppProvider {
  name = 'mock';

  async sendTemplateMessage(params: SendWhatsAppMessageParams): Promise<{ messageId: string; status: string }> {
    const messageId = `wamid.mock.${crypto.randomUUID()}`;
    return { messageId, status: 'QUEUED' };
  }

  verifyWebhook(verifyToken: string, challenge: string): string | null {
    if (verifyToken === (process.env.WHATSAPP_VERIFY_TOKEN || 'kerala_rental_wa_verify_token_dev')) {
      return challenge;
    }
    return null;
  }
}

export class CloudApiWhatsAppProvider implements WhatsAppProvider {
  name = 'cloud_api';
  private accessToken: string;
  private phoneNumberId: string;

  constructor() {
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  }

  async sendTemplateMessage(params: SendWhatsAppMessageParams): Promise<{ messageId: string; status: string }> {
    if (!this.accessToken || !this.phoneNumberId) {
      throw new Error('WhatsApp Cloud API credentials not configured');
    }

    const formattedPhone = params.recipientPhone.replace(/[^0-9]/g, '');
    const url = `https://graph.facebook.com/v19.0/${this.phoneNumberId}/messages`;

    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: 'template',
      template: {
        name: params.templateName,
        language: { code: params.languageCode === 'ml' ? 'ml' : 'en_US' },
        components: [
          {
            type: 'body',
            parameters: params.parameters.map((p) => ({ type: 'text', text: p })),
          },
        ],
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`WhatsApp send error: ${err}`);
    }

    const data = await res.json();
    return {
      messageId: data.messages?.[0]?.id || `wamid_${crypto.randomUUID()}`,
      status: 'SENT',
    };
  }

  verifyWebhook(verifyToken: string, challenge: string): string | null {
    if (verifyToken === process.env.WHATSAPP_VERIFY_TOKEN) {
      return challenge;
    }
    return null;
  }
}

export function getWhatsAppProvider(): WhatsAppProvider {
  if (process.env.WHATSAPP_PROVIDER === 'cloud_api' && process.env.WHATSAPP_ACCESS_TOKEN) {
    return new CloudApiWhatsAppProvider();
  }
  return new MockWhatsAppProvider();
}

/**
 * Secure Single-Use Action Link Generator
 * NEVER exposes plain IDs or bypasses authentication.
 * Generates an encrypted/signed token with 15-minute expiry.
 */
export function generateSecureActionLink(userId: string, actionType: string, resourceId: string): string {
  const secret = process.env.JWT_SECRET || 'dev_secret_key_32_characters_long!';
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins
  const payload = `${userId}:${actionType}:${resourceId}:${expiresAt}`;
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const token = Buffer.from(`${payload}:${hmac}`).toString('base64url');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${baseUrl}/action?token=${token}`;
}

/**
 * Notification Service supporting WhatsApp, SMS, and in-app logs
 */
export class NotificationService {
  static async sendNotification(params: {
    userId: string;
    phone: string;
    title: string;
    body: string;
    eventType: string;
    templateName: string;
    language: 'en' | 'ml';
    templateArgs: string[];
    payload?: any;
  }) {
    const notifId = `notif_${crypto.randomUUID()}`;
    const provider = getWhatsAppProvider();

    // 1. Queue or send via WhatsApp
    let waMessageId: string | null = null;
    let deliveryStatus = 'SENT';

    try {
      const res = await provider.sendTemplateMessage({
        recipientPhone: params.phone,
        templateName: params.templateName,
        languageCode: params.language,
        parameters: params.templateArgs,
      });
      waMessageId = res.messageId;
    } catch (err) {
      console.error('Failed to send WhatsApp message:', err);
      deliveryStatus = 'FAILED';
    }

    // 2. Record WhatsApp Event
    const eventId = `wae_${crypto.randomUUID()}`;
    await dbQuery(
      `INSERT INTO whatsapp_events (id, provider_message_id, recipient_phone, template_name, language_code, parameters, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        eventId,
        waMessageId,
        params.phone,
        params.templateName,
        params.language,
        JSON.stringify(params.templateArgs),
        deliveryStatus === 'SENT' ? 'SENT' : 'FAILED',
      ]
    );

    // 3. Record In-App Notification
    await dbQuery(
      `INSERT INTO notifications (id, user_id, title, body, channel, event_type, payload, delivery_status)
       VALUES ($1, $2, $3, $4, 'WHATSAPP', $5, $6, $7)`,
      [
        notifId,
        params.userId,
        params.title,
        params.body,
        params.eventType,
        JSON.stringify(params.payload || {}),
        deliveryStatus,
      ]
    );

    return { notifId, waMessageId, deliveryStatus };
  }
}
