#!/usr/bin/env node
/**
 * Gated real Zoom smoke check. Run only with RUN_ZOOM_REAL_SMOKE=1.
 * Never prints tokens, secrets, or full meeting URLs.
 */
import '../../config/env.js';
import { loadZoomConfig } from './zoom/zoom-config.js';
import { RealZoomMeetingProvider } from './zoom/zoom-meeting-provider.real.js';
import { getZoomAccessToken, resetZoomTokenCacheForTests } from './zoom/zoom-token-manager.js';

const redactMeetingId = (meetingId: string) => {
  const digits = meetingId.replace(/\D/g, '');
  return digits.length <= 4 ? '****' : `****${digits.slice(-4)}`;
};

async function main() {
  if (process.env.RUN_ZOOM_REAL_SMOKE !== '1') {
    console.log('SKIP: set RUN_ZOOM_REAL_SMOKE=1 to run real Zoom smoke');
    process.exit(0);
  }

  resetZoomTokenCacheForTests();
  const config = loadZoomConfig();
  if (config.mode !== 'real') {
    console.log('BLOCKED: ZOOM_INTEGRATION_MODE must be real');
    process.exit(1);
  }

  let tokenAcquired = false;
  let meetingCreated = false;
  let getSucceeded = false;
  let deleteSucceeded = false;
  let meetingId = '';
  let redactedMeetingId = '****';

  try {
    await getZoomAccessToken(config);
    tokenAcquired = true;
  } catch {
    console.log('token acquired: no');
    console.log('BLOCKED: token request failed');
    process.exit(1);
  }

  const provider = new RealZoomMeetingProvider(config);
  const startsAt = new Date(Date.now() + 12 * 60 * 1000);

  try {
    const created = await provider.createMeeting({
      topic: 'ImpactLoop Zoom Integration Smoke Test',
      startsAt,
      durationMinutes: 15,
      agenda: 'ImpactLoop Zoom integration smoke test.',
    });
    meetingCreated = true;
    meetingId = created.meetingId;
    redactedMeetingId = redactMeetingId(meetingId);
  } catch {
    console.log('token acquired: yes');
    console.log('meeting created: no');
    console.log('BLOCKED: create meeting failed');
    process.exit(1);
  }

  try {
    const details = await provider.getMeeting(meetingId);
    getSucceeded =
      details.durationMinutes === 15 &&
      Math.abs(details.startsAt.getTime() - startsAt.getTime()) < 60_000;
  } catch {
    getSucceeded = false;
  }

  try {
    await provider.deleteMeeting(meetingId);
    deleteSucceeded = true;
  } catch {
    try {
      await provider.deleteMeeting(meetingId);
      deleteSucceeded = true;
    } catch {
      deleteSucceeded = false;
    }
  }

  if (!deleteSucceeded) {
    console.log('token acquired: yes');
    console.log('meeting created: yes');
    console.log(`meeting id: ${redactedMeetingId}`);
    console.log(`get succeeded: ${getSucceeded ? 'yes' : 'no'}`);
    console.log('delete succeeded: no');
    console.log('BLOCKED: manual cleanup required');
    process.exit(1);
  }

  try {
    await provider.getMeeting(meetingId);
    console.log('BLOCKED: meeting still exists after delete');
    process.exit(1);
  } catch {
    // expected not found
  }

  console.log(`token acquired: ${tokenAcquired ? 'yes' : 'no'}`);
  console.log(`meeting created: ${meetingCreated ? 'yes' : 'no'}`);
  console.log(`meeting id: ${redactedMeetingId}`);
  console.log(`get succeeded: ${getSucceeded ? 'yes' : 'no'}`);
  console.log(`delete succeeded: ${deleteSucceeded ? 'yes' : 'no'}`);
  console.log('no meeting remains: yes');
}

main().catch(() => {
  console.log('BLOCKED: smoke execution failed');
  process.exit(1);
});
