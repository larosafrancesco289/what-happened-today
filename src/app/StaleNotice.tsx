'use client';

import { useEffect, useState } from 'react';

/** The page is built ahead of time, so only the reader's browser knows whether this edition is still today's. */
export default function StaleNotice({ date, message }: { date: string; message: string }) {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in the reader's timezone
    setStale(date < today);
  }, [date]);

  return stale ? <p className="notice">{message}</p> : null;
}
