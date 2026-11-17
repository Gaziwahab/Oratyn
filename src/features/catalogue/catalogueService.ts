import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import {
  db,
  handleFirestoreError,
  isLocalTestPreview,
  OperationType,
} from '../../lib/firebase';
import {
  PILOT_DOMAINS,
  PILOT_SCENARIOS,
} from '../../../packages/domain/src/catalogue';
import type { DomainItem, ScenarioItem } from '../../../packages/domain/src/types';

export async function fetchPublishedCatalogue(): Promise<{
  domains: DomainItem[];
  scenarios: ScenarioItem[];
  source: 'firestore' | 'seed_fallback';
}> {
  if (isLocalTestPreview()) {
    return {
      domains: [...PILOT_DOMAINS],
      scenarios: [...PILOT_SCENARIOS],
      source: 'seed_fallback',
    };
  }
  try {
    const [domSnap, scenSnap] = await Promise.all([
      getDocs(query(collection(db, 'domains'), where('status', '==', 'published'), limit(20))),
      getDocs(query(collection(db, 'scenarios'), where('status', '==', 'published'), limit(50))),
    ]);

    if (domSnap.empty || scenSnap.empty) {
      return {
        domains: [...PILOT_DOMAINS],
        scenarios: [...PILOT_SCENARIOS],
        source: 'seed_fallback',
      };
    }

    const domains = domSnap.docs
      .map((d) => d.data() as DomainItem)
      .sort((a, b) => a.order - b.order);
    const scenarios = scenSnap.docs.map((s) => s.data() as ScenarioItem);

    return { domains, scenarios, source: 'firestore' };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'scenarios');
  }
}

export async function seedPilotCatalogueToFirestore(): Promise<number> {
  let written = 0;
  try {
    for (const domain of PILOT_DOMAINS) {
      await setDoc(doc(db, 'domains', domain.id), domain, { merge: true });
      written++;
    }
    for (const scenario of PILOT_SCENARIOS) {
      await setDoc(doc(db, 'scenarios', scenario.id), scenario, { merge: true });
      written++;
    }
    return written;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'scenarios');
  }
}
