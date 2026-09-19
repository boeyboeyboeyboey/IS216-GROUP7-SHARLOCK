import { describe, expect, it } from 'vitest'
import { assertSafeTestDatabaseUri, databaseNameFromUri } from '../../src/config/database-uri.js'
import { validateEnvironment } from '../../src/config/env.js'

const base = {
  NODE_ENV: 'development',
  PORT: '3000',
  CLIENT_ORIGIN: 'http://localhost:5173',
  MONGO_URI: 'mongodb://127.0.0.1:27018/sharlock_dev',
  SESSION_SECRET: 'a'.repeat(64),
}

describe('environment validation', () => {
  it('uses MONGO_URI, including Atlas connections without a database path', () => {
    const uri = 'mongodb+srv://member:private@example.mongodb.net/?retryWrites=true'
    expect(validateEnvironment({ ...base, MONGO_URI: uri }).databaseUri).toBe(uri)
    expect(databaseNameFromUri(uri, 'MONGO_URI', 'sharlock_dev')).toBe('sharlock_dev')
    expect(() => validateEnvironment({ ...base, MONGO_URI: undefined })).toThrow('MONGO_URI')
  })
  it('selects the explicit test database without falling back to development', () => {
    const testUri = 'mongodb://127.0.0.1:27019/sharlock_unit_test'
    expect(
      validateEnvironment({ ...base, NODE_ENV: 'test', TEST_MONGODB_URI: testUri }).databaseUri,
    ).toBe(testUri)
    expect(() => validateEnvironment({ ...base, NODE_ENV: 'test' })).toThrow('TEST_MONGODB_URI')
  })

  it.each([
    ['SESSION_SECRET', 'replace-with-secret'],
    ['PORT', '3000.5'],
    ['PORT', '65536'],
    ['CLIENT_ORIGIN', 'http://example.com:5173'],
    ['CLIENT_ORIGIN', 'http://localhost:5173/path'],
    ['CLIENT_ORIGIN', 'http://user:password@localhost:5173'],
    ['NODE_ENV', 'unexpected'],
  ])('rejects invalid %s', (key, value) => {
    expect(() => validateEnvironment({ ...base, [key]: value })).toThrow(key)
  })
})

describe('database safety', () => {
  it.each([
    undefined,
    '',
    'https://localhost/example_test',
    'mongodb://localhost/',
    'mongodb://localhost/admin',
    'mongodb://localhost/sharlock_dev',
    'mongodb://localhost/sharlock_test?dbName=sharlock_dev',
    'mongodb://localhost/sharlock_test?DBNAME=sharlock_dev',
    'mongodb://localhost/sharlock%2F_test',
  ])('rejects an unsafe test connection: %s', (uri) => {
    expect(() => assertSafeTestDatabaseUri(uri)).toThrow()
  })

  it('compares decoded database names across host aliases and casing', () => {
    expect(() =>
      assertSafeTestDatabaseUri(
        'mongodb://localhost/shared_test',
        'mongodb://127.0.0.1/%73hared_test',
      ),
    ).toThrow('different')
    expect(() =>
      assertSafeTestDatabaseUri(
        'mongodb://localhost/shared_test',
        'mongodb://elsewhere/SHARED_TEST',
      ),
    ).toThrow('different')
  })

  it('supports authenticated SRV URIs without exposing their credentials', () => {
    expect(
      databaseNameFromUri(
        'mongodb+srv://member:private@example.mongodb.net/member_dev?retryWrites=true',
      ),
    ).toBe('member_dev')
    try {
      databaseNameFromUri('mongodb+srv://member:private@example.mongodb.net/')
      expect.unreachable()
    } catch (error) {
      expect(error.message).not.toContain('private')
      expect(error.message).not.toContain('example.mongodb.net')
    }
  })
})

describe('LLM configuration', () => {
  it('is undefined when unset and trimmed when set', () => {
    const unset = validateEnvironment(base)
    expect(unset.llmBaseUrl).toBeUndefined()
    expect(unset.llmModel).toBeUndefined()
    expect(unset.llmApiKey).toBeUndefined()

    const configured = {
      ...base,
      LLM_BASE_URL: '  http://127.0.0.1:11434  ',
      LLM_MODEL: '  llama3.2:1b  ',
      LLM_API_KEY: '  sk-example-key  ',
    }
    const result = validateEnvironment(configured)
    expect(result.llmBaseUrl).toBe('http://127.0.0.1:11434')
    expect(result.llmModel).toBe('llama3.2:1b')
    expect(result.llmApiKey).toBe('sk-example-key')
  })
})
