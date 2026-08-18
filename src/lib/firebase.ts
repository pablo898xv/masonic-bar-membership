import { initializeApp, getApps, cert, App } from 'firebase-admin/app'
import { getFirestore, Firestore, Timestamp } from 'firebase-admin/firestore'
import { getAuth, Auth } from 'firebase-admin/auth'

let app: App | undefined
let db: Firestore | undefined
let auth: Auth | undefined

function initializeFirebaseAdmin() {
  if (getApps().length === 0) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      app = initializeApp({
        credential: cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID,
      })
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      app = initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID,
      })
    } else {
      app = initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'demo-project',
      })
    }
  } else {
    app = getApps()[0]
  }

  db = getFirestore(app)
  auth = getAuth(app)

  return { app, db, auth }
}

const firebase = initializeFirebaseAdmin()

export { Timestamp }
export const getDb = () => {
  if (!db) {
    initializeFirebaseAdmin()
  }
  return db!
}
export const getFirebaseAuth = () => {
  if (!auth) {
    initializeFirebaseAdmin()
  }
  return auth!
}
export default firebase
