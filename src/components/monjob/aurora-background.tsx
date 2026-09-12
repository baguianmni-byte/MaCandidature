// React and its JSX types are provided by the consuming application.
// @ts-nocheck
export function AuroraBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <div
        className="aurora-blob bg-aurora-a"
        style={{ top: "-120px", left: "-80px", width: "320px", height: "320px" }}
      />
      <div
        className="aurora-blob bg-aurora-b"
        style={{ top: "180px", right: "-120px", width: "360px", height: "360px" }}
      />
      <div
        className="aurora-blob bg-aurora-c"
        style={{ bottom: "-160px", left: "10%", width: "380px", height: "380px", opacity: 0.4 }}
      />
    </div>
  );
}
