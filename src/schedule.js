export const MEET_LINKS = {
  ayush:   "https://meet.google.com/kgm-jzqg-fui",
  dhun:    "https://meet.google.com/ygi-rtwo-nkm",
  pragati: "https://meet.google.com/szi-cdob-jvo",
  meena:   "https://meet.google.com/bfd-hwjm-qbm",
};

// null = free period for that class at that slot
// Each day has 4 slots: [4-5PM, 5-6PM, 6-7PM, 7-8PM]
// Each slot has entries for all classes taught at that time

const TIMETABLE = {
  monday: {
    "6":  [
      { subject:"maths",   teacher:"ayush"   },
      { subject:"science", teacher:"dhun"    },
      { subject:"hindi",   teacher:"pragati" },
      { subject:"social",  teacher:"meena"   },
    ],
    "7":  [
      { subject:"science", teacher:"dhun"    },
      { subject:"hindi",   teacher:"pragati" },
      { subject:"social",  teacher:"meena"   },
      null,
    ],
    "8":  [
      { subject:"hindi",   teacher:"pragati" },
      { subject:"social",  teacher:"meena"   },
      null,
      { subject:"maths",   teacher:"ayush"   },
    ],
    "9":  [
      { subject:"social",  teacher:"meena"   },
      null,
      { subject:"maths",   teacher:"ayush"   },
      { subject:"science", teacher:"dhun"    },
    ],
    "10": [
      null,
      { subject:"maths",   teacher:"ayush"   },
      { subject:"science", teacher:"dhun"    },
      { subject:"hindi",   teacher:"pragati" },
    ],
  },
  tuesday: {
    "6":  [
      null,
      { subject:"maths",   teacher:"ayush"   },
      { subject:"science", teacher:"dhun"    },
      { subject:"hindi",   teacher:"pragati" },
    ],
    "7":  [
      { subject:"maths",   teacher:"ayush"   },
      { subject:"science", teacher:"dhun"    },
      { subject:"hindi",   teacher:"pragati" },
      { subject:"social",  teacher:"meena"   },
    ],
    "8":  [
      { subject:"science", teacher:"dhun"    },
      { subject:"hindi",   teacher:"pragati" },
      { subject:"social",  teacher:"meena"   },
      null,
    ],
    "9":  [
      { subject:"hindi",   teacher:"pragati" },
      { subject:"social",  teacher:"meena"   },
      null,
      { subject:"maths",   teacher:"ayush"   },
    ],
    "10": [
      { subject:"social",  teacher:"meena"   },
      null,
      { subject:"maths",   teacher:"ayush"   },
      { subject:"science", teacher:"dhun"    },
    ],
  },
  wednesday: {
    "6":  [
      { subject:"social",  teacher:"meena"   },
      null,
      { subject:"maths",   teacher:"ayush"   },
      { subject:"science", teacher:"dhun"    },
    ],
    "7":  [
      null,
      { subject:"maths",   teacher:"ayush"   },
      { subject:"science", teacher:"dhun"    },
      { subject:"hindi",   teacher:"pragati" },
    ],
    "8":  [
      { subject:"maths",   teacher:"ayush"   },
      { subject:"science", teacher:"dhun"    },
      { subject:"hindi",   teacher:"pragati" },
      { subject:"social",  teacher:"meena"   },
    ],
    "9":  [
      { subject:"science", teacher:"dhun"    },
      { subject:"hindi",   teacher:"pragati" },
      { subject:"social",  teacher:"meena"   },
      null,
    ],
    "10": [
      { subject:"hindi",   teacher:"pragati" },
      { subject:"social",  teacher:"meena"   },
      null,
      { subject:"maths",   teacher:"ayush"   },
    ],
  },
  thursday: {
    "6":  [
      { subject:"hindi",   teacher:"pragati" },
      { subject:"social",  teacher:"meena"   },
      null,
      { subject:"maths",   teacher:"ayush"   },
    ],
    "7":  [
      { subject:"social",  teacher:"meena"   },
      null,
      { subject:"maths",   teacher:"ayush"   },
      { subject:"science", teacher:"dhun"    },
    ],
    "8":  [
      null,
      { subject:"maths",   teacher:"ayush"   },
      { subject:"science", teacher:"dhun"    },
      { subject:"hindi",   teacher:"pragati" },
    ],
    "9":  [
      { subject:"maths",   teacher:"ayush"   },
      { subject:"science", teacher:"dhun"    },
      { subject:"hindi",   teacher:"pragati" },
      { subject:"social",  teacher:"meena"   },
    ],
    "10": [
      { subject:"science", teacher:"dhun"    },
      { subject:"hindi",   teacher:"pragati" },
      { subject:"social",  teacher:"meena"   },
      null,
    ],
  },
  friday: {
    "6":  [
      { subject:"science", teacher:"dhun"    },
      { subject:"hindi",   teacher:"pragati" },
      { subject:"social",  teacher:"meena"   },
      null,
    ],
    "7":  [
      { subject:"hindi",   teacher:"pragati" },
      { subject:"social",  teacher:"meena"   },
      null,
      { subject:"maths",   teacher:"ayush"   },
    ],
    "8":  [
      { subject:"social",  teacher:"meena"   },
      null,
      { subject:"maths",   teacher:"ayush"   },
      { subject:"science", teacher:"dhun"    },
    ],
    "9":  [
      null,
      { subject:"maths",   teacher:"ayush"   },
      { subject:"science", teacher:"dhun"    },
      { subject:"hindi",   teacher:"pragati" },
    ],
    "10": [
      { subject:"maths",   teacher:"ayush"   },
      { subject:"science", teacher:"dhun"    },
      { subject:"hindi",   teacher:"pragati" },
      { subject:"social",  teacher:"meena"   },
    ],
  },
  saturday: { "6":[], "7":[], "8":[], "9":[], "10":[] },
  sunday:   { "6":[], "7":[], "8":[], "9":[], "10":[] },
};

