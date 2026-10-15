import type { ButtonHTMLAttributes, Ref } from 'react';
import { cn } from '@/shared/lib';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const variantStyles: Record<Variant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300',
  danger: 'bg-red-50 text-red-600 hover:bg-red-100',
  ghost: 'text-gray-600 hover:bg-gray-100',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({ variant = 'primary', className, ref, ...props }: ButtonProps) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]',
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  );
}
