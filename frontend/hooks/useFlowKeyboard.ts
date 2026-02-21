import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';

interface FlowOption {
  key: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export default function useFlowKeyboard(
  options: FlowOption[],
  backHref?: string
) {
  const router = useRouter();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Ignore if typing in an input/textarea
      const tag = (event.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const key = event.key.toUpperCase();

      // Escape = go back
      if (event.key === 'Escape' && backHref) {
        router.push(backHref);
        return;
      }

      // Letter keys map to options
      const option = options.find((o) => o.key.toUpperCase() === key);
      if (option && !option.disabled) {
        if (option.href) {
          router.push(option.href);
        } else if (option.onClick) {
          option.onClick();
        }
      }
    },
    [options, backHref, router]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
