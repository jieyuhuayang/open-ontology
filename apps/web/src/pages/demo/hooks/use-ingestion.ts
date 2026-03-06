import { useState, useCallback, useRef } from 'react';
import type { IngestionPhase } from '../types';
import { getIngestionResult } from '../mock/mock-ingestion-results';
import type { DemoObjectType, DemoLinkType } from '../types';

interface IngestionState {
  phase: IngestionPhase;
  fileName: string | null;
  result: { objectTypes: DemoObjectType[]; linkTypes: DemoLinkType[] } | null;
}

const PHASE_DURATIONS: Record<string, number> = {
  ABSORBING: 1500,
  PROCESSING: 2000,
  CRYSTALLIZING: 2000,
};

export function useIngestion(
  onComplete: (objectTypes: DemoObjectType[], linkTypes: DemoLinkType[]) => void,
) {
  const [state, setState] = useState<IngestionState>({
    phase: 'IDLE',
    fileName: null,
    result: null,
  });
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const startIngestion = useCallback(
    (fileName: string) => {
      if (state.phase !== 'IDLE') return;

      const result = getIngestionResult(fileName);

      setState({ phase: 'ABSORBING', fileName, result });

      timeoutRef.current = setTimeout(() => {
        setState((s) => ({ ...s, phase: 'PROCESSING' }));

        timeoutRef.current = setTimeout(() => {
          setState((s) => ({ ...s, phase: 'CRYSTALLIZING' }));

          timeoutRef.current = setTimeout(() => {
            setState((s) => ({ ...s, phase: 'COMPLETE' }));
            onComplete(result.objectTypes, result.linkTypes);
          }, PHASE_DURATIONS.CRYSTALLIZING);
        }, PHASE_DURATIONS.PROCESSING);
      }, PHASE_DURATIONS.ABSORBING);
    },
    [state.phase, onComplete],
  );

  const reset = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setState({ phase: 'IDLE', fileName: null, result: null });
  }, []);

  return {
    phase: state.phase,
    fileName: state.fileName,
    startIngestion,
    reset,
  };
}
