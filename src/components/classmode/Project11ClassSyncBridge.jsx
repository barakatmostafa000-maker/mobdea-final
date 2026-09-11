// PROJECT11_CROSS_DEVICE_CLASS_SYNC_V1
import { useEffect, useRef } from 'react';
import {
  buildProject11ClassState,
  project11ClassFingerprint,
  project11DeviceId,
  shouldApplyProject11State,
} from '../../services/project11ClassSync';

export default function Project11ClassSyncBridge({
  data,
  updateData,
  sessionId,
  group,
  grade,
  lessonId,
  resourceId,
  contentMode,
  page,
  boardTemplate,
  boardActions,
  points,
  selectedStudentId,
  students = [],
  setLessonId,
  setResourceId,
  setContentMode,
  setPage,
  setBoardTemplate,
  setBoardActions,
  setPoints,
  setSelectedStudent,
  onNotice,
}) {
  const deviceIdRef = useRef(project11DeviceId());
  const applyingRemoteRef = useRef(false);
  const applyingTimerRef = useRef(null);
  const lastPublishedFingerprintRef = useRef('');
  const lastAppliedAtRef = useRef(0);

  useEffect(() => () => {
    clearTimeout(applyingTimerRef.current);
  }, []);

  useEffect(() => {
    if (!sessionId || applyingRemoteRef.current) return undefined;

    const snapshot = buildProject11ClassState({
      sessionId,
      group,
      grade,
      lessonId,
      resourceId,
      contentMode,
      page,
      boardTemplate,
      boardActions,
      points,
      selectedStudentId,
    }, deviceIdRef.current);

    const fingerprint = project11ClassFingerprint(snapshot);
    if (fingerprint === lastPublishedFingerprintRef.current) return undefined;

    const timer = globalThis.setTimeout(() => {
      if (applyingRemoteRef.current) return;
      lastPublishedFingerprintRef.current = fingerprint;
      void updateData?.((latest) => {
        const current = latest?.classLiveSync;
        if (
          current?.sourceDeviceId === deviceIdRef.current
          && project11ClassFingerprint(current) === fingerprint
        ) return latest;

        return {
          ...latest,
          classLiveSync: {
            ...snapshot,
            fingerprint,
            updatedAt: new Date().toISOString(),
          },
        };
      }).catch((error) => {
        onNotice?.(error?.message || 'تعذر إرسال حالة الحصة للجهاز الآخر.');
      });
    }, 650);

    return () => globalThis.clearTimeout(timer);
  }, [
    sessionId,
    group,
    grade,
    lessonId,
    resourceId,
    contentMode,
    page,
    boardTemplate,
    boardActions,
    points,
    selectedStudentId,
    updateData,
    onNotice,
  ]);

  useEffect(() => {
    const remote = data?.classLiveSync;
    if (!shouldApplyProject11State(remote, {
      deviceId: deviceIdRef.current,
      sessionId,
      lastAppliedAt: lastAppliedAtRef.current,
    })) return;

    const updated = Date.parse(remote.updatedAt || '');
    lastAppliedAtRef.current = updated;
    lastPublishedFingerprintRef.current = project11ClassFingerprint(remote);
    applyingRemoteRef.current = true;
    clearTimeout(applyingTimerRef.current);

    if (remote.lessonId) setLessonId?.(remote.lessonId);
    if (remote.resourceId) setResourceId?.(remote.resourceId);
    if (remote.contentMode) setContentMode?.(remote.contentMode);
    if (remote.page) setPage?.(Math.max(1, Number(remote.page || 1)));
    if (remote.boardTemplate) setBoardTemplate?.(remote.boardTemplate);
    if (Array.isArray(remote.boardActions)) setBoardActions?.(remote.boardActions);
    if (remote.points && typeof remote.points === 'object') setPoints?.(remote.points);

    if (remote.selectedStudentId) {
      const student = students.find((item) => String(item.id) === String(remote.selectedStudentId));
      if (student) setSelectedStudent?.(student);
    }

    onNotice?.('تم تحديث الحصة من جهاز آخر.');
    applyingTimerRef.current = globalThis.setTimeout(() => {
      applyingRemoteRef.current = false;
    }, 900);
  }, [
    data?.classLiveSync,
    sessionId,
    students,
    setLessonId,
    setResourceId,
    setContentMode,
    setPage,
    setBoardTemplate,
    setBoardActions,
    setPoints,
    setSelectedStudent,
    onNotice,
  ]);

  return null;
}
