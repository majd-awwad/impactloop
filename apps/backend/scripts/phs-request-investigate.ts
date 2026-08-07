/**
 * PHS request-creation investigation for a specific project/build.
 * Does not print tokens or DATABASE_URL.
 */
import { prisma } from '../src/database/prisma.js';

const BASE = process.env.PHS_BASE_URL ?? 'http://127.0.0.1:4000';
const PROJECT_ID = process.env.PHS_PROJECT_ID ?? 'f77f8f85-a9bf-4af8-9972-0a65b693c8cf';
const LEARNERS = [
  { email: 'israa@learner.com', password: 'password' },
  { email: 'majd@learner.com', password: 'password' },
];

async function loginAs(email: string, password: string) {
  const response = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await response.json();
  if (!json?.data?.accessToken) {
    throw new Error(`Login failed: HTTP ${response.status}`);
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

async function fetchBuild(token: string) {
  const url = `${BASE}/api/learning-projects/${PROJECT_ID}/builds/me`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await response.json();
  return { url, status: response.status, json };
}

async function createRequest(token: string, buildId: string, body: object) {
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
  return { url, method: 'POST', status: response.status, json };
}

async function listSessions(token: string, buildId: string) {
  const url = `${BASE}/api/project-help-sessions/learner?buildId=${encodeURIComponent(buildId)}&page=1&limit=5`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await response.json().catch(() => ({}));
  return { url, status: response.status, json };
}

async function queryDbForProject() {
  const project = await prisma.learningProject.findUnique({
    where: { id: PROJECT_ID },
    select: { id: true, title: true },
  });
  const builds = await prisma.projectBuild.findMany({
    where: { projectId: PROJECT_ID },
    select: {
      id: true,
      projectId: true,
      learnerId: true,
      status: true,
      attemptNumber: true,
      learner: { select: { email: true, displayName: true } },
    },
  });
  return { project, builds };
}

async function queryDb(buildId: string) {
  const sessions = await prisma.projectHelpSession.findMany({
    where: { buildId },
    select: {
      id: true,
      status: true,
      activeKey: true,
      projectId: true,
      buildId: true,
      _count: {
        select: {
          timeOptions: true,
          statusHistory: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const build = await prisma.projectBuild.findUnique({
    where: { id: buildId },
    select: {
      id: true,
      projectId: true,
      learnerId: true,
      status: true,
      attemptNumber: true,
    },
  });

  const project = await prisma.learningProject.findUnique({
    where: { id: PROJECT_ID },
    select: { id: true, title: true },
  });

  return { build, project, sessions };
}

const projectDb = await queryDbForProject();

let investigation: Record<string, unknown> = {
  projectRouteId: PROJECT_ID,
  databaseProject: projectDb,
};

for (const learner of LEARNERS) {
  const token = await loginAs(learner.email, learner.password);
  const buildFetch = await fetchBuild(token);
  const buildId = buildFetch.json?.data?.id as string | undefined;
  const buildProjectId = buildFetch.json?.data?.projectId as string | undefined;

  const steps = buildFetch.json?.data?.stepProgress?.steps ?? [];
  const firstStepId = steps[0]?.stepId ?? steps[0]?.id ?? null;

  const requestBody = {
    problemDescription:
      'Need help with the bottle cap mosaic layout and glue pattern before assembly.',
    projectStepId: firstStepId,
    durationMinutes: 30,
    learnerTimeZone: 'Asia/Hebron',
    proposedTimes: futureTimes(),
  };

  const wrongIdAttempt = await createRequest(token, PROJECT_ID, requestBody);
  const createAttempt = buildId
    ? await createRequest(token, buildId, requestBody)
    : null;
  const listAttempt = buildId ? await listSessions(token, buildId) : null;
  const db = buildId
    ? await queryDb(buildId)
    : { build: null, project: projectDb.project, sessions: [] };

  investigation = {
    ...investigation,
    [`learner:${learner.email}`]: {
      buildFetch: {
        url: buildFetch.url,
        status: buildFetch.status,
        buildId,
        buildProjectId,
        routeIdMatchesProjectId: PROJECT_ID === buildProjectId,
        routeIdMatchesBuildId: PROJECT_ID === buildId,
        buildStatus: buildFetch.json?.data?.status,
        hasBuildData: buildFetch.json?.data != null,
      },
      requestBody,
      wrongIdUsingProjectRouteId: {
        url: wrongIdAttempt.url,
        status: wrongIdAttempt.status,
        code: wrongIdAttempt.json?.error?.code,
        message: wrongIdAttempt.json?.message,
        validationPath: wrongIdAttempt.json?.error?.details?.issues?.[0]?.path,
        validationMessage:
          wrongIdAttempt.json?.error?.details?.issues?.[0]?.message,
      },
      correctBuildIdRequest: createAttempt
        ? {
            url: createAttempt.url,
            status: createAttempt.status,
            success: createAttempt.json?.success,
            code: createAttempt.json?.error?.code,
            message: createAttempt.json?.message,
            sessionId: createAttempt.json?.data?.id,
            sessionStatus: createAttempt.json?.data?.status,
            optionCount: createAttempt.json?.data?.timeOptions?.length,
            validationIssues: createAttempt.json?.error?.details?.issues,
          }
        : { skipped: true, reason: 'no build id from builds/me' },
      listAfterCreate: listAttempt
        ? {
            url: listAttempt.url,
            status: listAttempt.status,
            code: listAttempt.json?.error?.code,
            total: listAttempt.json?.data?.pagination?.total,
            items: (listAttempt.json?.data?.items ?? []).map((item: {
              id: string;
              status: string;
              build?: { id?: string };
            }) => ({
              id: item.id,
              status: item.status,
              buildId: item.build?.id,
            })),
          }
        : null,
      databaseForBuild: db,
    },
  };
}

console.log(JSON.stringify(investigation, null, 2));

await prisma.$disconnect();
