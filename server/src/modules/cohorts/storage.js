import { cohortModel } from '../../models/Cohort.js'
import { instructorAssignmentModel } from '../../models/InstructorAssignment.js'
import { institutionModel } from '../../models/Institution.js'
import { membershipModel } from '../../models/Membership.js'
import { enrollmentCodeModel } from './enrollment-code-model.js'

function alreadyExists(error) {
  return error?.code === 48 || error?.codeName === 'NamespaceExists'
}

async function createCollection(database, name) {
  try {
    await database.db.createCollection(name)
  } catch (error) {
    if (!alreadyExists(error)) throw error
  }
}

export async function initializeCohortStorage(database) {
  if (!database?.db || database.readyState !== 1) {
    throw new TypeError('A connected Mongoose database is required.')
  }

  const models = [
    ['institutions', institutionModel(database)],
    ['cohorts', cohortModel(database)],
    ['memberships', membershipModel(database)],
    ['instructor_assignments', instructorAssignmentModel(database)],
    ['enrollment_codes', enrollmentCodeModel(database)],
  ]
  for (const [collectionName, model] of models) {
    await createCollection(database, collectionName)
    await model.createIndexes()
  }
}
