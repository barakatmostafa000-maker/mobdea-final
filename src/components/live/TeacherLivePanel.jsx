import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Cast,
  Copy,
  Hand,
  Link,
  Mic,
  MicOff,
  MonitorUp,
  Radio,
  ScreenShareOff,
  UserRoundX,
  Users,
  Volume2,
  WifiOff,
  X,
} from 'lucide-react';
import {
  buildLiveStudentLink,
  closeLiveRoom,
  createLivePoller,
  createLiveRoom,
  defaultIceServers,
  fetchLiveEvents,
  listLiveParticipants,
  liveClassSupported,
  postLiveEvent,
  updateLiveParticipant,
  validateLiveStudentLink,
} from '../../services/liveClass';
import { cloudConfigured } from '../../services/cloudSync';
import { copyToClipboard } from '../../services/share';


function friendlyLiveError(error, fallback = 'تعذر تشغيل الحصة الأونلاين.') {
  const raw = String(error?.message || error || '').trim();
  const normalized = raw.toLowerCase();

  if (normalized.includes('unauthorized') || normalized.includes('401') || normalized.includes('forbidden') || normalized.includes('403')) {
    return 'تعذر إنشاء رابط الحصة: رمز مساحة العمل غير صحيح أو غير محفوظ. راجع إعدادات المزامنة السحابية.';
  }
  if (normalized.includes('failed to fetch') || normalized.includes('network') || normalized.includes('internet')) {
    return 'تعذر الاتصال بخادم الحصة. تأكد من الإنترنت ثم حاول مرة أخرى.';
  }
  if (normalized.includes('timeout') || normalized.includes('مهلة')) {
    return 'استغرق الخادم وقتًا طويلًا في الرد. حاول مرة أخرى بعد لحظات.';
  }
  return raw || fallback;
}

function participantLabel(participant) {
  return participant.studentCode
    ? `${participant.name} — ${participant.studentCode}`
    : participant.name;
}

function eventMessage(event) {
  const name = event?.data?.name || event?.data?.studentName || 'طالب';
  switch (event?.type) {
    case 'participant-joined':
      return `دخل ${name} إلى الحصة.`;
    case 'mic-request':
      return `${name} يطلب فتح الميكروفون.`;
    case 'hand-raised':
      return `${name} رفع يده.`;
    case 'reaction':
      return `${name}: ${event?.data?.reaction || '👍'}`;
    case 'chat':
      return `${name}: ${event?.data?.message || ''}`;
    default:
      return '';
  }
}

async function compressSnapshot(dataUrl) {
  if (!dataUrl || !String(dataUrl).startsWith('data:image/')) return '';
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio = Math.min(1, 720 / image.width, 405 / image.height);
      canvas.width = Math.max(1, Math.round(image.width * ratio));
      canvas.height = Math.max(1, Math.round(image.height * ratio));
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.5));
    };
    image.onerror = () => resolve('');
    image.src = dataUrl;
  });
}

