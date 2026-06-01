import { useEffect, useState } from 'react';
import logoImg from '../assets/logo.jpg';

interface SplashScreenProps {
  steps: { label: string; done: boolean }[];
  allDone: boolean;
  onFinish: () => void;
}

const SplashScreen = ({ steps, allDone, onFinish }: SplashScreenProps) => {
  const [fadeOut, setFadeOut] = useState(false);
  const doneCount = steps.filter(s => s.done).length;
  const progress = steps.length > 0 ? (doneCount / steps.length) * 100 : 0;

  useEffect(() => {
    if (allDone) {
      const timer = setTimeout(() => {
        setFadeOut(true);
        setTimeout(onFinish, 500);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [allDone, onFinish]);

  return (
    <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      {/* Animated aurora gradient blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-aurora-glow/8 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-aurora-purple/8 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '0.8s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-aurora-green/6 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '1.6s' }} />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-10">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden shadow-lg">
              <img
                src={logoImg}
                alt="AuroraChat Logo"
                className="w-14 h-14 object-contain dark:invert"
              />
            </div>
            <div className="absolute inset-0 rounded-2xl bg-primary/5 blur-xl" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">AuroraChat</h1>
        </div>

        {/* Progress bar */}
        <div className="w-64 space-y-3">
          <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Current step label */}
          <div className="text-center min-h-[20px]">
            {steps.map((step, i) => {
              const isActive = !step.done && (i === 0 || steps[i - 1]?.done);
              if (!isActive && !(!allDone && step === steps[steps.length - 1] && doneCount === steps.length - 1)) return null;
              return (
                <p key={i} className="text-xs text-muted-foreground animate-pulse truncate">{step.label}</p>
              );
            })}
            {allDone && (
              <p className="text-xs text-status-online font-medium">Hazır!</p>
            )}
          </div>
        </div>

        {/* Step dots */}
        <div className="flex items-center gap-2">
          {steps.map((step, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                step.done
                  ? 'w-2 h-2 bg-primary'
                  : 'w-1.5 h-1.5 bg-muted-foreground/30'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
