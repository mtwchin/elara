import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  size?: number;
  className?: string;
}

export default function Spinner({ size = 16, className = '' }: SpinnerProps) {
  return <Loader2 size={size} className={`spinner ${className}`} />;
}
