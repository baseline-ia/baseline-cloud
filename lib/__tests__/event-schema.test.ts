import { describe, expect, it } from 'vitest'
import { EventSchema } from '../events/schema'

describe('EventSchema', () => {
  it.each(['sdd.phase.started', 'sdd.phase.completed'])('accepts %s', (event_type) => {
    expect(EventSchema.safeParse({ event_type, project: 'default', payload: {} }).success).toBe(true)
  })

  it('still rejects unknown event types', () => {
    expect(EventSchema.safeParse({ event_type: 'sdd.phase.failed', project: 'default', payload: {} }).success).toBe(false)
  })
})
