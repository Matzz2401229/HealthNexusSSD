/**
 * Password policy tests (D1 §9.1). Security-critical path — real assertions so
 * the Test Automation section has genuine evidence from day one.
 */
import { validatePasswordPolicy } from '../src/utils/password';

describe('validatePasswordPolicy', () => {
  it('accepts a strong 12+ char password', () => {
    expect(validatePasswordPolicy('Str0ng!Passw0rd')).toEqual([]);
  });

  it('rejects passwords shorter than 12 chars', () => {
    const result = validatePasswordPolicy('Ab1!short');
    expect(result).toEqual(expect.arrayContaining([expect.stringContaining('at least 12')]));
  });

  it('requires an uppercase letter', () => {
    const result = validatePasswordPolicy('str0ng!passw0rd');
    expect(result).toEqual(expect.arrayContaining([expect.stringContaining('uppercase')]));
  });

  it('requires a digit', () => {
    const result = validatePasswordPolicy('Strong!Password');
    expect(result).toEqual(expect.arrayContaining([expect.stringContaining('digit')]));
  });

  it('requires a special character', () => {
    const result = validatePasswordPolicy('Str0ngPassw0rd');
    expect(result).toEqual(expect.arrayContaining([expect.stringContaining('special')]));
  });
});
