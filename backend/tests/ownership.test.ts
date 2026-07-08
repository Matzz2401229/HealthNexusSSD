/**
 * Ownership / IDOR middleware tests (D1 §9.2, FSR3/FSR4, SR8/SR12) — the #1
 * ranked risk. Verifies deny-by-default, correct per-role ownership rules, the
 * doctor↔patient treatment gate, and that denied attempts are audited (SR14/16).
 * The DB pool and audit service are mocked (no Docker / live DB needed).
 */
jest.mock('../src/db/pool', () => ({ pool: { execute: jest.fn() } }));
jest.mock('../src/services/audit.service', () => ({ recordAudit: jest.fn() }));

import { Request, Response } from 'express';
import { pool } from '../src/db/pool';
import { recordAudit } from '../src/services/audit.service';
import {
  requireOwnership,
  doctorHasTreatmentRelationship,
  canAccessPatientRecord,
  canAccessAppointment,
  canAccessPrescription,
  canAccessDocument,
} from '../src/middleware/ownership';

const mockExecute = pool.execute as unknown as jest.Mock;
const mockAudit = recordAudit as unknown as jest.Mock;

/** pool.execute resolves to [rows, fields]; helpers shape the next result. */
const rows = (r: unknown[]) => mockExecute.mockResolvedValueOnce([r]);
const noRows = () => mockExecute.mockResolvedValueOnce([[]]);

beforeEach(() => jest.clearAllMocks());

// --- doctorHasTreatmentRelationship (FSR4) --------------------------------
describe('doctorHasTreatmentRelationship', () => {
  it('is true when an auth/appointment row exists, querying both tables', async () => {
    rows([{ ok: 1 }]);
    await expect(doctorHasTreatmentRelationship(10, 20)).resolves.toBe(true);
    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toMatch(/doctor_patient_auth/);
    expect(sql).toMatch(/revoked_at IS NULL/);
    expect(sql).toMatch(/appointment/);
    expect(params).toEqual([10, 20, 10, 20]);
  });

  it('is false when no relationship exists (deny-by-default)', async () => {
    noRows();
    await expect(doctorHasTreatmentRelationship(10, 20)).resolves.toBe(false);
  });
});

