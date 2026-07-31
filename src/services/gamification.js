const LEVEL_SIZE = 500;

export const defaultRewardCatalog = [
  { id: 'reward-game-choice', title: 'اختيار لعبة الحصة القادمة', cost: 500, active: true },
  { id: 'reward-certificate', title: 'شهادة تميز رقمية', cost: 800, active: true },
  { id: 'reward-teacher-gift', title: 'هدية يحددها المعلم', cost: 1200, active: true },
];

function sameStudent(value, student) {
  return String(value ?? '') === String(student?.id ?? '');
}

function gradePercent(result) {
  const total = Number(result?.total || 0);
  const score = Number(result?.score || 0);
  return total > 0 ? Math.max(0, Math.min(100, Math.round((score / total) * 100))) : 0;
}

export function calculateStudentGamification(data = {}, student = {}) {
  const code = String(student.code || student.id || '');
  const gameEntries = [];
  let gameXp = 0;

  for (const result of data.gameResults || []) {
    if (sameStudent(result.studentId, student)) {
      const earned = Math.max(0, Number(result.xp ?? result.score ?? 0));
      gameXp += earned;
      gameEntries.push(result);
    }
    if (sameStudent(result.secondStudentId, student)) {
      const earned = Math.max(0, Number(result.secondScore || 0));
      gameXp += earned;
      gameEntries.push(result);
    }
    if (result.kind === 'online' && Array.isArray(result.scores)) {
      const row = result.scores.find((item) => String(item.studentCode || '') === code);
      if (row) {
        gameXp += Math.max(0, Number(row.score || 0));
        gameEntries.push(result);
      }
    }
  }

  const gradeRows = [
    ...(data.grades || []),
    ...(data.detailedResults || []),
  ].filter((result) => sameStudent(result.studentId, student));
  const gradeAverage = gradeRows.length
    ? Math.round(gradeRows.reduce((sum, result) => sum + gradePercent(result), 0) / gradeRows.length)
    : 0;
  const gradeXp = gradeRows.reduce((sum, result) => sum + Math.round(gradePercent(result) * 1.5), 0);

  const attendanceRows = (data.attendance || []).filter((entry) => sameStudent(entry.studentId, student));
  const presentCount = attendanceRows.filter((entry) => ['present', 'late', 'حاضر', 'متأخر'].includes(entry.status)).length;
  const attendanceXp = presentCount * 20;

  const manualXp = Math.max(0, Number(student.points || student.xp || 0));
  const storedAchievements = (data.achievements || []).filter((item) => sameStudent(item.studentId, student));
  const achievementXp = storedAchievements.length * 100;
  const xp = Math.round(manualXp + gameXp + gradeXp + attendanceXp + achievementXp);
  const level = Math.max(1, Math.floor(xp / LEVEL_SIZE) + 1);
  const levelProgressXp = xp % LEVEL_SIZE;
  const levelProgress = Math.round((levelProgressXp / LEVEL_SIZE) * 100);

  const badges = [...storedAchievements.map((item) => ({
    id: item.key || item.id,
    title: item.title || 'إنجاز',
    icon: item.icon || '🏅',
    date: item.date || '',
    source: 'stored',
  }))];

  const addBadge = (id, title, icon) => {
    if (!badges.some((item) => String(item.id) === String(id))) badges.push({ id, title, icon, source: 'derived' });
  };
  if (presentCount >= 5) addBadge('attendance-5', 'ملتزم بالحضور', '📅');
  if (presentCount >= 15) addBadge('attendance-15', 'بطل الالتزام', '🔥');
  if (gradeRows.length >= 2 && gradeAverage >= 85) addBadge('high-grades', 'متفوق دراسيًا', '🎓');
  if (gameEntries.length >= 5) addBadge('games-5', 'محترف الألعاب', '🎮');
  if (gameEntries.some((result) => result.kind === 'online' && String(result.winner?.studentCode || '') === code)) addBadge('online-winner', 'بطل الأونلاين', '🏆');

  const spent = (data.rewardRedemptions || [])
    .filter((item) => sameStudent(item.studentId, student) && !['rejected', 'cancelled'].includes(item.status))
    .reduce((sum, item) => sum + Math.max(0, Number(item.cost || 0)), 0);

  return {
    xp,
    level,
    levelProgress,
    levelProgressXp,
    nextLevelXp: LEVEL_SIZE,
    spendableXp: Math.max(0, xp - spent),
    gradeAverage,
    presentCount,
    gamesPlayed: gameEntries.length,
    badges,
  };
}

export function rewardCatalogFor(data = {}) {
  const catalog = Array.isArray(data.rewardCatalog) && data.rewardCatalog.length
    ? data.rewardCatalog
    : defaultRewardCatalog;
  return catalog
    .filter((item) => item && item.active !== false)
    .map((item, index) => ({
      id: String(item.id || `reward-${index + 1}`),
      title: String(item.title || 'جائزة').slice(0, 120),
      cost: Math.max(1, Math.round(Number(item.cost || 1))),
      active: item.active !== false,
    }))
    .sort((left, right) => left.cost - right.cost);
}
