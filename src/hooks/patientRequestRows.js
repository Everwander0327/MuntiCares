const DEFAULT_LOCATION = 'Muntinlupa City';

export function formatRequestRow(req, locationMap = {}) {
  return {
    id: req.id,
    patientId: req.patient_id,
    providerId: req.provider_id,
    provider: req.provider?.full_name || 'Unknown',
    providerAvatarUrl: req.provider?.avatar_url || '',
    service: req.service,
    date: req.date,
    time: req.time,
    status: req.status,
    location: locationMap[req.provider_id] || req.provider?.location || DEFAULT_LOCATION,
    originalNotes: req.notes || '',
    durationMinutes: req.duration_minutes ?? null,
    destLat: req.dest_lat ?? null,
    destLng: req.dest_lng ?? null,
    destAddress: req.dest_address ?? null,
    destSource: req.dest_source ?? null,
    destVersion: req.dest_version ?? 0,
    destUpdatedAt: req.dest_updated_at ?? null,
    routeStartedAt: req.route_started_at ?? null,
    arrivedAt: req.arrived_at ?? null,
  };
}

export function mergeRequestRow(existing, newRow) {
  const resolvedProvider =
    newRow.provider?.full_name ||
    newRow.provider_name ||
    (existing.provider && existing.provider !== 'Unknown' ? existing.provider : 'Unknown');

  return {
    ...existing,
    id: newRow.id,
    patientId: newRow.patient_id ?? existing.patientId,
    providerId: newRow.provider_id ?? existing.providerId,
    provider: resolvedProvider,
    providerAvatarUrl: newRow.provider?.avatar_url || existing.providerAvatarUrl || '',
    service: newRow.service ?? existing.service,
    date: newRow.date ?? existing.date,
    time: newRow.time ?? existing.time,
    status: newRow.status ?? existing.status,
    location: newRow.provider?.location || (existing.location && existing.location !== DEFAULT_LOCATION ? existing.location : DEFAULT_LOCATION),
    originalNotes: newRow.notes ?? existing.originalNotes ?? '',
    durationMinutes: newRow.duration_minutes !== undefined ? newRow.duration_minutes : existing.durationMinutes,
    destLat: newRow.dest_lat !== undefined ? newRow.dest_lat : existing.destLat,
    destLng: newRow.dest_lng !== undefined ? newRow.dest_lng : existing.destLng,
    destAddress: newRow.dest_address !== undefined ? newRow.dest_address : existing.destAddress,
    destSource: newRow.dest_source !== undefined ? newRow.dest_source : existing.destSource,
    destVersion: newRow.dest_version !== undefined ? newRow.dest_version : existing.destVersion,
    destUpdatedAt: newRow.dest_updated_at !== undefined ? newRow.dest_updated_at : existing.destUpdatedAt,
    routeStartedAt: newRow.route_started_at !== undefined ? newRow.route_started_at : existing.routeStartedAt,
    arrivedAt: newRow.arrived_at !== undefined ? newRow.arrived_at : existing.arrivedAt,
  };
}
