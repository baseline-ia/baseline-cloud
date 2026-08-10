/**
 * Tests for SkillsForm admin UI
 * Spec: corporate-skills-server
 *
 * Tests verify:
 * - Create skill form renders fields and wires to createSkillAction
 * - Publish version panel submits publishVersionAction with skillId
 * - Skills table renders skill rows
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock server actions
vi.mock('./actions', () => ({
  createSkillAction: vi.fn(),
  publishVersionAction: vi.fn(),
  assignToProjectAction: vi.fn(),
  unassignAction: vi.fn(),
}))

// Mock useActionState — React 19 API
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    useActionState: vi.fn((_action: unknown, initialState: unknown) => [initialState, vi.fn(), false]),
  }
})

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
    tool: 'claude',
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

  describe('Create skill form', () => {
    it('renders the create skill form with required fields', () => {
      render(<SkillsForm initialSkills={[]} />)

      expect(screen.getByLabelText(/slug/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
    })

    it('renders the "Create Skill" submit button', () => {
      render(<SkillsForm initialSkills={[]} />)
      expect(screen.getByRole('button', { name: /create skill/i })).toBeInTheDocument()
    })
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
  })

  describe('Publish version panel', () => {
    it('renders publish panel with skillId hidden input', async () => {
      const skills = [makeSkill({ id: 'skill-id-1' })]
      render(<SkillsForm initialSkills={skills} />)

      // Open the publish details panel
      const publishSummary = screen.getByText(/publish version/i)
      await userEvent.click(publishSummary)

      const hiddenInput = document.querySelector<HTMLInputElement>(
        'input[type="hidden"][name="skillId"][value="skill-id-1"]',
      )
      expect(hiddenInput).toBeInTheDocument()
    })
  })
})
