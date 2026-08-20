import { seedBaselineSkills } from './seed-skills'

seedBaselineSkills().then((results) => {
  const created = results.filter((r) => r.action === 'created').length
  const updated = results.filter((r) => r.action === 'updated').length
  const skipped = results.filter((r) => r.action === 'skipped').length
  const errors = results.filter((r) => r.action === 'error')
  console.log(`Skills seeded: ${created} created, ${updated} updated, ${skipped} skipped`)
  for (const e of errors) console.error(`  ERROR ${e.slug}: ${e.error}`)
  process.exit(errors.length > 0 ? 1 : 0)
}).catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
