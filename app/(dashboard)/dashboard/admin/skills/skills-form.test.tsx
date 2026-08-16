/**
 * Tests for SkillsForm admin UI
 * Spec: corporate-skills-server
 *
 * Tests verify:
 * - Skills table renders skill rows with slug, name, and version
 * - "Manage" link points to the skill detail page
 * - Empty state message when no skills
 */

import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'

import { SkillsForm } from './skills-form'
import type { CorporateSkill } from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSkill(overrides: Partial<CorporateSkill & { latestVersion: number | null }> = {}) {
  return {
    id: 'skill-id-1',
    slug: 'sdd-apply',
    name: 'SDD Apply',
    description: null,
    tool: 'kiro',
    failClosed: false,
    createdByUserId: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    latestVersion: 1,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SkillsForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Skills table', () => {
    it('renders skill rows with slug and name', () => {
      const skills = [makeSkill()]
      render(<SkillsForm initialSkills={skills} />)

      expect(screen.getByText('sdd-apply')).toBeInTheDocument()
      expect(screen.getByText('SDD Apply')).toBeInTheDocument()
    })

    it('shows "No skills" message when list is empty', () => {
      render(<SkillsForm initialSkills={[]} />)
      expect(screen.getByText(/no skills/i)).toBeInTheDocument()
    })

    it('shows latestVersion for a skill', () => {
      const skills = [makeSkill({ latestVersion: 3 })]
      render(<SkillsForm initialSkills={skills} />)
      expect(screen.getByText('v3')).toBeInTheDocument()
    })

    it('shows "No versions" when latestVersion is null', () => {
      const skills = [makeSkill({ latestVersion: null })]
      render(<SkillsForm initialSkills={skills} />)
      expect(screen.getByText(/no versions/i)).toBeInTheDocument()
    })

    it('renders a Manage link pointing to the skill detail page', () => {
      const skills = [makeSkill({ slug: 'sdd-apply' })]
      render(<SkillsForm initialSkills={skills} />)

      const link = screen.getByRole('link', { name: /manage/i })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', '/dashboard/admin/skills/sdd-apply')
    })
  })
})
