export function rankStudentsByPoints(students = [], livePoints = {}) {
  return (students || [])
    .map((student, index) => ({
      student,
      index,
      score: Math.max(0, Number(livePoints?.[student.id] ?? student.points ?? 0)),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.student);
}
