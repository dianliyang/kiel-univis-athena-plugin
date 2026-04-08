export const KIEL_SOURCE_TIMEZONE = 'Europe/Berlin'

export function parseDateOnly(value) {
  if (!value) {
    return null
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    return null
  }

  return {
    year: Number.parseInt(match[1], 10),
    month: Number.parseInt(match[2], 10),
    day: Number.parseInt(match[3], 10),
  }
}

export function parseTimeOnly(value) {
  if (!value) {
    return null
  }

  const match = value.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) {
    return null
  }

  return {
    hours: Number.parseInt(match[1], 10),
    minutes: Number.parseInt(match[2], 10),
  }
}

export function normalizeTimeOnly(value) {
  const timeParts = parseTimeOnly(value)
  if (!timeParts) {
    return value ?? null
  }

  return `${String(timeParts.hours).padStart(2, '0')}:${String(timeParts.minutes).padStart(2, '0')}`
}

export function normalizeDayMonthYear(value) {
  if (!value) {
    return null
  }

  const match = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (!match) {
    return null
  }

  const day = match[1].padStart(2, '0')
  const month = match[2].padStart(2, '0')
  return `${match[3]}-${month}-${day}`
}

export function getTimeZoneOffsetMs(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value]),
  )
  const asUtc = Date.UTC(
    Number.parseInt(parts.year, 10),
    Number.parseInt(parts.month, 10) - 1,
    Number.parseInt(parts.day, 10),
    Number.parseInt(parts.hour, 10),
    Number.parseInt(parts.minute, 10),
    Number.parseInt(parts.second, 10),
  )

  return asUtc - date.getTime()
}

export function zonedDateTimeToIso(dateValue, timeValue, timeZone) {
  const dateParts = parseDateOnly(dateValue)
  const timeParts = parseTimeOnly(timeValue)
  if (!dateParts || !timeParts) {
    return null
  }

  let guess = Date.UTC(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    timeParts.hours,
    timeParts.minutes,
    0,
    0,
  )

  for (let index = 0; index < 3; index += 1) {
    const offset = getTimeZoneOffsetMs(new Date(guess), timeZone)
    const nextGuess
      = Date.UTC(
        dateParts.year,
        dateParts.month - 1,
        dateParts.day,
        timeParts.hours,
        timeParts.minutes,
        0,
        0,
      ) - offset

    if (nextGuess === guess) {
      break
    }

    guess = nextGuess
  }

  return new Date(guess).toISOString()
}

export function toAllDayStartIso(dateValue) {
  const dateParts = parseDateOnly(dateValue)
  if (!dateParts) {
    return null
  }

  return new Date(
    Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, 0, 0, 0, 0),
  ).toISOString()
}

export function toAllDayEndIso(dateValue) {
  const dateParts = parseDateOnly(dateValue)
  if (!dateParts) {
    return null
  }

  return new Date(
    Date.UTC(
      dateParts.year,
      dateParts.month - 1,
      dateParts.day,
      23,
      59,
      59,
      999,
    ),
  ).toISOString()
}

export function findFirstOccurrenceDate(baseDateValue, dayOfWeek) {
  const dateParts = parseDateOnly(baseDateValue)
  if (!dateParts || dayOfWeek === null) {
    return null
  }

  const date = new Date(
    Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, 0, 0, 0, 0),
  )

  while (date.getUTCDay() !== dayOfWeek) {
    date.setUTCDate(date.getUTCDate() + 1)
  }

  const year = date.getUTCFullYear()
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${date.getUTCDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseWeekdayLabel(value) {
  switch (value?.toLowerCase()) {
    case 'sun':
      return 0
    case 'mon':
      return 1
    case 'tue':
      return 2
    case 'wed':
      return 3
    case 'thu':
      return 4
    case 'fri':
      return 5
    case 'sat':
      return 6
    default:
      return null
  }
}
