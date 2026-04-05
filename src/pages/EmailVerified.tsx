import { CheckCircle2 } from "lucide-react";

export default function EmailVerified() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center space-y-5 shadow-xl">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground mb-2">E-posta Doğrulandı!</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            E-posta adresiniz başarıyla doğrulandı. Bu sekmeyi kapatıp uygulamaya dönebilirsiniz.
          </p>
        </div>
        <div className="pt-2">
          <a
            href="/"
            className="inline-flex items-center justify-center w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Uygulamaya Dön
          </a>
        </div>
      </div>
    </div>
  );
}
