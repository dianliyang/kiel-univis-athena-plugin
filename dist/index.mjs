// src/utils/entities.ts
function decodeHtml(html) {
  if (!html) return "";
  return html.replace(/&([^;]+);/g, (match, entity) => {
    const entities = {
      amp: "&",
      lt: "<",
      gt: ">",
      quot: '"',
      apos: "'",
      nbsp: " "
    };
    if (entity in entities) {
      return entities[entity];
    }
    if (entity.startsWith("#x")) {
      return String.fromCharCode(parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith("#")) {
      return String.fromCharCode(parseInt(entity.slice(1), 10));
    }
    return match;
  });
}
function stripTags(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>?/gm, "");
}
function stripHtmlWithLineBreaks(html) {
  if (!html) return "";
  return decodeHtml(
    html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<li[^>]*>/gi, "\n- ").replace(/<\/li>/gi, "").replace(/<[^>]*>?/gm, "")
  ).trim();
}
function stripHtmlWithLineBreaksPreservingLinks(html, sourceBaseUrl = null) {
  if (!html) return "";
  let processed = html.replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (match, href, text) => {
    try {
      const url = sourceBaseUrl ? new URL(href, sourceBaseUrl).toString() : href;
      return `[${stripTags(text)}](${url})`;
    } catch {
      return text;
    }
  }).replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<li[^>]*>/gi, "\n- ").replace(/<\/li>/gi, "").replace(/<[^>]*>?/gm, "");
  return decodeHtml(processed).trim();
}
async function readHtmlResponse(response) {
  return await response.text();
}
function extractUrls(text) {
  const matches = text.match(/https?:\/\/[^\s)\]]+/g);
  return matches ? [...new Set(matches)] : [];
}

// src/utils/time.ts
var KIEL_SOURCE_TIMEZONE = "Europe/Berlin";
function parseDateOnly(value) {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    year: parseInt(match[1], 10),
    month: parseInt(match[2], 10),
    day: parseInt(match[3], 10)
  };
}
function parseTimeOnly(value) {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return {
    hours: parseInt(match[1], 10),
    minutes: parseInt(match[2], 10)
  };
}
function normalizeTimeOnly(value) {
  const timeParts = parseTimeOnly(value);
  if (!timeParts) return value ?? null;
  return `${String(timeParts.hours).padStart(2, "0")}:${String(timeParts.minutes).padStart(2, "0")}`;
}
function normalizeDayMonthYear(value) {
  if (!value) return null;
  const match = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return null;
  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  return `${match[3]}-${month}-${day}`;
}
function findFirstOccurrenceDate(baseDateValue, dayOfWeek) {
  const dateParts = parseDateOnly(baseDateValue);
  if (!dateParts || dayOfWeek === null) return null;
  const date = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, 0, 0, 0, 0));
  while (date.getUTCDay() !== dayOfWeek) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function parseWeekdayLabel(value) {
  switch (value?.toLowerCase()) {
    case "sun":
      return 0;
    case "mon":
      return 1;
    case "tue":
      return 2;
    case "wed":
      return 3;
    case "thu":
      return 4;
    case "fri":
      return 5;
    case "sat":
      return 6;
    default:
      return null;
  }
}