export default function TeacherLivePanel({
  cloudSync,
  roomMeta,
  liveState,
  buildSnapshot,
  onNotice,
  onOpenSettings,
  startRequest = 0,
}) {
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [activity, setActivity] = useState([]);
  const [busy, setBusy] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [teacherAudioActive, setTeacherAudioActive] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [participantVolumes, setParticipantVolumes] = useState({});
  const roomRef = useRef(null);
  const eventCursorRef = useRef(0);
  const peersRef = useRef(new Map());
  const remoteAudioRef = useRef(new Map());
  const screenStreamRef = useRef(null);
  const teacherMicStreamRef = useRef(null);
  const liveStateRef = useRef(liveState);
  const buildSnapshotRef = useRef(buildSnapshot);
  const participantsRef = useRef(participants);
  const renegotiatingRef = useRef(new Set());
  const pendingIceRef = useRef(new Map());
  const lastStartRequestRef = useRef(0);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    liveStateRef.current = liveState;
  }, [liveState]);

  useEffect(() => {
    buildSnapshotRef.current = buildSnapshot;
  }, [buildSnapshot]);

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  const configured = cloudConfigured({ cloudSync });
  const supported = liveClassSupported();
  const makeStudentLink = useCallback((activeRoom) => {
    if (!activeRoom) return '';
    return buildLiveStudentLink({
      roomId: activeRoom.roomId,
      joinCode: activeRoom.joinCode,
      endpoint: activeRoom.endpoint,
      workspaceId: activeRoom.workspaceId,
      title: roomMeta.title,
      grade: roomMeta.grade,
      lesson: roomMeta.lesson,
      expiresAt: activeRoom.expiresAt,
    });
  }, [roomMeta.grade, roomMeta.lesson, roomMeta.title]);
  const studentLink = useMemo(() => {
    try {
      return makeStudentLink(room);
    } catch {
      return '';
    }
  }, [makeStudentLink, room]);

  const announce = useCallback((message) => {
    if (!message) return;
    onNotice?.(message);
  }, [onNotice]);

  const sendEvent = useCallback(async (event) => {
    const currentRoom = roomRef.current;
    if (!currentRoom) return null;
    return postLiveEvent(
      currentRoom,
      currentRoom.roomId,
      currentRoom.teacherToken,
      event,
    );
  }, []);

  const closePeer = useCallback((participantId) => {
    const peer = peersRef.current.get(participantId);
    if (peer) {
      peer.ontrack = null;
      peer.onicecandidate = null;
      peer.close();
      peersRef.current.delete(participantId);
    }
    const audio = remoteAudioRef.current.get(participantId);
    if (audio) {
      audio.pause?.();
      audio.srcObject = null;
      remoteAudioRef.current.delete(participantId);
    }
  }, []);

  const attachTeacherTracks = useCallback((peer) => {
    const tracks = [
      ...(screenStreamRef.current?.getVideoTracks() || []),
      ...(screenStreamRef.current?.getAudioTracks() || []),
      ...(teacherMicStreamRef.current?.getAudioTracks() || []),
    ];
    const senders = peer.getSenders();
    for (const track of tracks) {
      const existing = senders.find((sender) => sender.track?.kind === track.kind);
      if (existing) void existing.replaceTrack(track);
      else peer.addTrack(track, new MediaStream([track]));
    }
  }, []);

  const flushPendingIce = useCallback(async (participantId, peer) => {
    const pending = pendingIceRef.current.get(participantId) || [];
    pendingIceRef.current.delete(participantId);
    for (const candidate of pending) {
      await peer.addIceCandidate(candidate).catch(() => null);
    }
  }, []);

  const ensurePeer = useCallback((participantId) => {
    const existing = peersRef.current.get(participantId);
    if (existing && existing.connectionState !== 'closed') return existing;
    const peer = new RTCPeerConnection({ iceServers: defaultIceServers() });
    peer.onicecandidate = (event) => {
      if (!event.candidate) return;
      void sendEvent({
        type: 'webrtc-ice',
        targetId: participantId,
        data: { candidate: event.candidate.toJSON?.() || event.candidate },
      });
    };
    peer.ontrack = (event) => {
      const stream = event.streams?.[0] || new MediaStream([event.track]);
      let audio = remoteAudioRef.current.get(participantId);
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        audio.playsInline = true;
        remoteAudioRef.current.set(participantId, audio);
      }
      audio.srcObject = stream;
      const participant = participantsRef.current.find((item) => item.id === participantId);
      const approved = ['approved', 'speaking'].includes(participant?.micState);
      audio.volume = Number(participantVolumes[participantId] ?? 1);
      audio.muted = !approved || participant?.muted === true;
      void audio.play().catch(() => {
        announce('اضغط داخل الشاشة مرة واحدة للسماح بتشغيل صوت الطالب.');
      });
    };
    peer.onconnectionstatechange = () => {
      if (['failed', 'closed'].includes(peer.connectionState)) closePeer(participantId);
    };
    attachTeacherTracks(peer);
    peersRef.current.set(participantId, peer);
    return peer;
  }, [announce, attachTeacherTracks, closePeer, participantVolumes, sendEvent]);

  const sendOffer = useCallback(async (participantId) => {
    if (renegotiatingRef.current.has(participantId)) return;
    renegotiatingRef.current.add(participantId);
    try {
      const peer = ensurePeer(participantId);
      attachTeacherTracks(peer);
      const offer = await peer.createOffer({ offerToReceiveAudio: true });
      await peer.setLocalDescription(offer);
      await sendEvent({
        type: 'webrtc-offer',
        targetId: participantId,
        data: { description: peer.localDescription },
      });
    } catch (error) {
      announce(error?.message || 'تعذر ربط بث الشاشة مع الطالب.');
    } finally {
      renegotiatingRef.current.delete(participantId);
    }
  }, [announce, attachTeacherTracks, ensurePeer, sendEvent]);

  const handleSignalEvent = useCallback(async (event) => {
    const participantId = event.sourceId;
    if (!participantId || participantId === 'teacher') return;
    if (event.type === 'webrtc-answer') {
      const peer = ensurePeer(participantId);
      if (event.data?.description && peer.signalingState !== 'closed') {
        await peer.setRemoteDescription(event.data.description).catch(() => null);
        await flushPendingIce(participantId, peer);
      }
      return;
    }
    if (event.type === 'webrtc-offer') {
      const peer = ensurePeer(participantId);
      attachTeacherTracks(peer);
      if (!event.data?.description) return;
      await peer.setRemoteDescription(event.data.description);
      await flushPendingIce(participantId, peer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await sendEvent({
        type: 'webrtc-answer',
        targetId: participantId,
        data: { description: peer.localDescription },
      });
      return;
    }
    if (event.type === 'webrtc-ice' && event.data?.candidate) {
      const peer = ensurePeer(participantId);
      if (peer.remoteDescription) await peer.addIceCandidate(event.data.candidate).catch(() => null);
      else {
        const pending = pendingIceRef.current.get(participantId) || [];
        pending.push(event.data.candidate);
        pendingIceRef.current.set(participantId, pending.slice(-100));
      }
    }
  }, [attachTeacherTracks, ensurePeer, flushPendingIce, sendEvent]);

  useEffect(() => {
    if (!room) return undefined;
    let stopped = false;
    const refreshParticipants = async () => {
      const result = await listLiveParticipants(room, room.roomId, room.teacherToken);
      if (!stopped) setParticipants(result.participants || []);
    };
    const stopParticipants = createLivePoller({
      intervalMs: 3000,
      poll: refreshParticipants,
      onError: () => {},
    });
    const stopEvents = createLivePoller({
      intervalMs: 900,
      poll: () => fetchLiveEvents(
        room,
        room.roomId,
        room.teacherToken,
        eventCursorRef.current,
      ),
      onData: async (result) => {
        eventCursorRef.current = Math.max(eventCursorRef.current, Number(result.cursor || 0));
        for (const event of result.events || []) {
          await handleSignalEvent(event).catch(() => null);
          if (['participant-joined', 'student-ready', 'mic-started', 'mic-stopped'].includes(event.type)) {
            void refreshParticipants();
            if (screenStreamRef.current) void sendOffer(event.sourceId || event.data?.participantId);
          }
          if (['mic-request', 'hand-raised', 'reaction', 'chat', 'participant-joined'].includes(event.type)) {
            const message = eventMessage(event);
            if (message) setActivity((items) => [{ id: event.id, message }, ...items].slice(0, 12));
          }
        }
        if (result.roomStatus === 'closed') {
          setRoom(null);
          announce('انتهت الحصة الأونلاين.');
        }
      },
      onError: (error) => {
        if (!stopped) announce(friendlyLiveError(error, 'تعذر تحديث الحصة الأونلاين.'));
      },
    });
    return () => {
      stopped = true;
      stopParticipants();
      stopEvents();
    };
  }, [announce, handleSignalEvent, room, sendOffer]);

  useEffect(() => {
    if (!room) return undefined;
    const timer = setTimeout(async () => {
      try {
        let snapshot = '';
        if (!screenSharing && buildSnapshotRef.current) {
          snapshot = await compressSnapshot(await buildSnapshotRef.current());
        }
        await sendEvent({
          type: 'class-state',
          targetId: 'all',
          data: { ...liveStateRef.current, snapshot },
        });
      } catch {
        // A missed state frame is harmless; the next state change retries.
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [
    room,
    screenSharing,
    liveState?.contentMode,
    liveState?.resourceId,
    liveState?.page,
    liveState?.boardRevision,
    liveState?.pointsRevision,
  ]);

  useEffect(() => () => {
    for (const participantId of peersRef.current.keys()) closePeer(participantId);
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    teacherMicStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, [closePeer]);

  const copyRoomLink = useCallback(async (link = studentLink) => {
    if (!link || !validateLiveStudentLink(link)) {
      announce('رابط الحصة غير مكتمل. أعد إنشاء الغرفة.');
      return false;
    }
    const copied = await copyToClipboard(link);
    announce(copied ? 'تم نسخ رابط الحصة الأونلاين.' : 'الرابط جاهز؛ افتح لوحة الحصة واضغط معاينة أو انسخه يدويًا.');
    return copied;
  }, [announce, studentLink]);

  const startRoom = useCallback(async ({ copyAfterCreate = true } = {}) => {
    if (!configured) {
      announce('زر الحصة يعمل، لكن يلزم حفظ رمز مساحة العمل مرة واحدة في إعدادات المزامنة السحابية.');
      setPanelOpen(true);
      onOpenSettings?.();
      return null;
    }
    if (busy) return null;
    setBusy(true);
    try {
      const created = await createLiveRoom({ cloudSync }, roomMeta);
      const createdLink = makeStudentLink(created);
      if (!validateLiveStudentLink(createdLink)) throw new Error('تعذر تكوين رابط الطالب بعد إنشاء الغرفة.');
      roomRef.current = created;
      setRoom(created);
      eventCursorRef.current = 0;
      setParticipants([]);
      setActivity([]);
      setPanelOpen(true);
      if (copyAfterCreate) {
        const copied = await copyToClipboard(createdLink);
        announce(copied
          ? 'تم إنشاء الحصة ونسخ رابط الطالب تلقائيًا.'
          : 'تم إنشاء الحصة. افتح لوحة الأونلاين لنسخ الرابط أو معاينته.');
      } else {
        announce('تم إنشاء الحصة الأونلاين بنجاح.');
      }
      return { room: created, link: createdLink };
    } catch (error) {
      announce(friendlyLiveError(error, 'تعذر إنشاء الحصة الأونلاين.'));
      return null;
    } finally {
      setBusy(false);
    }
  }, [announce, busy, cloudSync, configured, makeStudentLink, onOpenSettings, roomMeta]);

  useEffect(() => {
    if (!startRequest || startRequest === lastStartRequestRef.current) return;
    lastStartRequestRef.current = startRequest;

    if (roomRef.current) {
      setPanelOpen(true);
      const link = makeStudentLink(roomRef.current);
      void copyRoomLink(link);
      return;
    }

    void startRoom({ copyAfterCreate: true });
  }, [copyRoomLink, makeStudentLink, startRequest, startRoom]);

  const startTeacherAudio = async () => {
    if (!room || teacherAudioActive) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      announce('ميكروفون المعلم غير مدعوم على هذا الجهاز.');
      return;
    }
    setBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      teacherMicStreamRef.current?.getTracks().forEach((track) => track.stop());
      teacherMicStreamRef.current = stream;
      setTeacherAudioActive(true);
      for (const participant of participantsRef.current) {
        if (participant.online !== false) void sendOffer(participant.id);
      }
      announce('تم تشغيل صوت المعلم للطلاب.');
    } catch (error) {
      announce(error?.name === 'NotAllowedError'
        ? 'لم يتم منح إذن ميكروفون المعلم.'
        : error?.message || 'تعذر تشغيل ميكروفون المعلم.');
    } finally {
      setBusy(false);
    }
  };

  const stopTeacherAudio = async () => {
    teacherMicStreamRef.current?.getTracks().forEach((track) => track.stop());
    teacherMicStreamRef.current = null;
    setTeacherAudioActive(false);
    for (const [participantId, peer] of peersRef.current.entries()) {
      for (const sender of peer.getSenders()) {
        if (sender.track?.kind === 'audio') await sender.replaceTrack(null).catch(() => null);
      }
      if (screenStreamRef.current?.getAudioTracks().length) void sendOffer(participantId);
    }
    announce('تم إيقاف صوت المعلم.');
  };

  const startScreenShare = async () => {
    if (!room) return;
    if (!navigator.mediaDevices?.getDisplayMedia) {
      announce('مشاركة الشاشة غير مدعومة في هذا المتصفح؛ سيستمر إرسال حالة الدرس والسبورة تلقائيًا.');
      return;
    }
    setBusy(true);
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15, max: 24 } },
        audio: true,
      });
      screenStreamRef.current = displayStream;
      if (!teacherMicStreamRef.current) {
        try {
          teacherMicStreamRef.current = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: false,
          });
          setTeacherAudioActive(true);
        } catch {
          announce('تمت مشاركة الشاشة بدون ميكروفون المعلم. يمكنك تشغيل الصوت من الزر المخصص.');
        }
      }
      displayStream.getVideoTracks()[0]?.addEventListener('ended', () => {
        setScreenSharing(false);
        screenStreamRef.current = null;
        void sendEvent({ type: 'screen-stopped', targetId: 'all', data: {} });
      }, { once: true });
      setScreenSharing(true);
      await sendEvent({ type: 'screen-started', targetId: 'all', data: {} });
      for (const participant of participantsRef.current) {
        if (participant.online !== false) void sendOffer(participant.id);
      }
      announce('بدأ بث شاشة الحصة وصوت المعلم للطلاب.');
    } catch (error) {
      if (error?.name !== 'NotAllowedError') announce(error?.message || 'تعذر بدء مشاركة الشاشة.');
      else announce('لم يتم منح إذن مشاركة الشاشة.');
    } finally {
      setBusy(false);
    }
  };

  const stopScreenShare = async () => {
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    setScreenSharing(false);
    await sendEvent({ type: 'screen-stopped', targetId: 'all', data: {} }).catch(() => null);
    announce('تم إيقاف بث الشاشة، والحصة الأونلاين ما زالت مفتوحة.');
  };

  const approveMic = async (participant) => {
    try {
      await updateLiveParticipant(
        room,
        room.roomId,
        room.teacherToken,
        participant.id,
        { micState: 'approved', muted: false },
      );
      setParticipants((items) => items.map((item) => (
        item.id === participant.id
          ? { ...item, micState: 'approved', muted: false }
          : item
      )));
      const audio = remoteAudioRef.current.get(participant.id);
      if (audio) audio.muted = false;
      announce(`تم السماح لـ ${participant.name} بفتح الميكروفون.`);
    } catch (error) {
      announce(error?.message || 'تعذر فتح ميكروفون الطالب.');
    }
  };

  const muteParticipant = async (participant) => {
    try {
      await updateLiveParticipant(
        room,
        room.roomId,
        room.teacherToken,
        participant.id,
        { micState: 'muted', muted: true },
      );
      const audio = remoteAudioRef.current.get(participant.id);
      if (audio) audio.muted = true;
      setParticipants((items) => items.map((item) => (
        item.id === participant.id
          ? { ...item, micState: 'muted', muted: true }
          : item
      )));
    } catch (error) {
      announce(error?.message || 'تعذر كتم الطالب.');
    }
  };

  const muteAllParticipants = async () => {
    const eligible = participants.filter((participant) => participant.micState !== 'muted');
    if (!eligible.length) {
      announce('كل ميكروفونات الطلاب مغلقة بالفعل.');
      return;
    }
    setBusy(true);
    try {
      await Promise.all(eligible.map((participant) => updateLiveParticipant(
        room,
        room.roomId,
        room.teacherToken,
        participant.id,
        { micState: 'muted', muted: true },
      )));
      for (const audio of remoteAudioRef.current.values()) audio.muted = true;
      setParticipants((items) => items.map((item) => ({ ...item, micState: 'muted', muted: true })));
      announce('تم كتم جميع الطلاب.');
    } catch (error) {
      announce(error?.message || 'تعذر كتم جميع الطلاب.');
    } finally {
      setBusy(false);
    }
  };

  const removeParticipant = async (participant) => {
    try {
      await updateLiveParticipant(
        room,
        room.roomId,
        room.teacherToken,
        participant.id,
        { micState: 'muted', muted: true, removed: true },
      );
      closePeer(participant.id);
      setParticipants((items) => items.filter((item) => item.id !== participant.id));
      announce(`تم إخراج ${participant.name} من الحصة.`);
    } catch (error) {
      announce(error?.message || 'تعذر إخراج الطالب.');
    }
  };

  const setParticipantVolume = (participantId, value) => {
    const volume = Math.max(0, Math.min(1, Number(value)));
    setParticipantVolumes((current) => ({ ...current, [participantId]: volume }));
    const audio = remoteAudioRef.current.get(participantId);
    if (audio) {
      audio.volume = volume;
      audio.muted = volume === 0;
    }
  };

  const endRoom = async () => {
    if (!room) return;
    setBusy(true);
    try {
      if (screenSharing) await stopScreenShare();
      teacherMicStreamRef.current?.getTracks().forEach((track) => track.stop());
      teacherMicStreamRef.current = null;
      setTeacherAudioActive(false);
      await closeLiveRoom(room, room.roomId, room.teacherToken);
      for (const participantId of peersRef.current.keys()) closePeer(participantId);
      setRoom(null);
      setParticipants([]);
      setPanelOpen(false);
      announce('تم إنهاء الحصة الأونلاين.');
    } catch (error) {
      announce(error?.message || 'تعذر إنهاء الحصة الأونلاين.');
    } finally {
      setBusy(false);
    }
  };

  if (!room) {
    return (
      <article className="panel classmode-side-panel live-teacher-panel is-idle">
        <div className="panel-heading compact">
          <div>
            <span className="eyebrow">الحصة الأونلاين</span>
            <h3>بث مباشر للطلاب</h3>
          </div>
          <Radio size={18} />
        </div>
        <p className="live-panel-description">
          أنشئ رابطًا واحدًا؛ يشاهد الطلاب الشرح ويطلبون فتح الميكروفون من أجهزتهم.
        </p>
        {!configured && (
          <div className="settings-notice warning">
            <WifiOff size={16} /> فعّل المزامنة السحابية من الإعدادات أولًا.
          </div>
        )}
        {!supported && (
          <div className="settings-notice warning">
            هذا الجهاز لا يدعم WebRTC كاملًا؛ سيعمل رابط المحتوى دون بث الصوت والصورة.
          </div>
        )}
        <div className="live-idle-actions">
          <button
            className="primary-btn"
            type="button"
            disabled={busy}
            onClick={() => void startRoom({ copyAfterCreate: true })}
          >
            <Radio size={17} /> {busy ? 'جارٍ الإنشاء…' : 'بدء حصة أونلاين'}
          </button>
          {!configured && (
            <button className="secondary-btn" type="button" onClick={onOpenSettings}>
              <Link size={16} /> إعداد الرابط الآن
            </button>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className={`panel classmode-side-panel live-teacher-panel ${panelOpen ? 'is-open' : 'is-collapsed'}`}>
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow live-status-line"><i /> مباشر الآن</span>
          <h3>{roomMeta.title || 'الحصة المباشرة'}</h3>
        </div>
        <button className="icon-action" type="button" onClick={() => setPanelOpen((value) => !value)} title={panelOpen ? 'تصغير' : 'فتح'}>
          {panelOpen ? <X size={17} /> : <Radio size={17} />}
        </button>
      </div>

      <div className="live-room-code-row">
        <div><span>كود الدخول</span><strong>{room.joinCode}</strong></div>
        <button className="secondary-btn" type="button" onClick={() => void copyRoomLink()}><Copy size={15} /> نسخ الرابط</button>
      </div>

      {panelOpen && (
        <>
          <div className="live-broadcast-actions">
            {!screenSharing ? (
              <button className="primary-btn" type="button" disabled={busy} onClick={startScreenShare}>
                <MonitorUp size={16} /> مشاركة الشاشة والصوت
              </button>
            ) : (
              <button className="danger-btn" type="button" onClick={stopScreenShare}>
                <ScreenShareOff size={16} /> إيقاف مشاركة الشاشة
              </button>
            )}
            <button className={teacherAudioActive ? 'danger-btn' : 'secondary-btn'} type="button" disabled={busy} onClick={teacherAudioActive ? stopTeacherAudio : startTeacherAudio}>
              {teacherAudioActive ? <MicOff size={16} /> : <Mic size={16} />} {teacherAudioActive ? 'إيقاف صوت المعلم' : 'تشغيل صوت المعلم'}
            </button>
            <button className="secondary-btn" type="button" onClick={() => validateLiveStudentLink(studentLink) && globalThis.open?.(studentLink, '_blank', 'noopener,noreferrer')}>
              <Link size={16} /> معاينة رابط الطالب
            </button>
          </div>

          <div className="live-participant-heading">
            <span><Users size={16} /> الطلاب المتصلون</span>
            <div><b>{participants.filter((item) => item.online !== false).length}</b><button className="secondary-btn compact-btn" type="button" disabled={busy || !participants.length} onClick={muteAllParticipants}><MicOff size={14} /> كتم الجميع</button></div>
          </div>
          <div className="live-participant-list">
            {participants.length ? participants.map((participant) => (
              <div className={`live-participant-row mic-${participant.micState || 'muted'}`} key={participant.id}>
                <div className="live-participant-name">
                  <i className={participant.online ? 'online' : 'offline'} />
                  <span><strong>{participantLabel(participant)}</strong><small>{participant.micState === 'requested' ? 'يطلب الكلام' : participant.micState === 'approved' ? 'مسموح بالميكروفون' : 'الميكروفون مكتوم'}</small></span>
                </div>
                <div className="live-participant-controls">
                  {participant.micState === 'requested' || participant.micState === 'muted' ? (
                    <button className="primary-btn compact-btn" type="button" onClick={() => approveMic(participant)} title="السماح بالكلام"><Mic size={14} /></button>
                  ) : (
                    <button className="secondary-btn compact-btn" type="button" onClick={() => muteParticipant(participant)} title="كتم"><MicOff size={14} /></button>
                  )}
                  <label className="live-volume-control" title="مستوى صوت الطالب">
                    <Volume2 size={14} />
                    <input type="range" min="0" max="1" step="0.05" value={participantVolumes[participant.id] ?? 1} onChange={(event) => setParticipantVolume(participant.id, event.target.value)} />
                  </label>
                  <button className="icon-action danger-text" type="button" onClick={() => removeParticipant(participant)} title="إخراج الطالب"><UserRoundX size={14} /></button>
                </div>
              </div>
            )) : <small className="settings-help">لم يدخل أي طالب بعد.</small>}
          </div>

          {activity.length > 0 && (
            <div className="live-activity-list">
              {activity.map((item) => <div key={item.id}><Hand size={13} /><span>{item.message}</span></div>)}
            </div>
          )}

          <button className="danger-btn live-end-room" type="button" disabled={busy} onClick={endRoom}>
            <Cast size={16} /> إنهاء الحصة الأونلاين
          </button>
        </>
      )}
    </article>
  );
}
