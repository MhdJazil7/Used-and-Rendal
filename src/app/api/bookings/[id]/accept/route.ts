import { NextRequest } from 'next/server';
import { AuthService } from '@/lib/auth/session';
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response';
import { acceptBookingAndCreateHold } from '@/lib/booking/concurrency';
import { NotificationService } from '@/lib/whatsapp/whatsappService';
import { dbQuery } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = req.headers.get('authorization') || req.cookies.get('kvr_session')?.value;
    const session = AuthService.verifySessionToken(authHeader);

    if (!session) {
      return apiUnauthorized('Authentication required');
    }

    const { id } = params;

    // Concurrency-safe acceptance with atomic booking hold
    const result = await acceptBookingAndCreateHold(id, session.userId);

    // Fetch customer details to dispatch notification
    const bRes = await dbQuery(
      `SELECT b.booking_reference, v.make, v.model, p.id as cust_id, p.phone, p.preferred_language
       FROM bookings b
       JOIN vehicles v ON v.id = b.vehicle_id
       JOIN profiles p ON p.id = b.customer_id
       WHERE b.id = $1`,
      [id]
    );

    if (bRes.rows.length > 0) {
      const bData = bRes.rows[0];
      const deadlineStr = new Date(result.paymentDeadline).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
      });

      await NotificationService.sendNotification({
        userId: bData.cust_id,
        phone: bData.phone,
        title: 'Booking Accepted by Owner',
        body: `Your booking for ${bData.make} ${bData.model} has been accepted! Please pay before ${deadlineStr}.`,
        eventType: 'booking.accepted',
        templateName: 'booking_accepted_customer',
        language: bData.preferred_language || 'en',
        templateArgs: [
          bData.booking_reference,
          `${bData.make} ${bData.model}`,
          deadlineStr,
          `http://localhost:3000/customer`,
        ],
      });
    }

    return apiSuccess(result);
  } catch (err: any) {
    return apiError(err.message, 'ACCEPT_BOOKING_FAILED', 400);
  }
}
