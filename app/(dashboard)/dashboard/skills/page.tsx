import { Zap } from 'lucide-react';
import { getSkillAdoption } from '@/lib/services/metrics';
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

export default async function SkillsPage() {
  const skills = await getSkillAdoption();

  return (
    <div>
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Zap size={22} />
          Skills
        </h1>
        <p className="subtitle">Baseline skill adoption across your team</p>
      </div>

      {skills.length === 0 ? (
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--cl-radius)',
            padding: '3rem 1.5rem',
            textAlign: 'center',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <p
            style={{
              fontSize: '1.0625rem',
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: '0.5rem',
            }}
          >
            No skills installed yet.
          </p>
          <p style={{ fontSize: '0.9375rem', color: 'var(--text-muted)', margin: 0 }}>
            Developers can install baseline skills via the CLI.
          </p>
        </div>
      ) : (
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--cl-radius)',
            boxShadow: 'var(--shadow-sm)',
            overflow: 'hidden',
          }}
        >
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
        </div>
      )}
    </div>
  );
}
