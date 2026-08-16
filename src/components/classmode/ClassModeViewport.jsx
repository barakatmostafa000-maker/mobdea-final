function Slot({ className, children }) {
  return <div className={className}>{children}</div>;
}

function ClassModeViewport({ className = '', sceneRef, children }) {
  return (
    <section className={`classmode-viewport ${className}`.trim()} ref={sceneRef}>
      <div className="classmode-viewport-skin classmode-v103">
        {children}
      </div>
    </section>
  );
}

ClassModeViewport.Header = function ClassModeViewportHeader({ children }) {
  return <Slot className="classmode-viewport-header">{children}</Slot>;
};

ClassModeViewport.Body = function ClassModeViewportBody({ children }) {
  return <Slot className="classmode-layout classmode-viewport-body">{children}</Slot>;
};

ClassModeViewport.Stage = function ClassModeViewportStage({ children }) {
  return <Slot className="classmode-viewport-stage">{children}</Slot>;
};

ClassModeViewport.Students = function ClassModeViewportStudents({ children }) {
  return <Slot className="classmode-viewport-students">{children}</Slot>;
};

ClassModeViewport.Footer = function ClassModeViewportFooter({ children }) {
  return <Slot className="classmode-viewport-footer">{children}</Slot>;
};

ClassModeViewport.Overlays = function ClassModeViewportOverlays({ children }) {
  return <Slot className="classmode-viewport-overlays">{children}</Slot>;
};

export default ClassModeViewport;
