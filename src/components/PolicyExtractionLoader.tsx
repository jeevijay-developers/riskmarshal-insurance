import { useEffect, useState } from "react";
import { FileText, Sparkles, CheckCircle2, Loader2 } from "lucide-react";

const steps = [
  { label: "Uploading document...", icon: FileText },
  { label: "AI analyzing policy...", icon: Sparkles },
  { label: "Extracting fields...", icon: Loader2 },
  { label: "Done!", icon: CheckCircle2 },
];

interface PolicyExtractionLoaderProps {
  currentStep: number; // 0-3
}

const PolicyExtractionLoader = ({ currentStep }: PolicyExtractionLoaderProps) => {
  const [scanPosition, setScanPosition] = useState(0);

  useEffect(() => {
    if (currentStep >= 3) return;
    const interval = setInterval(() => {
      setScanPosition((prev) => (prev >= 100 ? 0 : prev + 2));
    }, 30);
    return () => clearInterval(interval);
  }, [currentStep]);

  return (
    <div className="flex flex-col items-center justify-center py-10 space-y-8">
      {/* Document with scanning line */}
      <div className="relative w-32 h-40 bg-muted/50 rounded-lg border-2 border-dashed border-primary/30 flex items-center justify-center overflow-hidden">
        <FileText className="h-12 w-12 text-muted-foreground/40" />
        {currentStep < 3 && (
          <div
            className="absolute left-0 right-0 h-0.5 bg-primary/70 shadow-[0_0_8px_hsl(var(--primary)/0.5)]"
            style={{ top: `${scanPosition}%`, transition: "top 30ms linear" }}
          />
        )}
        {currentStep >= 3 && (
          <div className="absolute inset-0 bg-primary/5 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-primary animate-scale-in" />
          </div>
        )}
      </div>

      {/* AI sparkle animation */}
      <div className="flex items-center gap-3">
        {currentStep < 3 ? (
          <Sparkles className="h-5 w-5 text-primary animate-pulse" />
        ) : (
          <CheckCircle2 className="h-5 w-5 text-primary" />
        )}
        <span className="text-sm font-medium text-foreground">
          {steps[Math.min(currentStep, 3)].label}
        </span>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full transition-all duration-500 ${
                i < currentStep
                  ? "bg-primary scale-100"
                  : i === currentStep
                  ? "bg-primary animate-pulse scale-125"
                  : "bg-muted-foreground/30 scale-100"
              }`}
            />
            {i < steps.length - 1 && (
              <div className={`h-px w-6 transition-colors duration-500 ${i < currentStep ? "bg-primary" : "bg-muted-foreground/20"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {currentStep < 3 && (
        <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full animate-[indeterminate_1.5s_ease-in-out_infinite]" 
               style={{ width: "40%", animation: "indeterminate 1.5s ease-in-out infinite" }} />
        </div>
      )}
    </div>
  );
};

export default PolicyExtractionLoader;
