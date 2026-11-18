import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const DEFAULT_STATE = {
  loading: true,
  isProfileComplete: false,
  isApproved: false,
  professionalIdStatus: 'none',
  professionalIdPaths: [],
};

export function useProviderVerification() {
  const { user } = useAuth();
  const [status, setStatus] = useState(DEFAULT_STATE);

  const fetchStatus = useCallback(async () => {
    if (!user?.id || user?.role !== 'provider') {
      setStatus({ ...DEFAULT_STATE, loading: false });
      return;
    }
    try {
      const { data, error } = await supabase
        .from('providers')
        .select('is_profile_complete, is_approved, professional_id_status, professional_id_paths')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      setStatus({
        loading: false,
        isProfileComplete: Boolean(data?.is_profile_complete),
        isApproved: Boolean(data?.is_approved),
        professionalIdStatus: data?.professional_id_status || 'none',
        professionalIdPaths: Array.isArray(data?.professional_id_paths) ? data.professional_id_paths : [],
      });
    } catch {
      setStatus((prev) => ({ ...prev, loading: false }));
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!user?.id || user?.role !== 'provider') return undefined;
    const channel = supabase
      .channel(`provider-verification-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'providers',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload?.new;
          if (!row) {
            fetchStatus();
            return;
          }
          setStatus({
            loading: false,
            isProfileComplete: Boolean(row.is_profile_complete),
            isApproved: Boolean(row.is_approved),
            professionalIdStatus: row.professional_id_status || 'none',
            professionalIdPaths: Array.isArray(row.professional_id_paths) ? row.professional_id_paths : [],
          });
        }
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [user?.id, user?.role, fetchStatus]);

  return {
    ...status,
    canHandleCareRequests: status.isApproved,
    refresh: fetchStatus,
  };
}
