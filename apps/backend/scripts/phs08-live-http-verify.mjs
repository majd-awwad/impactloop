/**
 * PHS-08 authenticated HTTP verification against the running local API.
 * Run while `npm run dev` is active on port 4000.
 */
const BASE = process.env.PHS08_BASE_URL ?? 'http://127.0.0.1:4000';
const PROJECT_ID = 'e445e3b7-6fe2-49db-a695-1d3a47bf8e5c';
const BUILD_ID = 'cmshf6ugs000724vg3rfvnr1d';
const STEP_ID = '3b5a9309-8039-4f69-802b-61ec1bde2902';

async function login() {
  const response = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'israa@learner.com', password: 'password' }),
  });
  const json = await response.json();
  if (!json?.data?.accessToken) {
    throw new Error(`Login failed: ${response.status}`);
  }
  return json.data.accessToken;
}

function futureTimes() {
  const base = new Date();
  base.setUTCDate(base.getUTCDate() + 5);
  return [10, 14, 18].map((hour) =>
    new Date(
      Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), hour, 0),
    ).toISOString(),
  );
}

async function createRequest(token, body, buildId = BUILD_ID) {
  const url = `${BASE}/api/project-help-sessions/learner/builds/${buildId}/request`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  return { url, status: response.status, json };
}

const token = await login();
const buildFetch = await fetch(`${BASE}/api/learning-projects/${PROJECT_ID}/builds/me`, {
  headers: { Authorization: `Bearer ${token}` },
});
const buildJson = await buildFetch.json();

const body = {
  problemDescription:
    'Need help with step one wiring and component inspection before assembly.',
  projectStepId: STEP_ID,
  durationMinutes: 30,
  learnerTimeZone: 'Asia/Hebron',
  proposedTimes: futureTimes(),
};

const first = await createRequest(token, body);
const duplicate = await createRequest(token, body);

console.log(
  JSON.stringify(
    {
      buildFetch: {
        status: buildFetch.status,
        buildId: buildJson?.data?.id,
        projectId: buildJson?.data?.projectId,
      },
      firstRequest: {
        status: first.status,
        code: first.json?.error?.code,
        sessionId: first.json?.data?.id,
        sessionStatus: first.json?.data?.status,
        stepId: first.json?.data?.projectStep?.id,
        optionCount: first.json?.data?.timeOptions?.length,
      },
      duplicateRequest: {
        status: duplicate.status,
        code: duplicate.json?.error?.code,
      },
    },
    null,
    2,
  ),
);
