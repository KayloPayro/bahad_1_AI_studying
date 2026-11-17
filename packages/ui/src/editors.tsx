import { useEffect, useId, useState } from 'preact/hooks';
import type { NumberIndex } from '@lumda/checkers';
import type { Requirement, Sample } from '@lumda/schema';
import { CheckList, countMet, evaluate, NumberMarks } from './checks';
import { copyText } from './clipboard';
import { toast } from './toast';
import { OpenInTool } from './tools';

export const ASK_FIRST_LINE =
  'לפני שאתה מתחיל, שאל אותי את כל מה שאתה צריך כדי לבצע את זה מצוין. שאלה אחת בכל פעם. אל תניח הנחות.';

/**
 * Prompt editor: the cadet writes, a keyword pre-check shows which requirements the prompt carries, and
 * "העתק ופתח" sends it (optionally with the source document) to the cadet's own AI tool.
 */
export function PromptEditor({
  value,
  onChange,
  requirements = [],
  samples = [],
  askFirst,
  onAskFirst,
  attach,
  onMet,
  placeholder = 'כתוב כאן את ההנחיה',
  checked: checkedInit = false,
  onChecked,
}: {
  value: string;
  onChange: (v: string) => void;
  requirements?: Requirement[];
  samples?: Sample[];
  askFirst?: boolean;
  onAskFirst?: () => void;
  /** Extra text (e.g. the document) appended when copying to the tool. */
  attach?: { label: string; text: string };
  onMet?: (n: number) => void;
  placeholder?: string;
  checked?: boolean;
  onChecked?: (v: boolean) => void;
}) {
  const id = useId();
  const [checked, setChecked] = useState(checkedInit);
  const [withDoc, setWithDoc] = useState(true);
  const ev = evaluate(requirements, value);
  const met = countMet(ev, {});
  const hasAsk = value.includes(ASK_FIRST_LINE);

  // The metric always follows the current text once the cadet has run the check (typing or loading a sample).
  useEffect(() => {
    if (checked) onMet?.(met);
  }, [checked, met]);

  const runCheck = () => {
    setChecked(true);
    onChecked?.(true);
  };
  const fullText = () => (attach && withDoc ? value.trim() + '\n\n' + attach.text : value);

  return (
    <div class="editor">
      <label class="field-label" for={id}>
        ההנחיה שלך
      </label>
      <textarea
        id={id}
        class="textarea"
        rows={8}
        value={value}
        placeholder={placeholder}
        dir="auto"
        onInput={(e) => {
          const v = (e.currentTarget as HTMLTextAreaElement).value;
          onChange(v);
        }}
      />
      <div class="row">
        {requirements.length > 0 && (
          <button type="button" class="btn btn-primary" onClick={runCheck}>
            בדוק מה בהנחיה
          </button>
        )}
        {askFirst && (
          <button
            type="button"
            class="btn btn-secondary"
            disabled={hasAsk}
            onClick={() => {
              onChange((value.trim() ? value.trim() + '\n\n' : '') + ASK_FIRST_LINE);
              onAskFirst?.();
              toast('נוספה בקשה שהכלי ישאל קודם');
            }}
          >
            {hasAsk ? 'הכלי יתבקש לשאול קודם' : 'בקש מהכלי לשאול קודם'}
          </button>
        )}
        {samples.map((s) => (
          <button key={s.label} type="button" class="btn btn-ghost" onClick={() => onChange(s.text)}>
            {s.label}
          </button>
        ))}
      </div>

      {checked && requirements.length > 0 && (
        <div class="result" aria-live="polite">
          <CheckList items={ev} words={['מופיע', 'חסר']} />
          <p class="result-sum">
            בהנחיה מופיעות <strong class="num">{met}</strong> מתוך <span class="num">{requirements.length}</span> הדרישות.
          </p>
          <p class="note">הבדיקה לפי מילות מפתח בלבד. הנחיה יכולה לכלול את המילים ועדיין להיות לא ברורה.</p>
        </div>
      )}

      <div class="send">
        {attach && (
          <label class="inline-check">
            <input type="checkbox" checked={withDoc} onChange={(e) => setWithDoc((e.currentTarget as HTMLInputElement).checked)} />
            לצרף את {attach.label} בהעתקה
          </label>
        )}
        <div class="row">
          <button
            type="button"
            class="btn btn-secondary"
            onClick={async () => {
              if (!value.trim()) return toast('כתוב קודם הנחיה');
              toast((await copyText(fullText())) ? 'ההנחיה הועתקה' : 'לא הצלחתי להעתיק');
            }}
          >
            העתק את ההנחיה
          </button>
        </div>
        <OpenInTool getText={fullText} />
      </div>
    </div>
  );
}

/**
 * Output box: paste what the tool returned, check it against the requirements (auto + manual), and
 * optionally run the number check against the source document.
 */
export function OutputBox({
  value,
  onChange,
  requirements,
  samples = [],
  numberIndex,
  manual,
  onManual,
  onMet,
  label = 'התוצר שקיבלת מהכלי',
  checked: checkedInit = false,
  onChecked,
}: {
  value: string;
  onChange: (v: string) => void;
  requirements: Requirement[];
  samples?: Sample[];
  numberIndex?: NumberIndex;
  manual: Record<string, boolean>;
  onManual: (id: string, v: boolean) => void;
  onMet?: (n: number) => void;
  label?: string;
  checked?: boolean;
  onChecked?: (v: boolean) => void;
}) {
  const id = useId();
  const [checked, setChecked] = useState(checkedInit);
  const [numbers, setNumbers] = useState(false);
  const ev = evaluate(requirements, value);
  const met = countMet(ev, manual);
  const hasText = value.trim().length > 0;

  useEffect(() => {
    if (checked && hasText) onMet?.(met);
  }, [checked, met, hasText]);

  return (
    <div class="editor">
      <label class="field-label" for={id}>
        {label}
      </label>
      <textarea
        id={id}
        class="textarea"
        rows={9}
        value={value}
        placeholder="הדבק כאן"
        dir="auto"
        onInput={(e) => {
          const v = (e.currentTarget as HTMLTextAreaElement).value;
          onChange(v);
        }}
      />
      <div class="row">
        <button
          type="button"
          class="btn btn-primary"
          onClick={() => {
            if (!hasText) return toast('הדבק קודם את התוצר');
            setChecked(true);
            onChecked?.(true);
          }}
        >
          בדוק מול הדרישות
        </button>
        {numberIndex && (
          <button
            type="button"
            class="btn btn-secondary"
            onClick={() => (hasText ? setNumbers(true) : toast('הדבק קודם את התוצר'))}
          >
            בדוק מספרים מול המסמך
          </button>
        )}
        {samples.map((s) => (
          <button
            key={s.label}
            type="button"
            class="btn btn-ghost"
            onClick={() => {
              onChange(s.text);
              setChecked(true);
              onChecked?.(true);
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
      {checked && hasText && (
        <div class="result" aria-live="polite">
          <CheckList
            items={ev}
            manual={manual}
            onManual={onManual}
          />
          <p class="result-sum">
            התוצר עומד ב-<strong class="num">{met}</strong> מתוך <span class="num">{requirements.length}</span> הדרישות.
          </p>
        </div>
      )}
      {numbers && numberIndex && hasText && <NumberMarks index={numberIndex} text={value} />}
      {numberIndex && (
        <p class="note">
          בדיקת המספרים תופסת מספר שלא מופיע במקור. היא לא תופסת מספר ישן, פרט שהושמט או הכללה.
        </p>
      )}
    </div>
  );
}