// src/parsing/univis-normalize.ts
var THEORETICAL_CATEGORY = "Theoretical Computer Science";
var ELECTIVE_CATEGORY = "Compulsory elective modules in Computer Science";
var COURSE_CATEGORY_TITLES = /* @__PURE__ */ new Set([
  THEORETICAL_CATEGORY,
  ELECTIVE_CATEGORY
]);
function getCategoryPriority(categoryTitle) {
  if (categoryTitle === THEORETICAL_CATEGORY) return 0;
  if (categoryTitle === ELECTIVE_CATEGORY) return 1;
  return 99;
}
function parseTitleCode(value) {
  const clean = stripTags(value).replace(/^\W+/, "");
  const match = clean.match(/^([A-Z0-9-]+):\s*(.+)$/i);
  if (match) {
    return {
      code: match[1],
      title: match[2].trim()
    };
  }
  return {
    code: null,
    title: clean
  };
}
function isExerciseTitle(value) {
  return /^(Exercise:|Practical Exercise:|Übung zu:|Tutorial:)/i.test(
    stripTags(value)
  );
}
function mapKindToCategory(kindLabel) {
  const normalized = kindLabel?.trim().toLowerCase();
  switch (normalized) {
    case "lecture":
      return "academic.lecture";
    case "seminar":
      return "academic.seminar";
    case "tutorial":
      return "academic.tutorial";
    case "exercise":
      return "academic.exercise";
    case "practical exercise":
    case "lab":
    case "laboratory":
      return "academic.lab";
    case "study":
      return "academic.study";
    case "reading":
      return "academic.reading";
    case "project":
      return "academic.project";
    case "meeting":
      return "academic.meeting";
    case "review":
      return "academic.review";
    case "exam":
      return "academic.exam";
    default:
      return "academic.course";
  }
}
function getSessionTypeForKind(kindLabel) {
  if (/^Practical Exercise$/i.test(kindLabel ?? "")) {
    return "lab";
  }
  if (/^Exercise$/i.test(kindLabel ?? "")) {
    return "tutorial";
  }
  if (/^Lecture$/i.test(kindLabel ?? "")) {
    return "lecture";
  }
  return "course";
}
function normalizeHeadingText(value) {
  return value.replace(/\s*\[Import\]\s*$/i, "").trim();
}
function getExamDisplayLabel(label) {
  const ordinal = label.match(
    /^(\d+(?:st|nd|rd|th))\s+examination date\b/i
  )?.[1];
  return ordinal ? `${ordinal} Exam` : label;
}
function getPrimaryKindLabel(detailBlockHtml, headingText) {
  const detailKind = stripTags(detailBlockHtml).match(
    /^(Lecture|Exercise|Practical Exercise|Tutorial)\b/i
  )?.[1];
  const headingKind = normalizeHeadingText(headingText).match(
    /^(Exercise|Practical Exercise|Tutorial):/i
  )?.[1];
  const rawKind = detailKind ?? headingKind ?? "Lecture";
  if (/^Practical Exercise$/i.test(rawKind)) {
    return "Practical Exercise";
  }
  if (/^Exercise$|^Tutorial$/i.test(rawKind)) {
    return "Exercise";
  }
  return "Lecture";
}
function normalizeLectureLanguage(value) {
  const normalized = value?.trim().toLowerCase();
  switch (normalized) {
    case "english":
      return "en";
    case "german":
      return "de";
    default:
      return normalized || null;
  }
}
function extractLectureLanguage(detailLines) {
  for (const line of detailLines) {
    const match = line.match(/language of lecture is\s+(.+)$/i);
    if (match) {
      return normalizeLectureLanguage(match[1]);
    }
  }
  return null;
}
function normalizeScheduleLine(rawLine) {
  const line = stripTags(rawLine).replace(/\s*:\s*/, ": ").trim();
  if (!line) {
    return [];
  }
  if (/^time and place/i.test(line)) {
    const details = line.replace(/^time and place\s*:\s*/i, "");
    if (/^tbd$/i.test(details)) {
      return [
        {
          dayOfWeek: null,
          startTime: null,
          endTime: null,
          location: "TBD",
          displayTime: "TBD"
        }
      ];
    }
    if (details.includes(";")) {
      return details.split(/\s*;\s*/g).filter(Boolean).flatMap((part) => normalizeScheduleLine(`Time and place: ${part}`));
    }
    const dayMatch = details.match(/^([A-Z]{3})\s+(.+)$/i);
    const timeRanges = [
      ...details.matchAll(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/g)
    ];
    if (timeRanges.length > 0) {
      const weekdayPrefix = details.slice(0, timeRanges[0].index ?? 0);
      const weekdayLabels = Array.from(weekdayPrefix.matchAll(/\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\b/gi), (match) => parseWeekdayLabel(match[1])).filter((dayOfWeek) => dayOfWeek !== null);
      const locationStartIndex = (timeRanges.at(-1)?.index ?? 0) + timeRanges.at(-1)[0].length;
      const location = details.slice(locationStartIndex).replace(/^,\s*/, "").trim() || "TBD";
      if (weekdayLabels.length === 1 || dayMatch) {
        const dayOfWeek = weekdayLabels[0] ?? parseWeekdayLabel(dayMatch?.[1]);
        return timeRanges.map((match) => ({
          dayOfWeek,
          startTime: normalizeTimeOnly(match[1]),
          endTime: normalizeTimeOnly(match[2]),
          location,
          displayTime: `${normalizeTimeOnly(match[1])} - ${normalizeTimeOnly(match[2])}`
        }));
      }
      if (weekdayLabels.length > 1 && timeRanges.length === 1) {
        return weekdayLabels.map((dayOfWeek) => ({
          dayOfWeek,
          startTime: normalizeTimeOnly(timeRanges[0][1]),
          endTime: normalizeTimeOnly(timeRanges[0][2]),
          location,
          displayTime: `${normalizeTimeOnly(timeRanges[0][1])} - ${normalizeTimeOnly(timeRanges[0][2])}`
        }));
      }
    }
  }
  return [
    {
      dayOfWeek: null,
      startTime: null,
      endTime: null,
      location: "TBD",
      displayTime: "TBD"
    }
  ];
}
function normalizeDateRangeLine(rawLine) {
  const line = stripTags(rawLine).trim();
  const match = line.match(
    /^from\s+(\d{1,2}\.\d{1,2}\.\d{4})\s+to\s+(\d{1,2}\.\d{1,2}\.\d{4})$/i
  );
  if (!match) {
    return null;
  }
  return {
    startDate: normalizeDayMonthYear(match[1]),
    endDate: normalizeDayMonthYear(match[2])
  };
}
function extractDefinitionContent(html, label) {
  const match = html.match(
    new RegExp(
      `<dt><b>${label}</b></dt>\\s*<dd>([\\s\\S]*?)(?=<dt><b>|<\\/dl>|$)`,
      "i"
    )
  );
  return match ? match[1] : null;
}
function combineDefinitionSections(html, labels, sourceBaseUrl = null) {
  const sections = labels.map((label) => ({
    label,
    content: stripHtmlWithLineBreaksPreservingLinks(
      extractDefinitionContent(html, label) ?? "",
      sourceBaseUrl
    )
  })).filter((section) => section.content);
  return sections.length > 0 ? sections.map((section) => `### ${section.label}

${section.content}`).join("\n\n") : null;
}
function parseExamLines(detailLines) {
  return detailLines.map(
    (line) => line.match(
      /^(\d+(?:st|nd|rd|th)\s+examination date[^:]*):\s*(\d{1,2}\.\d{1,2}\.\d{4})(?:,\s*(\d{1,2}:\d{2})(?:\s*-\s*(\d{1,2}:\d{2}))?)?$/i
    )
  ).filter((match) => !!match).map((match) => ({
    label: decodeHtml(match[1]),
    date: normalizeDayMonthYear(match[2]),
    startTime: normalizeTimeOnly(match[3]),
    endTime: normalizeTimeOnly(match[4] ?? match[3])
  })).filter((exam) => !!exam.date);
}
function parseAssignedLectureEntries(blockHtml, fallbackDateRange, sourceBaseUrl = "https://univis.uni-kiel.de") {
  return Array.from(blockHtml.matchAll(/<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/gi), (match) => {
    const headerText = stripTags(match[1]);
    const detailUrlMatch = match[1].match(/<a[^>]*href="([^"]+)"/i);
    const bodyLines = stripHtmlWithLineBreaks(match[2]).split("\n").map((line) => line.trim()).filter(Boolean);
    const headerTitleMatch = headerText.match(/:\s*(.+?)\s*\(\d+\)\s*$/);
    const headerCodeMatch = headerText.match(/^([A-Z]+):/);
    const kindLabel = /^Practical Exercise:/i.test(
      headerTitleMatch?.[1] ?? ""
    ) ? "Practical Exercise" : /^Exercise:|^Übung zu:|^Tutorial:/i.test(headerTitleMatch?.[1] ?? "") ? "Exercise" : headerCodeMatch?.[1] === "V" ? "Lecture" : "Course";
    const scheduleLine = bodyLines.find(
      (line) => /^time and place/i.test(line)
    );
    const parsedSchedules = normalizeScheduleLine(scheduleLine ?? "TBD");
    const parsedRange = bodyLines.map(normalizeDateRangeLine).find(Boolean) ?? fallbackDateRange;
    return {
      kindLabel,
      detailUrl: detailUrlMatch?.[1] ? new URL(decodeHtml(detailUrlMatch[1]), sourceBaseUrl).toString() : null,
      schedules: parsedSchedules.map((parsedSchedule) => ({
        kindLabel,
        dayOfWeek: parsedSchedule.dayOfWeek,
        startTime: parsedSchedule.startTime,
        endTime: parsedSchedule.endTime,
        displayTime: parsedSchedule.displayTime,
        location: parsedSchedule.location || "TBD",
        startDate: parsedRange?.startDate ?? null,
        endDate: parsedRange?.endDate ?? null
      })).filter((schedule) => !!schedule.startDate && !!schedule.endDate)
    };
  }).filter((item) => item.kindLabel !== "Course");
}

