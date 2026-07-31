import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CircleStop,
  Copy,
  Gamepad2,
  Link,
  LoaderCircle,
  Play,
  Radio,
  RotateCcw,
  Trophy,
  Users,
  WifiOff,
} from 'lucide-react';
import {
  buildLiveStudentLink,
  closeLiveRoom,
  createLivePoller,
  createLiveRoom,
  fetchLiveEvents,
  listLiveParticipants,
  postLiveEvent,
} from '../../services/liveClass';
import { cloudConfigured } from '../../services/cloudSync';
import { copyToClipboard } from '../../services/share';
import {
  normalizeOnlineQuestions,
  publicOnlineQuestion,
  scoreOnlineAnswer,
  sortedOnlineScoreboard,
} from '../../services/onlineGame';

const QUESTION_SECONDS = 25;

function errorText(error, fallback) {
  return error?.message || fallback;
}

export default function OnlineGameHostPanel({
  cloudSync,
  title = 'تحدي أونلاين',
  grade = '',
  unit = '',
  questions = [],
  onNotice,
  onFinish,
}) {
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [phase, setPhase] = useState('idle');
  const [questionIndex, setQuestionIndex] = useState(-1);
  const [scores, setScores] = useState({});
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(QUESTION_SECONDS);
  const roomRef = useRef(null);
  const cursorRef = useRef(0);
  const processedEventsRef = useRef(new Set());
  const currentQuestionStartedAtRef = useRef(0);
  const answersRef = useRef({});
  const scoresRef = useRef({});
  const phaseRef = useRef(phase);
  const questionIndexRef = useRef(questionIndex);

  const questionSet = useMemo(
    () => normalizeOnlineQuestions(questions, 10),
    [questions],
  );
  const currentQuestion = questionSet[questionIndex] || null;
  const scoreboard = useMemo(
    () => sortedOnlineScoreboard(participants, scores),
    [participants, scores],
  );
  const configured = cloudConfigured({ cloudSync });

  useEffect(() => {
    roomRef.current = room;
  }, [room]);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  useEffect(() => {
    scoresRef.current = scores;
  }, [scores]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    questionIndexRef.current = questionIndex;
  }, [questionIndex]);

  const showNotice = useCallback((message) => {
    setNotice(message);
    onNotice?.(message);
  }, [onNotice]);

  const send = useCallback(async (event) => {
    const activeRoom = roomRef.current;
    if (!activeRoom) return null;
    return postLiveEvent(
      activeRoom,
      activeRoom.roomId,
      activeRoom.teacherToken,
      event,
    );
  }, []);

  const studentLink = useMemo(() => {
    if (!room) return '';
    return buildLiveStudentLink({
      experience: 'game',
      roomId: room.roomId,
      joinCode: room.joinCode,
      endpoint: room.endpoint,
      workspaceId: room.workspaceId,
      title,
      grade,
      lesson: unit,
      gameTitle: title,
      expiresAt: room.expiresAt,
    });
  }, [grade, room, title, unit]);

  const broadcastScoreboard = useCallback(async (targetId = 'all', extra = {}) => {
    const activeRoom = roomRef.current;
    if (!activeRoom) return;
    const board = sortedOnlineScoreboard(participants, scoresRef.current).map((item, index) => ({
      ...item,
      rank: index + 1,
    }));
    await send({
      type: 'game-score',
      targetId,
      data: { scoreboard: board, ...extra },
    });
  }, [participants, send]);

  const sendCurrentQuestion = useCallback(async (targetId = 'all') => {
    const index = questionIndexRef.current;
    const question = questionSet[index];
    if (!question) return;
    await send({
      type: 'game-question',
      targetId,
      data: {
        question: publicOnlineQuestion(
          question,
          index,
          questionSet.length,
          QUESTION_SECONDS,
        ),
      },
    });
  }, [questionSet, send]);

  const endCurrentQuestion = useCallback(async () => {
    const activeIndex = questionIndexRef.current;
    const question = questionSet[activeIndex];
    if (!question || phaseRef.current !== 'question') return;
    setPhase('review');
    phaseRef.current = 'review';
    await broadcastScoreboard('all', {
      questionId: question.id,
      correctAnswerIndex: question.answerIndex,
      correctAnswer: question.answer,
      review: true,
    });
  }, [broadcastScoreboard, questionSet]);

  const processAnswer = useCallback(async (event) => {
    const participantId = event.sourceId;
    const activeIndex = questionIndexRef.current;
    const question = questionSet[activeIndex];
    if (!participantId || !question || phaseRef.current !== 'question') return;
    if (String(event.data?.questionId || '') !== String(question.id)) return;
    const answerKey = `${question.id}:${participantId}`;
    if (answersRef.current[answerKey]) return;

    const choiceIndex = Number(event.data?.choiceIndex);
    if (!Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex >= question.options.length) return;
    const elapsedMs = Math.max(0, Date.now() - currentQuestionStartedAtRef.current);
    const result = scoreOnlineAnswer(question, choiceIndex, elapsedMs, QUESTION_SECONDS);
    const nextAnswers = {
      ...answersRef.current,
      [answerKey]: {
        choiceIndex,
        correct: result.correct,
        points: result.points,
        submittedAt: event.createdAt || new Date().toISOString(),
      },
    };
    const nextScores = {
      ...scoresRef.current,
      [participantId]: Number(scoresRef.current[participantId] || 0) + result.points,
    };
    answersRef.current = nextAnswers;
    scoresRef.current = nextScores;
    setAnswers(nextAnswers);
    setScores(nextScores);

    await send({
      type: 'game-score',
      targetId: participantId,
      data: {
        questionId: question.id,
        correct: result.correct,
        points: result.points,
        totalScore: nextScores[participantId],
        correctAnswerIndex: question.answerIndex,
        correctAnswer: question.answer,
      },
    });
    await broadcastScoreboard('all');
    const answeredCount = Object.keys(nextAnswers)
      .filter((key) => key.startsWith(`${question.id}:`)).length;
    const activeCount = participants.filter((item) => item.status !== 'removed').length;
    if (activeCount > 0 && answeredCount >= activeCount) {
      await endCurrentQuestion();
    }
  }, [broadcastScoreboard, endCurrentQuestion, participants, questionSet, send]);

  useEffect(() => {
    if (!room) return undefined;
    let disposed = false;
    const stopParticipants = createLivePoller({
      intervalMs: 2500,
      poll: () => listLiveParticipants(room, room.roomId, room.teacherToken),
      onData: (result) => {
        if (!disposed) setParticipants(result.participants || []);
      },
      onError: () => {},
    });
    const stopEvents = createLivePoller({
      intervalMs: 700,
      poll: () => fetchLiveEvents(
        room,
        room.roomId,
        room.teacherToken,
        cursorRef.current,
      ),
      onData: async (result) => {
        cursorRef.current = Math.max(cursorRef.current, Number(result.cursor || 0));
        for (const event of result.events || []) {
          if (!event?.id || processedEventsRef.current.has(event.id)) continue;
          processedEventsRef.current.add(event.id);
          if (event.type === 'game-answer') await processAnswer(event);
          if (['participant-joined', 'student-ready', 'game-ready'].includes(event.type)) {
            const participantId = event.sourceId || event.data?.participantId;
            if (participantId && phaseRef.current === 'question') {
              await sendCurrentQuestion(participantId);
              await broadcastScoreboard(participantId);
            }
          }
        }
        if (processedEventsRef.current.size > 1000) {
          processedEventsRef.current = new Set(
            [...processedEventsRef.current].slice(-500),
          );
        }
      },
      onError: (error) => setNotice(errorText(error, 'تعذر تحديث غرفة اللعب.')),
    });
    return () => {
      disposed = true;
      stopParticipants();
      stopEvents();
    };
  }, [broadcastScoreboard, processAnswer, room, sendCurrentQuestion]);

  useEffect(() => {
    if (phase !== 'question' || !currentQuestion) return undefined;
    if (secondsLeft <= 0) {
      void endCurrentQuestion();
      return undefined;
    }
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [currentQuestion, endCurrentQuestion, phase, secondsLeft]);

  const createRoom = async () => {
    if (!configured) {
      showNotice('فعّل المزامنة السحابية أولًا لإنشاء غرفة لعب أونلاين.');
      return;
    }
    if (!questionSet.length) {
      showNotice('لا توجد أسئلة اختيارية صالحة لهذا الدرس.');
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      const created = await createLiveRoom({ cloudSync }, {
        title,
        grade,
        lesson: unit,
        ttlSeconds: 4 * 60 * 60,
      });
      setRoom(created);
      roomRef.current = created;
      cursorRef.current = 0;
      processedEventsRef.current.clear();
      setParticipants([]);
      setScores({});
      setAnswers({});
      scoresRef.current = {};
      answersRef.current = {};
      setQuestionIndex(-1);
      setPhase('waiting');
      showNotice('تم إنشاء غرفة اللعب. أرسل الرابط للطلاب ثم ابدأ التحدي.');
    } catch (error) {
      showNotice(errorText(error, 'تعذر إنشاء غرفة اللعب.'));
    } finally {
      setBusy(false);
    }
  };

  const startQuestionAt = async (nextIndex) => {
    if (!questionSet[nextIndex]) return;
    setQuestionIndex(nextIndex);
    questionIndexRef.current = nextIndex;
    setSecondsLeft(QUESTION_SECONDS);
    setPhase('question');
    phaseRef.current = 'question';
    currentQuestionStartedAtRef.current = Date.now();
    await send({
      type: nextIndex === 0 ? 'game-start' : 'game-state',
      targetId: 'all',
      data: {
        title,
        questionIndex: nextIndex,
        totalQuestions: questionSet.length,
      },
    });
    await sendCurrentQuestion('all');
  };

  const nextQuestion = async () => {
    const nextIndex = questionIndex + 1;
    if (nextIndex >= questionSet.length) {
      const finalBoard = sortedOnlineScoreboard(participants, scoresRef.current)
        .map((item, index) => ({ ...item, rank: index + 1 }));
      setPhase('finished');
      phaseRef.current = 'finished';
      onFinish?.({
        id: `online-game-${Date.now()}`,
        kind: 'online',
        mode: 'multiplayer',
        title,
        grade,
        unit,
        participantCount: finalBoard.length,
        questionCount: questionSet.length,
        scores: finalBoard,
        winner: finalBoard[0] || null,
        score: Number(finalBoard[0]?.score || 0),
        date: new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString(),
      });
      await send({
        type: 'game-finished',
        targetId: 'all',
        data: { title, scoreboard: finalBoard },
      });
      return;
    }
    await startQuestionAt(nextIndex);
  };

  const restartGame = async () => {
    setScores({});
    setAnswers({});
    scoresRef.current = {};
    answersRef.current = {};
    setQuestionIndex(-1);
    questionIndexRef.current = -1;
    setPhase('waiting');
    phaseRef.current = 'waiting';
    await broadcastScoreboard('all', { reset: true });
    showNotice('تم تصفير النقاط. ابدأ الجولة الجديدة عندما يكون الطلاب جاهزين.');
  };

  const finishRoom = async () => {
    const activeRoom = roomRef.current;
    if (!activeRoom) return;
    setBusy(true);
    try {
      await send({
        type: 'game-finished',
        targetId: 'all',
        data: { title, scoreboard },
      }).catch(() => null);
      await closeLiveRoom(activeRoom, activeRoom.roomId, activeRoom.teacherToken);
      setRoom(null);
      roomRef.current = null;
      setPhase('idle');
      showNotice('تم إنهاء غرفة اللعب.');
    } catch (error) {
      showNotice(errorText(error, 'تعذر إنهاء غرفة اللعب.'));
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!studentLink) return;
    const copied = await copyToClipboard(studentLink);
    showNotice(copied ? 'تم نسخ رابط اللعب الأونلاين.' : 'الرابط جاهز للمشاركة.');
  };

  return (
    <article className="panel online-game-host-panel">
      <div className="panel-title online-game-host-title">
        <div>
          <span className="eyebrow">لعب جماعي مباشر</span>
          <h3>غرفة التحدي الأونلاين</h3>
          <p>الطلاب يدخلون من رابط واحد، وتظهر الأسئلة والترتيب لحظيًا.</p>
        </div>
        <Gamepad2 size={24} />
      </div>

      {!configured && (
        <div className="settings-notice warning">
          <WifiOff size={17} /> يلزم إعداد المزامنة السحابية لتشغيل اللعب المباشر.
        </div>
      )}

      {!room ? (
        <div className="online-game-launch-row">
          <div>
            <strong>{questionSet.length} أسئلة جاهزة</strong>
            <small>{grade || 'الصف الحالي'} {unit ? `• ${unit}` : ''}</small>
          </div>
          <button
            className="primary-btn"
            type="button"
            disabled={busy || !configured || !questionSet.length}
            onClick={createRoom}
          >
            {busy ? <LoaderCircle className="spin" size={18} /> : <Radio size={18} />}
            إنشاء غرفة أونلاين
          </button>
        </div>
      ) : (
        <>
          <div className="online-game-room-strip">
            <div><span>كود الدخول</span><strong>{room.joinCode}</strong></div>
            <div><span>المشاركون</span><strong>{participants.length}</strong></div>
            <button className="secondary-btn" type="button" onClick={copyLink}><Copy size={17} /> نسخ الرابط</button>
            <a className="secondary-btn" href={studentLink} target="_blank" rel="noopener noreferrer"><Link size={17} /> معاينة</a>
          </div>

          {phase === 'waiting' && (
            <div className="online-game-waiting">
              <Users size={34} />
              <div><strong>في انتظار الطلاب</strong><span>ابدأ بعد ظهور الطلاب في القائمة.</span></div>
              <button className="primary-btn" type="button" disabled={!participants.length} onClick={() => startQuestionAt(0)}><Play size={17} /> بدء التحدي</button>
            </div>
          )}

          {['question', 'review'].includes(phase) && currentQuestion && (
            <div className="online-game-current-question">
              <div className="online-game-question-meta">
                <span>السؤال {questionIndex + 1} من {questionSet.length}</span>
                <strong>{phase === 'question' ? `⏱ ${secondsLeft}` : 'انتهى السؤال'}</strong>
              </div>
              <h4>{currentQuestion.text}</h4>
              <div className="online-game-answer-progress">
                أجاب {Object.keys(answers).filter((key) => key.startsWith(`${currentQuestion.id}:`)).length} من {participants.length}
              </div>
              {phase === 'question' && <button className="secondary-btn" type="button" onClick={endCurrentQuestion}>إنهاء السؤال الآن</button>}
              {phase === 'review' && <div className="settings-notice success">الإجابة الصحيحة: {currentQuestion.answer}</div>}
              {phase === 'review' && <button className="primary-btn" type="button" onClick={nextQuestion}>
                {questionIndex + 1 >= questionSet.length ? <Trophy size={17} /> : <Play size={17} />}
                {questionIndex + 1 >= questionSet.length ? 'إظهار النتيجة النهائية' : 'السؤال التالي'}
              </button>}
            </div>
          )}

          {phase === 'finished' && (
            <div className="online-game-finished">
              <Trophy size={42} />
              <h4>انتهى التحدي</h4>
              <button className="secondary-btn" type="button" onClick={restartGame}><RotateCcw size={17} /> جولة جديدة</button>
            </div>
          )}

          <div className="online-game-scoreboard">
            <div className="online-game-scoreboard-head"><Trophy size={18} /><strong>الترتيب اللحظي</strong></div>
            {scoreboard.length ? scoreboard.map((item, index) => (
              <div className="online-game-score-row" key={item.id}>
                <span className="online-game-rank">#{index + 1}</span>
                <div><strong>{item.name}</strong><small>{item.studentCode || 'طالب'}</small></div>
                <b>{item.score}</b>
              </div>
            )) : <div className="shared-placeholder">لم يدخل طلاب بعد.</div>}
          </div>

          <button className="danger-btn online-game-close" type="button" disabled={busy} onClick={finishRoom}>
            <CircleStop size={17} /> إنهاء الغرفة
          </button>
        </>
      )}

      {notice && <div className="settings-notice">{notice}</div>}
    </article>
  );
}
