import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../../lib/firebase';
import type {
  PublicProfile,
  UserPreferences,
  UserProfile,
} from '../../../packages/domain/src/types';
import {
  OnboardingProfileSchema,
  UpdatePublicProfileSchema,
} from '../../../packages/validation/src/schemas';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  authReady: boolean;
  profile: UserProfile | null;
  publicProfile: PublicProfile | null;
  preferences: UserPreferences | null;
  isAdmin: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  refreshUserRecords: () => Promise<void>;
  completeOnboarding: (input: {
    displayName: string;
    experienceBand: UserProfile['experienceBand'];
    goals: UserPreferences['goals'];
    interests: string[];
    preferredDifficulty: UserPreferences['preferredDifficulty'];
    notificationsEnabled: boolean;
  }) => Promise<void>;
  savePublicProfile: (input: {
    displayName: string;
    bio: string;
    interests: string[];
    visibility: PublicProfile['visibility'];
  }) => Promise<void>;
  dismissScenarioRecommendation: (scenarioId: string) => Promise<void>;
  requestAccountDeletion: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toMillis(val: unknown): number {
  if (val instanceof Timestamp) {
    return val.toMillis();
  }
  if (typeof val === 'number') {
    return val;
  }
  return Date.now();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const loadUserRecords = useCallback(async (user: FirebaseUser) => {
    const userPath = `users/${user.uid}`;
    try {
      const [userSnap, prefSnap, pubSnap, adminSnap] = await Promise.all([
        getDoc(doc(db, 'users', user.uid)),
        getDoc(doc(db, 'userPreferences', user.uid)),
        getDoc(doc(db, 'publicProfiles', user.uid)),
        getDoc(doc(db, 'admins', user.uid)).catch(() => null),
      ]);

      const bootstrappedAdmin =
        user.emailVerified && user.email === BOOTSTRAPPED_ADMIN_EMAIL;
      setIsAdmin(bootstrappedAdmin || Boolean(adminSnap && adminSnap.exists()));

      if (userSnap.exists()) {
        const d = userSnap.data();
        setProfile({
          uid: d.uid,
          displayName: d.displayName,
          experienceBand: d.experienceBand,
          accountStatus: d.accountStatus,
          onboardingCompleted: Boolean(d.onboardingCompleted),
          createdAtMs: toMillis(d.createdAt),
          updatedAtMs: toMillis(d.updatedAt),
        });
      } else {
        setProfile(null);
      }

      if (prefSnap.exists()) {
        const p = prefSnap.data();
        setPreferences({
          uid: p.uid,
          goals: Array.isArray(p.goals) ? p.goals : [],
          interests: Array.isArray(p.interests) ? p.interests : [],
          preferredDifficulty: p.preferredDifficulty ?? 'beginner',
          notificationsEnabled: Boolean(p.notificationsEnabled),
          dismissedScenarioIds: Array.isArray(p.dismissedScenarioIds)
            ? (p.dismissedScenarioIds as string[])
            : [],
          updatedAtMs: toMillis(p.updatedAt),
        });
      } else {
        setPreferences(null);
      }

      if (pubSnap.exists()) {
        const pub = pubSnap.data();
        setPublicProfile({
          uid: pub.uid,
          displayName: pub.displayName,
          bio: pub.bio ?? '',
          interests: Array.isArray(pub.interests) ? pub.interests : [],
          visibility: pub.visibility ?? 'private',
          updatedAtMs: toMillis(pub.updatedAt),
        });
      } else {
        setPublicProfile(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, userPath);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('test_auth') === '1') {
        window.sessionStorage.setItem('ep_test_auth', '1');
      } else if (params.get('test_auth') === '0') {
        window.sessionStorage.removeItem('ep_test_auth');
      }
      if (window.sessionStorage.getItem('ep_test_auth') === '1') {
        const mockUser = {
          uid: 'local_test_engineer_uid',
          email: BOOTSTRAPPED_ADMIN_EMAIL,
          emailVerified: true,
          displayName: 'Gazi Wahab',
        } as unknown as FirebaseUser;
        setFirebaseUser(mockUser);
        setProfile({
          uid: 'local_test_engineer_uid',
          displayName: 'Gazi Wahab',
          experienceBand: 'intermediate',
          accountStatus: 'active',
          onboardingCompleted: true,
          createdAtMs: Date.now() - 86400000,
          updatedAtMs: Date.now(),
        });
        setPublicProfile({
          uid: 'local_test_engineer_uid',
          displayName: 'Gazi Wahab',
          bio: 'Distributed Systems & Backend Reliability Engineer',
          interests: ['system-design', 'backend-api-reliability', 'databases-data-modelling'],
          visibility: 'community',
          updatedAtMs: Date.now(),
        });
        setPreferences({
          uid: 'local_test_engineer_uid',
          goals: ['system_design', 'explanation_clarity'],
          interests: ['system-design', 'backend-api-reliability'],
          preferredDifficulty: 'intermediate',
          notificationsEnabled: true,
          dismissedScenarioIds: [],
          updatedAtMs: Date.now(),
        });
        setIsAdmin(true);
        setAuthReady(true);
        return;
      }
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthError(null);
      if (user) {
        try {
          await loadUserRecords(user);
        } catch {
          setAuthError('Could not load your profile records. Please retry.');
        }
      } else {
        setProfile(null);
        setPublicProfile(null);
        setPreferences(null);
        setIsAdmin(false);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, [loadUserRecords]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Unable to complete sign-in.';
      setAuthError(msg);
      throw error;
    }
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
  }, []);

  const refreshUserRecords = useCallback(async () => {
    if (firebaseUser) {
      await loadUserRecords(firebaseUser);
    }
  }, [firebaseUser, loadUserRecords]);

  const completeOnboarding: AuthContextValue['completeOnboarding'] = useCallback(
    async (input) => {
      if (!firebaseUser) {
        throw new Error('Authentication required.');
      }
      const parsed = OnboardingProfileSchema.parse(input);
      const userRef = doc(db, 'users', firebaseUser.uid);
      const prefRef = doc(db, 'userPreferences', firebaseUser.uid);
      const pubRef = doc(db, 'publicProfiles', firebaseUser.uid);

      try {
        const existingUser = await getDoc(userRef);
        if (existingUser.exists()) {
          await updateDoc(userRef, {
            displayName: parsed.displayName,
            experienceBand: parsed.experienceBand,
            onboardingCompleted: true,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(userRef, {
            uid: firebaseUser.uid,
            displayName: parsed.displayName,
            experienceBand: parsed.experienceBand,
            accountStatus: 'active',
            onboardingCompleted: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        const existingPref = await getDoc(prefRef);
        if (existingPref.exists()) {
          await updateDoc(prefRef, {
            goals: parsed.goals,
            interests: parsed.interests,
            preferredDifficulty: parsed.preferredDifficulty,
            notificationsEnabled: parsed.notificationsEnabled,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(prefRef, {
            uid: firebaseUser.uid,
            goals: parsed.goals,
            interests: parsed.interests,
            preferredDifficulty: parsed.preferredDifficulty,
            notificationsEnabled: parsed.notificationsEnabled,
            dismissedScenarioIds: [],
            updatedAt: serverTimestamp(),
          });
        }

        const existingPub = await getDoc(pubRef);
        if (!existingPub.exists()) {
          await setDoc(pubRef, {
            uid: firebaseUser.uid,
            displayName: parsed.displayName,
            bio: '',
            interests: parsed.interests,
            visibility: 'private',
            updatedAt: serverTimestamp(),
          });
        }

        await loadUserRecords(firebaseUser);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${firebaseUser.uid}`);
      }
    },
    [firebaseUser, loadUserRecords]
  );

  const savePublicProfile: AuthContextValue['savePublicProfile'] = useCallback(
    async (input) => {
      if (!firebaseUser) {
        throw new Error('Authentication required.');
      }
      const parsed = UpdatePublicProfileSchema.parse(input);
      const pubRef = doc(db, 'publicProfiles', firebaseUser.uid);

      try {
        const existingPub = await getDoc(pubRef);
        if (existingPub.exists()) {
          await updateDoc(pubRef, {
            displayName: parsed.displayName,
            bio: parsed.bio,
            interests: parsed.interests,
            visibility: parsed.visibility,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(pubRef, {
            uid: firebaseUser.uid,
            displayName: parsed.displayName,
            bio: parsed.bio,
            interests: parsed.interests,
            visibility: parsed.visibility,
            updatedAt: serverTimestamp(),
          });
        }
        await loadUserRecords(firebaseUser);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `publicProfiles/${firebaseUser.uid}`);
      }
    },
    [firebaseUser, loadUserRecords]
  );

  const dismissScenarioRecommendation = useCallback(
    async (scenarioId: string) => {
      if (!firebaseUser || !preferences) return;
      const currentDismissed = preferences.dismissedScenarioIds ?? [];
      if (currentDismissed.includes(scenarioId)) return;
      const nextDismissed = [...currentDismissed, scenarioId].slice(-18);
      const prefRef = doc(db, 'userPreferences', firebaseUser.uid);
      try {
        await updateDoc(prefRef, {
          dismissedScenarioIds: nextDismissed,
          updatedAt: serverTimestamp(),
        });
        await loadUserRecords(firebaseUser);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `userPreferences/${firebaseUser.uid}`);
      }
    },
    [firebaseUser, preferences, loadUserRecords]
  );

  const requestAccountDeletion = useCallback(async () => {
    if (!firebaseUser) return;
    const userRef = doc(db, 'users', firebaseUser.uid);
    try {
      await updateDoc(userRef, {
        accountStatus: 'pending_deletion',
        updatedAt: serverTimestamp(),
      });
      await loadUserRecords(firebaseUser);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${firebaseUser.uid}`);
    }
  }, [firebaseUser, loadUserRecords]);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        authReady,
        profile,
        publicProfile,
        preferences,
        isAdmin,
        authError,
        signInWithGoogle,
        signOutUser,
        refreshUserRecords,
        completeOnboarding,
        savePublicProfile,
        dismissScenarioRecommendation,
        requestAccountDeletion,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
