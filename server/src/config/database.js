import mongoose from 'mongoose'
import { databaseNameFromUri } from './database-uri.js'

export async function connectDatabase(uri) {
  databaseNameFromUri(uri)
  return mongoose
    .createConnection(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      maxPoolSize: 10,
      bufferCommands: false,
      autoCreate: false,
    })
    .asPromise()
}
