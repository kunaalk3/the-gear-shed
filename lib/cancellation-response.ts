export function buildCancellationResponse<T extends { id: string; status: string }>(
  request: T,
  refundsPending: boolean
) {
  return {
    request: {
      id: request.id,
      status: request.status,
    },
    refundsPending,
  };
}
