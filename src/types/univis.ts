export interface UnivisSchedule {
  dayOfWeek: number | null
  startTime: string | null
  endTime: string | null
  location: string | null
  displayTime: string
  kindLabel?: string
  startDate?: string | null
  endDate?: string | null
}

export interface UnivisExam {
  label: string
  date: string
  startTime: string | null
  endTime: string | null
}

export interface UnivisAssignedLecture {
  kindLabel: string
  detailUrl: string | null
  schedules: Array<Required<UnivisSchedule>>
}

export interface UnivisLectureDetail {
  code: string | null
  title: string | null
  number: string | null
  categoryTitle: string
  allCategories: string[]
  department: string
  credit: number | null
  language: string | null
  description: string | null
  url: string | null
  instructors: string[]
  primarySchedules: UnivisSchedule[]
  assignedLectures: UnivisAssignedLecture[]
  schedules: Array<Required<UnivisSchedule>>
  exams: UnivisExam[]
}

export interface UnivisCategory {
  title: string
  url: string
}

export interface UnivisLectureRow {
  code: string | null
  title: string
  rawTitle: string
  detailUrl: string
  summary: string
  categoryTitle: string
  allCategories?: string[]
}
