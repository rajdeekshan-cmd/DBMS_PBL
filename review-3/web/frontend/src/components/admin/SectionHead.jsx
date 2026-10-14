export default function SectionHead({ title, children }) {
  return (
    <header className="section-head">
      <h1 className="h-lg">{title}</h1>
      {children && <div className="section-head__actions">{children}</div>}
    </header>
  )
}
