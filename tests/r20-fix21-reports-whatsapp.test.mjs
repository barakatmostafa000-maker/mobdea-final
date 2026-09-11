import assert from "node:assert/strict";
import test from "node:test";

class MemoryStorage {
  constructor() {
    this.map =
      new Map();
  }

  getItem(key) {
    return this.map.has(key)
      ? this.map.get(key)
      : null;
  }

  setItem(key, value) {
    this.map.set(
      String(key),
      String(value),
    );
  }

  key(index) {
    return [
      ...this.map.keys(),
    ][index] ??
      null;
  }

  get length() {
    return this.map.size;
  }
}

globalThis.localStorage =
  new MemoryStorage();

const module =
  await import(
    "../src/services/r20ReportsWhatsApp.js"
  );

const {
  normalizeWhatsAppPhone,
  resolveStudentContact,
  viewerCanAccessStudent,
  formatWhatsAppReport,
  buildWhatsAppUrl,
} = module;

test("FIX21 normalizes Egyptian parent phones safely", () => {
  assert.equal(
    normalizeWhatsAppPhone(
      "010 1234 5678",
    ),
    "201012345678",
  );

  assert.equal(
    normalizeWhatsAppPhone(
      "+20 10 1234 5678",
    ),
    "201012345678",
  );

  assert.equal(
    normalizeWhatsAppPhone(
      "٠١٠١٢٣٤٥٦٧٨",
    ),
    "201012345678",
  );

  assert.equal(
    normalizeWhatsAppPhone(
      "0123",
    ),
    "",
  );
});

test("FIX21 resolves the parent phone only from the exact student record", () => {
  localStorage.setItem(
    "students",
    JSON.stringify({
      students: [
        {
          id:
            "STU-1",
          name:
            "أحمد",
          parentPhone:
            "01012345678",
        },
        {
          id:
            "STU-2",
          name:
            "محمد",
          parentPhone:
            "01199999999",
        },
      ],
    }),
  );

  const contact =
    resolveStudentContact(
      "STU-1",
      localStorage,
    );

  assert.equal(
    contact.studentName,
    "أحمد",
  );

  assert.equal(
    contact.whatsappPhone,
    "201012345678",
  );
});

test("FIX21 portal report scope is strict", () => {
  assert.equal(
    viewerCanAccessStudent(
      {
        role:
          "student",
        studentId:
          "STU-1",
      },
      "STU-1",
    ),
    true,
  );

  assert.equal(
    viewerCanAccessStudent(
      {
        role:
          "student",
        studentId:
          "STU-1",
      },
      "STU-2",
    ),
    false,
  );

  assert.equal(
    viewerCanAccessStudent(
      {
        role:
          "parent",
        linkedStudentIds:
          [
            "STU-1",
          ],
      },
      "STU-2",
    ),
    false,
  );

  assert.equal(
    viewerCanAccessStudent(
      {
        role:
          "parent",
        linkedStudentIds:
          [
            "STU-1",
          ],
      },
      "STU-1",
    ),
    true,
  );
});

test("FIX21 WhatsApp message contains every grouped weakness", () => {
  const report = {
    studentId:
      "STU-1",
    studentName:
      "أحمد",
    examCode:
      "EX-123456789ABC",
    examTitle:
      "امتحان الوحدة",
    percentage:
      70,
    correctCount:
      7,
    wrongCount:
      3,
    ungradedCount:
      0,
    examWeaknesses: [
      {
        count:
          2,
        metadata: {
          lesson:
            "الموقع",
        },
      },
      {
        count:
          1,
        metadata: {
          lesson:
            "المناخ",
        },
      },
    ],
    cumulativeWeaknesses: [
      {
        totalWrong:
          4,
        metadata: {
          unit:
            "الوحدة الأولى",
        },
      },
      {
        totalWrong:
          2,
        metadata: {
          unit:
            "الوحدة الثانية",
        },
      },
    ],
  };

  const message =
    formatWhatsAppReport(
      report,
    );

  for (
    const token of [
      "الموقع",
      "المناخ",
      "الوحدة الأولى",
      "الوحدة الثانية",
      "EX-123456789ABC",
    ]
  ) {
    assert.match(
      message,
      new RegExp(
        token,
      ),
    );
  }
});

test("FIX21 WhatsApp URL is explicit and encoded", () => {
  const url =
    buildWhatsAppUrl(
      "01012345678",
      "تقرير الطالب\nسطر ثانٍ",
    );

  assert.match(
    url,
    /^https:\/\/wa\.me\/201012345678\?text=/,
  );

  assert.ok(
    url.includes(
      "%0A",
    ),
  );
});
