import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'

export class LocalTimestamp {
  constructor(private readonly date: Date) {}

  toDate() {
    return this.date
  }

  toMillis() {
    return this.date.getTime()
  }

  static fromDate(date: Date) {
    return new LocalTimestamp(date)
  }

  static now() {
    return new LocalTimestamp(new Date())
  }
}

type DocumentData = Record<string, unknown>
type CollectionData = Record<string, DocumentData>
type StoreData = Record<string, CollectionData>

type FilterOp = '==' | '>=' | '<=' | '<' | '>' | 'in'
type Filter = { field: string; op: FilterOp; value: unknown }

const STORE_PATH = join(process.cwd(), '.data', 'local-store.json')

function isTimestampMarker(value: unknown): value is { _t: 'ts'; v: string } {
  return Boolean(value && typeof value === 'object' && (value as { _t?: string })._t === 'ts')
}

function serializeValue(value: unknown): unknown {
  if (value instanceof LocalTimestamp) {
    return { _t: 'ts', v: value.toDate().toISOString() }
  }
  if (value instanceof Date) {
    return { _t: 'ts', v: value.toISOString() }
  }
  if (Array.isArray(value)) {
    return value.map(serializeValue)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as DocumentData).map(([key, nested]) => [key, serializeValue(nested)])
    )
  }
  return value
}

function deserializeValue(value: unknown): unknown {
  if (isTimestampMarker(value)) {
    return LocalTimestamp.fromDate(new Date(value.v))
  }
  if (Array.isArray(value)) {
    return value.map(deserializeValue)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as DocumentData).map(([key, nested]) => [key, deserializeValue(nested)])
    )
  }
  return value
}

function comparable(value: unknown): number | string | boolean | null {
  if (value instanceof LocalTimestamp) return value.toMillis()
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }
  return null
}

function matchesFilter(data: DocumentData, filter: Filter) {
  const left = comparable(data[filter.field])
  if (filter.op === 'in') {
    const options = Array.isArray(filter.value) ? filter.value.map(comparable) : []
    return options.includes(left)
  }
  const right = comparable(filter.value)
  if (left === null || right === null) return false
  switch (filter.op) {
    case '==':
      return left === right
    case '>=':
      return left >= right
    case '<=':
      return left <= right
    case '>':
      return left > right
    case '<':
      return left < right
    default:
      return false
  }
}

class LocalDocumentSnapshot {
  constructor(
    public readonly id: string,
    private readonly document: DocumentData | undefined
  ) {}

  get exists() {
    return this.document !== undefined
  }

  data() {
    return this.document
  }
}

class LocalQuerySnapshot {
  constructor(public readonly docs: LocalDocumentSnapshot[]) {}

  get empty() {
    return this.docs.length === 0
  }

  get size() {
    return this.docs.length
  }
}

class LocalQuery {
  constructor(
    private readonly db: LocalFirestore,
    private readonly collectionName: string,
    private readonly filters: Filter[] = [],
    private readonly order?: { field: string; direction: 'asc' | 'desc' },
    private readonly limitCount?: number
  ) {}

  where(field: string, op: FilterOp, value: unknown) {
    return new LocalQuery(
      this.db,
      this.collectionName,
      [...this.filters, { field, op, value }],
      this.order,
      this.limitCount
    )
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
    return new LocalQuery(this.db, this.collectionName, this.filters, { field, direction }, this.limitCount)
  }

  limit(count: number) {
    return new LocalQuery(this.db, this.collectionName, this.filters, this.order, count)
  }

  count() {
    return {
      get: async () => ({
        data: () => ({ count: this.matchingDocuments().length }),
      }),
    }
  }

  async get() {
    const docs = this.matchingDocuments().map(
      ([id, data]) => new LocalDocumentSnapshot(id, data)
    )
    return new LocalQuerySnapshot(docs)
  }

  private matchingDocuments() {
    let entries = Object.entries(this.db.readCollection(this.collectionName))

    for (const filter of this.filters) {
      entries = entries.filter(([, data]) => matchesFilter(data, filter))
    }

    if (this.order) {
      const { field, direction } = this.order
      entries.sort((a, b) => {
        const left = comparable(a[1][field])
        const right = comparable(b[1][field])
        if (left === null && right === null) return 0
        if (left === null) return 1
        if (right === null) return -1
        if (left < right) return direction === 'asc' ? -1 : 1
        if (left > right) return direction === 'asc' ? 1 : -1
        return 0
      })
    }

    if (this.limitCount !== undefined) {
      entries = entries.slice(0, this.limitCount)
    }

    return entries
  }
}

export class LocalDocumentReference {
  constructor(
    private readonly db: LocalFirestore,
    public readonly collectionName: string,
    public readonly id: string
  ) {}

  async get() {
    const data = this.db.readCollection(this.collectionName)[this.id]
    return new LocalDocumentSnapshot(this.id, data)
  }

  async set(data: DocumentData) {
    this.db.writeDocument(this.collectionName, this.id, { ...data })
  }

  async update(data: DocumentData) {
    const current = this.db.readCollection(this.collectionName)[this.id]
    if (!current) {
      throw new Error(`Document ${this.collectionName}/${this.id} does not exist`)
    }
    this.db.writeDocument(this.collectionName, this.id, { ...current, ...data })
  }

  async delete() {
    this.db.deleteDocument(this.collectionName, this.id)
  }
}

class LocalWriteBatch {
  private readonly operations: Array<() => void> = []

  constructor(private readonly db: LocalFirestore) {}

  set(ref: LocalDocumentReference, data: DocumentData) {
    this.operations.push(() => {
      this.db.writeDocument(ref.collectionName, ref.id, { ...data }, false)
    })
    return this
  }

  async commit() {
    for (const operation of this.operations) {
      operation()
    }
    this.db.persist()
  }
}

class LocalCollectionReference extends LocalQuery {
  constructor(
    private readonly firestore: LocalFirestore,
    private readonly name: string
  ) {
    super(firestore, name)
  }

  doc(id?: string) {
    return new LocalDocumentReference(this.firestore, this.name, id || crypto.randomUUID())
  }
}

export class LocalFirestore {
  private store: StoreData

  constructor() {
    this.store = this.load()
  }

  collection(name: string) {
    return new LocalCollectionReference(this, name)
  }

  batch() {
    return new LocalWriteBatch(this)
  }

  readCollection(name: string): CollectionData {
    return this.store[name] || {}
  }

  writeDocument(collectionName: string, id: string, data: DocumentData, persist = true) {
    if (!this.store[collectionName]) {
      this.store[collectionName] = {}
    }
    this.store[collectionName][id] = data
    if (persist) this.persist()
  }

  deleteDocument(collectionName: string, id: string) {
    if (this.store[collectionName]) {
      delete this.store[collectionName][id]
      this.persist()
    }
  }

  persist() {
    mkdirSync(dirname(STORE_PATH), { recursive: true })
    writeFileSync(STORE_PATH, JSON.stringify(serializeValue(this.store), null, 2))
  }

  private load(): StoreData {
    if (!existsSync(STORE_PATH)) return {}
    const raw = JSON.parse(readFileSync(STORE_PATH, 'utf8')) as StoreData
    return deserializeValue(raw) as StoreData
  }
}

const globalForLocalDb = globalThis as unknown as { localFirestore?: LocalFirestore }

export function getLocalDb() {
  if (!globalForLocalDb.localFirestore) {
    globalForLocalDb.localFirestore = new LocalFirestore()
    console.info(`Using local JSON database at ${STORE_PATH}`)
  }
  return globalForLocalDb.localFirestore
}
