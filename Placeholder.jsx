export default function Placeholder({ title, subtitle }) {
  return (
    <section className="page">
      <div className="page-heading"><div><span className="eyebrow">قيد البناء داخل المشروع الجديد</span><h2>{title}</h2><p>{subtitle}</p></div></div>
      <div className="panel empty-module">
        <div>🚧</div>
        <h3>الوحدة جاهزة كهيكل مستقل</h3>
        <p>سيتم استكمال الوظائف داخل هذا الملف دون التأثير على باقي أجزاء التطبيق.</p>
      </div>
    </section>
  );
}
