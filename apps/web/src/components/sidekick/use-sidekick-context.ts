import { useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { DEFAULT_ONTOLOGY_RID } from '@/api/working-state';
import type { SidekickContext } from '@/api/sidekick';

export function useSidekickContext(): SidekickContext | null {
  const params = useParams<{ rid?: string }>();
  const location = useLocation();

  return useMemo(() => {
    const path = location.pathname;
    const rid = params.rid;

    if (!rid) return null;

    if (path.includes('/object-types/') && path.includes('/properties')) {
      return {
        pageType: 'property_list',
        entityRid: rid,
        ontologyRid: DEFAULT_ONTOLOGY_RID,
      };
    }

    if (path.includes('/object-types/')) {
      return {
        pageType: 'object_type_detail',
        entityRid: rid,
        ontologyRid: DEFAULT_ONTOLOGY_RID,
      };
    }

    if (path.includes('/link-types/')) {
      return {
        pageType: 'link_type_detail',
        entityRid: rid,
        ontologyRid: DEFAULT_ONTOLOGY_RID,
      };
    }

    return null;
  }, [params.rid, location.pathname]);
}
