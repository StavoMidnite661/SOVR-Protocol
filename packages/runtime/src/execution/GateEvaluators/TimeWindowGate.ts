/**
 * TimeWindowGate
 *
 * Gate type: TIME_WINDOW
 *
 * Checks that a command is being executed within
 * the declared time window.
 *
 * Use cases:
 *   Treasury transfers restricted to business hours
 *   Batch operations restricted to off-peak windows
 *   High-value transfers restricted to staffed hours
 *
 * Time zone aware — uses IANA timezone identifiers.
 * Days of week: 0=Sunday, 1=Monday ... 6=Saturday.
 */

import { GateEvaluator, GateType, TimeWindowGateConfig, GateConfig } from '../types'

export class TimeWindowGate implements GateEvaluator {

  readonly type: GateType = 'TIME_WINDOW'

  async evaluate(
    _aggregateId: string,
    _actorId:     string,
    _payload:     Record<string, unknown>,
    config:       GateConfig
  ): Promise<{ passed: boolean; reason?: string }> {

    const cfg = config as TimeWindowGateConfig
    const window = cfg.window

    const now = new Date(
      new Date().toLocaleString('en-US', { timeZone: window.timezone })
    )

    const day  = now.getDay()
    const hour = now.getHours()
    const min  = now.getMinutes()

    if (!window.daysOfWeek.includes(day)) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      return {
        passed: false,
        reason: `Command not allowed on ${dayNames[day]}. Allowed days: ${window.daysOfWeek.map(d => dayNames[d]).join(', ')}`
      }
    }

    const currentMinutes = hour * 60 + min
    const startMinutes   = window.startHour * 60
    const endMinutes     = window.endHour * 60

    if (currentMinutes < startMinutes || currentMinutes >= endMinutes) {
      return {
        passed: false,
        reason: `Command not allowed at ${hour.toString().padStart(2,'0')}:${min.toString().padStart(2,'0')} ${window.timezone}. Window: ${window.startHour}:00–${window.endHour}:00`
      }
    }

    return { passed: true }
  }
}
