import type { Category } from '@/types/news';
import { Swords, Landmark, TrendingUp, FlaskConical, Globe, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const categoryIcons: Record<Category, LucideIcon> = {
  conflict: Swords,
  politics: Landmark,
  economy: TrendingUp,
  science: FlaskConical,
  environment: Globe,
  society: Users,
};
