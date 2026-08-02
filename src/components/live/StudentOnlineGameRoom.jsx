/* MOBDEA_STUDENT_GAME_SERVER_V1 */
import {
  joinGameRoom as joinLiveRoom,
  postGameEvent as postLiveEvent,
  fetchGameEvents as fetchLiveEvents,
  createGamePoller as createLivePoller,
} from '../../services/gameRooms';

function errorText(error) {
  return error?.message || 'تعذر الاتصال بغرفة اللعب.';
}

export default function StudentOnlineGameRoom({ payload, onGoHome }) {
  const [name, setName] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [session, setSession] = useState(null);
  const [joining, setJoining] = useState(false);
  const [notice, setNotice] = useState('');
  const [question, setQuestion] = useState(null);
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [answerResult, setAnswerResult] = useState(null);
  const [score, setScore] = useState(0);
  const [scoreboard, setScoreboard] = useState([]);
  const [phase, setPhase] = useState('waiting');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [roomClosed, setRoomClosed] = useState(false);
  const cursorRef = useRef(0);
  const processedEventsRef = useRef(new Set());
  const sessionRef = useRef(null);
  const questionRef = useRef(null);
  const answeredQuestionsRef = useRef(new Set());

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  useEffect(() => {
    questionRef.current = question;
  }, [question]);

  const send = useCallback(async (event) => {
    const active = sessionRef.current;
    if (!active) return null;
    return postLiveEvent(
      active,
      active.roomId,
      active.participantToken,
      event,
    );
  }, []);

  useEffect(() => {
    if (phase !== 'question' || !question || selectedChoice !== null) return undefined;
    if (secondsLeft <= 0) {
      setPhase('review');
      setNotice('انتهى وقت الإجابة.');
      return undefined;
    }
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, question, secondsLeft, selectedChoice]);

  useEffect(() => {
    if (!session) return undefined;
    const stop = createLivePoller({
      intervalMs: 700,
      poll: () => fetchLiveEvents(
        session,
        session.roomId,
        session.participantToken,
        cursorRef.current,
      ),
      onData: (result) => {
        cursorRef.current = Math.max(cursorRef.current, Number(result.cursor || 0));
        if (result.roomStatus === 'closed') setRoomClosed(true);
        for (const event of result.events || []) {
          if (!event?.id || processedEventsRef.current.has(event.id)) continue;
          processedEventsRef.current.add(event.id);
          if (event.type === 'game-start') {
            setPhase('waiting-question');
            setNotice('بدأ التحدي. استعد للسؤال الأول.');
          }
          if (event.type === 'game-question' && event.data?.question) {
            const nextQuestion = event.data.question;
            if (String(questionRef.current?.id || '') !== String(nextQuestion.id)) {
              setQuestion(nextQuestion);
              questionRef.current = nextQuestion;
              setSelectedChoice(null);
              setAnswerResult(null);
              setSecondsLeft(Number(nextQuestion.durationSec || 25));
              setPhase('question');
              setNotice('');
            }
          }
          if (event.type === 'game-score') {
            if (Array.isArray(event.data?.scoreboard)) {
              setScoreboard(event.data.scoreboard);
              const own = event.data.scoreboard.find((item) => item.id === session.participantId);
              if (own) setScore(Number(own.score || 0));
            }
            if (event.data?.questionId && String(event.data.questionId) === String(questionRef.current?.id)) {
              setAnswerResult({
                correct: event.data.correct === true,
                points: Number(event.data.points || 0),
                correctAnswerIndex: Number(event.data.correctAnswerIndex),
                correctAnswer: event.data.correctAnswer || '',
              });
              if (event.data.totalScore !== undefined) setScore(Number(event.data.totalScore || 0));
              setPhase('review');
            }
            if (event.data?.review && String(event.data.questionId) === String(questionRef.current?.id)) {
              setAnswerResult((current) => ({
                ...(current || {}),
                correctAnswerIndex: Number(event.data.correctAnswerIndex),
                correctAnswer: event.data.correctAnswer || '',
              }));
              setPhase('review');
            }
          }
          if (event.type === 'game-finished') {
            setPhase('finished');
            if (Array.isArray(event.data?.scoreboard)) {
              setScoreboard(event.data.scoreboard);
              const own = event.data.scoreboard.find((item) => item.id === session.participantId);
              if (own) setScore(Number(own.score || 0));
            }
            setNotice('انتهى التحدي.');
          }
          if (event.type === 'participant-removed' || event.type === 'room-closed') {
            setRoomClosed(true);
            setNotice('تم إنهاء غرفة اللعب.');
          }
        }
      },
      onError: (error) => setNotice(errorText(error)),
    });
    const heartbeat = setInterval(() => {
      void send({ type: 'heartbeat', targetId: 'teacher', data: {} });
    }, 15_000);
    return () => {
      stop();
      clearInterval(heartbeat);
    };
  }, [send, session]);

  const join = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      setNotice('اكتب اسمك أولًا.');
      return;
    }
    setJoining(true);
    setNotice('');
    try {
      const joined = await joinLiveRoom(
        {
          endpoint: payload.endpoint,
          workspaceId: payload.workspaceId,
        },
        payload.joinCode,
        {
          name,
          studentCode,
        },
      );
      const nextSession = { ...joined, roomId: payload.roomId };
      setSession(nextSession);
      sessionRef.current = nextSession;
      cursorRef.current = 0;
      processedEventsRef.current.clear();
      await postLiveEvent(
        nextSession,
        nextSession.roomId,
        nextSession.participantToken,
        {
          type: 'game-ready',
          targetId: 'teacher',
          data: { name: name.trim(), studentCode: studentCode.trim() },
        },
      );
      setPhase('waiting');
      setNotice('تم الدخول. انتظر المعلم ليبدأ التحدي.');
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setJoining(false);
    }
  };

  const answer = async (choiceIndex) => {
    const activeQuestion = questionRef.current;
    if (!session || !activeQuestion || selectedChoice !== null || secondsLeft <= 0) return;
    if (answeredQuestionsRef.current.has(activeQuestion.id)) return;
    answeredQuestionsRef.current.add(activeQuestion.id);
    setSelectedChoice(choiceIndex);
    setNotice('تم إرسال إجابتك.');
    try {
      await send({
        type: 'game-answer',
        targetId: 'teacher',
        data: {
          questionId: activeQuestion.id,
          choiceIndex,
          submittedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      answeredQuestionsRef.current.delete(activeQuestion.id);
      setSelectedChoice(null);
      setNotice(errorText(error));
    }
  };

  if (!payload?.roomId || !payload?.endpoint || !payload?.workspaceId) {
    return (
      <section className="page online-game-student-page">
        <article className="panel live-student-error">
          <AlertTriangle size={32} />
          <h2>رابط اللعب غير مكتمل</h2>
          <p>اطلب من المعلم إرسال رابط جديد.</p>
          <button className="primary-btn" type="button" onClick={onGoHome}>العودة</button>
        </article>
      </section>
    );
  }

  if (!session) {
    return (
      <section className="page online-game-student-page">
        <div className="live-student-join-shell">
          <article className="panel live-student-join-card online-game-join-card">
            <header>
              <img src={identity.logo} alt={identity.schoolName} />
              <div><span className="eyebrow">تحدي أونلاين مباشر</span><h2>{payload.gameTitle || payload.title || 'تحدي المُبدع'}</h2><p>{payload.grade || ''} {payload.lesson ? `• ${payload.lesson}` : ''}</p></div>
            </header>
            {!globalThis.isSecureContext && (
              <div className="settings-notice warning"><WifiOff size={17} /> افتح الرابط عبر HTTPS لتشغيل التحدي بصورة آمنة.</div>
            )}
            <form onSubmit={join}>
              <label><span>اسم الطالب</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="اكتب اسمك" autoComplete="name" /></label>
              <label><span>كود الطالب — اختياري</span><input value={studentCode} onChange={(event) => setStudentCode(event.target.value)} placeholder="مثال: 25" inputMode="numeric" /></label>
              <div className="live-join-code"><span>كود الغرفة</span><strong>{payload.joinCode}</strong></div>
              {notice && <div className="settings-notice">{notice}</div>}
              <button className="primary-btn" type="submit" disabled={joining}>
                {joining ? <LoaderCircle className="spin" size={18} /> : <LogIn size={18} />}
                {joining ? 'جارٍ الدخول…' : 'دخول التحدي'}
              </button>
            </form>
          </article>
        </div>
      </section>
    );
  }

  const ownRank = scoreboard.findIndex((item) => item.id === session.participantId) + 1;

  return (
    <section className="page online-game-student-page">
      <div className="online-game-student-shell">
        <header className="panel online-game-student-header">
          <div><Gamepad2 size={25} /><div><span className="eyebrow">تحدي مباشر</span><h2>{payload.gameTitle || payload.title || 'تحدي المُبدع'}</h2></div></div>
          <div className="online-game-student-metrics"><span>النقاط <strong>{score}</strong></span><span>الترتيب <strong>{ownRank || '—'}</strong></span></div>
        </header>

        {roomClosed ? (
          <article className="panel online-game-ended-card">
            <Trophy size={48} />
            <h3>انتهت غرفة اللعب</h3>
            <p>نتيجتك النهائية: {score} نقطة.</p>
            <button className="primary-btn" type="button" onClick={onGoHome}>العودة للمنصة</button>
          </article>
        ) : (
          <div className="online-game-student-grid">
            <article className="panel online-game-question-card">
              {phase === 'waiting' || phase === 'waiting-question' ? (
                <div className="online-game-student-waiting"><Radio className="pulse" size={42} /><h3>في انتظار المعلم</h3><p>{notice || 'سيظهر السؤال هنا فور بدء التحدي.'}</p></div>
              ) : phase === 'finished' ? (
                <div className="online-game-student-waiting"><Trophy size={52} /><h3>انتهى التحدي</h3><p>أحسنت! حصلت على {score} نقطة.</p></div>
              ) : question ? (
                <>
                  <div className="online-game-question-meta"><span>السؤال {Number(question.index || 0) + 1} من {question.total}</span><strong className={secondsLeft <= 5 ? 'danger' : ''}>⏱ {secondsLeft}</strong></div>
                  <h3>{question.text}</h3>
                  <div className="online-game-student-options">
                    {(question.options || []).map((option, index) => {
                      const isSelected = selectedChoice === index;
                      const isCorrect = answerResult && Number(answerResult.correctAnswerIndex) === index;
                      const isWrong = answerResult && isSelected && !answerResult.correct;
                      return (
                        <button
                          key={`${option}-${index}`}
                          type="button"
                          disabled={selectedChoice !== null || phase === 'review'}
                          className={`${isSelected ? 'selected' : ''} ${isCorrect ? 'correct' : ''} ${isWrong ? 'wrong' : ''}`.trim()}
                          onClick={() => answer(index)}
                        >
                          <span>{String.fromCharCode(65 + index)}</span>{option}
                        </button>
                      );
                    })}
                  </div>
                  {answerResult && (
                    <div className={`online-game-answer-result ${answerResult.correct ? 'correct' : 'wrong'}`}>
                      <strong>{answerResult.correct ? `إجابة صحيحة +${answerResult.points}` : 'إجابة غير صحيحة'}</strong>
                      {answerResult.correctAnswer && <span>الإجابة: {answerResult.correctAnswer}</span>}
                    </div>
                  )}
                  {!answerResult && selectedChoice !== null && <div className="settings-notice">تم إرسال إجابتك، انتظر النتيجة.</div>}
                </>
              ) : null}
            </article>

            <aside className="panel online-game-student-scoreboard">
              <div className="online-game-scoreboard-head"><Users size={18} /><strong>ترتيب اللاعبين</strong></div>
              {scoreboard.length ? scoreboard.slice(0, 12).map((item, index) => (
                <div className={`online-game-score-row ${item.id === session.participantId ? 'current' : ''}`} key={item.id}>
                  <span className="online-game-rank">#{item.rank || index + 1}</span>
                  <div><strong>{item.name}</strong><small>{item.studentCode || 'طالب'}</small></div>
                  <b>{item.score}</b>
                </div>
              )) : <div className="shared-placeholder">سيظهر الترتيب بعد بدء الإجابات.</div>}
            </aside>
          </div>
        )}

        {notice && phase !== 'waiting' && <div className="settings-notice online-game-student-notice">{notice}</div>}
      </div>
    </section>
  );
}
