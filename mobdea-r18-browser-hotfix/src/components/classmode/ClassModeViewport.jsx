function Slot({ className, children }) {
  return <div className={className}>{children}</div>;
}

/**
 * Classroom owns one real root element.
 *
 * R18 previously put `classmode-v103` on a display:contents wrapper while
 * `classmode-final-layout` lived on the parent. A large part of the existing
 * classroom CSS intentionally targets `.classmode-v103.classmode-final-layout`,
 * so those rules could never match. Keeping both contracts on the same root
 * restores the visual/interaction skin while v111.css (loaded last) remains the
 * single owner of viewport geometry and safe-area overrides.
 */
function ClassModeViewport({ className = '', sceneRef, children }) {
  return (
    <section className={`classmode-viewport classmode-v103 ${className}`.trim()} ref={sceneRef}>
      {children}
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
