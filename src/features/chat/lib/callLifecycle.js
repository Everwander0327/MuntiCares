export function isCallActive(status, currentCallId, requestedCallId) {
  if (currentCallId !== requestedCallId) return false;
  return status === 'connecting' || status === 'connected';
}

export function stopStreamTracks(stream) {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}
