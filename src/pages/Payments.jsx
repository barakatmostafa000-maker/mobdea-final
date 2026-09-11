// PROJECT13_BARCODE_ATTENDANCE_ACCOUNTING_V1
import { useMemo, useState } from 'react';
import { Barcode, CreditCard, WalletCards } from 'lucide-react';

export default function Payments({ data, updateData }) {
  const [form, setForm] = useState(null);
  const rows = useMemo(
    () => [...(data.payments || [])].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))),
    [data.payments],
  );
  const paid = rows.filter((item) => item.type === 'paid').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const due = rows.filter((item) => item.type === 'due').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const barcodeRows = rows.filter((item) => item.source === 'attendance-barcode').length;

  const save = async () => {
    if (!form?.studentId || !form?.amount) return;
    const session = (data.sessions || []).find((item) => String(item.id) === String(form.sessionId));
    await updateData({
      ...data,
      payments: [
        ...(data.payments || []),
        {
          ...form,
          id: Date.now(),
          sessionTitle: session?.title || form.sessionTitle || '',
          source: form.source || 'manual',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    setForm(null);
  };

  return (
    <section className="page project13-payments-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">الحضور والحسابات</span>
          <h2>الحسابات والمستحقات</h2>
          <p>أي حضور بالباركود يظهر هنا تلقائيًا باسم الطالب والحصة وحالتها: مدفوعة أو مستحقة.</p>
        </div>
        <button className="primary-btn" type="button" onClick={() => setForm({
          studentId: data.students?.[0]?.id || '',
          sessionId: data.sessions?.find((item) => item.current)?.id || data.sessions?.[0]?.id || '',
          type: 'paid',
          amount: Number(data.students?.[0]?.sessionPrice || data.sessions?.[0]?.price || 50),
          note: 'حصة',
          date: new Date().toISOString().slice(0, 10),
          source: 'manual',
        })}>+ تسجيل حركة</button>
      </div>

      <div className="stats-grid compact">
        <div className="stat-card"><CreditCard/><div><span>إجمالي المدفوع</span><strong>{paid} ج</strong><small>الحركات المدفوعة</small></div></div>
        <div className="stat-card"><WalletCards/><div><span>إجمالي المستحق</span><strong>{due} ج</strong><small>المبالغ المستحقة</small></div></div>
        <div className="stat-card"><Barcode/><div><span>من الباركود</span><strong>{barcodeRows}</strong><small>حركات حضور مرتبطة</small></div></div>
      </div>

      <div className="panel responsive-table">
        <table>
          <thead><tr><th>الطالب</th><th>الحصة</th><th>الحالة</th><th>المبلغ</th><th>المصدر</th><th>البيان</th><th>التاريخ</th></tr></thead>
          <tbody>
            {rows.map((payment) => (
              <tr key={payment.id}>
                <td>{data.students.find((student) => String(student.id) === String(payment.studentId))?.name || '—'}</td>
                <td>{payment.sessionTitle || data.sessions.find((session) => String(session.id) === String(payment.sessionId))?.title || '—'}</td>
                <td><span className={`project13-payment-badge ${payment.type}`}>{payment.type === 'paid' ? 'مدفوع' : payment.type === 'due' ? 'مستحق' : payment.type}</span></td>
                <td>{Number(payment.amount || 0)} ج</td>
                <td>{payment.source === 'attendance-barcode' ? 'باركود الحضور' : 'يدوي'}</td>
                <td>{payment.note || '—'}</td>
                <td>{payment.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>تسجيل حركة حساب</h3>
            <div className="form-grid">
              <select value={form.studentId} onChange={(event) => {
                const studentId = event.target.value;
                const student = data.students.find((item) => String(item.id) === String(studentId));
                setForm({ ...form, studentId: student?.id || studentId, amount: Number(student?.sessionPrice || form.amount || 0) });
              }}>
                {data.students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
              </select>
              <select value={form.sessionId || ''} onChange={(event) => setForm({ ...form, sessionId: event.target.value })}>
                <option value="">بدون حصة محددة</option>
                {(data.sessions || []).map((session) => <option key={session.id} value={session.id}>{session.title} — {session.group}</option>)}
              </select>
              <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
                <option value="paid">مدفوع</option><option value="due">مستحق</option><option value="discount">خصم</option><option value="exempt">إعفاء</option>
              </select>
              <input type="number" min="0" value={form.amount} onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })}/>
              <input placeholder="البيان" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })}/>
              <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })}/>
            </div>
            <div className="modal-actions">
              <button className="primary-btn" type="button" onClick={() => void save()}>حفظ</button>
              <button className="secondary-btn" type="button" onClick={() => setForm(null)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
