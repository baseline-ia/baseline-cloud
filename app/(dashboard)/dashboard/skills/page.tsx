import { Zap } from 'lucide-react';
import { getSkillAdoptionPage, parseSkillAdoptionParams } from '@/lib/services/metrics';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

function formatDate(date: Date | null): string {
  if (!date) return '–';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default async function SkillsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const listParams = parseSkillAdoptionParams(await searchParams);
  const skillList = await getSkillAdoptionPage(listParams);
  const { rows: skills, total, page, totalPages } = skillList;

  function skillListHref(nextPage: number) {
    const params = new URLSearchParams();
    if (listParams.search) params.set('q', listParams.search);
    if (nextPage > 1) params.set('page', String(nextPage));
    const query = params.toString();
    return `/dashboard/skills${query ? `?${query}` : ''}`;
  }

  return (
    <div>
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Zap size={22} />
          Skills
        </h1>
        <p className="subtitle">Baseline skill adoption across your team</p>
      </div>

      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--cl-radius)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
        }}
      >
        <form method="get" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '1.25rem 1.5rem' }}>
          <label htmlFor="skill-adoption-search" style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}>
            Search
          </label>
          <input
            id="skill-adoption-search"
            name="q"
            type="search"
            defaultValue={listParams.search}
            placeholder="Skill name or tool"
            aria-label="Search skill adoption"
            style={{ height: '36px', padding: '0 0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--cl-radius-sm)', fontSize: '0.9375rem', color: 'var(--text)', background: 'var(--bg-subtle)', width: 'min(100%, 360px)' }}
          />
          <input type="hidden" name="page" value="1" />
          <button type="submit" style={{ height: '36px', padding: '0 1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--cl-radius-sm)', background: 'var(--bg-subtle)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer' }}>
            Search
          </button>
        </form>
        {skills.length === 0 ? (
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
            <p style={{ fontSize: '1.0625rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.5rem' }}>
              No skills installed yet.
            </p>
            <p style={{ fontSize: '0.9375rem', color: 'var(--text-muted)', margin: 0 }}>
              {listParams.search ? 'No skill adoption matches your search.' : 'Developers can install baseline skills via the CLI.'}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Skill Name</TableHead>
                <TableHead>Tool</TableHead>
                <TableHead style={{ textAlign: 'center' }}>Adopters</TableHead>
                <TableHead>Last Installed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {skills.map((skill) => (
                <TableRow key={`${skill.skillName}-${skill.tool}`}>
                  <TableCell>
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: '0.9375rem',
                        color: 'var(--text)',
                      }}
                    >
                      {skill.skillName}
                    </span>
                  </TableCell>
                  <TableCell>
                    <code
                      style={{
                        fontFamily: 'var(--font-jetbrains-mono), monospace',
                        fontSize: '0.8125rem',
                        color: 'var(--text-muted)',
                        background: 'var(--bg-subtle)',
                        padding: '0.125rem 0.375rem',
                        borderRadius: '4px',
                      }}
                    >
                      {skill.tool}
                    </code>
                  </TableCell>
                  <TableCell style={{ textAlign: 'center' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '28px',
                        height: '24px',
                        padding: '0 0.5rem',
                        borderRadius: '999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: 'var(--cl-primary-soft)',
                        color: 'var(--cl-primary)',
                      }}
                    >
                      {skill.adopters}
                    </span>
                  </TableCell>
                  <TableCell
                    style={{
                      fontSize: '0.9375rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {formatDate(skill.lastInstalledAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          <span>{total} skill{total === 1 ? '' : 's'} · Page {page} of {totalPages}</span>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {page > 1 && <a href={skillListHref(page - 1)} style={{ color: 'var(--cl-primary)', textDecoration: 'none' }}>Previous</a>}
            {page < totalPages && <a href={skillListHref(page + 1)} style={{ color: 'var(--cl-primary)', textDecoration: 'none' }}>Next</a>}
          </div>
        </div>
      </div>
    </div>
  );
}
