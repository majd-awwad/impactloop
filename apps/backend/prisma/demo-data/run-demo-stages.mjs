/**
 * Shared runner for additive demo orchestrators (demo:seed / demo:prepare / demo:all).
 *
 * Stages either spawn an npm script (canonical seed) or run an in-process
 * async function (graduation screenshot prep). A failing stage always throws
 * with the stage id/label so the CLI exits non-zero.
 */
import { spawnSync } from 'node:child_process';

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   script?: string,
 *   run?: () => Promise<unknown> | unknown,
 * }} DemoStage
 */

export const formatStageFailure = (input) => {
  const { orchestrator, index, total, stage, status } = input;
  const identity = stage.script
    ? `${stage.label} (${stage.script})`
    : `${stage.label} (${stage.id})`;
  return `[${orchestrator} ${index + 1}/${total}] FAILED: ${identity} exited with code ${status ?? 'null'}.`;
};

export const runSpawnedNpmStage = (input) => {
  const { stage, index, total, orchestrator, cwd, env, spawn } = input;
  const spawnImpl = spawn ?? spawnSync;
  const step = `[${orchestrator} ${index + 1}/${total}]`;
  console.log(`${step} Starting: ${stage.label} (${stage.script})`);

  const result = spawnImpl('npm', ['run', stage.script], {
    cwd,
    env,
    encoding: 'utf8',
    shell: true,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(
      formatStageFailure({
        orchestrator,
        index,
        total,
        stage,
        status: result.status,
      }),
    );
  }

  console.log(`${step} OK: ${stage.label}`);
  return result;
};

export const runInProcessStage = async (input) => {
  const { stage, index, total, orchestrator } = input;
  const step = `[${orchestrator} ${index + 1}/${total}]`;
  console.log(`${step} Starting: ${stage.label} (${stage.id})`);

  if (typeof stage.run !== 'function') {
    throw new Error(
      formatStageFailure({
        orchestrator,
        index,
        total,
        stage,
        status: 'missing-run',
      }),
    );
  }

  try {
    await stage.run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${formatStageFailure({
        orchestrator,
        index,
        total,
        stage,
        status: 1,
      })} ${message}`,
    );
  }

  console.log(`${step} OK: ${stage.label}`);
};

export const runSpawnedNpmStages = (input) => {
  const { stages, orchestrator, cwd, env, spawn, note } = input;
  console.log(
    JSON.stringify(
      {
        orchestrator,
        note,
        stages: stages.map((stage) => stage.script ?? stage.id),
      },
      null,
      2,
    ),
  );

  for (let index = 0; index < stages.length; index += 1) {
    runSpawnedNpmStage({
      stage: stages[index],
      index,
      total: stages.length,
      orchestrator,
      cwd,
      env,
      spawn,
    });
  }

  console.log(
    JSON.stringify(
      {
        orchestrator,
        status: 'ok',
        completedStages: stages.map((stage) => stage.script ?? stage.id),
      },
      null,
      2,
    ),
  );
};
