import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  date,
  datetime,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  time,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';

export const departments = mysqlTable('departments', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: datetime('created_at', { mode: 'string' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'string' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
});

export const employees = mysqlTable(
  'employees',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    departmentId: bigint('department_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => departments.id, { onDelete: 'restrict' }),
    employeeNo: varchar('employee_no', { length: 20 }).notNull(),
    name: varchar('name', { length: 20 }).notNull(),
    title: varchar('title', { length: 50 }),
    phone: varchar('phone', { length: 20 }).notNull(),
    status: mysqlEnum('status', ['active', 'inactive']).notNull().default('active'),
    createdAt: datetime('created_at', { mode: 'string' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime('updated_at', { mode: 'string' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`)
      .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('uk_employees_dept_no').on(table.departmentId, table.employeeNo),
    index('idx_employees_dept_status').on(table.departmentId, table.status),
  ],
);

export const users = mysqlTable(
  'users',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    phone: varchar('phone', { length: 20 }),
    passwordHash: varchar('password_hash', { length: 255 }),
    role: mysqlEnum('role', ['admin', 'staff']).notNull(),
    employeeId: bigint('employee_id', { mode: 'number', unsigned: true }).references(
      () => employees.id,
      { onDelete: 'restrict' },
    ),
    wxOpenid: varchar('wx_openid', { length: 64 }),
    status: mysqlEnum('status', ['active', 'disabled']).notNull().default('active'),
    tokenValidAfter: datetime('token_valid_after', { mode: 'string' }).notNull(),
    createdAt: datetime('created_at', { mode: 'string' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime('updated_at', { mode: 'string' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`)
      .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('uk_users_phone').on(table.phone),
    uniqueIndex('uk_users_wx_openid').on(table.wxOpenid),
    uniqueIndex('uk_users_employee_id').on(table.employeeId),
    index('idx_users_role_status').on(table.role, table.status),
  ],
);

export const shiftTypes = mysqlTable(
  'shift_types',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    departmentId: bigint('department_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => departments.id, { onDelete: 'restrict' }),
    code: varchar('code', { length: 10 }).notNull(),
    name: varchar('name', { length: 50 }).notNull(),
    startTime: time('start_time'),
    durationMinutes: int('duration_minutes', { unsigned: true }),
    color: varchar('color', { length: 20 }).notNull(),
    minRequiredCount: int('min_required_count', { unsigned: true }).notNull().default(0),
    status: mysqlEnum('status', ['active', 'inactive']).notNull().default('active'),
    kind: mysqlEnum('kind', ['day', 'evening', 'night', 'off', 'standby', 'other'])
      .notNull()
      .default('other'),
    sortOrder: int('sort_order').notNull().default(0),
    createdAt: datetime('created_at', { mode: 'string' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime('updated_at', { mode: 'string' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`)
      .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('uk_shift_types_dept_code').on(table.departmentId, table.code),
    index('idx_shift_types_dept_status').on(table.departmentId, table.status, table.sortOrder),
  ],
);

export const schedulePeriods = mysqlTable(
  'schedule_periods',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    departmentId: bigint('department_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => departments.id, { onDelete: 'restrict' }),
    weekStart: date('week_start', { mode: 'string' }).notNull(),
    editStatus: mysqlEnum('edit_status', ['draft', 'published']).notNull().default('draft'),
    hasUnpublishedChanges: boolean('has_unpublished_changes').notNull().default(false),
    latestPublishedVersion: int('latest_published_version', { unsigned: true }),
    lastPublishedAt: datetime('last_published_at', { mode: 'string' }),
    lastPublishedBy: bigint('last_published_by', { mode: 'number', unsigned: true }).references(
      () => users.id,
      { onDelete: 'restrict' },
    ),
    createdAt: datetime('created_at', { mode: 'string' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime('updated_at', { mode: 'string' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`)
      .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('uk_periods_dept_week').on(table.departmentId, table.weekStart),
    index('idx_periods_dept_week').on(table.departmentId, table.weekStart),
  ],
);

export const scheduleEntries = mysqlTable(
  'schedule_entries',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    periodId: bigint('period_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => schedulePeriods.id, { onDelete: 'restrict' }),
    employeeId: bigint('employee_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => employees.id, { onDelete: 'restrict' }),
    workDate: date('work_date', { mode: 'string' }).notNull(),
    shiftTypeId: bigint('shift_type_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => shiftTypes.id, { onDelete: 'restrict' }),
    note: varchar('note', { length: 255 }),
    createdAt: datetime('created_at', { mode: 'string' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime('updated_at', { mode: 'string' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`)
      .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('uk_entries_period_emp_date').on(table.periodId, table.employeeId, table.workDate),
    index('idx_entries_period_date').on(table.periodId, table.workDate),
    index('idx_entries_period_shift').on(table.periodId, table.shiftTypeId, table.workDate),
  ],
);

export const schedulePublishSnapshots = mysqlTable(
  'schedule_publish_snapshots',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    periodId: bigint('period_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => schedulePeriods.id, { onDelete: 'restrict' }),
    version: int('version', { unsigned: true }).notNull(),
    snapshotData: json('snapshot_data').notNull(),
    publishedAt: datetime('published_at', { mode: 'string' }).notNull(),
    publishedBy: bigint('published_by', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
  },
  (table) => [
    uniqueIndex('uk_snapshots_period_version').on(table.periodId, table.version),
    index('idx_snapshots_period').on(table.periodId, table.version),
  ],
);

export const employeeBindingCodes = mysqlTable(
  'employee_binding_codes',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    employeeId: bigint('employee_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => employees.id, { onDelete: 'restrict' }),
    codeHash: varchar('code_hash', { length: 255 }).notNull(),
    status: mysqlEnum('status', ['active', 'used', 'expired']).notNull().default('active'),
    expiresAt: datetime('expires_at', { mode: 'string' }),
    usedAt: datetime('used_at', { mode: 'string' }),
    createdBy: bigint('created_by', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: datetime('created_at', { mode: 'string' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index('idx_binding_employee_status').on(table.employeeId, table.status)],
);

export const scheduleChangeLogs = mysqlTable(
  'schedule_change_logs',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    periodId: bigint('period_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => schedulePeriods.id, { onDelete: 'restrict' }),
    operatorId: bigint('operator_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    action: varchar('action', { length: 32 }).notNull(),
    detail: json('detail'),
    createdAt: datetime('created_at', { mode: 'string' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index('idx_change_logs_period').on(table.periodId, table.createdAt)],
);

/** v1.5 预留，v1 不实现业务 */
export const swapRequests = mysqlTable('swap_requests', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  createdAt: datetime('created_at', { mode: 'string' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
