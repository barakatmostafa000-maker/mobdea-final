import { useEffect, useMemo, useState } from 'react';
import { identity } from '../config/identity';

export default function LockScreen({ correctPin, onUnlock }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);

  const normalizedPin = useMemo(() => String(correctPin || '').replace(/\D/g, '').slice(0, 6), [correctPin]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const submit = () => {
    if (cooldown > 0) {
      setError(`حاول مرة أخرى بعد ${cooldown} ثانية`);
      return;
    }
    if (pin === normalizedPin) {
      setError('');
      setAttempts(0);
      onUnlock();
      return;
    }
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    setError('الرقم السري غير صحيح');
    setPin('');
    if (nextAttempts >= 5) {
      setCooldown(30);
      setAttempts(0);
      setError('تم إيقاف المحاولة مؤقتًا لمدة 30 ثانية');
    }
  };

  return <div className="lock-screen">
    <div className="lock-card">
      <img className="lock-avatar" src={identity.portrait} alt={identity.teacherName} />
      <div className="lock-badge">{identity.schoolName}</div>
      <h1>{identity.schoolName}</h1>
      <p>أدخل PIN الإدارة</p>
      <input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e)=>setPin(e.target.value.replace(/\D/g,''))} onKeyDown={(e)=>e.key==='Enter'&&submit()} />
      {error && <span className="lock-error">{error}</span>}
      <button className="primary-btn" onClick={submit} disabled={cooldown > 0}>{cooldown > 0 ? `انتظر ${cooldown} ثانية` : 'دخول'}</button>
      {import.meta.env.DEV && <small>PIN التجريبي: 123456</small>}
    </div>
  </div>;
}
