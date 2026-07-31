import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Hand,
  Link as LinkIcon,
  LoaderCircle,
  MessageCircle,
  Mic,
  MicOff,
  Radio,
  Send,
  Share2,
  Smile,
  Users,
  Video,
  Volume2,
  WifiOff,
} from 'lucide-react';
import { identity } from '../../config/identity';
import {
  createLivePoller,
  defaultIceServers,
  fetchLiveEvents,
  joinLiveRoom,
  liveClassSupported,
  postLiveEvent,
} from '../../services/liveClass';
import { copyToClipboard } from '../../services/share';

function joinErrorMessage(error) {
  return error?.message || 'تعذر دخول الحصة. تأكد من الإنترنت وكود الدخول.';
}

export default function StudentLiveRoom({ payload, onGoHome }) {
  const [name, setName] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [session, setSession] = useState(null);
  const [joining, setJoining] = useState(false);
  const [notice, setNotice] = useState('');
  const [roomClosed, setRoomClosed] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);
  const [classState, setClassState] = useState(null);
  const [micState, setMicState] = useState('muted');
  const [handRaised, setHandRaised] = useState(false);
  const [chatText, setChatText] = useState('');
  const [activity, setActivity] = useState([]);
  const [screenActive, setScreenActive] = useState(false);
  const videoRef = useRef(null);
  const peerRef = useRef(null);
  const micStreamRef = useRef(null);
  const cursorRef = useRef(0);
  const pendingIceRef = useRef([]);
  const sessionRef = useRef(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
      void videoRef.current.play().catch(() => {
        setNotice('اضغط على زر تشغيل الفيديو للسماح بالصوت.');
      });
    }
  }, [remoteStream]);

  const sendEvent = useCallback(async (event) => {
    const current = sessionRef.current;
    if (!current) return null;
    return postLiveEvent(
      current,
      current.roomId,
      current.participantToken,
      event,
    );
  }, []);

  const ensurePeer = useCallback(() => {
    if (peerRef.current && peerRef.current.connectionState !== 'closed') return peerRef.current;
    const peer = new RTCPeerConnection({ iceServers: defaultIceServers() });
    peer.onicecandidate = (event) => {
      if (!event.candidate) return;
      void sendEvent({
        type: 'webrtc-ice',
        targetId: 'teacher',
        data: { candidate: event.candidate.toJSON?.() || event.candidate },
      });
    };
    peer.ontrack = (event) => {
      const stream = event.streams?.[0] || new MediaStream([event.track]);
      setRemoteStream(stream);
      if (event.track.kind === 'video') setScreenActive(true);
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'failed') {
        setNotice('انقطع البث مؤقتًا. سيتم إعادة المحاولة تلقائيًا.');
      }
    };
    peerRef.current = peer;
    return peer;
  }, [sendEvent]);

  const flushPendingIce = useCallback(async (peer) => {
    const pending = [...pendingIceRef.current];
    pendingIceRef.current = [];
    for (const candidate of pending) await peer.addIceCandidate(candidate).catch(() => null);
  }, []);

  const handleSignal = useCallback(async (event) => {
    if (event.type === 'webrtc-offer' && event.data?.description) {
      const peer = ensurePeer();
      await peer.setRemoteDescription(event.data.description);
      await flushPendingIce(peer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await sendEvent({
        type: 'webrtc-answer',
        targetId: 'teacher',
        data: { description: peer.localDescription },
      });
      return;
    }
    if (event.type === 'webrtc-answer' && event.data?.description) {
      const peer = ensurePeer();
      await peer.setRemoteDescription(event.data.description).catch(() => null);
      await flushPendingIce(peer);
      return;
    }
    if (event.type === 'webrtc-ice' && event.data?.candidate) {
      const peer = ensurePeer();
      if (peer.remoteDescription) await peer.addIceCandidate(event.data.candidate).catch(() => null);
      else pendingIceRef.current.push(event.data.candidate);
    }
  }, [ensurePeer, flushPendingIce, sendEvent]);

  const stopMic = useCallback(() => {
    const hadActiveMic = Boolean(micStreamRef.current?.getAudioTracks().some((track) => track.readyState === 'live'));
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
    const peer = peerRef.current;
    if (peer) {
      for (const sender of peer.getSenders()) {
        if (sender.track?.kind === 'audio') {
          sender.replaceTrack(null).catch(() => null);
        }
      }
    }
    setMicState('muted');
    if (hadActiveMic) {
      void sendEvent({ type: 'mic-stopped', targetId: 'teacher', data: { name, studentCode } });
    }
  }, [name, sendEvent, studentCode]);

  const startMic = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setNotice('الميكروفون غير مدعوم في هذا المتصفح.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      micStreamRef.current?.getTracks().forEach((track) => track.stop());
      micStreamRef.current = stream;
      const peer = ensurePeer();
      const audioTrack = stream.getAudioTracks()[0];
      const existing = peer.getSenders().find((sender) => sender.track?.kind === 'audio');
      if (existing) await existing.replaceTrack(audioTrack);
      else peer.addTrack(audioTrack, stream);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await sendEvent({
        type: 'webrtc-offer',
        targetId: 'teacher',
        data: { description: peer.localDescription },
      });
      setMicState('speaking');
      await sendEvent({ type: 'mic-started', targetId: 'teacher', data: { name, studentCode } });
      setNotice('الميكروفون مفتوح الآن والمعلم يسمعك.');
    } catch (error) {
      setMicState('muted');
      setNotice(error?.name === 'NotAllowedError'
        ? 'لم يتم منح إذن الميكروفون. فعّله من إعدادات المتصفح.'
        : joinErrorMessage(error));
    }
  }, [ensurePeer, name, sendEvent, studentCode]);

  useEffect(() => {
    if (!session) return undefined;
    const stopEvents = createLivePoller({
      intervalMs: 850,
      poll: () => fetchLiveEvents(
        session,
        session.roomId,
        session.participantToken,
        cursorRef.current,
      ),
      onData: async (result) => {
        cursorRef.current = Math.max(cursorRef.current, Number(result.cursor || 0));
        if (result.roomStatus === 'closed') setRoomClosed(true);
        for (const event of result.events || []) {
          await handleSignal(event).catch(() => null);
          if (event.type === 'class-state') setClassState(event.data || null);
          if (event.type === 'screen-started') setScreenActive(true);
          if (event.type === 'screen-stopped') setScreenActive(false);
          if (event.type === 'mic-approved' && !micStreamRef.current) {
            setMicState('approved');
            setNotice('وافق المعلم على فتح الميكروفون. جارٍ تشغيله…');
            void startMic();
          }
          if (event.type === 'mic-revoked') {
            stopMic();
            setNotice('تم كتم الميكروفون بواسطة المعلم.');
          }
          if (event.type === 'participant-removed') {
            stopMic();
            setRoomClosed(true);
            setNotice('أنهى المعلم مشاركتك في الحصة.');
          }
          if (event.type === 'room-closed') {
            stopMic();
            setRoomClosed(true);
            setNotice('انتهت الحصة الأونلاين.');
          }
          if (['reaction', 'chat', 'teacher-message'].includes(event.type)) {
            const message = event.data?.message || event.data?.reaction || '';
            if (message) setActivity((items) => [{ id: event.id, message, role: event.sourceRole }, ...items].slice(0, 20));
          }
        }
      },
      onError: (error) => setNotice(error?.message || 'تعذر استقبال البث.'),
    });
    const heartbeat = setInterval(() => {
      void sendEvent({ type: 'heartbeat', targetId: 'teacher', data: {} });
    }, 15_000);
    return () => {
      stopEvents();
      clearInterval(heartbeat);
    };
  }, [handleSignal, sendEvent, session, startMic, stopMic]);

  useEffect(() => () => {
    stopMic();
    peerRef.current?.close();
  }, [stopMic]);

  const join = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      setNotice('اكتب اسم الطالب أولًا.');
      return;
    }
    setJoining(true);
    setNotice('');
    try {
      const joined = await joinLiveRoom(
        { endpoint: payload.endpoint, workspaceId: payload.workspaceId },
        payload.roomId,
        payload.joinCode,
        { name, studentCode },
      );
      const nextSession = {
        ...joined,
        roomId: payload.roomId,
      };
      setSession(nextSession);
      sessionRef.current = nextSession;
      cursorRef.current = 0;
      ensurePeer();
      await postLiveEvent(
        nextSession,
        nextSession.roomId,
        nextSession.participantToken,
        {
          type: 'student-ready',
          targetId: 'teacher',
          data: { name: name.trim(), studentCode: studentCode.trim() },
        },
      );
      setNotice('تم الدخول. انتظر بدء مشاركة شاشة المعلم.');
    } catch (error) {
      setNotice(joinErrorMessage(error));
    } finally {
      setJoining(false);
    }
  };

  const requestMic = async () => {
    if (!session || roomClosed) return;
    try {
      await sendEvent({
        type: 'mic-request',
        targetId: 'teacher',
        data: { name, studentCode },
      });
      setMicState('requested');
      setNotice('تم إرسال طلب الكلام للمعلم.');
    } catch (error) {
      setNotice(joinErrorMessage(error));
    }
  };

  const raiseHand = async () => {
    if (!session || roomClosed) return;
    try {
      await sendEvent({
        type: 'hand-raised',
        targetId: 'teacher',
        data: { name, studentCode },
      });
      setHandRaised(true);
      setNotice('تم رفع اليد وإبلاغ المعلم.');
      setTimeout(() => setHandRaised(false), 5000);
    } catch (error) {
      setNotice(joinErrorMessage(error));
    }
  };

  const sendReaction = async (reaction) => {
    if (!session || roomClosed) return;
    await sendEvent({
      type: 'reaction',
      data: { name, reaction },
    }).catch((error) => setNotice(joinErrorMessage(error)));
  };

  const sendChat = async () => {
    const message = chatText.trim();
    if (!message || !session || roomClosed) return;
    try {
      await sendEvent({
        type: 'chat',
        data: { name, message: message.slice(0, 300) },
      });
      setChatText('');
      setActivity((items) => [{ id: `local-${Date.now()}`, message, role: 'participant' }, ...items].slice(0, 20));
    } catch (error) {
      setNotice(joinErrorMessage(error));
    }
  };

  if (!payload?.roomId || !payload?.endpoint || !payload?.workspaceId) {
    return (
      <section className="page live-student-page">
        <article className="panel live-student-error">
          <AlertTriangle size={32} />
          <h2>رابط الحصة غير مكتمل</h2>
          <p>اطلب من المعلم إرسال رابط جديد.</p>
          <button className="primary-btn" type="button" onClick={onGoHome}>العودة</button>
        </article>
      </section>
    );
  }

  if (!session) {
    return (
      <section className="page live-student-page">
        <div className="live-student-join-shell">
          <article className="panel live-student-join-card">
            <header>
              <img src={identity.logo} alt={identity.schoolName} />
              <div><span className="eyebrow">حصة أونلاين مباشرة</span><h2>{payload.title || 'منصة المُبدع'}</h2><p>{payload.grade || ''} {payload.lesson ? `• ${payload.lesson}` : ''}</p></div>
            </header>
            {!liveClassSupported() && (
              <div className="settings-notice warning"><WifiOff size={17} /> افتح الرابط من Chrome أو Edge عبر اتصال HTTPS لتشغيل الصوت والبث.</div>
            )}
            <form onSubmit={join}>
              <label><span>اسم الطالب</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="اكتب اسمك" autoComplete="name" /></label>
              <label><span>كود الطالب — اختياري</span><input value={studentCode} onChange={(event) => setStudentCode(event.target.value)} placeholder="مثال: 25" inputMode="numeric" /></label>
              <div className="live-join-code"><span>كود الحصة</span><strong>{payload.joinCode}</strong></div>
              {notice && <div className="settings-notice">{notice}</div>}
              <button className="primary-btn" type="submit" disabled={joining}>{joining ? <LoaderCircle className="spin" size={18} /> : <Radio size={18} />} {joining ? 'جارٍ الدخول…' : 'دخول الحصة'}</button>
            </form>
            <button className="text-btn" type="button" onClick={onGoHome}><ArrowRight size={15} /> العودة للمنصة</button>
          </article>
        </div>
      </section>
    );
  }

  return (
    <section className="page live-student-page is-connected">
      <header className="panel live-student-topbar">
        <div className="live-student-brand"><img src={identity.icon} alt="" /><div><span className="eyebrow live-status-line"><i /> {roomClosed ? 'انتهت الحصة' : 'متصل مباشر'}</span><h2>{payload.title || 'الحصة المباشرة'}</h2></div></div>
        <div className="live-student-top-actions">
          <button className="secondary-btn" type="button" onClick={async () => {
            const copied = await copyToClipboard(globalThis.location?.href || '');
            setNotice(copied ? 'تم نسخ رابط الحصة.' : 'تعذر نسخ الرابط.');
          }}><Share2 size={16} /> مشاركة الرابط</button>
          <button className="secondary-btn" type="button" onClick={onGoHome}><ArrowRight size={16} /> خروج</button>
        </div>
      </header>

      <div className="live-student-layout">
        <main className="panel live-student-stage">
          {remoteStream ? (
            <video ref={videoRef} autoPlay playsInline controls={false} muted={false} />
          ) : classState?.snapshot ? (
            <img className="live-state-snapshot" src={classState.snapshot} alt="شاشة شرح المعلم" />
          ) : (
            <div className="live-waiting-stage">
              {screenActive ? <Video size={48} /> : <Radio size={48} />}
              <h3>{screenActive ? 'جارٍ توصيل البث…' : 'انتظر بدء شرح المعلم'}</h3>
              <p>ستظهر السبورة أو الملف المفتوح هنا تلقائيًا.</p>
            </div>
          )}
          <div className="live-stage-caption">
            <span>{classState?.contentModeLabel || classState?.contentMode || 'الشرح المباشر'}</span>
            <strong>{classState?.resourceTitle || payload.lesson || payload.title}</strong>
            {classState?.page ? <small>صفحة {classState.page}</small> : null}
          </div>
        </main>

        <aside className="live-student-controls">
          <article className="panel">
            <div className="panel-heading compact"><div><span className="eyebrow">المشاركة</span><h3>تفاعل مع المعلم</h3></div><Users size={18} /></div>
            <div className="live-student-action-grid">
              <button className={handRaised ? 'primary-btn active' : 'secondary-btn'} type="button" disabled={roomClosed} onClick={raiseHand}><Hand size={17} /> رفع اليد</button>
              {micState === 'speaking' ? (
                <button className="danger-btn" type="button" onClick={stopMic}><MicOff size={17} /> إغلاق الميكروفون</button>
              ) : (
                <button className={micState === 'requested' ? 'primary-btn active' : 'secondary-btn'} type="button" disabled={roomClosed || micState === 'requested'} onClick={requestMic}><Mic size={17} /> {micState === 'requested' ? 'الطلب مُرسل' : 'طلب الكلام'}</button>
              )}
            </div>
            <div className="live-reaction-row">
              {['👍', '👏', '💡', '✅', '❓'].map((reaction) => <button type="button" key={reaction} disabled={roomClosed} onClick={() => sendReaction(reaction)}>{reaction}</button>)}
            </div>
            <div className="live-mic-status">
              {micState === 'speaking' ? <><Volume2 size={16} /><span>المعلم يسمع صوتك الآن</span></> : <><MicOff size={16} /><span>الميكروفون مغلق</span></>}
            </div>
          </article>

          <article className="panel live-chat-panel">
            <div className="panel-heading compact"><div><span className="eyebrow">الدردشة</span><h3>رسائل الحصة</h3></div><MessageCircle size={18} /></div>
            <div className="live-chat-list">
              {activity.length ? activity.map((item) => <div key={item.id} className={item.role === 'participant' ? 'mine' : ''}><Smile size={13} /><span>{item.message}</span></div>) : <small className="settings-help">لا توجد رسائل بعد.</small>}
            </div>
            <div className="live-chat-compose"><input value={chatText} disabled={roomClosed} onChange={(event) => setChatText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void sendChat(); } }} placeholder="اكتب رسالة قصيرة" /><button className="primary-btn compact-btn" type="button" disabled={roomClosed || !chatText.trim()} onClick={sendChat}><Send size={15} /></button></div>
          </article>

          {notice && <div className="settings-notice live-student-notice">{notice}</div>}
          {roomClosed && <div className="settings-notice warning"><AlertTriangle size={16} /> انتهت الحصة. يمكنك العودة للمنصة.</div>}
        </aside>
      </div>
    </section>
  );
}
