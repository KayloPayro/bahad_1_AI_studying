/** יוצר את PRINCIPLES.md מ-apps/site/src/principles.ts. הרצה: npx tsx scripts/principles-md.ts */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PRINCIPLES } from '../apps/site/src/principles';

const titles: Record<string, string> = {};
for (const d of readdirSync('modules')) {
  const c = JSON.parse(readFileSync(`modules/${d}/content.json`, 'utf8'));
  titles[c.id] = c.title;
}

const out = ['# עקרונות השימוש ב-AI לקצין מטה', ''];
PRINCIPLES.forEach((p, i) => {
  out.push(`## ${i + 1}. ${p.title}`, '', p.short, '', p.body, '', '**לומדים בלומדות:**');
  for (const id of p.lessons) out.push(`- ${titles[id] ?? id}`);
  out.push('');
});
writeFileSync('PRINCIPLES.md', out.join('\n'));
