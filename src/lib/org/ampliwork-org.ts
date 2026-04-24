// Ground-truth org chart data from Ampliwork_Org_Chart_April2026.pdf.
// This file — not Rippling — is the source of truth for the /team org chart.
// When the company structure changes, update this file to match the latest PDF.

export type WorkerType = 'executive' | 'salaried' | 'contractor' | 'intern'

export interface OrgPerson {
  id: string
  initials: string
  name: string
  title: string
  location: string
  type: WorkerType
}

export interface DeptLead extends OrgPerson {
  reports: OrgPerson[]
}

export interface OrgDepartment {
  key: string
  name: string
  accent: string // hex color for dept label + salaried avatar gradient
  gradient: string // tailwind gradient classes for salaried avatars in this dept
  lead: DeptLead
}

export interface AmpliworkOrg {
  asOf: string
  ceo: OrgPerson
  departments: OrgDepartment[]
  contractors: OrgPerson[] // section 1: ungrouped contractors
  interns: OrgPerson[] // section 2: ungrouped interns
}

export const AMPLIWORK_ORG: AmpliworkOrg = {
  asOf: 'April 2026',
  ceo: {
    id: 'mb',
    initials: 'MB',
    name: 'Marco Buchbinder',
    title: 'Chief Executive Officer',
    location: 'Boston, USA',
    type: 'executive',
  },
  departments: [
    {
      key: 'customer-ops',
      name: 'Customer Operations',
      accent: '#34d399',
      gradient: 'from-emerald-400 to-emerald-600',
      lead: {
        id: 'av',
        initials: 'AV',
        name: 'Adrian Varma',
        title: 'Growth & Strategy, Transportation Director',
        location: 'London, UK',
        type: 'salaried',
        reports: [
          {
            id: 'lh',
            initials: 'LH',
            name: 'Laura Heritage',
            title: 'Director of Pre-Sales',
            location: 'London, UK',
            type: 'salaried',
          },
        ],
      },
    },
    {
      key: 'product',
      name: 'Product',
      accent: '#a78bfa',
      gradient: 'from-violet-400 to-violet-600',
      lead: {
        id: 'ep',
        initials: 'EP',
        name: 'Etienne Pelletier Gagné',
        title: 'Director of Product',
        location: 'Montreal, CA',
        type: 'salaried',
        reports: [
          {
            id: 'sa',
            initials: 'SA',
            name: 'Steve Allen',
            title: 'Tax Consultant',
            location: 'Dallas, USA',
            type: 'contractor',
          },
          {
            id: 'bi',
            initials: 'BI',
            name: 'Bassil Issa',
            title: 'AI Product Manager Intern',
            location: 'Montreal, CA',
            type: 'intern',
          },
        ],
      },
    },
    {
      key: 'engineering',
      name: 'Engineering',
      accent: '#60a5fa',
      gradient: 'from-sky-400 to-sky-600',
      lead: {
        id: 'sm',
        initials: 'SM',
        name: 'Sumit Machwe',
        title: 'SDE Team Lead',
        location: 'Boston, USA',
        type: 'salaried',
        reports: [
          { id: 'cc', initials: 'CC', name: 'Cosmin Cojocaru', title: 'Sr. Applied AI Engineer', location: 'Montreal, CA', type: 'salaried' },
          { id: 'bm', initials: 'BM', name: 'Bachir Mets', title: 'Applied AI Engineer', location: 'Montreal, CA', type: 'salaried' },
          { id: 'nk', initials: 'NK', name: 'Nanda Kumar', title: 'Applied AI Engineer', location: 'Montreal, CA', type: 'salaried' },
          { id: 'ag', initials: 'AG', name: 'Aditya Gupta', title: 'Applied AI Engineer', location: 'Montreal, CA', type: 'salaried' },
          { id: 'rd', initials: 'RD', name: 'Roopasree Dundigalla', title: 'DevOps Engineer (AWS)', location: 'Montreal, CA', type: 'salaried' },
          { id: 'vk', initials: 'VK', name: 'Vishvesh Khandpur', title: 'QA Engineer', location: 'Montreal, CA', type: 'salaried' },
          { id: 'cj', initials: 'CJ', name: 'Chaima Jaziri', title: 'Applied AI Engineer', location: 'Montreal, CA', type: 'salaried' },
          { id: 'cl', initials: 'CL', name: 'Calef Lopez', title: 'Applied AI Engineer', location: 'Montreal, CA', type: 'salaried' },
        ],
      },
    },
    {
      key: 'ops',
      name: 'Ops & Finance',
      accent: '#fbbf24',
      gradient: 'from-amber-400 to-amber-600',
      lead: {
        id: 'ri',
        initials: 'RI',
        name: 'Roxane Ivaldi',
        title: 'Operations Manager',
        location: 'Montreal, CA',
        type: 'salaried',
        reports: [],
      },
    },
  ],
  contractors: [
    { id: 'ms', initials: 'MS', name: 'Mohit Savany', title: 'Sr. Associate SDE', location: 'Morrisville, USA', type: 'contractor' },
    { id: 'lm', initials: 'LM', name: 'Laksh Mishra', title: 'Sr. Front End Engineer', location: 'Noida, India', type: 'contractor' },
    { id: 'am', initials: 'AM', name: 'Anamika Mishra', title: 'QA Automation Engineer', location: 'Noida, India', type: 'contractor' },
    { id: 'np', initials: 'NP', name: 'Nitesh Pandey', title: 'Full Stack Developer', location: 'Noida, India', type: 'contractor' },
    { id: 'nl', initials: 'NL', name: 'Nikita Letov', title: 'Senior AI Engineer', location: 'Montreal, CA', type: 'contractor' },
  ],
  interns: [
    { id: 'at', initials: 'AT', name: 'Affan Thameem', title: 'Front End Eng. Intern', location: 'Montreal, CA', type: 'intern' },
    { id: 'dy', initials: 'DY', name: 'Daniel Yu', title: 'Applied AI Intern', location: 'Montreal, CA', type: 'intern' },
    { id: 'oa', initials: 'OA', name: 'Oishika Ahmed', title: 'AI Research Intern', location: 'Montreal, CA', type: 'intern' },
  ],
}

export interface OrgTotals {
  total: number
  salaried: number
  contractors: number
  interns: number
  departments: number
}

export function getOrgTotals(org: AmpliworkOrg = AMPLIWORK_ORG): OrgTotals {
  let total = 0
  let salaried = 0
  let contractors = 0
  let interns = 0

  const count = (p: OrgPerson) => {
    total += 1
    if (p.type === 'contractor') contractors += 1
    else if (p.type === 'intern') interns += 1
    else salaried += 1
  }

  count(org.ceo)
  for (const dept of org.departments) {
    count(dept.lead)
    for (const r of dept.lead.reports) count(r)
  }
  for (const c of org.contractors) count(c)
  for (const i of org.interns) count(i)

  return { total, salaried, contractors, interns, departments: org.departments.length }
}
