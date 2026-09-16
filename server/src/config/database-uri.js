import ConnectionString from 'mongodb-connection-string-url'

export function databaseNameFromUri(uri, label = 'MONGODB_URI') {
  try {
    if (typeof uri !== 'string' || !uri.trim()) throw new Error()
    const parsed = new ConnectionString(uri)
    const name = decodeURIComponent(parsed.pathname.slice(1))
    if (
      !/^[a-zA-Z0-9_-]+$/.test(name) ||
      ['admin', 'config', 'local'].includes(name.toLowerCase())
    ) {
      throw new Error()
    }
    // A query option must never override the database checked by the test guard.
    if ([...parsed.searchParams.keys()].some((key) => key.toLowerCase() === 'dbname'))
      throw new Error()
    return name
  } catch {
    throw new Error(`${label} must be a MongoDB URI with an explicit, non-system database name.`)
  }
}

export function assertSafeTestDatabaseUri(testUri, developmentUri) {
  const testName = databaseNameFromUri(testUri, 'TEST_MONGODB_URI')
  if (!testName.endsWith('_test')) {
    throw new Error('TEST_MONGODB_URI database must end in _test.')
  }
  if (developmentUri) {
    const developmentName = databaseNameFromUri(developmentUri)
    // Conservatively reject the same name even when hosts or aliases differ.
    if (testName.toLowerCase() === developmentName.toLowerCase()) {
      throw new Error('Test and development database names must be different.')
    }
  }
  return testUri
}
