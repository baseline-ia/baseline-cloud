export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { seedBaselineSkills } = await import('@/lib/db/seed-skills')
    try {
      const results = await seedBaselineSkills()
      const created = results.filter((r) => r.action === 'created').length
      const updated = results.filter((r) => r.action === 'updated').length
      const errors = results.filter((r) => r.action === 'error')
      if (created > 0 || updated > 0) {
        console.log(`[baseline] skills seeded: ${created} created, ${updated} updated`)
      }
      for (const e of errors) {
        console.error(`[baseline] skill seed error (${e.slug}): ${e.error}`)
      }
    } catch (err) {
      console.error('[baseline] skill seed failed:', err)
    }
  }
}
