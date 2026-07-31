import { useMemo, useState } from 'react';
import {
  Award,
  Check,
  Gift,
  Medal,
  Plus,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  X,
} from 'lucide-react';
import {
  calculateStudentGamification,
  defaultRewardCatalog,
  rewardCatalogFor,
} from '../services/gamification';

const statusLabels = {
  pending: 'بانتظار الموافقة',
  approved: 'تمت الموافقة',
  delivered: 'تم التسليم',
  rejected: 'مرفوضة',
  cancelled: 'ملغاة',
};

function linkedStudents(data, auth) {
  if (!['student', 'guardian'].includes(auth?.role)) return data.students || [];
  const ids = new Set([
    auth?.studentId,
    ...(Array.isArray(auth?.studentIds) ? auth.studentIds : []),
    ...(Array.isArray(auth?.linkedStudentIds) ? auth.linkedStudentIds : []),
  ].filter((value) => value !== null && value !== undefined).map(String));
  const anchor = (data.students || []).find((student) => ids.has(String(student.id)));
  if (auth?.role === 'guardian' && anchor?.guardianPhone) {
    return (data.students || []).filter((student) => student.guardianPhone === anchor.guardianPhone);
  }
  return (data.students || []).filter((student) => ids.has(String(student.id)));
}

export default function Achievements({ data, updateData, auth }) {
  const canManage = ['admin', 'teacher'].includes(auth?.role);
  const canRedeem = auth?.role === 'student';
  const students = useMemo(() => linkedStudents(data, auth), [auth, data]);
  const [studentId, setStudentId] = useState(String(students[0]?.id || ''));
  const [newRewardTitle, setNewRewardTitle] = useState('');
  const [newRewardCost, setNewRewardCost] = useState('500');
  const [notice, setNotice] = useState('');
  const student = students.find((item) => String(item.id) === String(studentId)) || students[0] || null;
  const stats = useMemo(
    () => calculateStudentGamification(data, student || {}),
    [data, student],
  );
  const catalog = useMemo(() => rewardCatalogFor(data), [data]);
  const redemptions = useMemo(
    () => (data.rewardRedemptions || [])
      .filter((item) => !student || String(item.studentId) === String(student.id))
      .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || ''))),
    [data.rewardRedemptions, student],
  );

  const requestReward = async (reward) => {
    if (!student || !canRedeem) return;
    if (stats.spendableXp < reward.cost) {
      setNotice('النقاط المتاحة لا تكفي لهذه الجائزة.');
      return;
    }
    if ((data.rewardRedemptions || []).some((item) => String(item.studentId) === String(student.id) && item.rewardId === reward.id && ['pending', 'approved'].includes(item.status))) {
      setNotice('تم طلب هذه الجائزة بالفعل وهي قيد المتابعة.');
      return;
    }
    const redemption = {
      id: `redeem-${Date.now()}`,
      studentId: student.id,
      rewardId: reward.id,
      rewardTitle: reward.title,
      cost: reward.cost,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await updateData({
      ...data,
      rewardRedemptions: [redemption, ...(data.rewardRedemptions || [])].slice(0, 500),
    });
    setNotice('تم إرسال طلب الجائزة للمعلم.');
  };

  const updateRedemption = async (id, status) => {
    if (!canManage) return;
    await updateData({
      ...data,
      rewardRedemptions: (data.rewardRedemptions || []).map((item) => (
        item.id === id ? { ...item, status, updatedAt: new Date().toISOString() } : item
      )),
    });
    setNotice(status === 'approved' ? 'تمت الموافقة على الجائزة.' : status === 'delivered' ? 'تم تسجيل تسليم الجائزة.' : 'تم رفض الطلب وإعادة النقاط.');
  };

  const addReward = async (event) => {
    event.preventDefault();
    if (!canManage) return;
    const title = newRewardTitle.trim();
    const cost = Math.max(1, Math.round(Number(newRewardCost || 0)));
    if (!title || !Number.isFinite(cost)) {
      setNotice('اكتب اسم الجائزة وتكلفتها بصورة صحيحة.');
      return;
    }
    const current = Array.isArray(data.rewardCatalog) && data.rewardCatalog.length
      ? data.rewardCatalog
      : defaultRewardCatalog;
    await updateData({
      ...data,
      rewardCatalog: [...current, { id: `reward-${Date.now()}`, title, cost, active: true }].slice(0, 100),
    });
    setNewRewardTitle('');
    setNewRewardCost('500');
    setNotice('تمت إضافة الجائزة إلى المتجر.');
  };

  const removeReward = async (rewardId) => {
    if (!canManage) return;
    const current = Array.isArray(data.rewardCatalog) && data.rewardCatalog.length
      ? data.rewardCatalog
      : defaultRewardCatalog;
    await updateData({
      ...data,
      rewardCatalog: current.map((item) => item.id === rewardId ? { ...item, active: false } : item),
    });
    setNotice('تم إخفاء الجائزة من المتجر.');
  };

  if (!student) {
    return <section className="page"><div className="panel empty-state">لا يوجد طالب مرتبط بهذا الحساب.</div></section>;
  }

  return (
    <section className="page achievements-page">
      <div className="page-heading">
        <div><span className="eyebrow">نقاط ومستويات وجوائز</span><h2>الإنجازات ومتجر المكافآت</h2><p>كل حضور ونتيجة وتحدٍ يتحول إلى تقدم واضح يحفز الطالب.</p></div>
        {students.length > 1 && <select value={student.id} onChange={(event) => setStudentId(event.target.value)}>{students.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
      </div>

      <div className="achievements-hero panel">
        <div className="achievements-level-orb"><Trophy size={30} /><strong>{stats.level}</strong><span>المستوى</span></div>
        <div className="achievements-hero-copy">
          <span className="eyebrow">{student.name}</span>
          <h3>{stats.xp} XP إجمالي</h3>
          <div className="achievements-progress"><i style={{ width: `${stats.levelProgress}%` }} /></div>
          <small>{stats.levelProgressXp} من {stats.nextLevelXp} نقطة للمستوى التالي • المتاح للجوائز: {stats.spendableXp}</small>
        </div>
        <div className="achievements-quick-stats">
          <span><Star size={17} /><strong>{stats.gradeAverage}%</strong><small>متوسط الدرجات</small></span>
          <span><ShieldCheck size={17} /><strong>{stats.presentCount}</strong><small>مرات حضور</small></span>
          <span><Sparkles size={17} /><strong>{stats.gamesPlayed}</strong><small>جولات لعب</small></span>
        </div>
      </div>

      <div className="achievements-layout">
        <article className="panel achievements-badges-panel">
          <div className="panel-title"><div><span className="eyebrow">الأوسمة المفتوحة</span><h3>لوحة الإنجازات</h3></div><Medal size={21} /></div>
          <div className="achievements-badge-grid">
            {stats.badges.length ? stats.badges.map((badge) => <div className="achievement-badge" key={badge.id}><span>{badge.icon || '🏅'}</span><strong>{badge.title}</strong><small>{badge.date || 'إنجاز مستمر'}</small></div>) : <div className="empty-state">ستظهر الأوسمة هنا بعد الحضور والتفوق وحل التحديات.</div>}
          </div>
        </article>

        <article className="panel rewards-store-panel">
          <div className="panel-title"><div><span className="eyebrow">متجر الجوائز</span><h3>استبدال نقاط XP</h3></div><Gift size={21} /></div>
          <div className="reward-catalog-grid">
            {catalog.map((reward) => <div className="reward-card" key={reward.id}>
              <span className="reward-icon"><Gift size={20} /></span>
              <div><strong>{reward.title}</strong><small>{reward.cost} XP</small></div>
              {canRedeem && <button className="primary-btn" type="button" disabled={stats.spendableXp < reward.cost} onClick={() => requestReward(reward)}>طلب</button>}
              {auth?.role === 'guardian' && <span className="reward-view-only">للعرض</span>}
              {canManage && <button className="icon-button reward-remove" type="button" onClick={() => removeReward(reward.id)} aria-label="إخفاء الجائزة"><X size={16} /></button>}
            </div>)}
          </div>
          {canManage && <form className="reward-add-form" onSubmit={addReward}><input value={newRewardTitle} onChange={(event) => setNewRewardTitle(event.target.value)} placeholder="اسم جائزة جديدة" /><input value={newRewardCost} onChange={(event) => setNewRewardCost(event.target.value)} type="number" min="1" inputMode="numeric" placeholder="النقاط" /><button className="secondary-btn" type="submit"><Plus size={16} /> إضافة</button></form>}
        </article>
      </div>

      <article className="panel reward-requests-panel">
        <div className="panel-title"><div><span className="eyebrow">سجل المتجر</span><h3>{canManage ? 'طلبات الجوائز' : 'طلباتي'}</h3></div><Award size={21} /></div>
        <div className="reward-request-list">
          {redemptions.length ? redemptions.map((item) => {
            const owner = (data.students || []).find((entry) => String(entry.id) === String(item.studentId));
            return <div className="reward-request-row" key={item.id}>
              <div><strong>{item.rewardTitle}</strong><small>{canManage ? `${owner?.name || 'طالب'} • ` : ''}{item.cost} XP • {statusLabels[item.status] || item.status}</small></div>
              {canManage && item.status === 'pending' && <div><button className="primary-btn" type="button" onClick={() => updateRedemption(item.id, 'approved')}><Check size={15} /> موافقة</button><button className="danger-btn" type="button" onClick={() => updateRedemption(item.id, 'rejected')}><X size={15} /> رفض</button></div>}
              {canManage && item.status === 'approved' && <button className="secondary-btn" type="button" onClick={() => updateRedemption(item.id, 'delivered')}>تم التسليم</button>}
            </div>;
          }) : <div className="empty-state">لا توجد طلبات جوائز حتى الآن.</div>}
        </div>
      </article>

      {notice && <div className="settings-notice achievements-notice">{notice}</div>}
    </section>
  );
}
