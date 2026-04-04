import { useMemo } from 'react';
import { Converter } from 'opencc-js';

// Lazy-init: converter creation is expensive, share a single instance
let _converter: ((s: string) => string) | null = null;
function getConverter(): (s: string) => string {
  if (_converter === null) {
    _converter = Converter({ from: 'hk', to: 'cn' });
  }
  return _converter!;
}

export function useSimplify(enabled: boolean): (s: string) => string {
  return useMemo(() => {
    if (!enabled) return (s: string) => s;
    const convert = getConverter();
    return (s: string) => convert(s);
  }, [enabled]);
}
