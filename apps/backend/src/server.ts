import { app } from './app.js';
import { env, logAiPriceSuggestionStartupConfig } from './config/env.js';

logAiPriceSuggestionStartupConfig();

app.listen(env.port, () => {
  console.log(`ImpactLoop API listening on port ${env.port}`);
});
