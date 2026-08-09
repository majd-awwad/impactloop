import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import jwt from 'jsonwebtoken';

import { env } from '../../config/env.js';
import { signAccessToken, verifyAccessToken } from '../../utils/jwt.js';

describe('JWT role claims', () => {
  test('round-trips generated user roles', () => {
    const token = signAccessToken({
      sub: 'jwt-role-claims-user',
      roles: ['LEARNER', 'SUPPLIER'],
    });

    assert.deepEqual(verifyAccessToken(token), {
      sub: 'jwt-role-claims-user',
      roles: ['LEARNER', 'SUPPLIER'],
    });
  });

  test('discards role claims outside the generated user-role enum', () => {
    const token = jwt.sign(
      {
        sub: 'jwt-role-claims-user',
        roles: ['LEARNER', 'SUPER_ADMIN', 42],
      },
      env.jwtAccessSecret,
    );

    assert.deepEqual(verifyAccessToken(token), {
      sub: 'jwt-role-claims-user',
      roles: ['LEARNER'],
    });
  });
});
