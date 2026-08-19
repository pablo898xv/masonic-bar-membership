import { initializeApp, getApps, cert, App } from 'firebase-admin/app'
import { getFirestore, Firestore, Timestamp as FirebaseTimestamp } from 'firebase-admin/firestore'
import { getAuth, Auth } from 'firebase-admin/auth'
import { getLocalDb, LocalTimestamp } from './local-firestore'

let app: App | undefined
let db: Firestore | undefined
let auth: Auth | undefined

export function shouldUseLocalDb() {
  if (process.env.FIRESTORE_EMULATOR_HOST) return false
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) return false
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return false
  if (process.env.USE_LOCAL_DB === 'true') return true
  if (process.env.USE_LOCAL_DB === 'false') return false
  return true
}

function initializeFirebaseAdmin() {
  if (getApps().length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'demo-masonic-bar'
    process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || projectId

    if (process.env.FIRESTORE_EMULATOR_HOST) {
      console.info(`Using Firestore emulator at ${process.env.FIRESTORE_EMULATOR_HOST} (project ${projectId})`)
      app = initializeApp({ projectId })
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      app = initializeApp({
        credential: cert(serviceAccount),
        projectId,
      })
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      app = initializeApp({
        projectId,
      })
    } else {
      app = initializeApp({
        projectId,
      })
    }
  } else {
    app = getApps()[0]
  }

  db = getFirestore(app)
  auth = getAuth(app)

  return { app, db, auth }
}

export const Timestamp = shouldUseLocalDb() ? LocalTimestamp : FirebaseTimestamp

export const getDb = () => {
  if (shouldUseLocalDb()) {
    return getLocalDb() as unknown as Firestore
  }
  if (!db) {
    initializeFirebaseAdmin()
  }
  return db!
}

export const getFirebaseAuth = () => {
  if (shouldUseLocalDb()) {
    throw new Error('Firebase Auth is not available when using the local database')
  }
  if (!auth) {
    initializeFirebaseAdmin()
  }
  return auth!
}

export default { getDb, getFirebaseAuth }