const DAYS    = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
const SLOTS   = [16, 17, 18, 19]; // 4PM, 5PM, 6PM, 7PM
const SLOT_LABELS = ["4:00 – 5:00 PM", "5:00 – 6:00 PM", "6:00 – 7:00 PM", "7:00 – 8:00 PM"];

export function getLiveSession(studentClass) {
  const now     = new Date();
  const day     = DAYS[now.getDay()];
  const hour    = now.getHours();
  const slotIdx = SLOTS.indexOf(hour);
  if (slotIdx === -1) return null;
  const dayData = TIMETABLE[day];
  if (!dayData) return null;
  const slots = dayData[String(studentClass)];
  if (!slots || slots.length === 0) return null;
  const session = slots[slotIdx];
  if (!session) return { free: true, timeSlot: SLOT_LABELS[slotIdx] };
  return {
    free: false,
    subject:  session.subject,
    teacher:  session.teacher,
    meetLink: MEET_LINKS[session.teacher],
    timeSlot: SLOT_LABELS[slotIdx],
  };
}

export function getTodaySchedule(studentClass) {
  const now     = new Date();
  const day     = DAYS[now.getDay()];
  const dayData = TIMETABLE[day];
  if (!dayData) return [];
  const slots = dayData[String(studentClass)];
  if (!slots || slots.length === 0) return [];
  return slots.map((session, i) => ({
    slotLabel:  SLOT_LABELS[i],
    startHour:  SLOTS[i],
    session,    // null = free period
  }));
}

export function normalizeTeacherKey(key) {
  if (!key) return "ayush";
  const k = key.toLowerCase();
  if (k.includes("ayushman") || k.includes("ayush")) return "ayush";
  if (k.includes("dhun")) return "dhun";
  if (k.includes("pragati") || k.includes("aunty")) return "pragati";
  if (k.includes("meena")) return "meena";
  return k;
}

export function getTeacherLiveSession(teacherKey) {
  const normKey = normalizeTeacherKey(teacherKey);
  const now     = new Date();
  const day     = DAYS[now.getDay()];
  const hour    = now.getHours();
  const slotIdx = SLOTS.indexOf(hour);
  if (slotIdx === -1) return null;
  const dayData = TIMETABLE[day];
  if (!dayData) return null;
  for (const cls of ["6","7","8","9","10"]) {
    const slots = dayData[cls];
    if (!slots || slots.length === 0) continue;
    const session = slots[slotIdx];
    if (session && normalizeTeacherKey(session.teacher) === normKey) {
      return {
        cls,
        subject:  session.subject,
        meetLink: MEET_LINKS[normKey] || MEET_LINKS["ayush"],
        label:    SLOT_LABELS[slotIdx],
      };
    }
  }
  return null;
}

// Full weekly schedule for a class — for timetable view
export function getWeeklySchedule(studentClass) {
  const days = ["monday","tuesday","wednesday","thursday","friday"];
  return days.map(day => ({
    day: day.charAt(0).toUpperCase() + day.slice(1),
    slots: (TIMETABLE[day][String(studentClass)] || []).map((session, i) => ({
      label: SLOT_LABELS[i],
      session,
    })),
  }));
}

export const SUBJECT_META = {
  maths:   { label:"Maths",          color:"#a855f7", icon:"∑",  teacher:"Ayush"   },
  science: { label:"Science",        color:"#00e5ff", icon:"⚗",  teacher:"Dhun"    },
  social:  { label:"Social Science", color:"#34d399", icon:"G",  teacher:"Meena"   },
  hindi:   { label:"Hindi",          color:"#fbbf24", icon:"अ",  teacher:"Pragati" },
};

export const TEACHER_SUBJECTS = {
  ayushman: "maths",
  ayush:    "maths",
  dhun:     "science",
  pragati:  "hindi",
  meena:    "social",
};