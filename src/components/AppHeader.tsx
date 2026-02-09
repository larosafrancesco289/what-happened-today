"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';
import LanguageSelector from './LanguageSelector';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslations } from '@/lib/i18n';

const activeStyle = 'text-accent-light dark:text-accent-dark';
const inactiveStyle = 'text-subtle-light/50 dark:text-subtle-dark/50 hover:text-subtle-light dark:hover:text-subtle-dark';

interface NavLinkProps {
  href: string;
  label: string;
  active: boolean;
}

function NavLink({ href, label, active }: NavLinkProps) {
  return (
    <Link
      href={href}
      className={`relative px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] transition-colors duration-300 ${
        active ? activeStyle : inactiveStyle
      }`}
    >
      {label}
      {active && (
        <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-accent-light dark:bg-accent-dark" />
      )}
    </Link>
  );
}

export default function AppHeader() {
  const pathname = usePathname();
  const { currentLanguage } = useLanguage();
  const t = getTranslations(currentLanguage.code);

  const isWeekly = pathname === '/weekly';

  return (
    <header className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
      <div className="flex items-center justify-between">
        <nav className="flex items-center gap-1">
          <NavLink href="/" label={t.navigation.today} active={!isWeekly} />
          <span className="text-border-light/40 dark:text-border-dark/40 text-xs select-none">/</span>
          <NavLink href="/weekly" label={t.weekly.subtitle} active={isWeekly} />
        </nav>

        <div className="flex items-center gap-3">
          <LanguageSelector />
          <div className="w-px h-6 bg-border-light/50 dark:bg-border-dark/50" />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
