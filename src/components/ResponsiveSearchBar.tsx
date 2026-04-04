import { ReactNode, useEffect, useState } from "react";
import { Search, X } from "lucide-react";

import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ResponsiveSearchBarProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  children?: ReactNode;
  className?: string;
  desktopInputWidthClassName?: string;
}

export function ResponsiveSearchBar({
  value,
  onValueChange,
  placeholder,
  children,
  className,
  desktopInputWidthClassName,
}: ResponsiveSearchBarProps) {
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  const hasValue = value.trim().length > 0;

  if (isMobile) {
    return (
      <div className={cn("w-full space-y-2", className)}>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={mobileOpen || hasValue ? "secondary" : "outline"}
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => setMobileOpen((prev) => !prev)}
          >
            <Search className="h-4 w-4" />
            <span className="sr-only">Toggle search</span>
          </Button>
          {(mobileOpen || hasValue) && (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus={mobileOpen}
                placeholder={placeholder}
                className="pl-9"
                value={value}
                onChange={(e) => onValueChange(e.target.value)}
              />
            </div>
          )}
          {(mobileOpen || hasValue) && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => {
                setMobileOpen(false);
                onValueChange("");
              }}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Clear search</span>
            </Button>
          )}
        </div>
        {mobileOpen && children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className={cn("relative w-full md:w-72", desktopInputWidthClassName)}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          className="pl-9"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
        />
      </div>
      {children}
    </div>
  );
}
