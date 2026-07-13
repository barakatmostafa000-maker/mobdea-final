import { QRCodeSVG } from 'qrcode.react';

export default function StudentCards({ data }) {
  return <section className="page">
    <div className="page-heading">
      <div><span className="eyebrow">كارت وجه واحد</span><h2>كروت الطلاب</h2><p>كل كارت يحمل الكود القصير وQR الخاص بالطالب.</p></div>
    </div>
    <div className="student-cards-grid">
      {data.students.map((student) => (
        <article className="print-student-card" key={student.id}>
          <div className="card-brand"><strong>المُبدع</strong><span>مصطفى بركات</span></div>
          <div className="card-info">
            <h3>{student.name}</h3>
            <p>{student.grade}</p>
            <p>{student.group}</p>
            <div className="short-code">كود الطالب: <b>{student.code}</b></div>
          </div>
          <div className="card-qr">
            <QRCodeSVG value={`mobdea://student/${student.code}`} size={92} level="M" includeMargin />
          </div>
          <footer>المُبدع لتعليم ممتع</footer>
        </article>
      ))}
    </div>
  </section>;
}
