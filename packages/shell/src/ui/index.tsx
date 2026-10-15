import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Screen({ title, right, children }: { title?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="screen">
      {(title || right) && (
        <header className="screen__header">
          {title && <h1 className="screen__title">{title}</h1>}
          {right}
        </header>
      )}
      {children}
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' };

export function Button({ variant = 'primary', className = '', ...props }: BtnProps) {
  const v = variant === 'primary' ? '' : `btn--${variant}`;
  return <button className={`btn ${v} ${className}`.trim()} {...props} />;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`.trim()}>{children}</div>;
}
