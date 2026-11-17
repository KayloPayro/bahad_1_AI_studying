import { SITE_BASE } from '@lumda/config';

/** The course symbol is white line art, so it sits on the accent badge in both themes. */
export function Logo() {
  return (
    <span class="logo" aria-hidden="true">
      <img src={`${SITE_BASE}icons/symbol.svg`} alt="" width="40" height="40" />
    </span>
  );
}
