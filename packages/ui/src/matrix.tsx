import { Rich } from './rich';

export interface MatrixCell {
  /** What the cell belongs to, e.g. "סבב 2" or "משפט אחד". */
  head: string;
  /** ok / bad get a ✓ / ✕ mark; na is neutral. The status is always also written in words. */
  tone: 'ok' | 'bad' | 'na';
  text: string;
}

export interface MatrixRow {
  id: string;
  label: string;
  /** One small line under the label, e.g. where the detail entered the prompt. */
  note?: string;
  cells: MatrixCell[];
}

/**
 * Rows of results side by side: one label, several statuses. Used to compare two attempts (L03) or to follow
 * one property across rounds (L04). Mobile first: cells wrap under the label.
 */
export function Matrix({ rows, label }: { rows: MatrixRow[]; label: string }) {
  return (
    <ul class="matrix" aria-label={label}>
      {rows.map((r) => (
        <li key={r.id} class="matrix-row">
          <p class="matrix-label">
            <Rich text={r.label} />
          </p>
          {r.note && <p class="matrix-note">{r.note}</p>}
          <div class="matrix-cells">
            {r.cells.map((c) => (
              <span key={c.head} class="matrix-cell">
                <span class="matrix-head">{c.head}</span>
                <span class={'status status-' + c.tone}>{c.text}</span>
              </span>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
