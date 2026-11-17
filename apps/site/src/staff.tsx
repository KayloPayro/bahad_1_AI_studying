import '@lumda/theme/all.css';
import { render } from 'preact';
import { useId, useMemo, useState } from 'preact/hooks';
import { config, SITE_BASE } from '@lumda/config';
import { applyTheme, ThemeToggle, Toaster, Watermark } from '@lumda/ui';
import { MODULES } from './modules';
import { Logo } from './logo';

/** One row per cadet × module, aggregated by the Apps Script doGet (see apps-script/Code.gs). */
export interface MatrixRow {
  pn: string;
  team: string;
  module: string;
  status: 'progress' | 'done';
  score: number | '';
  updated: string;
}

type Load = { state: 'idle' } | { state: 'loading' } | { state: 'error'; message: string } | { state: 'ok'; rows: MatrixRow[] };

async function fetchMatrix(code: string): Promise<MatrixRow[]> {
  const url = new URL(config.TRACKING_URL);
  url.searchParams.set('action', 'matrix');
  url.searchParams.set('code', code);
  const res = await fetch(url.toString(), { method: 'GET' });
  if (!res.ok) throw new Error('השרת החזיר שגיאה ' + res.status);
  const body = (await res.json()) as { ok: boolean; rows?: MatrixRow[]; error?: string };
  if (!body.ok) throw new Error(body.error === 'code' ? 'קוד הסגל שגוי' : 'הבקשה נדחתה');
  return body.rows ?? [];
}

function Staff() {
  const [code, setCode] = useState('');
  const [load, setLoad] = useState<Load>({ state: 'idle' });
  const [team, setTeam] = useState('');
  const id = useId();

  const rows = load.state === 'ok' ? load.rows : [];
  const cadets = useMemo(() => {
    const map = new Map<string, { pn: string; team: string; cells: Record<string, MatrixRow> }>();
    for (const r of rows) {
      if (team && r.team !== team) continue;
      const c = map.get(r.pn) ?? { pn: r.pn, team: r.team, cells: {} };
      c.cells[r.module] = r;
      map.set(r.pn, c);
    }
    return [...map.values()].sort((a, b) => a.team.localeCompare(b.team, 'he', { numeric: true }) || a.pn.localeCompare(b.pn));
  }, [rows, team]);

  return (
    <>
      <header class="site-head">
        <div class="site-head-in">
          <Logo />
          <div>
            <p class="site-kicker">
              <a href={SITE_BASE}>{config.SITE_TITLE}</a>
            </p>
            <h1 class="site-title">מעקב סגל</h1>
          </div>
        </div>
      </header>
      <main id="main" class="page page-wide">
        {!config.TRACKING_URL ? (
          <section class="card">
            <h2 class="section-h">המעקב עוד לא מחובר</h2>
            <p>
              צריך לפרוס פעם אחת את הסקריפט <span class="mono">apps-script/Code.gs</span> מחשבון Google של הסגל, ולהדביק את כתובת ה-Web
              App בשדה <span class="mono">TRACKING_URL</span> בקובץ <span class="mono">site.config.json</span>. ההוראות ב-
              <span class="mono">apps-script/README.md</span>.
            </p>
            <p class="muted">עד אז, ההתקדמות של כל צוער נשמרת בתור במכשיר שלו ונשלחת כשהמעקב יחובר.</p>
          </section>
        ) : (
          <section class="card">
            <form
              class="form form-inline"
              onSubmit={async (e) => {
                e.preventDefault();
                setLoad({ state: 'loading' });
                try {
                  setLoad({ state: 'ok', rows: await fetchMatrix(code.trim()) });
                } catch (err) {
                  setLoad({ state: 'error', message: (err as Error).message || 'אין חיבור. נסה שוב' });
                }
              }}
            >
              <div class="field">
                <label class="field-label" for={id}>
                  קוד סגל
                </label>
                <input
                  id={id}
                  class="input"
                  type="password"
                  autoComplete="off"
                  value={code}
                  onInput={(e) => setCode((e.currentTarget as HTMLInputElement).value)}
                />
              </div>
              <button type="submit" class="btn btn-primary" disabled={load.state === 'loading' || !code.trim()}>
                {load.state === 'loading' ? 'טוען…' : 'הצג מטריצה'}
              </button>
            </form>
            {load.state === 'error' && (
              <p class="field-error" role="alert">
                {load.message}
              </p>
            )}
          </section>
        )}

        {load.state === 'ok' && (
          <section aria-labelledby="h-matrix">
            <div class="matrix-head">
              <h2 id="h-matrix" class="section-h">
                צוער מול לומדה
              </h2>
              <label class="inline-field">
                צוות
                <select class="input input-small" value={team} onChange={(e) => setTeam((e.currentTarget as HTMLSelectElement).value)}>
                  <option value="">כל הצוותים</option>
                  {config.TEAMS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p class="legend">
              <span class="cell cell-done">סיים</span>
              <span class="cell cell-progress">בתהליך</span>
              <span class="cell cell-none">לא התחיל</span>
            </p>
            {cadets.length === 0 ? (
              <p class="muted">אין עדיין נתונים{team ? ' לצוות הזה' : ''}.</p>
            ) : (
              <div class="table-wrap">
                <table class="table matrix">
                  <thead>
                    <tr>
                      <th scope="col">מספר אישי</th>
                      <th scope="col">צוות</th>
                      {MODULES.map((m) => (
                        <th scope="col" key={m.id} title={m.title}>
                          {m.id}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cadets.map((c) => (
                      <tr key={c.pn}>
                        <th scope="row" class="clock">
                          {c.pn}
                        </th>
                        <td class="num">{c.team}</td>
                        {MODULES.map((m) => {
                          const r = c.cells[m.id];
                          return (
                            <td key={m.id}>
                              {!r ? (
                                <span class="cell cell-none">—</span>
                              ) : r.status === 'done' ? (
                                <span class="cell cell-done">{r.score === '' ? 'סיים' : `${r.score}%`}</span>
                              ) : (
                                <span class="cell cell-progress">בתהליך</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
        <footer class="page-foot">
          <ThemeToggle />
        </footer>
      </main>
      <Watermark />
      <Toaster />
    </>
  );
}

applyTheme();
render(<Staff />, document.getElementById('app')!);
