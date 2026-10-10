import { vehicleImage } from '../config/media'

/*
 * Vehicle visual. Uses a real photo when one is mapped in config/media.js;
 * otherwise a typographic chrome plate: the model name in outlined serif over
 * a brushed-metal horizon, with the registration as a plate. Swappable, honest.
 */
export default function VehiclePlate({ vehicle, size = 'md', priority = false }) {
  const img = vehicleImage(vehicle)
  const [make, ...rest] = (vehicle?.model_name || '').split(' ')
  return (
    <div className={`plate plate--${size}`}>
      {img ? (
        <img
          className="plate__img"
          src={img}
          alt={`${vehicle.model_name}, ${vehicle.category_name}`}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
        />
      ) : (
        <div className="plate__art" role="img" aria-label={`${vehicle?.model_name} placeholder visual`}>
          <span className="plate__horizon" />
          <span className="plate__glint" />
          <span className="plate__make">{make}</span>
          <span className="plate__model">{rest.join(' ') || make}</span>
        </div>
      )}
      <span className="plate__reg num">{vehicle?.registration_no}</span>
    </div>
  )
}
