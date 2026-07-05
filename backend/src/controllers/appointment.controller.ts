import { Request, Response, NextFunction } from 'express';
import * as appointmentService from '../services/appointment.service';
import { recordAudit } from '../services/audit.service';

export async function bookAppointment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const patientId = (req as any).user?.id;
        const { doctorId, scheduledAt } = req.body;

        const appointmentId = await appointmentService.bookAppointment(patientId, doctorId, new Date(scheduledAt));

        // log critical action
        await recordAudit({
            userId: patientId,
            role: (req as any).user?.role,
            action: 'appointment.book',
            target: `appointmentId:${appointmentId}`,
            ip: req.ip,
            result: 'success'
        });

        res.status(201).json({ message: 'Appointment booked successfully.', appointmentId });
    } catch (err) {
        next(err);
    }
}

export async function cancelAppointment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const patientId =(req as any).user?.id;
        const appointmentId = Number(req.params.id);

        const success = await appointmentService.cancelAppointment(appointmentId, patientId);

        // log critical action
        await recordAudit({
            userId: patientId,
            role: (req as any).user?.role,
            action: 'appointment.cancel',
            target: `appointmentId:${appointmentId}`,
            ip: req.ip,
            result: success ? 'success' : 'failure'
        });

        if (!success) {
            res.status(404).json({ error: 'Appointment not found or cannot be cancelled.' });
            return;
        }

        res.json({ message: 'Appointment cancelled successfully.' });
    } catch (err) {
        next(err);
    }
}

export async function rescheduleAppointment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const patientId = (req as any).user?.id;
        const appointmentId = Number(req.params.id);
        const { scheduledAt } = req.body;

        const success = await appointmentService.rescheduleAppointment(appointmentId, patientId, new Date(scheduledAt));

        // log critical action
        await recordAudit({
            userId: patientId,
            role: (req as any).user?.role,
            action: 'appointment.reschedule',
            target: `appointmentId:${appointmentId}`,
            ip: req.ip,
            result: success ? 'success' : 'failure'
        });

        if (!success) {
            res.status(404).json({ error: 'Appointment not found or cannot be rescheduled.' });
            return;
        }

        res.json({ message: 'Appointment rescheduled successfully.' });
    } catch (err) {
        next(err);
    }
}

export async function getPatientAppointments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const patientId = (req as any).user?.id;
        const appointments = await appointmentService.getPatientAppointments(patientId);
        res.json({ appointments });
    } catch (err) {
        next(err);
    }
}

export async function getPatientDiagnosis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const patientId = (req as any).user?.id;
        const appointmentId = Number(req.params.id);

        const diagnosis = await appointmentService.getPatientDiagnosis(appointmentId, patientId);

        // log protected health information access event
        await recordAudit({
            userId: patientId,
            role: (req as any).user?.role,
            action: 'diagnosis.view',
            target: `appointmentId:${appointmentId}`,
            ip: req.ip,
            result: 'success'
        });

        res.json({ diagnosis });
    } catch (err) {
        next(err);
    }
}

export async function getDoctorSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const doctorId = (req as any).user?.id;
        const appointments = await appointmentService.getDoctorSchedule(doctorId);
        res.json({ appointments });
    } catch (err) {
        next(err);
    }
}

export async function updateAppointmentStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const doctorId = (req as any).user?.id;
        const appointmentId = Number(req.params.id);
        const { status } = req.body;

        const success = await appointmentService.updateAppointmentStatus(appointmentId, doctorId, status);

        // log critical action
        await recordAudit({
            userId: doctorId,
            role: (req as any).user?.role,
            action: 'appointment.update_status',
            target: `appointmentId:${appointmentId}`,
            ip: req.ip,
            result: success ? 'success' : 'failure'
        });

        if (!success) {
            res.status(404).json({ error: 'Appointment not found or unauthorized.' });
            return;
        }

        res.json({ message: 'Appointment status updated successfully.' });
    } catch (err) {
        next(err);
    }
}

export async function recordDiagnosis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const doctorId = (req as any).user?.id;
        const appointmentId = Number(req.params.id);
        const { remarks } = req.body;

        const diagnosisId = await appointmentService.recordDiagnosis(appointmentId, doctorId, remarks);

        // log clinical record creation
        await recordAudit({
            userId: doctorId,
            role: (req as any).user?.role,
            action: 'diagnosis.record',
            target: `appointmentId:${appointmentId}`,
            ip: req.ip,
            result: diagnosisId ? 'success' : 'failure'
        });

        if (!diagnosisId) {
            res.status(404).json({ error: 'Appointment not found or unauthorized.' });
            return;
        }

        res.status(201).json({ message: 'Diagnosis recorded successfully.', diagnosisId });
    } catch (err) {
        next(err);
    }
}