// src/parsing/univis-parse.ts
function buildKielOverviewUrl({
  language = "en",
  semester = "2026s",
  requestPath = "/formbot"
} = {}) {
  const dsc = `dsc=anew/tlecture&tdir=techn/infora/master&lang=${language}&ref=tlecture&sem=${semester}`;
  const trimmedRequestPath = `${requestPath}`.trim();
  const normalizedRequestPath = !trimmedRequestPath || trimmedRequestPath === "/" ? "/formbot/" : `${trimmedRequestPath.startsWith("/") ? trimmedRequestPath : `/${trimmedRequestPath}`}${trimmedRequestPath.endsWith("/") ? "" : "/"}`;
  return new URL(
    `${normalizedRequestPath}${encodeURIComponent(dsc).replace(/%/g, "_")}`,
    "https://univis.uni-kiel.de"
  ).toString();
}
function parseOverviewCategories(html, sourceBaseUrl) {
  return Array.from(html.matchAll(/<li><a href="([^"]+)">([^<]+)<\/a><\/li>/gi), (match) => ({
    title: stripTags(match[2]),
    url: new URL(decodeHtml(match[1]), sourceBaseUrl).toString()
  }));
}
function parseCategoryLectureRows(html, { categoryTitle, sourceBaseUrl = "https://univis.uni-kiel.de" }) {
  return Array.from(html.matchAll(
    /<h4>\s*<a href="([^"]+)">([\s\S]*?)<\/a><\/h4>\s*<small>([\s\S]*?)<\/small>/gi
  ), (match) => {
    const titleData = parseTitleCode(match[2]);
    return {
      code: titleData.code,
      title: titleData.title,
      rawTitle: stripTags(match[2]),
      detailUrl: new URL(decodeHtml(match[1]), sourceBaseUrl).toString(),
      summary: stripHtmlWithLineBreaks(match[3]),
      categoryTitle
    };
  }).filter(
    (lecture) => lecture.code && COURSE_CATEGORY_TITLES.has(lecture.categoryTitle) && !isExerciseTitle(lecture.rawTitle)
  );
}
function mergeLectureSummaries(lectures) {
  const merged = /* @__PURE__ */ new Map();
  for (const lecture of lectures) {
    if (!lecture.code) continue;
    const key = lecture.code.toLowerCase();
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        ...lecture,
        allCategories: [lecture.categoryTitle]
      });
      continue;
    }
    const allCategories = /* @__PURE__ */ new Set([
      ...existing.allCategories,
      lecture.categoryTitle
    ]);
    const preferred = getCategoryPriority(lecture.categoryTitle) < getCategoryPriority(existing.categoryTitle) ? lecture : existing;
    merged.set(key, {
      ...preferred,
      allCategories: [...allCategories]
    });
  }
  return [...merged.values()].sort(
    (left, right) => (left.code || "").localeCompare(right.code || "")
  );
}
function parseLectureHeading(headingText) {
  const headingWithLeadingCode = headingText.match(
    /^([A-Z0-9-]+):\s*(.+?)\s+\(\1\)\s+\((\d+)\)$/i
  );
  const headingWithTrailingCode = headingText.match(
    /^(.+?)\s+\(([A-Z0-9-]+)\)\s+\((\d+)\)$/i
  );
  const headingTitleOnlyWithKindAndNumber = headingText.match(
    /^(Exercise|Practical Exercise|Tutorial):\s*(.+?)\s+\((\d+)\)$/i
  );
  const headingTitleOnlyWithNumber = headingText.match(/^(.+?)\s+\((\d+)\)$/);
  const headingSimple = headingText.match(/^([A-Z0-9-]+):\s*(.+)$/i);
  if (!headingWithLeadingCode && !headingWithTrailingCode && !headingTitleOnlyWithKindAndNumber && !headingTitleOnlyWithNumber && !headingSimple) {
    throw new Error("Could not parse lecture detail heading.");
  }
  return {
    code: headingWithLeadingCode?.[1] ?? headingWithTrailingCode?.[2] ?? (headingTitleOnlyWithKindAndNumber || headingTitleOnlyWithNumber ? null : headingSimple?.[1]),
    title: headingWithLeadingCode?.[2] ?? headingWithTrailingCode?.[1] ?? headingTitleOnlyWithKindAndNumber?.[2] ?? headingTitleOnlyWithNumber?.[1] ?? headingSimple?.[2],
    number: headingWithLeadingCode?.[3] ?? headingWithTrailingCode?.[3] ?? headingTitleOnlyWithKindAndNumber?.[3] ?? headingTitleOnlyWithNumber?.[2] ?? null
  };
}
function buildNormalizedSchedule(kindLabel, schedule, dateRange) {
  return {
    kindLabel,
    dayOfWeek: schedule.dayOfWeek,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    displayTime: schedule.displayTime,
    location: schedule.location || "TBD",
    startDate: dateRange?.startDate ?? null,
    endDate: dateRange?.endDate ?? null
  };
}
function parseLectureDetailHtml(html, {
  categoryTitle,
  allCategories = [categoryTitle],
  detailUrl = null,
  sourceBaseUrl = "https://univis.uni-kiel.de"
}) {
  const headingMatch = html.match(/<h3>([\s\S]*?)<\/h3>/i);
  const headingText = normalizeHeadingText(stripTags(headingMatch?.[1] ?? ""));
  const heading = parseLectureHeading(headingText);
  const detailBlockHtml = extractDefinitionContent(html, "Details") ?? "";
  const detailLines = stripHtmlWithLineBreaks(detailBlockHtml).split("\n").map((line) => line.trim()).filter(Boolean);
  const lecturers = [
    ...new Set(
      Array.from(html.matchAll(/dsc=anew\/tel_view[^"]*">([^<]+)<\/a>/gi), (match) => stripTags(match[1])).filter(Boolean)
    )
  ];
  const description = combineDefinitionSections(
    html,
    [
      "Prerequisites / Organisational information",
      "Contents",
      "Recommended literature"
    ],
    sourceBaseUrl
  );
  const departmentBlockMatch = html.match(
    /<dt><b>Department:<\/b>\s*<a[^>]*>([\s\S]*?)<\/a><\/dt>/i
  );
  const primaryKindLabel = getPrimaryKindLabel(detailBlockHtml, headingText);
  const primaryScheduleLine = detailLines.find(
    (line) => /^time and place/i.test(line)
  );
  const primarySchedules = primaryScheduleLine ? normalizeScheduleLine(primaryScheduleLine) : [];
  const primaryDateRange = detailLines.map(normalizeDateRangeLine).find(Boolean) ?? null;
  const assignedBlockHtml = extractDefinitionContent(html, "Assigned lectures") ?? "";
  const assignedLectures = assignedBlockHtml ? parseAssignedLectureEntries(
    assignedBlockHtml,
    primaryDateRange,
    sourceBaseUrl
  ) : [];
  const exams = parseExamLines(detailLines);
  const creditMatch = stripTags(detailBlockHtml).match(
    /ECTS credits:\s*(\d+)/i
  );
  const language = extractLectureLanguage(detailLines);
  const normalizedPrimarySchedules = primarySchedules.map(
    (schedule) => buildNormalizedSchedule(primaryKindLabel, schedule, primaryDateRange)
  );
  return {
    code: heading.code ? stripTags(heading.code) : null,
    title: heading.title ? stripTags(heading.title) : null,
    number: heading.number,
    categoryTitle,
    allCategories,
    department: stripTags(departmentBlockMatch?.[1] ?? "") || "Department of Computer Science",
    credit: creditMatch ? Number.parseInt(creditMatch[1], 10) : null,
    language,
    description,
    url: detailUrl,
    instructors: lecturers,
    primarySchedules: normalizedPrimarySchedules,
    assignedLectures,
    schedules: [
      ...normalizedPrimarySchedules,
      ...assignedLectures.flatMap((lecture) => lecture.schedules)
    ],
    exams
  };
}

// src/parsing/assigned-resolution.ts
async function resolveAssignedLectureSchedules({
  lecture,
  detail,
  fetchImpl,
  sourceBaseUrl = "https://univis.uni-kiel.de",
  warnings
}) {
  const resolvedSchedules = [];
  const seenAssignedUrls = /* @__PURE__ */ new Set();
  for (const assignedLecture of detail.assignedLectures ?? []) {
    if (!assignedLecture.detailUrl) {
      resolvedSchedules.push(...assignedLecture.schedules);
      continue;
    }
    if (seenAssignedUrls.has(assignedLecture.detailUrl)) {
      continue;
    }
    seenAssignedUrls.add(assignedLecture.detailUrl);
    try {
      const assignedResponse = await fetchImpl(assignedLecture.detailUrl);
      const assignedHtml = await readHtmlResponse(assignedResponse);
      const assignedDetail = parseLectureDetailHtml(assignedHtml, {
        categoryTitle: lecture.categoryTitle,
        allCategories: lecture.allCategories,
        detailUrl: assignedLecture.detailUrl,
        sourceBaseUrl
      });
      const usableAssignedSchedules = assignedDetail.primarySchedules?.filter(
        (schedule) => !!schedule.startDate && !!schedule.endDate
      ) ?? [];
      if (usableAssignedSchedules.length === 0) {
        warnings.push(
          `Skipped assigned lecture detail for ${lecture.code}: no usable schedule range at ${assignedLecture.detailUrl}`
        );
        continue;
      }
      resolvedSchedules.push(...usableAssignedSchedules);
    } catch (error) {
      warnings.push(
        `Skipped assigned lecture detail for ${lecture.code}: ${error instanceof Error ? error.message : "unknown error"}`
      );
    }
  }
  return resolvedSchedules;
}

// src/mapping/athena-map.ts
function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function buildCourseId(university, detail) {
  const stableKey = detail.code ?? detail.number ?? detail.title ?? "unknown";
  return `course-${slugify(university)}-${slugify(stableKey)}`;
}
function getScheduleSortRank(schedule) {
  const sessionType = schedule.metadata?.sessionType;
  if (sessionType === "review") {
    return 0;
  }
  return schedule.allDay ? 2 : 1;
}
function parseKielSemester(semester) {
  if (!semester) {
    return null;
  }
  const match = semester.match(/^(\d{4})([sw])$/i);
  if (!match) {
    return { label: semester };
  }
  const year = Number.parseInt(match[1], 10);
  const isSummer = match[2].toLowerCase() === "s";
  const term = isSummer ? "Summer" : "Winter";
  return {
    term,
    year,
    label: `${term} ${year}`
  };
}
function buildKielCourseImport(lectureDetails, { university = "Kiel University (CAU)", latestTerm = null } = {}) {
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const courses = [];
  const schedules = [];
  const sessions = [];
  const latestSemester = parseKielSemester(latestTerm);
  for (const detail of lectureDetails) {
    const description = detail.description || null;
    const resourceUrls = description ? extractUrls(description) : [];
    const courseId = buildCourseId(university, detail);
    courses.push({
      id: courseId,
      university,
      domain: null,
      category: detail.categoryTitle ?? null,
      language: detail.language ?? null,
      source: "external-import",
      code: detail.code || "",
      title: detail.title || "Untitled Course",
      department: detail.department ?? "Department of Computer Science",
      level: "master",
      credit: detail.credit,
      instructors: detail.instructors,
      latestSemester,
      description,
      url: detail.url,
      topics: [],
      resources: resourceUrls.map((url) => ({ label: url, value: url })),
      metadata: null,
      state: null,
      createdAt: nowIso,
      updatedAt: nowIso
    });
    for (const [index, schedule] of detail.schedules.entries()) {
      if (!schedule.startDate || !schedule.endDate) {
        continue;
      }
      const firstDate = schedule.dayOfWeek === null ? schedule.startDate : findFirstOccurrenceDate(schedule.startDate, schedule.dayOfWeek);
      if (!firstDate) {
        continue;
      }
      const normalizedLocation = schedule.location?.trim() || "TBD";
      const hasConcreteTime = !!schedule.startTime && !!schedule.endTime;
      const normalizedStartAt = hasConcreteTime ? schedule.startTime : "00:00";
      const normalizedEndAt = hasConcreteTime ? schedule.endTime : "23:59";
      schedules.push({
        id: `schedule-${slugify(`${courseId}-${schedule.kindLabel}-${index}`)}`,
        entityType: "course",
        entityId: courseId,
        title: detail.title || "Untitled Course",
        dayOfWeek: schedule.dayOfWeek ?? (/* @__PURE__ */ new Date(`${firstDate}T00:00:00.000Z`)).getUTCDay(),
        allDay: !hasConcreteTime,
        startAt: normalizedStartAt,
        endAt: normalizedEndAt,
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        recurrenceUntil: schedule.endDate,
        timezone: KIEL_SOURCE_TIMEZONE,
        location: normalizedLocation,
        category: mapKindToCategory(schedule.kindLabel),
        notes: null,
        metadata: {
          sessionType: getSessionTypeForKind(schedule.kindLabel)
        },
        createdAt: nowIso,
        updatedAt: nowIso
      });
    }
    for (const [index, exam] of detail.exams.entries()) {
      const examDisplayLabel = getExamDisplayLabel(exam.label);
      const allDay = !exam.startTime || !exam.endTime;
      const normalizedStartAt = allDay ? "00:00" : exam.startTime;
      const normalizedEndAt = allDay ? "23:59" : exam.endTime;
      const dateParts = parseDateOnly(exam.date);
      if (!dateParts) {
        continue;
      }
      const dayOfWeek = new Date(
        Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day)
      ).getUTCDay();
      schedules.push({
        id: `schedule-${slugify(`${courseId}-${exam.label}-${index}`)}`,
        entityType: "course",
        entityId: courseId,
        title: `${detail.title} \xB7 ${examDisplayLabel}`,
        dayOfWeek,
        allDay,
        startAt: normalizedStartAt,
        endAt: normalizedEndAt,
        startDate: exam.date,
        endDate: exam.date,
        recurrenceUntil: exam.date,
        timezone: KIEL_SOURCE_TIMEZONE,
        location: "TBD",
        category: mapKindToCategory("Exam"),
        notes: null,
        metadata: {
          sessionType: "review"
        },
        createdAt: nowIso,
        updatedAt: nowIso
      });
    }
  }
  return {
    protocolVersion: "v1",
    courses: courses.sort((left, right) => left.code.localeCompare(right.code)),
    schedules: schedules.sort(
      (left, right) => (left.entityId || "").localeCompare(right.entityId ?? "") || getScheduleSortRank(left) - getScheduleSortRank(right) || left.dayOfWeek - right.dayOfWeek || left.startAt.localeCompare(right.startAt)
    ),
    sessions: sessions.sort(
      (left, right) => (left.startAt || "").localeCompare(right.startAt || "")
    )
  };
}

