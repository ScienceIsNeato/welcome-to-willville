/** GET /api/auth/check — always returns true. */
export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ mayor: true }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
};
