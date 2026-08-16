import { useMemo, useState } from 'react';
import { ContactRound, KeyRound, Trash2 } from 'lucide-react';
import { normalizeEgyptPhone, pickPhoneFromContacts } from '../services/contacts';
import { createCredentialSecret, hasCredentialSecret, normalizePin } from '../utils/security';
import { cloudConfigured, pushCloudData } from '../services/cloudSync';

function pruneStudentFromData(data, studentId) {
  return {
    ...data,
    students: data.students.filter((student) => student.id !== studentId),
    attendance: (data.attendance || []).filter((item) => item.studentId !== studentId),
    grades: (data.grades || []).filter((item) => item.studentId !== studentId),
    detailedResults: (data.detailedResults || []).filter((item) => item.studentId !== studentId),
    payments: (data.payments || []).filter((item) => item.studentId !== studentId),
    gameResults: (data.gameResults || []).filter((item) => item.studentId !== studentId && item.secondStudentId !== studentId),
    notifications: (data.notifications || []).filter((item) => item.studentId !== studentId),
    achievements: (data.achievements || []).filter((item) => item.studentId !== studentId),
  };
}

function emptyStudent() {
  return {
    name: '', code: '', grade: '', group: '', guardianPhone: '', studentPhone: '', sessionPrice: 50,
    permissions: { games: true, grades: true, content: true },
    parentPermissions: { attendance: true, grades: true, dues: true },
    studentPin: '', guardianPin: '',
  };
}

