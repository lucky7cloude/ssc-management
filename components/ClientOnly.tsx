import React, { useState, useEffect } from 'react';

/**
 * ClientOnly wrapper to prevent hydration mismatches.
 * In Vite/CSR projects, this is usually unnecessary but kept for compatibility.
 */
export const ClientOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // During the first render (server-side or initial client pass), return null
  if (!hasMounted) {
    return null;
  }

  return <>{children}</>;
};