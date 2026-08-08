import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  EXTERNAL_DOMAIN_KNOWLEDGE_POLICY_VERSION,
  EXTERNAL_DOMAIN_KNOWLEDGE_SYSTEM_POLICY,
  GENERAL_LEARNING_POLICY_VERSION,
  GENERAL_LEARNING_SYSTEM_POLICY,
  resolveGeneralLearningSystemPolicy,
} from './ai.policy.js';

describe('ai learning policies', () => {
  test('general learning policy forbids implying external search', () => {
    assert.match(
      GENERAL_LEARNING_SYSTEM_POLICY,
      /Never imply that you searched the web or accessed external sources\./,
    );
  });

  test('external domain policy allows synthesizing supplied retrieval references', () => {
    assert.match(
      EXTERNAL_DOMAIN_KNOWLEDGE_SYSTEM_POLICY,
      /synthesize externally retrieved web references supplied by the system/i,
    );
    assert.equal(
      EXTERNAL_DOMAIN_KNOWLEDGE_SYSTEM_POLICY.includes(
        'Never imply that you searched the web or accessed external sources.',
      ),
      false,
    );
  });

  test('resolveGeneralLearningSystemPolicy selects route-specific policy and version', () => {
    const general = resolveGeneralLearningSystemPolicy('Explain Arduino Uno simply');
    assert.equal(general.policy, GENERAL_LEARNING_SYSTEM_POLICY);
    assert.equal(general.policyVersion, GENERAL_LEARNING_POLICY_VERSION);

    const external = resolveGeneralLearningSystemPolicy(
      `${EXTERNAL_DOMAIN_KNOWLEDGE_POLICY_VERSION}\nLearner question: "Wire library"`,
    );
    assert.equal(external.policy, EXTERNAL_DOMAIN_KNOWLEDGE_SYSTEM_POLICY);
    assert.equal(external.policyVersion, EXTERNAL_DOMAIN_KNOWLEDGE_POLICY_VERSION);
  });
});
