import { env } from './env.js';

const databaseUrl = env.databaseUrl;
let databaseName = '';
try {
  databaseName = decodeURIComponent(
    new URL(databaseUrl).pathname.replace(/^\//, '').split('?')[0] ?? '',
  );
} catch {
  databaseName = 'unparseable';
}

process.stdout.write(
  JSON.stringify({
    nodeEnv: env.nodeEnv,
    databaseName,
    hitsDevelopmentImpactloop: databaseName === 'impactloop',
  }),
);
