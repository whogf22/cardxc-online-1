import { useEffect } from 'react';

const DEFAULT_TITLE = 'CardXC — Send Money Worldwide & Buy Gift Cards';
const DEFAULT_DESCRIPTION = 'CardXC is a fintech platform for virtual payment cards. Bank-grade security, fast global payments, real-time rates, and 24/7 support. Manage your digital spending with VISA and Mastercard.';

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
