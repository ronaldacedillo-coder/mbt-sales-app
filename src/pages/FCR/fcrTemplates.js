// Field definitions and defaults that mirror the official Concepcion Midea Inc.
// "Field Contact Report" paper forms (MBT Sales / BD versions) exactly.

export const emptyCustomerInfo = () => ({
  company_name: '',
  business_address: '',
  owners: '',
  region: '',
  contact_no: '',
  email: '',
  dealer_classification: '',
  channel: '',
  ase_tse: '',
  visit_freq_days: '',
})

const emptyProgramRow = (program = '') => ({ program, status: '', date: '', next_steps: '', notes: '' })
const emptyCompetitiveRow = (brand = '') => ({ brand, initiative: '', duration: '', mechanics: '', notes: '' })
const emptyProjectRow = () => ({ project_name_owner: '', address: '', amount: '', rollout: '', rep: '', status: '', next_steps: '' })

const monthKeys = ['month1', 'month2', 'month3', 'q1', 'month4', 'month5', 'month6', 'q2']
const monthLabels = { month1: 'Month 1', month2: 'Month 2', month3: 'Month 3', q1: 'Q1', month4: 'Month 4', month5: 'Month 5', month6: 'Month 6', q2: 'Q2' }
const emptyMonthRow = () => Object.fromEntries(monthKeys.map(k => [k, '']))

export { monthKeys, monthLabels }

// Rep column is labeled "Consultant" on the SE form and "D. Engr" on the BD form,
// but structurally identical.
export const PROJECT_REP_LABEL = { mbt_sales: 'Consultant', business_development: 'D. Engr' }

export const emptyFormData = (teamType) => {
  if (teamType === 'business_development') {
    return {
      program_execution: [
        emptyProgramRow('Product Training'),
        emptyProgramRow('Product Brochures'),
        emptyProgramRow('Selection Software Training'),
      ],
      specializations: [1, 2, 3].map(() => ({ establishment_type: '', ac_system: '', notes: '' })),
      competitive_check: [1, 2, 3].map(() => emptyCompetitiveRow()),
      competitive_advantage: [1, 2, 3].map(() => ({ description: '', notes: '' })),
      get_back_items: '',
      project_opportunities: {
        primary_label: 'SPEC-IN',
        primary: [1, 2, 3, 4, 5].map(emptyProjectRow),
        qualified: [1, 2, 3, 4, 5].map(emptyProjectRow),
      },
      cycle_initiatives: [
        { label: 'C1', title: '', notes: '' },
        { label: 'C2', title: '', notes: '' },
        { label: 'C3', title: 'Presentation of Key Product Advantages', notes: '' },
      ],
    }
  }

  // mbt_sales (Sales Engineer / NSM)
  return {
    program_execution: [
      emptyProgramRow('Dealer Accreditation'),
      emptyProgramRow('Service Center Accreditation'),
      emptyProgramRow('Product Training'),
      emptyProgramRow('Marketing Support'),
      emptyProgramRow('Product Brochures'),
    ],
    competitive_check: [
      emptyCompetitiveRow('Daikin'),
      emptyCompetitiveRow('LG'),
      emptyCompetitiveRow('Panasonic'),
      emptyCompetitiveRow('Hi-Sense / TCL'),
      emptyCompetitiveRow(),
    ],
    get_back_items: '',
    ar_collection: {
      payment_terms: '',
      credit_limit: '',
      monitors: [
        { type: 'DP / Balance', reason: '', commitment_date: '', next_steps: '', contact: '' },
        { type: 'NYD', reason: '', commitment_date: '', next_steps: '', contact: '' },
        { type: 'DUE', reason: '', commitment_date: '', next_steps: '', contact: '' },
      ],
    },
    sales_update: {
      year_end_trip_goal: '',
      pax: '',
      per_pax: '',
      target: '',
      total_mbt: {
        target: emptyMonthRow(),
        sales: emptyMonthRow(),
        balance: emptyMonthRow(),
      },
    },
    project_opportunities: {
      primary_label: 'Under Negotiation',
      primary: [1, 2, 3, 4, 5, 6].map(emptyProjectRow),
      qualified: [1, 2, 3].map(emptyProjectRow),
    },
    cycle_initiatives: [
      { label: 'C1', title: '', notes: '' },
      { label: 'C2', title: '', notes: '' },
      { label: 'C3', title: '', notes: '' },
    ],
  }
}
