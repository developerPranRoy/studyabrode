import { prisma } from '../../config/prisma.js';
import { notify } from '../../lib/notifications.js';
import { AppError } from '../../utils/AppError.js';
import { assertOwner } from '../../utils/ownership.js';
import type { ListSessionsQuery, SessionInput } from './sessions.schema.js';

interface SessionRow {
  id: number;
  title: string;
  description: string;
  category: { id: number; name: string; slug: string };
  startsAt: Date;
  endsAt: Date;
  location: string;
  hostName: string;
  attendeesCount: number;
  registrationOpen: boolean;
  isRegistered: boolean;
}

interface Query {
  tab?: 'all' | 'upcoming' | 'past';
  category?: string;
  studentId?: number;
  id?: number;
  registeredOnly?: boolean;
}

// Read through fn_get_group_sessions. "registrationOpen" is computed from the clock in SQL.
const querySessions = ({ tab = 'all', category, studentId, id, registeredOnly = false }: Query = {}) =>
  prisma.$queryRaw<SessionRow[]>`
    SELECT * FROM fn_get_group_sessions(
      ${tab}::text, ${category ?? null}::text, ${studentId ?? null}::int, ${id ?? null}::int,
      ${registeredOnly}::boolean
    )`;

export const list = (filters: ListSessionsQuery, studentId?: number) => querySessions({ ...filters, studentId });

/** Dashboard "Group Sessions": the sessions the student registered for. */
export const listRegistered = (studentId: number, tab: ListSessionsQuery['tab'] = 'all') =>
  querySessions({ tab, studentId, registeredOnly: true });

export const getById = async (id: number, studentId?: number) => {
  const [session] = await querySessions({ id, studentId });
  if (!session) throw AppError.notFound('Session not found');
  return session;
};

const findHosted = async (id: number, userId: number) =>
  assertOwner(
    await prisma.groupSession.findUnique({ where: { id }, select: { createdById: true } }),
    'createdById', userId, 'Session',
  );

export const create = async (userId: number, data: SessionInput) => {
  const { id } = await prisma.groupSession.create({ data: { ...data, createdById: userId }, select: { id: true } });
  return getById(id, userId);
};

export const update = async (id: number, userId: number, data: SessionInput) => {
  await findHosted(id, userId);
  await prisma.groupSession.update({ where: { id }, data });
  return getById(id, userId);
};

export const remove = async (id: number, userId: number) => {
  await findHosted(id, userId);
  await prisma.groupSession.delete({ where: { id } }); // registrations cascade
};

/** Registration closes automatically: it is rejected once the start time has passed. */
export const register = async (id: number, studentId: number) => {
  const session = await prisma.groupSession.findUnique({ where: { id }, select: { startsAt: true, title: true } });
  if (!session) throw AppError.notFound('Session not found');
  if (session.startsAt <= new Date()) throw AppError.conflict('Registration is closed for this session');

  const { count } = await prisma.sessionRegistration.createMany({
    data: [{ sessionId: id, studentId }],
    skipDuplicates: true,
  });
  if (!count) throw AppError.conflict('You are already registered for this session');

  await notify(prisma, {
    userId: studentId, type: 'SESSION', title: 'Registered for a group session', body: `You are registered for "${session.title}".`,
  });
  return getById(id, studentId);
};

export const unregister = async (id: number, studentId: number) => {
  const { count } = await prisma.sessionRegistration.deleteMany({
    where: { sessionId: id, studentId, session: { startsAt: { gt: new Date() } } },
  });
  if (!count) throw AppError.notFound('No active registration found');
};
