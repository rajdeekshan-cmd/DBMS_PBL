/* The page's single marquee: brand values in huge outlined serif. CSS-only, paused for reduced motion. */
const WORDS = ['Discretion', 'Precision', 'Punctuality', 'Composure', 'Care']

export default function Marquee() {
  const row = (hidden) => (
    <div className="marquee__row" aria-hidden={hidden || undefined}>
      {WORDS.map((w) => (
        <span className="marquee__item" key={w}>
          <span className="marquee__word">{w}</span>
          <span className="marquee__sep" />
        </span>
      ))}
    </div>
  )
  return (
    <section className="marquee" aria-label="Our values: discretion, precision, punctuality, composure, care">
      <div className="marquee__track" aria-hidden="true">
        {row(true)}
        {row(true)}
      </div>
    </section>
  )
}
