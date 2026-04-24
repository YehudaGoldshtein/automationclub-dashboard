import { auth } from "@/auth";

// Next 16 renamed this from `middleware` to `proxy`; this file name is kept for
// Auth.js v5 compatibility (its docs still use middleware.ts). Function is
// identical — gate everything except /login and /api/auth/*.
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  if (!req.auth && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return Response.redirect(url);
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
