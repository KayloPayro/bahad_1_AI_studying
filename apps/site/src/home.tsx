import '@lumda/theme/all.css';
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { config, SITE_BASE } from '@lumda/config';
import { getLibrary, registerServiceWorker, removeFromLibrary, runStatus, type LibraryItem } from '@lumda/engine';
import { clearIdentity, getIdentity, maskPn, type Identity } from '@lumda/tracking';
import { applyTheme, Chip, copyText, ThemeToggle, toast, Toaster, Watermark } from '@lumda/ui';
import { MODULES } from './modules';
import { Logo } from './logo';
import { PRINCIPLES } from './principles';

function Home() {
  const [identity, setIdentity] = useState<Identity | null>(getIdentity);
  const [library, setLibrary] = useState<LibraryItem[]>(() => (identity ? getLibrary(identity.pn) : []));
  const ready = MODULES.filter((m) => m.status === 'ready');
  const drafts = MODULES.filter((m) => m.status !== 'ready');

  return (
    <>
      <a class="skip-link" href="#main">
        דלג לתוכן
      </a>
      <header class="site-head">
        <div class="site-head-in">
          <Logo />
          <div>
            <p class="site-kicker">בה״ד 1 · הכשרת צוערים</p>
            <h1 class="site-title">{config.SITE_TITLE}</h1>
          </div>
        </div>
      </header>
      <main id="main" class="page">
        <section class="lead">
          <p>
            כל לומדה בנויה כך שהדרך הנכונה לעבוד עם AI היא הדרך היחידה שמביאה לתוצר הנדרש. אתה עובד בכלי בחשבון החינמי שלך,
            ומחזיר ללומדה את התוצר לבדיקה.
          </p>
          <p>עובדים לפי הסדר. מתחילים בלומדה 0, שמכירה את הכלים לפני שעובדים איתם.</p>
          {identity ? (
            <p class="who">
              מחובר כ-<span class="clock" dir="ltr">{maskPn(identity.pn)}</span>, צוות <span class="num">{identity.team}</span>
              <button
                type="button"
                class="btn btn-ghost btn-small"
                onClick={() => {
                  clearIdentity();
                  setIdentity(null);
                  setLibrary([]);
                }}
              >
                לא אני
              </button>
            </p>
          ) : (
            <p class="muted">בכניסה לכל לומדה תתבקש מספר אישי וצוות.</p>
          )}
        </section>

        <section aria-labelledby="h-ready">
          <h2 id="h-ready" class="section-h">
            לומדות פעילות
          </h2>
          <ul class="mod-list">
            {ready.map((m) => {
              const st = identity ? runStatus(identity.pn, m) : { status: 'none' as const, score: null };
              return (
                <li key={m.id}>
                  <a class="mod" href={`${SITE_BASE}${m.slug}/`}>
                    <span class="mod-n clock">{m.id.slice(1)}</span>
                    <span class="mod-body">
                      <span class="mod-title">{m.title}</span>
                      {m.subtitle && <span class="mod-sub">{m.subtitle}</span>}
                      <span class="chips">
                        <Chip>
                          <span class="num">{m.minutes}</span> דק׳
                        </Chip>
                        {st.status === 'done' && (
                          <Chip tone="ok">
                            הושלם{st.score != null ? ` · ${st.score}%` : ''}
                          </Chip>
                        )}
                        {st.status === 'progress' && <Chip tone="warn">בתהליך</Chip>}
                      </span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="h-principles">
          <h2 id="h-principles" class="section-h">
            עקרונות
          </h2>
          <p class="muted">העקרונות של שימוש ב-AI על ידי קצין מטה. לחץ על עיקרון כדי לראות הרחבה ובאיזו לומדה לומדים אותו.</p>
          {PRINCIPLES.map((p) => (
            <details class="why" key={p.title}>
              <summary>{p.title}</summary>
              <p>{p.short}</p>
              <p>{p.body}</p>
              <p class="muted">
                לומדים ב:{' '}
                {p.lessons.map((id, i) => {
                  const m = MODULES.find((x) => x.id === id);
                  return (
                    <span key={id}>
                      {i > 0 && ', '}
                      {m ? <a href={`${SITE_BASE}${m.slug}/`}>{m.title}</a> : id}
                    </span>
                  );
                })}
              </p>
            </details>
          ))}
        </section>

        <section aria-labelledby="h-drafts">
          <h2 id="h-drafts" class="section-h">
            בבנייה
          </h2>
          <p class="muted">המבנה של כל לומדה לפי האפיון. התרגול יתווסף בשלבים הבאים.</p>
          <ul class="mod-list mod-list-compact">
            {drafts.map((m) => (
              <li key={m.id}>
                <a class="mod mod-draft" href={`${SITE_BASE}${m.slug}/`}>
                  <span class="mod-n clock">{m.id.slice(1)}</span>
                  <span class="mod-body">
                    <span class="mod-title">{m.title}</span>
                    <span class="mod-sub">
                      <span class="num">{m.minutes}</span> דק׳ · {m.tools.join(', ')}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        {identity && library.length > 0 && (
          <section aria-labelledby="h-lib">
            <h2 id="h-lib" class="section-h">
              ספריית ההנחיות שלי
            </h2>
            <p class="muted">נשמרות רק במכשיר הזה.</p>
            <ul class="lib">
              {library.map((it) => (
                <li key={it.savedAt} class="lib-item">
                  <p class="lib-title">{it.title}</p>
                  <p class="lib-text">{it.text}</p>
                  <div class="row">
                    <button
                      type="button"
                      class="btn btn-secondary btn-small"
                      onClick={async () => toast((await copyText(it.text)) ? 'הועתק' : 'לא הצלחתי להעתיק')}
                    >
                      העתק
                    </button>
                    <button
                      type="button"
                      class="btn btn-ghost btn-small"
                      onClick={() => {
                        removeFromLibrary(identity.pn, it.savedAt);
                        setLibrary(getLibrary(identity.pn));
                      }}
                    >
                      מחק
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer class="page-foot">
          <ThemeToggle />
          <a class="btn btn-ghost btn-small" href={`${SITE_BASE}staff/`}>
            מעקב סגל
          </a>
        </footer>
      </main>
      <Watermark />
      <Toaster />
    </>
  );
}

applyTheme();
registerServiceWorker();
render(<Home />, document.getElementById('app')!);
