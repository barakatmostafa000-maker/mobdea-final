import { useState } from 'react';

export default function LockScreen({ correctPin, onUnlock }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    if (pin === correctPin) {
      setError('');
      onUnlock();
    } else {
      setError('الرقم السري غير صحيح');
      setPin('');
    }
  };

  return <div className="lock-screen">
    <div className="lock-card">
      <div className="loading-mark">م</div>
      <h1>منصة المُبدع</h1>
      <p>أدخل PIN الإدارة</p>
      <input type="password" inputMode="numeric" maxLength="6" value={pin} onChange={(e)=>setPin(e.target.value.replace(/\D/g,''))} onKeyDown={(e)=>e.key==='Enter'&&submit()} />
      {error && <span className="lock-error">{error}</span>}
      <button className="primary-btn" onClick={submit}>دخول</button>
      <small>PIN التجريبي: 123456</small>
    </div>
  </div>;
}