export default function Students({ data, updateData }) {
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(null);
  const [contactMessage, setContactMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => data.students.filter((student) =>
    !search || student.name.includes(search) || String(student.code).includes(search)
  ), [data.students, search]);

  const chooseContact = async (field) => {
    try {
      const result = await pickPhoneFromContacts();
      if (!result.supported) { setContactMessage('اختيار جهات الاتصال غير مدعوم على هذا الجهاز؛ اكتب الرقم يدويًا.'); return; }
      const phone = normalizeEgyptPhone(result.phone);
      if (!phone) return;
      const duplicate = data.students.find((student) => student.id !== form?.id && normalizeEgyptPhone(student.studentPhone || '') === phone);
      const sibling = field === 'guardianPhone' ? data.students.find((student) => student.id !== form?.id && normalizeEgyptPhone(student.guardianPhone || '') === phone) : null;
      setContactMessage(duplicate ? `تنبيه: الرقم مستخدم كهاتف طالب لدى ${duplicate.name}` : sibling ? `سيتم ربط حساب ولي الأمر أيضًا بالطالب ${sibling.name}.` : '');
      setForm((previous) => ({ ...previous, [field]: phone }));
    } catch {
      setContactMessage('تعذر فتح جهات الاتصال. تحقق من الإذن.');
    }
  };

  const save = async () => {
    if (!form?.name?.trim() || saving) return;
    setSaving(true);
    setNotice('');
    try {
      const exists = data.students.some((student) => student.id === form.id);
      const studentId = exists ? form.id : Date.now() * 1000 + Math.floor(Math.random() * 1000);
      const usedCodes = new Set(data.students.filter((student) => student.id !== studentId).map((student) => Number(student.code)).filter((code) => Number.isSafeInteger(code) && code > 0));
      const requestedCode = Number(form.code);
      let code = Number.isSafeInteger(requestedCode) && requestedCode > 0 ? requestedCode : 1;
      if (!(Number.isSafeInteger(requestedCode) && requestedCode > 0)) {
        while (usedCodes.has(code)) code += 1;
      }
      if (usedCodes.has(code)) throw new Error(`كود الطالب ${code} مستخدم بالفعل. اختر كودًا آخر أو اتركه فارغًا للتوليد التلقائي.`);
      const guardianPhone = normalizeEgyptPhone(form.guardianPhone || '');
      const studentPhone = normalizeEgyptPhone(form.studentPhone || '');
      const duplicateStudentPhone = data.students.find((student) => student.id !== studentId && studentPhone && (studentPhone === normalizeEgyptPhone(student.studentPhone || '') || studentPhone === normalizeEgyptPhone(student.guardianPhone || '')));
      if (duplicateStudentPhone) throw new Error(`هاتف الطالب مستخدم بالفعل لدى ${duplicateStudentPhone.name}.`);
      const guardianUsedAsStudentPhone = data.students.find((student) => student.id !== studentId && guardianPhone && guardianPhone === normalizeEgyptPhone(student.studentPhone || ''));
      if (guardianUsedAsStudentPhone) throw new Error(`رقم ولي الأمر مستخدم كهاتف طالب لدى ${guardianUsedAsStudentPhone.name}.`);
      const nextStudent = { ...form, id: studentId, code, name: form.name.trim(), guardianPhone, studentPhone, updatedAt: new Date().toISOString() };
      const studentPin = normalizePin(form.studentPin);
      const guardianPin = normalizePin(form.guardianPin);
      if (studentPin && (studentPin.length < 6 || studentPin.length > 10)) throw new Error('PIN الطالب يجب أن يتكون من 6 إلى 10 أرقام.');
      if (guardianPin && (guardianPin.length < 6 || guardianPin.length > 10)) throw new Error('PIN ولي الأمر يجب أن يتكون من 6 إلى 10 أرقام.');
      if (guardianPin && !guardianPhone) throw new Error('أدخل رقم ولي الأمر قبل تفعيل حسابه.');
      delete nextStudent.studentPin;
      delete nextStudent.guardianPin;
      if (studentPin) Object.assign(nextStudent, await createCredentialSecret(studentPin, 'student'));
      if (guardianPin) Object.assign(nextStudent, await createCredentialSecret(guardianPin, 'guardian'));
      const nextStudents = exists
        ? data.students.map((student) => student.id === studentId ? nextStudent : student)
        : [...data.students, nextStudent];
      const nextData = { ...data, students: nextStudents };
      await updateData(nextData);
      let syncMessage = 'تم حفظ بيانات الطالب وحسابات الدخول بأمان.';
      if (cloudConfigured(nextData.settings)) {
        try {
          const remote = await pushCloudData(nextData);
          const syncedAt = new Date().toISOString();
          await updateData({
            ...nextData,
            settings: {
              ...nextData.settings,
              cloudSync: {
                ...nextData.settings.cloudSync,
                revision: remote.revision || nextData.settings.cloudSync.revision || '',
                lastPushAt: syncedAt,
                lastAutoSyncAt: syncedAt,
                localChangedAt: '',
                autoSyncError: '',
              },
            },
          }, { skipCloudDirty: true });
          syncMessage = 'تم حفظ الطالب ومزامنته فورًا؛ يمكنه الدخول من أي جهاز بنفس الكود وPIN.';
        } catch (syncError) {
          syncMessage = `تم الحفظ على هذا الجهاز، لكن المزامنة الفورية فشلت: ${syncError?.message || 'تحقق من الخادم ثم اضغط مزامنة.'}`;
        }
      } else {
        syncMessage = 'تم الحفظ محليًا. اضبط المزامنة السحابية ليتمكن الطالب من الدخول من جهاز آخر.';
      }
      setForm(null);
      setNotice(syncMessage);
    } catch (error) {
      setNotice(error?.message || 'تعذر حفظ الطالب.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (student) => {
    if (!window.confirm(`حذف الطالب ${student.name} نهائيًا؟ سيتم حذف بياناته المرتبطة فقط دون التأثير على بقية الطلاب.`)) return;
    await updateData(pruneStudentFromData(data, student.id));
    if (form?.id === student.id) setForm(null);
  };

  const editStudent = (student) => setForm({ ...student, studentPin: '', guardianPin: '' });

  return (
    <section className="page">
      <div className="page-heading">
        <div><span className="eyebrow">إدارة الطلاب</span><h2>الطلاب والمجموعات</h2></div>
        <button className="primary-btn" onClick={() => setForm(emptyStudent())}>+ إضافة طالب</button>
      </div>
      {notice && <div className="settings-notice">{notice}</div>}

      <div className="panel">
        <input className="search-input" placeholder="بحث بالاسم أو الكود..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <div className="responsive-table">
          <table>
            <thead><tr><th>الكود</th><th>الاسم</th><th>الصف</th><th>المجموعة</th><th>ولي الأمر</th><th>الحسابات</th><th></th></tr></thead>
            <tbody>
              {filtered.map((student) => (
                <tr key={student.id}>
                  <td><span className="student-code">{student.code}</span></td>
                  <td><strong>{student.name}</strong></td>
                  <td>{student.grade}</td>
                  <td>{student.group}</td>
                  <td>{student.guardianPhone}</td>
                  <td><small>{hasCredentialSecret(student, 'student') ? 'طالب ✓' : 'طالب غير مفعّل'} • {hasCredentialSecret(student, 'guardian') ? 'ولي أمر ✓' : 'ولي أمر غير مفعّل'}</small></td>
                  <td style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="text-btn" onClick={() => editStudent(student)}>تعديل</button>
                    <button className="text-btn danger-text" onClick={() => remove(student)}><Trash2 size={16} /> حذف</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>{form.id ? 'تعديل طالب' : 'إضافة طالب'}</h3>
            <div className="form-grid">
              <input placeholder="اسم الطالب" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              <input type="number" min="1" inputMode="numeric" placeholder="كود الطالب — اتركه فارغًا للتوليد" value={form.code || ''} onChange={(event) => setForm({ ...form, code: event.target.value.replace(/\D/g, '').slice(0, 9) })} />
              <input placeholder="الصف الدراسي" value={form.grade} onChange={(event) => setForm({ ...form, grade: event.target.value })} />
              <input placeholder="المجموعة" value={form.group} onChange={(event) => setForm({ ...form, group: event.target.value })} />
              <div className="phone-picker-field"><input placeholder="رقم ولي الأمر" value={form.guardianPhone || ''} onChange={(event) => setForm({ ...form, guardianPhone: normalizeEgyptPhone(event.target.value) })} /><button type="button" onClick={() => chooseContact('guardianPhone')} title="اختيار من جهات الاتصال"><ContactRound /></button></div>
              <div className="phone-picker-field"><input placeholder="رقم الطالب" value={form.studentPhone || ''} onChange={(event) => setForm({ ...form, studentPhone: normalizeEgyptPhone(event.target.value) })} /><button type="button" onClick={() => chooseContact('studentPhone')} title="اختيار من جهات الاتصال"><ContactRound /></button></div>
              {contactMessage && <div className="contact-message">{contactMessage}</div>}
              <input type="number" min="0" max="5000" placeholder="سعر الحصة" value={form.sessionPrice} onChange={(event) => setForm({ ...form, sessionPrice: Number(event.target.value) })} />
              <label className="auth-field"><span><KeyRound size={14} /> PIN الطالب {form.id ? '(اتركه فارغًا للإبقاء عليه)' : ''}</span><input type="password" inputMode="numeric" maxLength={10} value={form.studentPin || ''} onChange={(event) => setForm({ ...form, studentPin: normalizePin(event.target.value) })} placeholder="6 إلى 10 أرقام" /></label>
              <label className="auth-field"><span><KeyRound size={14} /> PIN ولي الأمر {form.id ? '(اتركه فارغًا للإبقاء عليه)' : ''}</span><input type="password" inputMode="numeric" maxLength={10} value={form.guardianPin || ''} onChange={(event) => setForm({ ...form, guardianPin: normalizePin(event.target.value) })} placeholder="6 إلى 10 أرقام" /></label>
              <label className="permission-check"><input type="checkbox" checked={form.permissions?.games !== false} onChange={(event) => setForm({ ...form, permissions: { ...form.permissions, games: event.target.checked } })} /> السماح بالألعاب</label>
              <label className="permission-check"><input type="checkbox" checked={form.permissions?.grades !== false} onChange={(event) => setForm({ ...form, permissions: { ...form.permissions, grades: event.target.checked } })} /> إظهار الدرجات للطالب</label>
              <label className="permission-check"><input type="checkbox" checked={form.parentPermissions?.grades !== false} onChange={(event) => setForm({ ...form, parentPermissions: { ...form.parentPermissions, grades: event.target.checked } })} /> إظهار الدرجات لولي الأمر</label>
            </div>
            <div className="modal-actions">
              <button className="primary-btn" onClick={save} disabled={saving}>{saving ? 'جارٍ الحفظ...' : 'حفظ'}</button>
              <button className="secondary-btn" onClick={() => setForm(null)} disabled={saving}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
