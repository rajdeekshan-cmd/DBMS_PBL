import { useId } from 'react'

/*
 * Floating-label field. The <label> is always rendered and visible (it rests in
 * the field and rises when focused or filled), so it is never a placeholder.
 * Animated chrome underline on focus. Hint and error sit below the input.
 */
export function Field({ label, hint, error, as = 'input', className = '', children, ...props }) {
  const id = useId()
  const Comp = as
  const describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(' ') || undefined
  const filled = props.value !== undefined && props.value !== null && String(props.value) !== ''
  const always = as === 'select' || props.type === 'datetime-local' || props.type === 'date'
  return (
    <div className={`field ${filled || always ? 'is-filled' : ''} ${error ? 'has-error' : ''} ${className}`}>
      <Comp id={id} className="field__input" aria-invalid={!!error} aria-describedby={describedBy} placeholder=" " {...props}>
        {children}
      </Comp>
      <label htmlFor={id} className="field__label">{label}</label>
      <span className="field__line" aria-hidden="true" />
      {hint && !error && <p id={`${id}-hint`} className="field__hint">{hint}</p>}
      {error && <p id={`${id}-err`} className="field__error" role="alert">{error}</p>}
    </div>
  )
}

export function Segmented({ label, options, value, onChange, name }) {
  return (
    <fieldset className="segmented">
      <legend className="segmented__legend">{label}</legend>
      <div className="segmented__row">
        {options.map((o) => (
          <label key={o.value} className={`chip-option ${value === o.value ? 'is-active' : ''}`}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
