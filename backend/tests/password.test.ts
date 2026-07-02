/**
 * Password policy tests (D1 §9.1). Security-critical path — real assertions so
 * the Test Automation section has genuine evidence from day one.
 */
import { validatePasswordPolicy } from '../src/utils/password';

describe('validatePasswordPolicy', () => {
  it('accepts a strong 12+ char password', () => {
    expect(validatePasswordPolicy('Str0ng!Passw0rd')).toBeNull();
  });

  it('rejects passwords shorter than 12 chars', () => {
    expect(validatePasswordPolicy('Ab1!short')).toMatch(/at least 12/);
  });

  it('requires an uppercase letter', () => {
    expect(validatePasswordPolicy('str0ng!passw0rd')).toMatch(/uppercase/);
  });

  it('requires a digit', () => {
    expect(validatePasswordPolicy('Strong!Password')).toMatch(/digit/);
  });

  it('requires a special character', () => {
    expect(validatePasswordPolicy('Str0ngPassw0rd')).toMatch(/special/);
  });
});
