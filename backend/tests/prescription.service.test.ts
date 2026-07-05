/**
 * Prescription service tests (workstream #6). Security-critical paths:
 * treatment-relationship gate (FSR4), pharmacist status-only writes + no
 * clinical fields touched (FSR6/FSR13), and ownership/IDOR (FSR3).
 *
 * The DB is mocked (pool.execute), so these run without Docker/MySQL.
 */

// Mock the DB layer and the audit log so we test only the service logic.
jest.mock('../src/db/pool', () => ({
  pool: { execute: jest.fn() },
}));
jest.mock('../src/services/audit.service', () => ({
  recordAudit: jest.fn().mockResolvedValue(undefined),
}));

import { pool } from '../src/db/pool';
import {
  issuePrescription,
  updateFulfilment,
  getForUser,
  pharmacyQueue,
  listAuthorisedPatients,
  listForDoctor,
  cancelPrescription,
  NotAuthorisedError,
} from '../src/services/prescription.service';

const mockExecute = pool.execute as unknown as jest.Mock;

beforeEach(() => mockExecute.mockReset());

// pool.execute resolves to [rows, fields] for SELECT and [header, fields] for writes.
const rows = (r: unknown[]) => [r];
const write = (r: Record<string, unknown>) => [r];

describe('issuePrescription (FSR4 treatment relationship)', () => {
  it('refuses to issue when the doctor has no relationship with the patient', async () => {
    mockExecute.mockResolvedValueOnce(rows([])); // relationship check -> no rows

    await expect(
      issuePrescription(1, { patientId: 99, medication: 'Amoxicillin', dosage: '500mg' }),
    ).rejects.toBeInstanceOf(NotAuthorisedError);

    // only the relationship check ran — no INSERT
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute.mock.calls[0][0]).not.toMatch(/INSERT/i);
  });

  it('issues with doctor_id taken from the session, not the input (FSR2)', async () => {
    mockExecute.mockResolvedValueOnce(rows([{ '1': 1 }]));                 // relationship exists
    mockExecute.mockResolvedValueOnce(write({ insertId: 42 }));            // INSERT
    mockExecute.mockResolvedValueOnce(rows([{ id: 42, doctor_id: 7 }]));   // re-fetch

    const created = await issuePrescription(7, { patientId: 5, medication: 'Amoxicillin', dosage: '500mg' });

    expect(created.id).toBe(42);
    // INSERT params are positional: [patientId, doctorId, ...] — doctorId (index 1) must be the session id 7
    const insertParams = mockExecute.mock.calls[1][1] as unknown[];
    expect(insertParams[1]).toBe(7);
  });
});

