import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '@/lib/supabase';
import type { Database, DriverDocumentType, ReviewStatus } from '@/types/database';

type DriverDocumentRow = Database['public']['Tables']['driver_documents']['Row'];

export const REQUIRED_DRIVER_DOCS: DriverDocumentType[] = [
  'drivers_license',
  'vehicle_insurance',
  'vehicle_registration',
  'police_record',
];

export const DRIVER_DOC_LABELS: Record<DriverDocumentType, string> = {
  drivers_license: "Driver's License",
  vehicle_insurance: 'Vehicle Insurance',
  vehicle_registration: 'Vehicle Registration',
  police_record: 'Police Record',
};

export const DRIVER_DOC_ICONS: Record<DriverDocumentType, string> = {
  drivers_license: 'user',
  vehicle_insurance: 'shield-alert',
  vehicle_registration: 'clipboard-list',
  police_record: 'star',
};

export const driverDocumentsApi = createApi({
  reducerPath: 'driverDocumentsApi',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['DriverDocuments'],
  endpoints: (builder) => ({
    /** Fetch all driver documents for a user */
    getDriverDocuments: builder.query<DriverDocumentRow[], string>({
      queryFn: async (profileId) => {
        const { data, error } = await supabase
          .from('driver_documents')
          .select('*')
          .eq('profile_id', profileId)
          .order('document_type');

        if (error)
          return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: (data ?? []) as DriverDocumentRow[] };
      },
      providesTags: (_result, _error, id) => [{ type: 'DriverDocuments', id }],
    }),

    /** Upsert a single driver document (insert or replace) */
    upsertDriverDocument: builder.mutation<
      DriverDocumentRow,
      {
        profileId: string;
        documentType: DriverDocumentType;
        documentUrl: string;
        documentNumber?: string | null;
        expirationDate?: string | null;
      }
    >({
      queryFn: async ({ profileId, documentType, documentUrl, documentNumber, expirationDate }) => {
        const payload: Database['public']['Tables']['driver_documents']['Insert'] = {
          profile_id: profileId,
          document_type: documentType,
          document_url: documentUrl,
          document_number: documentNumber ?? null,
          expiration_date: expirationDate ?? null,
          review_status: 'pending' as ReviewStatus,
          rejection_reason: null,
          reviewed_by: null,
          reviewed_at: null,
          uploaded_at: new Date().toISOString(),
        };

        // Try update first (if exists), then insert
        const { data: existing } = await supabase
          .from('driver_documents')
          .select('id')
          .eq('profile_id', profileId)
          .eq('document_type', documentType)
          .maybeSingle();

        let result;
        if (existing) {
          const { data, error } = await supabase
            .from('driver_documents')
            .update({
              document_url: documentUrl,
              document_number: documentNumber ?? null,
              expiration_date: expirationDate ?? null,
              review_status: 'pending' as ReviewStatus,
              rejection_reason: null,
              reviewed_by: null,
              reviewed_at: null,
              uploaded_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
            .select()
            .single();
          result = { data, error };
        } else {
          const { data, error } = await supabase
            .from('driver_documents')
            .insert(payload)
            .select()
            .single();
          result = { data, error };
        }

        if (result.error)
          return { error: { status: 'CUSTOM_ERROR' as const, error: result.error.message } };
        return { data: result.data as DriverDocumentRow };
      },
      invalidatesTags: (_result, _error, { profileId }) => [
        { type: 'DriverDocuments', id: profileId },
      ],
    }),
  }),
});

/**
 * Check if all required driver documents are approved.
 * Returns true only if all 4 required types exist and are 'approved'.
 */
export function areAllDriverDocsApproved(docs: DriverDocumentRow[]): boolean {
  return REQUIRED_DRIVER_DOCS.every((type) => {
    const doc = docs.find((d) => d.document_type === type);
    return doc?.review_status === 'approved';
  });
}

/**
 * Check if all required driver documents have been uploaded (any status).
 */
export function areAllDriverDocsUploaded(docs: DriverDocumentRow[]): boolean {
  return REQUIRED_DRIVER_DOCS.every((type) =>
    docs.some((d) => d.document_type === type),
  );
}

export const {
  useGetDriverDocumentsQuery,
  useUpsertDriverDocumentMutation,
} = driverDocumentsApi;
