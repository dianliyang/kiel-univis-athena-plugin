export interface CourseRecord {
  id: string
  university: string
  domain: string | null
  category: string | null
  language: string | null
  source: string | null
  code: string
  title: string
  department: string | null
  level: string | null
  credit: number | null
  instructors: string[]
  latestSemester: {
    term?: string
    year?: number
    label?: string
  } | null
  description: string | null
  url: string | null
  topics: string[]
  resources: Array<{ label: string; value: string }>
  metadata: Record<string, unknown> | null
  state: string | null
  createdAt: string
  updatedAt: string
}

export interface ScheduleRecord {
  id: string
  entityType: 'course' | 'reading' | 'project' | 'workout' | 'custom'
  entityId: string | null
  title: string
  dayOfWeek: number
  allDay: boolean
  startAt: string
  endAt: string
  startDate: string
  endDate: string | null
  recurrenceUntil: string | null
  timezone: string
  location: string | null
  category: string
  notes: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface SessionRecord {
  id: string
  scheduleId: string | null
  entityType: 'course' | 'reading' | 'project' | 'workout' | 'custom'
  entityId: string | null
  title: string
  allDay: boolean
  startAt: string
  endAt: string
  timezone: string
  location: string | null
  category: string
  status: 'scheduled' | 'missed' | 'cancelled' | 'completed' | 'deleted'
  notes: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface PluginContext {
  getConfig: () => Promise<Record<string, unknown>>
  fetch: (options: { url: string; method: string }) => Promise<{
    status: number
    headers: Record<string, string>
    bodyText: string
  }>
}

export interface PluginPullResult {
  protocolVersion: string
  courses?: CourseRecord[]
  schedules?: ScheduleRecord[]
  sessions?: SessionRecord[]
  warnings?: string[]
}

export interface PluginPushPayload {
  courses?: CourseRecord[]
  schedules?: ScheduleRecord[]
  sessions?: SessionRecord[]
}

export interface PluginPushResult {
  protocolVersion: string
  summary: {
    courses: number
    schedules: number
    sessions: number
  }
  warnings?: string[]
}
