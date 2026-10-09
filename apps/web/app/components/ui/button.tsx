/**
 * Button: the one button component for the whole app.
 *
 *   <Button>Save</Button>
 *   <Button variant="secondary" size="lg">Cancel</Button>
 *   <Button asLink to="/courses">Explore</Button>   (renders a router <Link> styled as a button)
 */
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cn } from '~/lib/cn';

export const buttonVariants = cva(
  'sv-button inline-flex items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-brand-fg hover:bg-brand-hover',
        secondary: 'border border-border-strong bg-surface text-fg hover:bg-surface-muted',
        ghost: 'text-fg-muted hover:bg-surface-muted hover:text-fg',
        danger: 'bg-danger text-danger-fg hover:opacity-90',
      },
      size: {
        sm: 'h-10 px-4 text-sm',
        md: 'h-11 px-5 text-sm',
        lg: 'h-13 px-6 text-base',
        icon: 'size-11',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

type Variants = VariantProps<typeof buttonVariants>;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & Variants & { asLink?: false };
type LinkButtonProps = LinkProps & Variants & { asLink: true };

export function Button(props: ButtonProps | LinkButtonProps) {
  if (props.asLink) {
    const { asLink: _asLink, variant, size, className, ...rest } = props;
    return <Link className={cn(buttonVariants({ variant, size }), className)} {...rest} />;
  }
  const { asLink: _asLink, variant, size, className, type = 'button', ...rest } = props;
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...rest} />
  );
}
