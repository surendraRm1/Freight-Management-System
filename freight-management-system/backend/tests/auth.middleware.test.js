const { deriveRoleSet, _test } = require('../src/middleware/auth');

describe('auth helpers', () => {
  test('deriveRoleSet does not grant admin to company admin', () => {
    const roles = deriveRoleSet('COMPANY_ADMIN');
    expect(roles.has('COMPANY_ADMIN')).toBe(true);
    expect(roles.has('USER')).toBe(true);
    expect(roles.has('ADMIN')).toBe(false);
  });

  test('IP allow list honors explicit entries', () => {
    const { isIpAllowed } = _test;
    expect(isIpAllowed(['10.0.0.1'], '10.0.0.1')).toBe(true);
    expect(isIpAllowed(['10.0.0.1'], '192.168.0.1')).toBe(false);
    expect(isIpAllowed(['*'], '203.0.113.5')).toBe(true);
  });
});
