/**
 * Data access for `instructor_applications`.
 */
import { and, asc, desc, eq } from 'drizzle-orm';
import { schema, type Db } from '@skillverse/db';

const { instructorApplications, users } = schema;

export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export function latestApplication(db: Db, userId: string) {
  return db
    .select()
    .from(instructorApplications)
    .where(eq(instructorApplications.userId, userId))
    .orderBy(desc(instructorApplications.createdAt))
    .limit(1)
    .get();
}

export function findApplication(db: Db, id: string) {
  return db.select().from(instructorApplications).where(eq(instructorApplications.id, id)).get();
}

/** Applications with a given status, oldest first (fair queue). */
export function listApplications(db: Db, status: ApplicationStatus) {
  return db
    .select({
      id: instructorApplications.id,
      status: instructorApplications.status,
      headline: instructorApplications.headline,
      topics: instructorApplications.topics,
      experience: instructorApplications.experience,
      sampleUrl: instructorApplications.sampleUrl,
      reviewNotes: instructorApplications.reviewNotes,
      createdAt: instructorApplications.createdAt,
      // Applicant fields; users.id is not selected (duplicate "id" column in a join).
      applicant: {
        id: instructorApplications.userId,
        displayName: users.displayName,
        username: users.username,
        email: users.email,
      },
    })
    .from(instructorApplications)
    .innerJoin(users, eq(users.id, instructorApplications.userId))
    .where(eq(instructorApplications.status, status))
    .orderBy(asc(instructorApplications.createdAt))
    .limit(200);
}

/** Moves a PENDING application to a decision; returns nothing if it was already decided. */
export function decideApplication(
  db: Db,
  id: string,
  decision: { status: 'approved' | 'rejected'; reviewerId: string; reviewNotes: string | null },
) {
  return db
    .update(instructorApplications)
    .set({ ...decision, reviewedAt: new Date() })
    .where(and(eq(instructorApplications.id, id), eq(instructorApplications.status, 'pending')))
    .returning({ userId: instructorApplications.userId });
}
