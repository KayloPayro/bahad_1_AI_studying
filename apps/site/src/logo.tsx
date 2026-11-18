import { Emblem } from '@lumda/ui';

/** The Bahad 1 symbol at header size. Decorative: the title next to it names the page. */
export function Logo() {
  return (
    <span class="logo" aria-hidden="true">
      <Emblem size={88} />
    </span>
  );
}
