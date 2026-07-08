import { Request } from 'express';
import { config } from '../src/config/env';
import { devAuth } from '../src/middleware/devAuth';

function reqWithHeaders(headers: Record<string, string>): Request {
  return {
    session: {},
    get: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
}

describe('devAuth', () => {
  const originalNodeEnv = config.nodeEnv;
  const originalEnableDevAuth = config.enableDevAuth;

  afterEach(() => {
    config.nodeEnv = originalNodeEnv;
    config.enableDevAuth = originalEnableDevAuth;
  });

  it('ignores dev headers unless NODE_ENV is development and ENABLE_DEV_AUTH is true', () => {
    config.nodeEnv = 'production';
    config.enableDevAuth = true;
    const req = reqWithHeaders({ 'x-dev-user-id': '1', 'x-dev-user-role': 'admin' });
    const next = jest.fn();

    devAuth(req, {} as never, next);

    expect(req.session.user).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('accepts dev headers only when both local-dev gates are enabled', () => {
    config.nodeEnv = 'development';
    config.enableDevAuth = true;
    const req = reqWithHeaders({ 'x-dev-user-id': '1', 'x-dev-user-role': 'admin' });

    devAuth(req, {} as never, jest.fn());

    expect(req.session.user).toMatchObject({ id: 1, role: 'admin', status: 'active' });
  });
});