// --- canAccessPatientRecord (SR8, FSR4) -----------------------------------
describe('canAccessPatientRecord', () => {
  it('lets a patient access ONLY their own record — no DB needed', async () => {
    await expect(canAccessPatientRecord(5, 'patient', 5)).resolves.toBe(true);
    await expect(canAccessPatientRecord(5, 'patient', 6)).resolves.toBe(false);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('lets a doctor in only with a treatment relationship (FSR4)', async () => {
    rows([{ ok: 1 }]);
    await expect(canAccessPatientRecord(10, 'doctor', 20)).resolves.toBe(true);
    noRows();
    await expect(canAccessPatientRecord(10, 'doctor', 21)).resolves.toBe(false);
  });

  it('denies pharmacist and admin (no clinical access via this guard)', async () => {
    await expect(canAccessPatientRecord(1, 'pharmacist', 2)).resolves.toBe(false);
    await expect(canAccessPatientRecord(1, 'admin', 2)).resolves.toBe(false);
  });
});

// --- canAccessAppointment -------------------------------------------------
describe('canAccessAppointment', () => {
  it('denies when the appointment does not exist', async () => {
    noRows();
    await expect(canAccessAppointment(5, 'patient', 99)).resolves.toBe(false);
  });

  it('allows only the owning patient / owning doctor', async () => {
    rows([{ patient_id: 5, doctor_id: 10 }]);
    await expect(canAccessAppointment(5, 'patient', 1)).resolves.toBe(true);
    rows([{ patient_id: 5, doctor_id: 10 }]);
    await expect(canAccessAppointment(7, 'patient', 1)).resolves.toBe(false); // other patient
    rows([{ patient_id: 5, doctor_id: 10 }]);
    await expect(canAccessAppointment(10, 'doctor', 1)).resolves.toBe(true);
    rows([{ patient_id: 5, doctor_id: 10 }]);
    await expect(canAccessAppointment(11, 'doctor', 1)).resolves.toBe(false); // other doctor
    rows([{ patient_id: 5, doctor_id: 10 }]);
    await expect(canAccessAppointment(10, 'pharmacist', 1)).resolves.toBe(false);
  });
});

// --- canAccessPrescription (FSR6) -----------------------------------------
describe('canAccessPrescription', () => {
  it('denies when missing', async () => {
    noRows();
    await expect(canAccessPrescription(5, 'patient', 9)).resolves.toBe(false);
  });

  it('patient owns; issuing doctor allowed; pharmacist may read any', async () => {
    rows([{ patient_id: 5, doctor_id: 10 }]);
    await expect(canAccessPrescription(5, 'patient', 1)).resolves.toBe(true);
    rows([{ patient_id: 5, doctor_id: 10 }]);
    await expect(canAccessPrescription(10, 'doctor', 1)).resolves.toBe(true); // issuer, no treatment query
    rows([{ patient_id: 5, doctor_id: 10 }]);
    await expect(canAccessPrescription(99, 'pharmacist', 1)).resolves.toBe(true); // FSR6 read
  });

  it('non-issuing doctor allowed ONLY via treatment relationship (FSR4)', async () => {
    rows([{ patient_id: 5, doctor_id: 10 }]); // fetch rx
    rows([{ ok: 1 }]); // treatment check true
    await expect(canAccessPrescription(11, 'doctor', 1)).resolves.toBe(true);

    rows([{ patient_id: 5, doctor_id: 10 }]); // fetch rx
    noRows(); // treatment check false
    await expect(canAccessPrescription(12, 'doctor', 1)).resolves.toBe(false);
  });
});

// --- canAccessDocument (FSR4) ---------------------------------------------
describe('canAccessDocument', () => {
  it('denies when missing', async () => {
    noRows();
    await expect(canAccessDocument(5, 'patient', 9)).resolves.toBe(false);
  });

  it('patient owns; treating doctor allowed; pharmacist denied', async () => {
    rows([{ patient_id: 5 }]);
    await expect(canAccessDocument(5, 'patient', 1)).resolves.toBe(true);
    rows([{ patient_id: 5 }]);
    await expect(canAccessDocument(7, 'patient', 1)).resolves.toBe(false);
    rows([{ patient_id: 5 }]); // fetch doc
    rows([{ ok: 1 }]); // treatment true
    await expect(canAccessDocument(10, 'doctor', 1)).resolves.toBe(true);
    rows([{ patient_id: 5 }]);
    await expect(canAccessDocument(10, 'pharmacist', 1)).resolves.toBe(false);
  });
});

// --- requireOwnership factory ---------------------------------------------
function mockRes() {
  const res = {} as Response & { statusCode?: number; body?: unknown };
  res.status = ((code: number) => {
    res.statusCode = code;
    return res;
  }) as Response['status'];
  res.json = ((body: unknown) => {
    res.body = body;
    return res;
  }) as Response['json'];
  return res;
}

function reqWith(user: unknown, params: Record<string, string>): Request {
  return {
    session: user ? { user } : {},
    params,
    method: 'GET',
    originalUrl: '/api/records/1',
    ip: '127.0.0.1',
  } as unknown as Request;
}

describe('requireOwnership factory', () => {
  const allow = jest.fn().mockResolvedValue(true);
  const deny = jest.fn().mockResolvedValue(false);

  it('401s when unauthenticated', async () => {
    const res = mockRes();
    const next = jest.fn();
    await requireOwnership('id', allow)(reqWith(null, { id: '1' }), res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('400s on a non-numeric or non-positive id (never reaches the resolver)', async () => {
    const res = mockRes();
    await requireOwnership('id', allow)(reqWith({ id: 1, role: 'patient' }, { id: 'abc' }), res, jest.fn());
    expect(res.statusCode).toBe(400);

    const res2 = mockRes();
    await requireOwnership('id', allow)(reqWith({ id: 1, role: 'patient' }, { id: '0' }), res2, jest.fn());
    expect(res2.statusCode).toBe(400);
    expect(allow).not.toHaveBeenCalled();
  });

  it('404s AND audits the failure when the resolver denies (anti-IDOR + SR16)', async () => {
    const res = mockRes();
    const next = jest.fn();
    await requireOwnership('id', deny)(reqWith({ id: 9, role: 'patient' }, { id: '1' }), res, next);
    expect(res.statusCode).toBe(404);
    expect(next).not.toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'failure', action: 'ownership.denied', userId: 9 }),
    );
  });

  it('calls next() when the resolver allows, and does NOT audit', async () => {
    const res = mockRes();
    const next = jest.fn();
    await requireOwnership('id', allow)(reqWith({ id: 5, role: 'patient' }, { id: '1' }), res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBeUndefined();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it('forwards resolver errors to next(err)', async () => {
    const boom = jest.fn().mockRejectedValue(new Error('db down'));
    const res = mockRes();
    const next = jest.fn();
    await requireOwnership('id', boom)(reqWith({ id: 5, role: 'patient' }, { id: '1' }), res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
