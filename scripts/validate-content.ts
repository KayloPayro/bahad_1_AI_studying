/**
 * Validates every modules/*\/content.json against the JSON Schema and the semantic checks.
 * Exit code 1 on any problem, so CI blocks a broken content file.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import schema from '../packages/schema/src/content.schema.json' with { type: 'json' };
import { semanticCheck, type ModuleContent } from '../packages/schema/src/index';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

let failed = 0;
const dirs = readdirSync(resolve(root, 'modules'), { withFileTypes: true }).filter((d) => d.isDirectory());
for (const d of dirs) {
  const file = resolve(root, 'modules', d.name, 'content.json');
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`✗ ${d.name}: invalid JSON (${(e as Error).message})`);
    failed++;
    continue;
  }
  const problems: string[] = [];
  if (!validate(json)) {
    for (const err of validate.errors ?? []) problems.push(`schema ${err.instancePath || '/'} ${err.message}`);
  } else {
    const c = json as unknown as ModuleContent;
    problems.push(...semanticCheck(c));
    if (!d.name.startsWith(c.slug + '-')) problems.push(`folder "${d.name}" should start with "${c.slug}-"`);
  }
  if (problems.length) {
    failed++;
    console.error(`✗ ${d.name}`);
    for (const p of problems) console.error('   ' + p);
  } else {
    const c = json as unknown as ModuleContent;
    console.log(`✓ ${d.name}  ${c.id} v${c.version} ${c.status}, ${c.steps.length} steps`);
  }
}
if (failed) {
  console.error(`\n${failed} module(s) failed validation`);
  process.exit(1);
}
