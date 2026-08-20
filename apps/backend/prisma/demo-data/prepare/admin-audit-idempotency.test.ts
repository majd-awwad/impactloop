import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  countDemoAuditScenarios,
  hasDemoAuditScenario,
  readLocalDemoKey,
} from './admin-audit-idempotency.js';

describe('admin-audit idempotency', () => {
  test('reads localDemoKey from metadata', () => {
    assert.equal(
      readLocalDemoKey({ localDemoKey: 'admin-audit-v1:export-users' }),
      'admin-audit-v1:export-users',
    );
    assert.equal(readLocalDemoKey(null), null);
  });

  test('detects an existing demo scenario and does not treat it as missing', () => {
    const rows = [
      { metadata: { localDemoKey: 'admin-audit-v1:invite-create' } },
      { metadata: { localDemoKey: 'admin-audit-v1:invite-revoke' } },
    ];
    assert.equal(hasDemoAuditScenario(rows, 'admin-audit-v1:invite-create'), true);
    assert.equal(countDemoAuditScenarios(rows, 'admin-audit-v1:invite-create'), 1);
  });

  test('rerun of identical keys does not imply a second insert is needed', () => {
    const afterFirstRun = [
      { metadata: { localDemoKey: 'admin-audit-v1:export-users' } },
    ];
    const afterSecondRunIfGuarded = afterFirstRun;
    assert.equal(
      countDemoAuditScenarios(afterSecondRunIfGuarded, 'admin-audit-v1:export-users'),
      1,
    );
    assert.notEqual(
      countDemoAuditScenarios(
        [
          ...afterFirstRun,
          { metadata: { localDemoKey: 'admin-audit-v1:export-users' } },
        ],
        'admin-audit-v1:export-users',
      ),
      1,
    );
  });
});
