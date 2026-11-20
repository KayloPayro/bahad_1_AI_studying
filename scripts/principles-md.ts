/** יוצר את PRINCIPLES.md מ-apps/site/src/principles.ts. הרצה: npx tsx scripts/principles-md.ts */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PRINCIPLES, RISK_RULE } from '../apps/site/src/principles';

const titles: Record<string, string> = {};
for (const d of readdirSync('modules')) {
  const c = JSON.parse(readFileSync(`modules/${d}/content.json`, 'utf8'));
  titles[c.id] = c.title;
}

const out = ['# עקרונות השימוש ב-AI לקצין מטה', '', `**כלל שחל על כולם:** ${RISK_RULE}`, ''];
PRINCIPLES.forEach((p, i) => {
  out.push(`## ${i + 1}. ${p.title}`, '', `_קבוצה: ${p.group}_`, '', p.body, '', '**מה עושים בפועל:**');
  for (const a of p.action) out.push(`- ${a}`);
  out.push('');
  if (p.note) out.push(`**הערה:** ${p.note}`, '');
  out.push('**לומדים בלומדות:**');
  for (const id of p.lessons) out.push(`- ${titles[id] ?? id}`);
  out.push('');
});
writeFileSync('PRINCIPLES.md', out.join('\n'));
