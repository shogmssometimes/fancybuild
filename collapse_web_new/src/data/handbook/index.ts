import baseCards from './baseCards'
import modCards from './modCards'
import nullCards from './nullCards'
import gear from './gear'
import events from './events'

export const Handbook = {
  baseCards,
  modCards,
  nullCards,
  gear,
  events,
  getAllCards(): any[] {
    return [...modCards, ...baseCards, ...nullCards, ...gear]
  }
}

export default Handbook
