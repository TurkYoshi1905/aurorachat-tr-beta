import { createContext, useContext, type ReactNode } from 'react';
import { useVoice, type VoiceState } from '@/hooks/useVoice';

const VoiceContext = createContext<VoiceState | null>(null);

export const VoiceProvider = ({ children }: { children: ReactNode }) => {
  const voice = useVoice();
  return <VoiceContext.Provider value={voice}>{children}</VoiceContext.Provider>;
};

export const useVoiceContext = (): VoiceState => {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error('useVoiceContext must be used within VoiceProvider');
  return ctx;
};
