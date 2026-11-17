import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Request } from 'express';
import firebaseConfig from '../firebase-applet-config.json';

const FIREBASE_JWKS = createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
  )
);

export interface VerifiedActor {
  uid: string;
  email: string | null;
  emailVerified: boolean;
}

export async function verifyFirebaseRequest(
  req: Request
): Promise<VerifiedActor | null> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token || token.length > 8192) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
      issuer: `https://securetoken.google.com/${firebaseConfig.projectId}`,
      audience: firebaseConfig.projectId,
    });

    const uid = typeof payload.sub === 'string' ? payload.sub : '';
    if (!uid) {
      return null;
    }

    return {
      uid,
      email: typeof payload.email === 'string' ? payload.email : null,
      emailVerified: payload.email_verified === true,
    };
  } catch {
    return null;
  }
}
