import type { Card } from '@lumda/schema';

/**
 * Hidden-knowledge card. Face down shows only the topic; the cadet flips it when the AI tool asked about it.
 * A real <button> with aria-pressed, so it works by keyboard and screen reader. The flip is a transform
 * transition (interruptible); reduced-motion turns it into a crossfade.
 */
export function FlipCard({
  card,
  flipped,
  onToggle,
  hint = 'הפוך כשהכלי שאל על זה',
  disabled,
}: {
  card: Card;
  flipped: boolean;
  onToggle?: () => void;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      class={'flip' + (flipped ? ' is-flipped' : '')}
      aria-pressed={flipped}
      disabled={disabled}
      onClick={onToggle}
    >
      <span class="flip-inner">
        <span class="flip-face flip-front" aria-hidden={flipped}>
          <span class="flip-topic">{card.topic}</span>
          <span class="flip-hint">{hint}</span>
        </span>
        <span class="flip-face flip-back" aria-hidden={!flipped}>
          <span class="flip-topic">{card.topic}</span>
          <span class="flip-text">{card.text}</span>
        </span>
      </span>
    </button>
  );
}
