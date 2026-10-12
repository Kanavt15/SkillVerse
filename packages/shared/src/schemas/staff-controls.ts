/** Explicit contracts; unfinished commerce/advertising switches remain protected. */
import { z } from 'zod';
import { idSchema } from './common';
import { secondFactorCodeSchema } from './auth';

export const PRIVILEGED_ROLES = ['moderator', 'admin', 'super_admin'] as const;
const versionSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const reasonSchema = z
  .string()
  .trim()
  .min(10, 'Explain the decision in at least 10 characters.')
  .max(2000);
const credentials = { password: z.string().max(128).optional(), code: secondFactorCodeSchema };
export const staffRoleDecisionSchema = z.strictObject({
  role: z.enum(PRIVILEGED_ROLES),
  decision: z.enum(['grant', 'revoke']),
  version: versionSchema,
  notes: reasonSchema,
  ...credentials,
});
export type StaffRoleDecision = z.infer<typeof staffRoleDecisionSchema>;

export const OPERATION_SETTING_RULES = {
  'operations.request_threshold': {
    label: 'Requests per 5 minutes',
    min: 1,
    max: 1000000,
    default: 5000,
  },
  'operations.error_threshold': {
    label: 'Server errors per 5 minutes',
    min: 1,
    max: 10000,
    default: 5,
  },
  'operations.slow_ms': {
    label: 'Slow request threshold (milliseconds)',
    min: 500,
    max: 30000,
    default: 2000,
  },
  'operations.slow_threshold': {
    label: 'Slow requests per 5 minutes',
    min: 1,
    max: 10000,
    default: 20,
  },
  'operations.rate_limit_threshold': {
    label: 'Rate-limited requests per 5 minutes',
    min: 1,
    max: 10000,
    default: 50,
  },
  'operations.retention_days': {
    label: 'Operational data retention (days)',
    min: 1,
    max: 30,
    default: 7,
  },
} as const;
export type OperationSettingKey = keyof typeof OPERATION_SETTING_RULES;
export const operationSettingKeySchema = z.enum(
  Object.keys(OPERATION_SETTING_RULES) as [OperationSettingKey, ...OperationSettingKey[]],
);
export const staffSettingDecisionSchema = z
  .strictObject({
    key: operationSettingKeySchema,
    value: z.number().int(),
    version: versionSchema,
    notes: reasonSchema,
    ...credentials,
  })
  .superRefine((input, context) => {
    const rule = OPERATION_SETTING_RULES[input.key];
    if (input.value < rule.min || input.value > rule.max)
      context.addIssue({
        code: 'custom',
        path: ['value'],
        message: `Use a whole number from ${rule.min} to ${rule.max}.`,
      });
  });
export type StaffSettingDecision = z.infer<typeof staffSettingDecisionSchema>;
export const staffFlagDecisionSchema = z
  .strictObject({
    key: z.literal('auth.google'),
    enabled: z.boolean(),
    rolloutPercent: z.union([z.literal(0), z.literal(100)]),
    version: versionSchema,
    notes: reasonSchema,
    ...credentials,
  })
  .refine((input) => !input.enabled || input.rolloutPercent === 100, {
    path: ['rolloutPercent'],
    message: 'Enabled sign-in must be available to all users.',
  });
export type StaffFlagDecision = z.infer<typeof staffFlagDecisionSchema>;
export const staffAuditQuerySchema = z.strictObject({
  before: z
    .string()
    .regex(/^\d{1,16}:[0-9a-f-]{36}$/)
    .refine((value) => {
      const [timestamp, id] = value.split(':');
      return Number(timestamp) <= 8640000000000000 && idSchema.safeParse(id).success;
    }, 'Invalid audit cursor.')
    .optional(),
  action: z
    .string()
    .max(80)
    .regex(/^[a-z0-9_.-]*$/)
    .default(''),
  targetId: z.string().max(120).default(''),
  actorId: z.preprocess((value) => (value === '' ? undefined : value), idSchema.optional()),
});
export type StaffAuditQuery = z.infer<typeof staffAuditQuerySchema>;
export const staffAuditSchema = z.object({
  items: z.array(
    z.object({
      id: idSchema,
      action: z.string(),
      actorName: z.string().nullable(),
      targetType: z.string().nullable(),
      targetId: z.string().nullable(),
      notes: z.string(),
      summary: z.string(),
      createdAt: z.string(),
      requestId: z.string().nullable(),
    }),
  ),
  nextCursor: z.string().nullable(),
});
export type StaffAudit = z.infer<typeof staffAuditSchema>;
export const staffControlsSchema = z.object({
  canWrite: z.boolean(),
  settings: z.array(
    z.object({
      key: operationSettingKeySchema,
      value: z.number().int(),
      label: z.string(),
      min: z.number(),
      max: z.number(),
      version: z.number().int(),
    }),
  ),
  flags: z.array(
    z.object({
      key: z.string(),
      enabled: z.boolean(),
      rolloutPercent: z.number().int(),
      version: z.number().int(),
      editable: z.boolean(),
      label: z.string(),
    }),
  ),
  telemetryEnabled: z.boolean(),
  alertDeliveryConfigured: z.boolean(),
});
export type StaffControls = z.infer<typeof staffControlsSchema>;
export const operationalQuerySchema = z.strictObject({
  hours: z.coerce.number().int().min(1).max(24).default(1),
});
export const operationalSummarySchema = z.object({
  measuredAt: z.string(),
  telemetryEnabled: z.boolean(),
  hours: z.number(),
  requests: z.number(),
  errors: z.number(),
  rateLimited: z.number(),
  slowRequests: z.number(),
  averageDurationMs: z.number(),
  scopes: z.array(z.object({ scope: z.string(), requests: z.number(), errors: z.number() })),
  alerts: z.array(
    z.object({
      id: idSchema,
      bucket: z.string(),
      kind: z.enum(['server_errors', 'slow_requests', 'rate_limit_spike', 'request_volume']),
      count: z.number(),
      state: z.string(),
      attempts: z.number(),
    }),
  ),
});
export type OperationalSummary = z.infer<typeof operationalSummarySchema>;
