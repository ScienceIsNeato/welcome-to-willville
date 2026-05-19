/** GET /api/auth/check — returns {mayor: boolean} based on the willville_mayor cookie. */
export const onRequestGet: PagesFunction = async ({ request }) => {
  const cookie = request.headers.get("Cookie") ?? "";
  const mayor = /(^|;\s*)willville_mayor=1\b/.test(cookie);
  return new Response(JSON.stringify({ mayor }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
};