// src/fetcher.ts
async function fetchKielUnivisCourses({
  fetchImpl = fetch,
  language = "en",
  semester = "2026s",
  requestPath = "/formbot",
  sourceBaseUrl = "https://univis.uni-kiel.de"
} = {}) {
  const overviewResponse = await fetchImpl(
    buildKielOverviewUrl({ language, semester, requestPath })
  );
  const overviewHtml = await readHtmlResponse(overviewResponse);
  const categories = parseOverviewCategories(
    overviewHtml,
    sourceBaseUrl
  ).filter((category) => COURSE_CATEGORY_TITLES.has(category.title));
  const summaries = [];
  const warnings = [];
  for (const category of categories) {
    const categoryResponse = await fetchImpl(category.url);
    const categoryHtml = await readHtmlResponse(categoryResponse);
    summaries.push(
      ...parseCategoryLectureRows(categoryHtml, {
        categoryTitle: category.title,
        sourceBaseUrl
      })
    );
  }
  const mergedLectures = mergeLectureSummaries(summaries);
  const details = [];
  for (const lecture of mergedLectures) {
    try {
      const detailResponse = await fetchImpl(lecture.detailUrl);
      const detailHtml = await readHtmlResponse(detailResponse);
      const detail = parseLectureDetailHtml(detailHtml, {
        categoryTitle: lecture.categoryTitle,
        allCategories: lecture.allCategories,
        detailUrl: lecture.detailUrl,
        sourceBaseUrl
      });
      const assignedPageSchedules = await resolveAssignedLectureSchedules({
        lecture,
        detail,
        fetchImpl,
        sourceBaseUrl,
        warnings
      });
      details.push({
        ...detail,
        code: detail.code ?? lecture.code,
        title: lecture.title ?? detail.title,
        schedules: [...detail.primarySchedules ?? [], ...assignedPageSchedules]
      });
    } catch (error) {
      warnings.push(
        `Skipped lecture detail for ${lecture.code}: ${error instanceof Error ? error.message : "unknown error"}`
      );
    }
  }
  const result = buildKielCourseImport(details, {
    university: "Kiel University (CAU)",
    latestTerm: semester
  });
  return {
    ...result,
    warnings
  };
}

