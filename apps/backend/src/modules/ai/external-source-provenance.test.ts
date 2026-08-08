import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  isAuthoritativeExternalHostname,
  scoreExternalSourceProvenance,
} from './external-source-provenance.js';

describe('external source provenance', () => {
  test('scores known manufacturer documentation hosts as authoritative', () => {
    assert.equal(
      scoreExternalSourceProvenance(
        'https://www.arduino.cc/reference/en/language/functions/communication/wire/',
      ),
      'authoritative',
    );
    assert.equal(
      scoreExternalSourceProvenance('https://docs.arduino.cc/hardware/uno-rev3'),
      'authoritative',
    );
    assert.equal(
      scoreExternalSourceProvenance('https://learn.adafruit.com/introducing-adafruit-itsybitsy-m4'),
      'authoritative',
    );
  });

  test('scores unknown third-party hosts as unverified', () => {
    assert.equal(
      scoreExternalSourceProvenance('https://random-blog.example.com/arduino-wire'),
      'unverified',
    );
    assert.equal(
      scoreExternalSourceProvenance('https://stackoverflow.com/questions/12345'),
      'unverified',
    );
  });

  test('does not treat substring hostname matches as authoritative', () => {
    assert.equal(isAuthoritativeExternalHostname('notarduino.cc'), false);
    assert.equal(isAuthoritativeExternalHostname('evilarduino.cc'), false);
  });
});
