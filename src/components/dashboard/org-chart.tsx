'use client'

import { useState, useEffect } from 'react'
import { Users, Briefcase, GraduationCap, UserCheck } from 'lucide-react'
import {
  AMPLIWORK_ORG,
  getOrgTotals,
  type OrgPerson,
  type OrgDepartment,
  type WorkerType,
} from '@/lib/org/ampliwork-org'

/* ---------- Styles ---------- */
const ORG_CHART_STYLES = `
@keyframes org-fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.org-card-enter {
  animation: org-fade-in 0.4s ease-out both;
}
.org-card-hover:hover {
  box-shadow: 0 0 20px 2px rgba(96,165,250,0.12), 0 4px 24px rgba(0,0,0,0.3);
}
`

function AnimationStyles() {
  return <style dangerouslySetInnerHTML={{ __html: ORG_CHART_STYLES }} />
}

/* ---------- Hero stats (matches PDF header) ---------- */
function HeroStats() {
  const totals = getOrgTotals()
  const stats = [
    { label: 'Total team', value: totals.total, icon: Users, color: '#60a5fa', bg: 'rgba(96,165,250,0.08)' },
    { label: 'Salaried', value: totals.salaried, icon: UserCheck, color: '#38bdf8', bg: 'rgba(56,189,248,0.08)' },
    { label: 'Contractors', value: totals.contractors, icon: Briefcase, color: '#f87171', bg: 'rgba(248,113,113,0.08)' },
    { label: 'Interns', value: totals.interns, icon: GraduationCap, color: '#34d399', bg: 'rgba(52,211,153,0.08)' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {stats.map((s, i) => (
        <div
          key={s.label}
          className="group relative flex items-center gap-3 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-4 py-3 transition-all duration-300 hover:border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.04)] org-card-enter"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div
            className="flex items-center justify-center size-9 rounded-lg shrink-0"
            style={{ backgroundColor: s.bg }}
          >
            <s.icon className="size-4" style={{ color: s.color }} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-[#e8edf4] tabular-nums leading-none">
              {s.value}
            </p>
            <p className="text-[11px] text-[#7b8fa3] leading-tight mt-0.5 truncate">
              {s.label}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ---------- View toggle ---------- */
function ViewTabs({
  active,
  onChange,
}: {
  active: 'chart' | 'departments'
  onChange: (v: 'chart' | 'departments') => void
}) {
  const tabs = ['chart', 'departments'] as const
  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    let next = index
    if (e.key === 'ArrowRight') { e.preventDefault(); next = (index + 1) % tabs.length }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); next = (index - 1 + tabs.length) % tabs.length }
    else return
    onChange(tabs[next])
    const btn = e.currentTarget.parentElement?.querySelectorAll('button')[next] as HTMLElement
    btn?.focus()
  }
  return (
    <div role="tablist" aria-label="Org chart views" className="flex gap-0.5 rounded-lg bg-[rgba(255,255,255,0.04)] p-0.5 border border-[rgba(255,255,255,0.04)]">
      {tabs.map((tab, i) => (
        <button
          key={tab}
          role="tab"
          aria-selected={active === tab}
          tabIndex={active === tab ? 0 : -1}
          onClick={() => onChange(tab)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          className={`px-3.5 py-1.5 text-[11px] font-medium rounded-md transition-all duration-200 ${
            active === tab
              ? 'bg-[rgba(255,255,255,0.1)] text-[#e8edf4] shadow-sm'
              : 'text-[#7b8fa3] hover:text-[#c0cad8]'
          }`}
        >
          {tab === 'chart' ? 'Chart' : 'Departments'}
        </button>
      ))}
    </div>
  )
}

/* ---------- Person card ---------- */
// Type-based visual styling for the colored elements on each card.
// Salaried folks use their department's gradient (passed in); contractors and
// interns use a fixed per-type gradient so they're visually distinct from the
// salaried tree.
const TYPE_STYLE: Record<WorkerType, { gradient: string; badge: string; label: string }> = {
  executive: {
    gradient: 'from-amber-400 to-amber-600',
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    label: 'Salaried',
  },
  salaried: {
    gradient: '', // resolved from dept
    badge: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    label: 'Salaried',
  },
  contractor: {
    gradient: 'from-rose-400 to-rose-600',
    badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    label: 'Contractor',
  },
  intern: {
    gradient: 'from-emerald-400 to-emerald-600',
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    label: 'Intern',
  },
}

function PersonCard({
  person,
  deptGradient,
  delayMs = 0,
}: {
  person: OrgPerson
  deptGradient?: string
  delayMs?: number
}) {
  const style = TYPE_STYLE[person.type]
  const gradient =
    person.type === 'salaried' && deptGradient
      ? deptGradient
      : style.gradient || 'from-slate-400 to-slate-600'

  return (
    <div
      className="org-card-enter org-card-hover flex flex-col items-center w-[180px] rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#111d2e] px-3 pt-4 pb-3 transition-all duration-200 hover:border-[rgba(255,255,255,0.18)]"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div
        className={`flex items-center justify-center size-11 rounded-full bg-gradient-to-br ${gradient} text-xs font-bold text-white/95 shadow-lg mb-2`}
      >
        {person.initials}
      </div>
      <p className="text-[13px] font-semibold text-[#e8edf4] text-center leading-tight">
        {person.name}
      </p>
      <p className="text-[11px] text-[#7b8fa3] text-center leading-tight mt-1 px-1">
        {person.title}
      </p>
      <p className="text-[10px] text-[#5b6e82] text-center leading-tight mt-0.5">
        {person.location}
      </p>
      <span
        className={`mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${style.badge}`}
      >
        {style.label}
      </span>
    </div>
  )
}

/* ---------- Department column (lead + reports) ---------- */
function DepartmentColumn({ dept, baseDelay }: { dept: OrgDepartment; baseDelay: number }) {
  const lead = dept.lead
  // Engineering is the only department with enough reports (8) to warrant a
  // 2-col grid; others stack vertically. Matches the PDF's layout.
  const useGrid = lead.reports.length >= 5

  return (
    <div className="flex flex-col items-center gap-3 min-w-[200px]">
      <p
        className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: dept.accent }}
      >
        {dept.name}
      </p>
      <PersonCard person={lead} deptGradient={dept.gradient} delayMs={baseDelay} />
      {lead.reports.length > 0 && (
        <>
          <div className="h-4 w-px bg-[rgba(255,255,255,0.1)]" />
          <div
            className={
              useGrid
                ? 'grid grid-cols-2 md:grid-cols-4 gap-3 justify-items-center'
                : 'flex flex-col items-center gap-3'
            }
          >
            {lead.reports.map((r, i) => (
              <PersonCard
                key={r.id}
                person={r}
                deptGradient={dept.gradient}
                delayMs={baseDelay + 80 * (i + 1)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ---------- Section divider for contractor/intern groups ---------- */
function SectionDivider({ label, accent }: { label: string; accent: string }) {
  return (
    <div className="flex items-center gap-3 my-6">
      <div className="flex-1 h-px bg-[rgba(255,255,255,0.06)]" />
      <p
        className="text-[10px] font-semibold uppercase tracking-[0.2em] px-2"
        style={{ color: accent }}
      >
        {label}
      </p>
      <div className="flex-1 h-px bg-[rgba(255,255,255,0.06)]" />
    </div>
  )
}

/* ---------- Chart view ---------- */
function ChartView() {
  const org = AMPLIWORK_ORG
  return (
    <div
      className="rounded-lg border border-[rgba(255,255,255,0.04)] bg-[rgba(0,0,0,0.15)] p-6 overflow-x-auto"
    >
      {/* CEO */}
      <div className="flex flex-col items-center">
        <PersonCard person={org.ceo} delayMs={0} />
        <div className="h-6 w-px bg-[rgba(255,255,255,0.1)]" />
      </div>

      {/* Department columns */}
      <div className="flex flex-wrap justify-center gap-6 md:gap-10 pb-2">
        {org.departments.map((dept, i) => (
          <DepartmentColumn key={dept.key} dept={dept} baseDelay={120 + i * 80} />
        ))}
      </div>

      {/* Contractors section */}
      {org.contractors.length > 0 && (
        <>
          <SectionDivider label="Contractors" accent="#f87171" />
          <div className="flex flex-wrap justify-center gap-3">
            {org.contractors.map((p, i) => (
              <PersonCard key={p.id} person={p} delayMs={400 + i * 60} />
            ))}
          </div>
        </>
      )}

      {/* Interns section */}
      {org.interns.length > 0 && (
        <>
          <SectionDivider label="Interns" accent="#34d399" />
          <div className="flex flex-wrap justify-center gap-3">
            {org.interns.map((p, i) => (
              <PersonCard key={p.id} person={p} delayMs={500 + i * 60} />
            ))}
          </div>
        </>
      )}

      {/* Footer */}
      <p className="mt-8 text-center text-[10px] text-[#5b6e82]">
        Ampliwork Inc. — Confidential — {org.asOf}
      </p>
    </div>
  )
}

/* ---------- Departments view ---------- */
function DepartmentsView() {
  const org = AMPLIWORK_ORG
  const totals = getOrgTotals(org)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 100)
    return () => clearTimeout(t)
  }, [])

  // Per-department headcount = lead + direct reports (matches chart)
  const deptRows = org.departments.map((d) => ({
    key: d.key,
    name: d.name,
    accent: d.accent,
    headcount: 1 + d.lead.reports.length,
  }))
  // Append pseudo-rows for the ungrouped contractor / intern sections so
  // totals reconcile visually against the hero stats.
  if (org.contractors.length) {
    deptRows.push({
      key: 'unassigned-contractors',
      name: 'Contractors (unassigned)',
      accent: '#f87171',
      headcount: org.contractors.length,
    })
  }
  if (org.interns.length) {
    deptRows.push({
      key: 'unassigned-interns',
      name: 'Interns (unassigned)',
      accent: '#34d399',
      headcount: org.interns.length,
    })
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {deptRows.map((dept, i) => {
        const pct = Math.round((dept.headcount / totals.total) * 100)
        return (
          <div
            key={dept.key}
            className="org-card-enter org-card-hover group relative rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] overflow-hidden transition-all duration-300 hover:border-[rgba(255,255,255,0.1)]"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="h-[3px]" style={{ background: dept.accent }} />
            <div className="p-3.5">
              <p className="text-[12px] font-semibold text-[#e8edf4] mb-2">
                {dept.name}
              </p>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[11px] text-[#7b8fa3] tabular-nums">
                  {dept.headcount} {dept.headcount === 1 ? 'person' : 'people'}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-[rgba(255,255,255,0.04)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: loaded ? `${pct}%` : '0%',
                    backgroundColor: dept.accent,
                    opacity: 0.65,
                  }}
                />
              </div>
              <p className="text-[9px] text-[#5b6e82] mt-1 tabular-nums text-right">
                {pct}% of team
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ---------- Main component ---------- */
export function OrgChart() {
  const [view, setView] = useState<'chart' | 'departments'>('chart')

  return (
    <div
      className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm"
      style={{ animation: 'slide-up 0.4s ease-out 0.6s both' }}
    >
      <AnimationStyles />
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-xs font-medium text-[#7b8fa3] uppercase tracking-wider">
              Ampliwork Inc. · Org Chart
            </h3>
            <p className="text-[10px] text-[#5b6e82] mt-0.5">
              {AMPLIWORK_ORG.asOf}
            </p>
          </div>
          <ViewTabs active={view} onChange={setView} />
        </div>

        <HeroStats />

        {view === 'chart' ? <ChartView /> : <DepartmentsView />}
      </div>
    </div>
  )
}