// src/index.ts
var index_default = {
  config: [
    {
      key: "language",
      label: "Language",
      type: "select",
      defaultValue: "en",
      options: [
        { value: "en", label: "English" },
        { value: "de", label: "Deutsch" }
      ]
    },
    {
      key: "semester",
      label: "Semester",
      type: "select",
      defaultValue: "2026s",
      options: [
        { value: "2026s", label: "2026 Summer" },
        { value: "2026w", label: "2026 Winter" },
        { value: "2025s", label: "2025 Summer" },
        { value: "2025w", label: "2025 Winter" }
      ]
    },
    {
      key: "requestPath",
      label: "Request Path",
      type: "text",
      defaultValue: "/formbot",
      placeholder: "/formbot",
      description: "Override the UnivIS request path while keeping the host fixed to univis.uni-kiel.de."
    }
  ],
  async pull(context) {
    const config = await context.getConfig() ?? {};
    const result = await fetchKielUnivisCourses({
      fetchImpl: async (input) => {
        const response = await context.fetch({
          url: String(input),
          method: "GET"
        });
        return {
          headers: {
            get(name) {
              return response.headers[String(name).toLowerCase()] ?? null;
            }
          },
          async text() {
            return response.bodyText;
          }
        };
      },
      language: typeof config.language === "string" ? config.language : "en",
      semester: typeof config.semester === "string" ? config.semester : "2026s",
      requestPath: typeof config.requestPath === "string" && config.requestPath.trim().length > 0 ? config.requestPath : "/formbot"
    });
    return {
      protocolVersion: "v1",
      ...result,
      warnings: result.warnings ?? []
    };
  },
  async push(_context, payload) {
    const warnings = [
      "Kiel UnivIS push is metadata-only. Remote UnivIS data was not modified."
    ];
    if ((payload.sessions?.length ?? 0) > 0) {
      warnings.push(
        `Ignored ${payload.sessions.length} session record(s) because the plugin does not write sessions.`
      );
    }
    return {
      protocolVersion: "v1",
      summary: {
        courses: payload.courses?.length ?? 0,
        schedules: payload.schedules?.length ?? 0,
        sessions: 0
      },
      warnings
    };
  }
};
export {
  index_default as default
};
