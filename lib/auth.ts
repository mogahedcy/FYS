import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const secretKey = process.env.JWT_SECRET
    ? new TextEncoder().encode(process.env.JWT_SECRET)
    : new TextEncoder().encode('your-very-secret-key-next-auth-appdeyar');

export async function createToken(payload: any) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('12h') // Token expires in 12 hours
        .sign(secretKey);
}

export async function verifyToken(token: string) {
    try {
        const { payload } = await jwtVerify(token, secretKey);
        return payload;
    } catch (error) {
        return null; // Invalid or expired token
    }
}

export async function getSession() {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) return null;
    return await verifyToken(token);
}
