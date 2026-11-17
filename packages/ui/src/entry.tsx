import { useId, useState } from 'preact/hooks';
import { config } from '@lumda/config';
import { clearIdentity, getIdentity, maskPn, setIdentity, validatePn, type Identity } from '@lumda/tracking';

/**
 * Entry: personal number + team. Not authentication — a progress tag. On a returning device it offers
 * "ממשיך כ-XXXX493" with "לא אני", so a shared classroom device works without retyping.
 */
export function EntryScreen({ onReady, context }: { onReady: (id: Identity) => void; context?: string }) {
  const existing = getIdentity();
  const [mode, setMode] = useState<'continue' | 'form'>(existing ? 'continue' : 'form');
  const [pn, setPn] = useState('');
  const [team, setTeam] = useState('');
  const [touched, setTouched] = useState({ pn: false, team: false });
  const pnId = useId();
  const teamId = useId();
  const pnErr = validatePn(pn, config.PN_LENGTH);
  const teamErr = team ? null : 'בחר צוות מהרשימה';

  if (mode === 'continue' && existing) {
    return (
      <section class="entry card" aria-labelledby="entry-h">
        <h1 id="entry-h" class="entry-title">
          {context ?? config.SITE_TITLE}
        </h1>
        <p class="entry-continue">
          ממשיך כ-<span class="clock" dir="ltr">{maskPn(existing.pn)}</span>, צוות <span class="num">{existing.team}</span>
        </p>
        <div class="row">
          <button type="button" class="btn btn-primary" onClick={() => onReady(existing)}>
            המשך
          </button>
          <button
            type="button"
            class="btn btn-secondary"
            onClick={() => {
              clearIdentity();
              setMode('form');
            }}
          >
            לא אני
          </button>
        </div>
      </section>
    );
  }

  return (
    <section class="entry card" aria-labelledby="entry-h">
      <h1 id="entry-h" class="entry-title">
        {context ?? config.SITE_TITLE}
      </h1>
      <p class="muted">לפני שמתחילים: מספר אישי וצוות. זה רק לתיוג ההתקדמות, אין סיסמה.</p>
      <form
        class="form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setTouched({ pn: true, team: true });
          if (pnErr) {
            document.getElementById(pnId)?.focus();
            return;
          }
          if (teamErr) {
            document.getElementById(teamId)?.focus();
            return;
          }
          const id = { pn, team };
          setIdentity(id);
          onReady(id);
        }}
      >
        <div class="field">
          <label class="field-label" for={pnId}>
            מספר אישי
          </label>
          <input
            id={pnId}
            class="input clock"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            enterKeyHint="next"
            dir="ltr"
            maxLength={config.PN_LENGTH + 3}
            value={pn}
            aria-invalid={touched.pn && Boolean(pnErr)}
            aria-describedby={pnId + '-help ' + pnId + '-err'}
            onInput={(e) => setPn((e.currentTarget as HTMLInputElement).value)}
            onBlur={() => setTouched((t) => ({ ...t, pn: true }))}
          />
          <span id={pnId + '-help'} class="field-help">
            {config.PN_LENGTH} ספרות
          </span>
          <span id={pnId + '-err'} class="field-error" role="alert">
            {touched.pn && pnErr ? pnErr : ''}
          </span>
        </div>
        <div class="field">
          <label class="field-label" for={teamId}>
            צוות
          </label>
          <select
            id={teamId}
            class="input"
            value={team}
            aria-invalid={touched.team && Boolean(teamErr)}
            aria-describedby={teamId + '-err'}
            onChange={(e) => setTeam((e.currentTarget as HTMLSelectElement).value)}
            onBlur={() => setTouched((t) => ({ ...t, team: true }))}
          >
            <option value="">בחר צוות</option>
            {config.TEAMS.map((t) => (
              <option key={t} value={t}>
                צוות {t}
              </option>
            ))}
          </select>
          <span id={teamId + '-err'} class="field-error" role="alert">
            {touched.team && teamErr ? teamErr : ''}
          </span>
        </div>
        <button type="submit" class="btn btn-primary btn-block">
          כניסה
        </button>
      </form>
    </section>
  );
}
