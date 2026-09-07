import { useEffect } from 'react';

const DEFAULT_TITLE = 'CardXC — Digital Wallet, Payments & Gift Cards';
const DEFAULT_DESCRIPTION = 'CardXC is a digital wallet and payments platform operated by CARDXC LLC, with wallet management, payment workflows, virtual-card experiences, gift cards, transaction tracking, and security controls. Feature availability depends on eligibility, provider configuration, geography, and compliance requirements.';

interface SEOHeadProps {
  title: string;
  description?: string;
  noindex?: boolean;
}

export default function SEOHead({ title, description, noindex }: SEOHeadProps) {
  useEffect(() => {
    document.title = title;

    const descMeta = document.querySelector('meta[name="description"]');
    if (description && descMeta) {
      descMeta.setAttribute('content', description);
    }

    const robotsMeta = document.querySelector('meta[name="robots"]');
    if (noindex && robotsMeta) {
      robotsMeta.setAttribute('content', 'noindex, nofollow');
    }

    return () => {
      document.title = DEFAULT_TITLE;
      if (description && descMeta) {
        descMeta.setAttribute('content', DEFAULT_DESCRIPTION);
      }
      if (noindex && robotsMeta) {
        robotsMeta.setAttribute('content', 'index, follow');
      }
    };
  }, [title, description, noindex]);

  return null;
}
