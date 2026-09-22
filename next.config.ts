import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/', destination: '/en', permanent: false },
      // Links from the previous version of the site.
      { source: '/:date(\\d{4}-\\d{2}-\\d{2})', destination: '/en/:date', permanent: true },
      { source: '/weekly', destination: '/en', permanent: true },
    ];
  },
};

export default nextConfig;
