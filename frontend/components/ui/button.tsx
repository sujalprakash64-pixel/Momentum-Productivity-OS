import { ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={clsx(
        "inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line bg-panel2 px-3 text-sm font-medium text-foreground transition hover:border-accent hover:text-accent disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