describe('updateFulfilment (FSR6 / FSR13 pharmacist)', () => {
  it('rejects an invalid fulfilment status without touching the DB', async () => {
    await expect(updateFulfilment(5, 9, 'pending' as never)).rejects.toThrow(/invalid/i);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('updates ONLY fulfilment fields — never medication/dosage', async () => {
    mockExecute.mockResolvedValueOnce(write({ affectedRows: 1 }));

    const ok = await updateFulfilment(5, 9, 'dispensed');

    expect(ok).toBe(true);
    const sql = mockExecute.mock.calls[0][0] as string;
    expect(sql).not.toMatch(/medication|dosage|patient_id|doctor_id/i);
    expect(sql).toMatch(/fulfilment_status/i);
    // params: [newStatus, pharmacistId, prescriptionId] — records who dispensed it
    expect((mockExecute.mock.calls[0][1] as unknown[])[1]).toBe(9);
  });

  it('returns false when the prescription was already actioned', async () => {
    mockExecute.mockResolvedValueOnce(write({ affectedRows: 0 }));
    expect(await updateFulfilment(5, 9, 'dispensed')).toBe(false);
  });
});

describe('cancelPrescription (doctor, own + still-pending only)', () => {
  it('cancels via status only, scoped to own + pending (never touches clinical fields)', async () => {
    mockExecute.mockResolvedValueOnce(write({ affectedRows: 1 }));
    const ok = await cancelPrescription(9, 2);
    expect(ok).toBe(true);
    const sql = mockExecute.mock.calls[0][0] as string;
    expect(sql).toMatch(/SET status = 'cancelled'/i);
    expect(sql).toMatch(/doctor_id = \?/i);              // ownership guard (FSR3)
    expect(sql).toMatch(/fulfilment_status = 'pending'/i); // can't cancel a dispensed one
    expect(sql).not.toMatch(/medication|dosage/i);       // clinical fields untouched (FSR13)
    // params: [prescriptionId, doctorId]
    expect(mockExecute.mock.calls[0][1]).toEqual([9, 2]);
  });

  it('returns false when nothing matched (not owner / already dispensed / already cancelled)', async () => {
    mockExecute.mockResolvedValueOnce(write({ affectedRows: 0 }));
    expect(await cancelPrescription(9, 2)).toBe(false);
  });
});

describe('getForUser (FSR3 ownership / IDOR)', () => {
  it('hides a prescription from a patient who does not own it', async () => {
    mockExecute.mockResolvedValueOnce(rows([{ id: 7, patient_id: 100, doctor_id: 5 }]));
    const res = await getForUser(7, { id: 200, role: 'patient' });
    expect(res).toBeNull();
  });

  it('returns a prescription to its owning patient', async () => {
    mockExecute.mockResolvedValueOnce(rows([{ id: 7, patient_id: 200, doctor_id: 5 }]));
    const res = await getForUser(7, { id: 200, role: 'patient' });
    expect(res?.id).toBe(7);
  });
});

describe('listAuthorisedPatients (FSR4 scope, FSR2 identity)', () => {
  it('passes the session doctorId positionally, never a client value', async () => {
    mockExecute.mockResolvedValueOnce(rows([{ id: 1, full_name: 'Test Patient' }]));
    await listAuthorisedPatients(7);
    // both ? placeholders are the same session doctorId (auth-check + appointment side)
    expect(mockExecute.mock.calls[0][1]).toEqual([7, 7]);
  });

  it('scopes to treatment/appointment links and returns only id + name', async () => {
    mockExecute.mockResolvedValueOnce(rows([]));
    await listAuthorisedPatients(7);
    const sql = mockExecute.mock.calls[0][0] as string;
    expect(sql).toMatch(/doctor_patient_auth/i);
    expect(sql).toMatch(/appointment/i);
    expect(sql).toMatch(/revoked_at IS NULL/i);
    // least privilege: never pulls medical history / diagnosis
    expect(sql).not.toMatch(/diagnosis|medical|remarks|dob|SELECT \*/i);
  });

  it('returns the rows the query produces', async () => {
    mockExecute.mockResolvedValueOnce(rows([
      { id: 1, full_name: 'Test Patient' },
      { id: 2, full_name: 'Another Patient' },
    ]));
    const patients = await listAuthorisedPatients(7);
    expect(patients).toHaveLength(2);
    expect(patients[0]).toEqual({ id: 1, full_name: 'Test Patient' });
  });
});

describe('listForDoctor (§9.8 doctor view + FSR3 scope)', () => {
  it('scopes strictly to the doctor\'s own records, joins patient, exposes fulfilment', async () => {
    mockExecute.mockResolvedValueOnce(rows([]));
    await listForDoctor(7);
    const sql = mockExecute.mock.calls[0][0] as string;
    expect(sql).toMatch(/WHERE p\.doctor_id = \?/i);
    expect(sql).toMatch(/JOIN patient/i);
    expect(sql).toMatch(/fulfilment_status/i);
    // doctorId comes from the session, passed positionally (FSR2/FSR9)
    expect(mockExecute.mock.calls[0][1]).toEqual([7]);
  });

  it('returns issued prescriptions with patient name + fulfilment status', async () => {
    mockExecute.mockResolvedValueOnce(rows([
      { id: 1, patient_id: 5, patient_name: 'Test Patient', medication: 'Amoxicillin', fulfilment_status: 'pending' },
    ]));
    const list = await listForDoctor(7);
    expect(list).toHaveLength(1);
    expect(list[0].patient_name).toBe('Test Patient');
  });
});

describe('pharmacyQueue (FSR6 limited fields)', () => {
  it('selects only prescription fields — no diagnosis/history', async () => {
    mockExecute.mockResolvedValueOnce(rows([]));
    await pharmacyQueue();
    const sql = mockExecute.mock.calls[0][0] as string;
    expect(sql).not.toMatch(/diagnosis|medical_history|remarks|SELECT \*/i);
    expect(sql).toMatch(/fulfilment_status = 'pending'/i);
  });
});
