import { readFile } from 'node:fs/promises';
import { summarizeRuns } from './evaluate.mjs';
// Los ficheros de resultados quedan fuera de Git: pueden contener texto de prueba.
const [corpusPath, runsPath, pricesPath] = process.argv.slice(2);
if (!corpusPath || !runsPath) {
  console.error('Uso: node scripts/ai-baseline/report.mjs <corpus.json> <runs.json> [prices.json]');
  process.exitCode = 1;
} else {
  try {
    const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
    const corpus = await readJson(corpusPath);
    const runs = await readJson(runsPath);
    const prices = pricesPath ? await readJson(pricesPath) : null;
    console.log(JSON.stringify(summarizeRuns(corpus.cases, runs, prices), null, 2));
  } catch {
    console.error(
      'No se pudo evaluar: revisa rutas, formato, métricas y correspondencia con el corpus.',
    );
    process.exitCode = 1;
  }
}
