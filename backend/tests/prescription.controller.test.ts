/**
 * Prescription controller tests (workstream #6). Proves the HTTP layer maps
 * service outcomes to the right status codes, with a faked logged-in user
 * (real login is a separate workstream). The service + audit log are mocked.
 */
import { Request, Response } from 'express';

jest.mock('../src/services/prescription.service', () => ({
  issuePrescription: jest.fn(),
  listForPatient: jest.fn(),
  pharmacyQueue: jest.fn(),
  getForUser: jest.fn(),
  updateFulfilment: jest.fn(),
  NotAuthorisedError: class NotAuthorisedError extends Error {},
}));
jest.mock('../src/services/audit.service', () => ({
  recordAudit: jest.fn().mockResolvedValue(undefined),
}));

import * as service from '../src/services/prescription.service';
import { NotAuthorisedError } from '../src/services/prescription.service';
import * as controller from '../src/controllers/prescription.controller';

const svc = service as jest.Mocked<typeof service>;

function mockRes() {
  const res = {} as Response & { statusCode?: number; body?: unknown };
  res.statusCode = 200;
  res.status = ((c: number) => { res.statusCode = c; return res; }) as Response['status'];
  res.json = ((b: unknown) => { res.body = b; return res; }) as Response['json'];
  res.send = ((b: unknown) => { res.body = b; return res; }) as Response['send'];
  res.setHeader = (() => res) as unknown as Response['setHeader'];
  return res;
}

const next = jest.fn();
beforeEach(() => jest.clearAllMocks());

describe('issue (POST /prescriptions)', () => {
  const req = { session: { user: { id: 7, role: 'doctor' } }, body: { patientId: 5, medication: 'x', dosage: 'y' } } as unknown as Request;

  it('returns 201 with the created prescription', async () => {
    svc.issuePrescription.mockResolvedValueOnce({ id: 42 } as never);
    const res = mockRes();
    await controller.issue(req, res, next);
    expect(res.statusCode).toBe(201);
    expect((res.body as { id: number }).id).toBe(42);
  });

  it('returns 403 when the doctor has no relationship (NotAuthorisedError)', async () => {
    svc.issuePrescription.mockRejectedValueOnce(new NotAuthorisedError());
    const res = mockRes();
    await controller.issue(req, res, next);
    expect(res.statusCode).toBe(403);
  });
});

describe('getOne (GET /prescriptions/:id)', () => {
  it('returns 400 for a non-numeric id', async () => {
    const req = { session: { user: { id: 1, role: 'patient' } }, params: { id: 'abc' } } as unknown as Request;
    const res = mockRes();
    await controller.getOne(req, res, next);
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when the user may not see it', async () => {
    svc.getForUser.mockResolvedValueOnce(null);
    const req = { session: { user: { id: 1, role: 'patient' } }, params: { id: '9' } } as unknown as Request;
    const res = mockRes();
    await controller.getOne(req, res, next);
    expect(res.statusCode).toBe(404);
  });

  it('returns 200 with the prescription when allowed', async () => {
    svc.getForUser.mockResolvedValueOnce({ id: 9 } as never);
    const req = { session: { user: { id: 1, role: 'patient' } }, params: { id: '9' } } as unknown as Request;
    const res = mockRes();
    await controller.getOne(req, res, next);
    expect(res.statusCode).toBe(200);
  });
});

describe('updateFulfilment (PATCH /prescriptions/:id/fulfilment)', () => {
  const req = { session: { user: { id: 3, role: 'pharmacist' } }, params: { id: '9' }, body: { fulfilmentStatus: 'dispensed' } } as unknown as Request;

  it('returns 200 when the update succeeds', async () => {
    svc.updateFulfilment.mockResolvedValueOnce(true);
    const res = mockRes();
    await controller.updateFulfilment(req, res, next);
    expect(res.statusCode).toBe(200);
  });

  it('returns 404 when already actioned or not found', async () => {
    svc.updateFulfilment.mockResolvedValueOnce(false);
    const res = mockRes();
    await controller.updateFulfilment(req, res, next);
    expect(res.statusCode).toBe(404);
  });
});
