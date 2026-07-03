/**
 * Prescription service tests (workstream #6). Security-critical paths:
 * treatment-relationship gate (FSR4), pharmacist status-only writes + no
 * clinical fields touched (FSR6/FSR13), and ownership/IDOR (FSR3).
 *
 * The DB is mocked, so these run without Docker/MySQL.
 */
// Mock the DB layer and the audit log so we test only the service logic.
jest.mock('../src/db/pool', () => ({
  query: jest.fn(),
  pool: { execute: jest.fn() },
}));
jest.mock('../src/services/audit.service', () => ({
  recordAudit: jest.fn().mockResolvedValue(undefined),
}));

import { query, pool } from '../src/db/pool';
import {
  issuePrescription,
  updateFulfilment,
  getForUser,
  pharmacyQueue,
  NotAuthorisedError,
} from '../src/services/prescription.service';

const mockQuery = query as jest.Mock;
const mockExecute = pool.execute as unknown as jest.Mock;

beforeEach(() => {
  mockQuery.mockReset();
  mockExecute.mockReset();
});

// A write returns [ResultSetHeader, ...]; we only need insertId/affectedRows.
const writeResult = (r: Record<string, unknown>) => [r];

describe('issuePrescription (FSR4 treatment relationship)', () => {
  it('refuses to issue when the doctor has no relationship with the patient', async () => {
    mockQuery.mockResolvedValueOnce([]); // hasTreatmentRelationship -> no rows

    await expect(
      issuePrescription(1, { patientId: 99, medication: 'Amoxicillin', dosage: '500mg' }),
    ).rejects.toBeInstanceOf(NotAuthorisedError);

    expect(mockExecute).not.toHaveBeenCalled(); // nothing was inserted
  });

  it('issues with doctor_id taken from the session, not the input (FSR2)', async () => {
    mockQuery.mockResolvedValueOnce([{ '1': 1 }]);            // relationship exists
    mockExecute.mockResolvedValueOnce(writeResult({ insertId: 42 })); // INSERT
    mockQuery.mockResolvedValueOnce([{ id: 42, doctor_id: 7, patient_id: 5 }]); // re-fetch

    const created = await issuePrescription(7, { patientId: 5, medication: 'Amoxicillin', dosage: '500mg' });

    expect(created.id).toBe(42);
    // the INSERT params must carry the session doctorId (7)
    const insertParams = mockExecute.mock.calls[0][1];
    expect(insertParams.doctorId).toBe(7);
  });
});

describe('updateFulfilment (FSR6 / FSR13 pharmacist)', () => {
  it('rejects an invalid fulfilment status without touching the DB', async () => {
    await expect(updateFulfilment(5, 9, 'pending' as never)).rejects.toThrow(/invalid/i);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('updates ONLY fulfilment fields — never medication/dosage', async () => {
    mockExecute.mockResolvedValueOnce(writeResult({ affectedRows: 1 }));

    const ok = await updateFulfilment(5, 9, 'dispensed');

    expect(ok).toBe(true);
    const sql = mockExecute.mock.calls[0][0] as string;
    // The UPDATE must not mention any clinical/immutable column.
    expect(sql).not.toMatch(/medication|dosage|patient_id|doctor_id/i);
    expect(sql).toMatch(/fulfilment_status/i);
    // and it records who dispensed it
    expect(mockExecute.mock.calls[0][1].pharmacistId).toBe(9);
  });

  it('returns false when the prescription was already actioned', async () => {
    mockExecute.mockResolvedValueOnce(writeResult({ affectedRows: 0 }));
    expect(await updateFulfilment(5, 9, 'dispensed')).toBe(false);
  });
});

describe('getForUser (FSR3 ownership / IDOR)', () => {
  it('hides a prescription from a patient who does not own it', async () => {
    mockQuery.mockResolvedValueOnce([{ id: 7, patient_id: 100, doctor_id: 5 }]);
    const res = await getForUser(7, { id: 200, role: 'patient' });
    expect(res).toBeNull();
  });

  it('returns a prescription to its owning patient', async () => {
    mockQuery.mockResolvedValueOnce([{ id: 7, patient_id: 200, doctor_id: 5 }]);
    const res = await getForUser(7, { id: 200, role: 'patient' });
    expect(res?.id).toBe(7);
  });
});

describe('pharmacyQueue (FSR6 limited fields)', () => {
  it('selects only prescription fields — no diagnosis/history', async () => {
    mockQuery.mockResolvedValueOnce([]);
    await pharmacyQueue();
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).not.toMatch(/diagnosis|medical_history|remarks|SELECT \*/i);
    expect(sql).toMatch(/fulfilment_status = 'pending'/i);
  });
});
