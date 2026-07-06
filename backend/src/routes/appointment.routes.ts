import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import * as appointmentController from '../controllers/appointment.controller';

const router = Router();

// ensure all endpoints here are authenticated by default
router.use(requireAuth);

const bookSchema = z.object({
    doctorId: z.number().int().positive(),
    scheduledAt: z.string().datetime().refine((val) => {
        // only require the appointment to be in the future, not a full day later
        return new Date(val).getTime() > Date.now();
    }, { message: 'Appointment must be booked at least 1 day in advance.' })
});
const rescheduleSchema = z.object({
    scheduledAt: z.string().datetime()
});

const updateStatusSchema = z.object({
    status: z.enum(['booked', 'cancelled', 'completed', 'rescheduled'])
});

const diagnosisSchema = z.object({
    remarks: z.string().min(1).max(5000)
});

// PATIENT ROUTES
router.post(
    '/patient/book',
    requireRole('patient'),
    validate(bookSchema),
    appointmentController.bookAppointment
);

router.get(
    '/patient/history',
    requireRole('patient'),
    appointmentController.getPatientAppointments
);

router.patch(
    '/patient/:id/cancel',
    requireRole('patient'),
    appointmentController.cancelAppointment
);

router.patch(
    '/patient/:id/reschedule',
    requireRole('patient'),
    validate(rescheduleSchema),
    appointmentController.rescheduleAppointment
);

router.get(
    '/patient/:id/diagnosis',
    requireRole('patient'),
    appointmentController.getPatientDiagnosis
);

// DOCTOR ROUTES
router.get(
    '/doctor/schedule',
    requireRole('doctor'),
    appointmentController.getDoctorSchedule
);

router.patch(
    '/doctor/:id/status',
    requireRole('doctor'),
    validate(updateStatusSchema),
    appointmentController.updateAppointmentStatus
);

router.post(
    '/doctor/:id/diagnosis',
    requireRole('doctor'),
    validate(diagnosisSchema),
    appointmentController.recordDiagnosis
);

router.get(
    '/patient/available-doctors',
    requireRole('patient'),
    appointmentController.getAvailableDoctors
);

export default router;