import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { upsertCorporateSkill } from '@/lib/services/corporate-skills'

const SEEDS_DIR = join(process.cwd(), 'seeds', 'skills')

interface SkillMeta {
  name: string
  description?: string
  tool?: string
}

function parseFrontmatter(content: string): SkillMeta {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content)
  if (!match) return { name: 'Unknown' }
  const block = match[1]

  const nameMatch = /^name:\s*(.+)$/m.exec(block)
  const descMatch = /^description:\s*["']?(.*?)["']?$/m.exec(block)
  const toolMatch = /^tool:\s*(.+)$/m.exec(block)

  return {
    name: nameMatch?.[1]?.trim().replace(/^["']|["']$/g, '') ?? 'Unknown',
    description: descMatch?.[1]?.trim().replace(/^["']|["']$/g, '') || undefined,
    tool: toolMatch?.[1]?.trim().replace(/^["']|["']$/g, '') || undefined,
  }
}

export interface SeedResult {
  slug: string
  action: 'created' | 'updated' | 'skipped' | 'error'
  error?: string
}

export async function seedBaselineSkills(): Promise<SeedResult[]> {
  if (!existsSync(SEEDS_DIR)) {
    console.warn('[baseline] seeds/skills/ not found — skipping skill seed')
    return []
  }

  const slugs = readdirSync(SEEDS_DIR).filter((f) =>
    statSync(join(SEEDS_DIR, f)).isDirectory(),
  )

  const results: SeedResult[] = []

  for (const slug of slugs) {
    const skillPath = join(SEEDS_DIR, slug, 'SKILL.md')
    if (!existsSync(skillPath)) continue

    const content = readFileSync(skillPath, 'utf8')
    const meta = parseFrontmatter(content)

    try {
      const result = await upsertCorporateSkill(
        {
          slug,
          name: meta.name,
          description: meta.description ?? null,
          tool: meta.tool ?? null,
          content,
        },
        null,
      )
      results.push({ slug, action: result.action })
    } catch (err) {
      results.push({ slug, action: 'error', error: err instanceof Error ? err.message : String(err) })
    }
  }

  return results
}
