import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';

interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  alert?: boolean;
  warning?: boolean;
  icon?: React.ElementType;
  className?: string;
  hero?: boolean;
}

export default function MetricCard({
  label,
  value,
  subValue,
  trend,
  trendValue,
  alert,
  warning,
  icon: Icon,
  className = '',
  hero = false,
}: MetricCardProps) {
  const cardBg = alert
    ? 'bg-red-500/5 border-red-500/20'
    : warning
      ? 'bg-amber-500/5 border-amber-500/20'
      : 'bg-card border-border';

  const valuColor = alert ? 'text-red-400' : warning ? 'text-amber-400' : 'text-foreground';

  return (
    <div className={`rounded-xl border p-5 flex flex-col gap-3 ${cardBg} ${className}`}>
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold tracking-widest uppercase text-muted-foreground">
          {label}
        </p>
        {Icon && (
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center
            ${alert ? 'bg-red-500/10' : warning ? 'bg-amber-500/10' : 'bg-primary/10'}`}
          >
            <Icon
              size={16}
              className={alert ? 'text-red-400' : warning ? 'text-amber-400' : 'text-primary'}
            />
          </div>
        )}
      </div>
      <div>
        <p className={`tabular-nums font-bold ${hero ? 'text-4xl' : 'text-3xl'} ${valuColor}`}>
          {value}
        </p>
        {subValue && <p className="text-[12px] text-muted-foreground mt-1">{subValue}</p>}
      </div>
      {(trend || trendValue) && (
        <div className="flex items-center gap-1.5">
          {trend === 'up' && (
            <TrendingUp size={13} className={alert ? 'text-red-400' : 'text-emerald-400'} />
          )}
          {trend === 'down' && (
            <TrendingDown size={13} className={alert ? 'text-emerald-400' : 'text-red-400'} />
          )}
          {trend === 'neutral' && <Minus size={13} className="text-muted-foreground" />}
          {trendValue && <span className="text-[11px] text-muted-foreground">{trendValue}</span>}
        </div>
      )}
    </div>
  );
}
