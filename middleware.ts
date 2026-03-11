import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/auth';

export async function middleware(request: NextRequest) {
    const token = request.cookies.get('auth-token')?.value;

    // Protect specific paths including the root dashboard
    const isProtectedPath =
        request.nextUrl.pathname.startsWith('/db-admin') ||
        request.nextUrl.pathname.startsWith('/db-explorer') ||
        request.nextUrl.pathname.startsWith('/users-admin') ||
        request.nextUrl.pathname.startsWith('/activity-logs') ||
        request.nextUrl.pathname === '/';

    const isLoginPage = request.nextUrl.pathname === '/login';

    // Verify token if user tries to access protected path
    if (isProtectedPath) {
        if (!token) {
            return NextResponse.redirect(new URL('/login', request.url));
        }

        const payload = await verifyToken(token);

        if (!payload) {
            // Invalid or expired token, redirect to login
            const response = NextResponse.redirect(new URL('/login', request.url));
            response.cookies.delete('auth-token');
            return response;
        }
    }

    // If logged in and visits /login, redirect to root dashboard
    if (isLoginPage && token) {
        const payload = await verifyToken(token);
        if (payload) {
            return NextResponse.redirect(new URL('/', request.url));
        }
    }

    return NextResponse.next();
}

// Config to apply middleware to specific routes
export const config = {
    matcher: ['/', '/db-admin/:path*', '/db-explorer/:path*', '/users-admin/:path*', '/activity-logs/:path*', '/login'],
};
