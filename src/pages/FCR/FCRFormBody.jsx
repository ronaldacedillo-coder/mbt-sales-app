import { EditableTable } from '../../components/EditableTable'
import { monthKeys, monthLabels, PROJECT_REP_LABEL } from './fcrTemplates'
import { PipelineProjectsPanel } from '../Accounts/PipelineProjectsPanel'

const SectionHeader = ({ children }) => (
  <div className="bg-gray-900 text-white text-sm font-semibold px-3 py-2 rounded-t-lg tracking-wide">
    {children}
  </div>
)

const Field = ({ label, value, onChange, readOnly, type = 'text' }) => (
  <div>
    <label className="label">{label}</label>
    {readOnly ? (
      <div className="input bg-gray-50 text-gray-700 min-h-[38px]">{value || <span className="text-gray-300">-</span>}</div>
    ) : (
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="input"
      />
    )}
  </div>
)

const STATUS_OPTIONS = ['Not Started', 'Ongoing', 'Completed', 'N/A']

// Renders the full FCR form -- Customer Information plus every section from
// the official paper template, laid out differently for the MBT Sales (SE)
// team vs. the Business Development (BD) team. Used both as the live editor
// (FCRForm) and, with readOnly, as the reviewer's read-only view (FCRApproval).
export const FCRFormBody = ({ record, onChange, teamType, readOnly, accounts = [] }) => {
  const customerInfo = record.customer_info || {}
  const formData = record.form_data || {}

  const set = (patch) => onChange({ ...record, ...patch })
  const setCustomerInfo = (patch) => set({ customer_info: { ...customerInfo, ...patch } })
  const setFormData = (patch) => set({ form_data: { ...formData, ...patch } })

  const handleAccountSelect = (accountId) => {
    const account = accounts.find(a => a.id === accountId)
    const patch = { account_id: accountId }
    // Only prefill blank fields so we never clobber something already typed.
    if (account && !customerInfo.company_name) {
      patch.customer_info = {
        ...customerInfo,
        company_name: account.company_name || '',
        business_address: [account.address, account.city, account.country].filter(Boolean).join(', '),
        contact_no: account.contact_phone || '',
        email: account.contact_email || '',
      }
    }
    set(patch)
  }

  const importPipelineProject = (p) => {
    const money = (n) => (n || n === 0) ? `PHP ${Number(n).toLocaleString()}` : ''
    const amountParts = [
      money(p.discounted_value) && `Discounted ${money(p.discounted_value)}`,
      money(p.srp_value) && `SRP ${money(p.srp_value)}`,
    ].filter(Boolean)
    const newRow = {
      project_name_owner: [p.name, p.equipment?.length ? `(${p.equipment.join(', ')})` : ''].filter(Boolean).join(' '),
      address: p.location || '',
      amount: amountParts.join(' / '),
      rollout: p.delivery || '',
      rep: p.se || p.bd_person || '',
      status: p.status || '',
      next_steps: '',
    }
    setFormData({
      project_opportunities: {
        ...formData.project_opportunities,
        primary: [...(formData.project_opportunities?.primary || []), newRow],
      },
    })
  }

  const repLabel = PROJECT_REP_LABEL[teamType] || 'Rep'
  const projectColumns = [
    { key: 'project_name_owner', label: 'Project Name / Owner' },
    { key: 'address', label: 'Address' },
    { key: 'amount', label: 'Amount' },
    { key: 'rollout', label: 'Roll-out' },
    { key: 'rep', label: repLabel },
    { key: 'status', label: 'Status' },
    { key: 'next_steps', label: 'Next Steps', type: 'textarea' },
  ]

  const programColumns = [
    { key: 'program', label: 'Program' },
    { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'next_steps', label: 'Next Steps', type: 'textarea' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ]

  const competitiveColumns = [
    { key: 'brand', label: 'Brand' },
    { key: 'initiative', label: 'Initiative' },
    { key: 'duration', label: 'Duration' },
    { key: 'mechanics', label: 'Mechanics', type: 'textarea' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ]

  return (
    <div className="space-y-6">
      {/* Link to an existing account (optional convenience, not required) */}
      {!readOnly && (
        <div className="card">
          <label className="label">Link to existing account (optional)</label>
          <select
            value={record.account_id || ''}
            onChange={(e) => handleAccountSelect(e.target.value)}
            className="input"
          >
            <option value="">Not linked -- fill in customer info manually below</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.company_name} ({acc.city})</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">Selecting an account fills in blank fields below from your saved account info -- everything stays editable.</p>
        </div>
      )}

      {/* Customer Information */}
      <div>
        <SectionHeader>Customer Information</SectionHeader>
        <div className="border border-t-0 border-gray-200 rounded-b-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Company Name" value={customerInfo.company_name} readOnly={readOnly} onChange={(v) => setCustomerInfo({ company_name: v })} />
          <Field label="Business Address" value={customerInfo.business_address} readOnly={readOnly} onChange={(v) => setCustomerInfo({ business_address: v })} />
          <Field label="Owner/s" value={customerInfo.owners} readOnly={readOnly} onChange={(v) => setCustomerInfo({ owners: v })} />
          <Field label="Region" value={customerInfo.region} readOnly={readOnly} onChange={(v) => setCustomerInfo({ region: v })} />
          <Field label="Contact No." value={customerInfo.contact_no} readOnly={readOnly} onChange={(v) => setCustomerInfo({ contact_no: v })} />
          <Field label="E-Mail Address" value={customerInfo.email} readOnly={readOnly} onChange={(v) => setCustomerInfo({ email: v })} />
          <Field label="Dealer Classification" value={customerInfo.dealer_classification} readOnly={readOnly} onChange={(v) => setCustomerInfo({ dealer_classification: v })} />
          <Field label="Channel" value={customerInfo.channel} readOnly={readOnly} onChange={(v) => setCustomerInfo({ channel: v })} />
          <Field label="ASE / TSE" value={customerInfo.ase_tse} readOnly={readOnly} onChange={(v) => setCustomerInfo({ ase_tse: v })} />
          <Field label="Visit Freq / Days" value={customerInfo.visit_freq_days} readOnly={readOnly} onChange={(v) => setCustomerInfo({ visit_freq_days: v })} />
          <Field label="Visit Date" type="date" value={record.visit_date} readOnly={readOnly} onChange={(v) => set({ visit_date: v })} />
        </div>
      </div>

      {/* Related Pipeline Projects -- only once this FCR is linked to an account */}
      {record.account_id && (
        <PipelineProjectsPanel
          accountId={record.account_id}
          companyName={customerInfo.company_name}
          canEdit={!readOnly}
          onImport={readOnly ? null : importPipelineProject}
          compact
        />
      )}

      {/* CMIP Program Execution Check */}
      <div>
        <SectionHeader>CMIP Program Execution Check</SectionHeader>
        <EditableTable
          columns={programColumns}
          rows={formData.program_execution || []}
          onChange={(rows) => setFormData({ program_execution: rows })}
          readOnly={readOnly}
          addLabel="Add Program"
        />
      </div>

      {/* BD-only: Specializations */}
      {teamType === 'business_development' && (
        <div>
          <SectionHeader>Specializations</SectionHeader>
          <EditableTable
            columns={[
              { key: 'establishment_type', label: 'Establishment Type' },
              { key: 'ac_system', label: 'AC System' },
              { key: 'notes', label: 'Notes', type: 'textarea' },
            ]}
            rows={formData.specializations || []}
            onChange={(rows) => setFormData({ specializations: rows })}
            readOnly={readOnly}
            addLabel="Add Row"
          />
        </div>
      )}

      {/* Competitive Check */}
      <div>
        <SectionHeader>Competitive Check</SectionHeader>
        <EditableTable
          columns={competitiveColumns}
          rows={formData.competitive_check || []}
          onChange={(rows) => setFormData({ competitive_check: rows })}
          readOnly={readOnly}
          addLabel="Add Brand"
        />
      </div>

      {/* BD-only: Competitive Advantage of Consultant */}
      {teamType === 'business_development' && (
        <div>
          <SectionHeader>Competitive Advantage of Consultant</SectionHeader>
          <EditableTable
            columns={[
              { key: 'description', label: 'Description' },
              { key: 'notes', label: 'Notes', type: 'textarea' },
            ]}
            rows={formData.competitive_advantage || []}
            onChange={(rows) => setFormData({ competitive_advantage: rows })}
            readOnly={readOnly}
            addLabel="Add Row"
          />
        </div>
      )}

      {/* Get Back Items */}
      <div>
        <SectionHeader>{teamType === 'business_development' ? 'Consultant Get Back Items' : 'Customer Get Back Items'}</SectionHeader>
        <div className="border border-t-0 border-gray-200 rounded-b-lg p-3">
          {readOnly ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap min-h-[60px]">{formData.get_back_items || <span className="text-gray-300">-</span>}</p>
          ) : (
            <textarea
              value={formData.get_back_items || ''}
              onChange={(e) => setFormData({ get_back_items: e.target.value })}
              className="input min-h-[80px]"
            />
          )}
        </div>
      </div>

      {/* SE-only: AR and Collection Update */}
      {teamType === 'mbt_sales' && (
        <div>
          <SectionHeader>AR and Collection Update</SectionHeader>
          <div className="border border-t-0 border-gray-200 rounded-b-lg p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field
                label="Payment Terms"
                value={formData.ar_collection?.payment_terms}
                readOnly={readOnly}
                onChange={(v) => setFormData({ ar_collection: { ...formData.ar_collection, payment_terms: v } })}
              />
              <Field
                label="Credit Limit"
                value={formData.ar_collection?.credit_limit}
                readOnly={readOnly}
                onChange={(v) => setFormData({ ar_collection: { ...formData.ar_collection, credit_limit: v } })}
              />
            </div>
            <EditableTable
              columns={[
                { key: 'type', label: 'AR Monitor' },
                { key: 'reason', label: 'Reason' },
                { key: 'commitment_date', label: 'Commitment Date', type: 'date' },
                { key: 'next_steps', label: 'Next Steps', type: 'textarea' },
                { key: 'contact', label: 'Contact' },
              ]}
              rows={formData.ar_collection?.monitors || []}
              onChange={(rows) => setFormData({ ar_collection: { ...formData.ar_collection, monitors: rows } })}
              readOnly={readOnly}
              addLabel="Add Monitor Row"
            />
          </div>
        </div>
      )}

      {/* SE-only: Sales Update */}
      {teamType === 'mbt_sales' && (
        <div>
          <SectionHeader>Sales Update</SectionHeader>
          <div className="border border-t-0 border-gray-200 rounded-b-lg p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Field label="Year End Trip Goal" value={formData.sales_update?.year_end_trip_goal} readOnly={readOnly}
                onChange={(v) => setFormData({ sales_update: { ...formData.sales_update, year_end_trip_goal: v } })} />
              <Field label="Pax" value={formData.sales_update?.pax} readOnly={readOnly}
                onChange={(v) => setFormData({ sales_update: { ...formData.sales_update, pax: v } })} />
              <Field label="Per Pax" value={formData.sales_update?.per_pax} readOnly={readOnly}
                onChange={(v) => setFormData({ sales_update: { ...formData.sales_update, per_pax: v } })} />
              <Field label="Target" value={formData.sales_update?.target} readOnly={readOnly}
                onChange={(v) => setFormData({ sales_update: { ...formData.sales_update, target: v } })} />
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-3 py-2 text-left font-medium text-gray-700 border-b border-gray-200">TOTAL MBT</th>
                    {monthKeys.map(k => (
                      <th key={k} className="px-3 py-2 text-left font-medium text-gray-700 border-b border-gray-200 whitespace-nowrap">{monthLabels[k]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {['target', 'sales', 'balance'].map((rowKey) => (
                    <tr key={rowKey} className="border-t border-gray-200">
                      <td className="px-3 py-1.5 italic text-gray-600 whitespace-nowrap">
                        {rowKey === 'target' ? 'Target' : rowKey === 'sales' ? 'Sales' : 'Balance to Hit'}
                      </td>
                      {monthKeys.map(k => (
                        <td key={k} className="px-1 py-0.5">
                          {readOnly ? (
                            <span className="block px-2 py-1.5 text-gray-700">{formData.sales_update?.total_mbt?.[rowKey]?.[k] || ''}</span>
                          ) : (
                            <input
                              type="text"
                              value={formData.sales_update?.total_mbt?.[rowKey]?.[k] || ''}
                              onChange={(e) => setFormData({
                                sales_update: {
                                  ...formData.sales_update,
                                  total_mbt: {
                                    ...formData.sales_update?.total_mbt,
                                    [rowKey]: { ...formData.sales_update?.total_mbt?.[rowKey], [k]: e.target.value },
                                  },
                                },
                              })}
                              className="w-full px-2 py-1.5 border border-transparent hover:border-gray-200 focus:border-primary-400 rounded focus:outline-none text-sm"
                            />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Project Opportunities */}
      <div>
        <SectionHeader>Project Opportunities -- {formData.project_opportunities?.primary_label || 'Under Negotiation'}</SectionHeader>
        <EditableTable
          columns={projectColumns}
          rows={formData.project_opportunities?.primary || []}
          onChange={(rows) => setFormData({ project_opportunities: { ...formData.project_opportunities, primary: rows } })}
          readOnly={readOnly}
          addLabel="Add Project"
        />
      </div>
      <div>
        <SectionHeader>Project Opportunities -- Qualified / Identified</SectionHeader>
        <EditableTable
          columns={projectColumns}
          rows={formData.project_opportunities?.qualified || []}
          onChange={(rows) => setFormData({ project_opportunities: { ...formData.project_opportunities, qualified: rows } })}
          readOnly={readOnly}
          addLabel="Add Project"
        />
      </div>

      {/* Cycle Initiatives */}
      <div>
        <SectionHeader>Cycle Initiatives</SectionHeader>
        <div className="border border-t-0 border-gray-200 rounded-b-lg divide-y divide-gray-200">
          {(formData.cycle_initiatives || []).map((ci, idx) => (
            <div key={ci.label} className="p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="label">{ci.label}</label>
                {readOnly ? (
                  <div className="input bg-gray-50 text-gray-700">{ci.title || <span className="text-gray-300">-</span>}</div>
                ) : (
                  <input
                    type="text"
                    value={ci.title || ''}
                    onChange={(e) => {
                      const next = [...formData.cycle_initiatives]
                      next[idx] = { ...ci, title: e.target.value }
                      setFormData({ cycle_initiatives: next })
                    }}
                    className="input"
                    placeholder="Initiative title"
                  />
                )}
              </div>
              <div className="md:col-span-2">
                <label className="label">Notes</label>
                {readOnly ? (
                  <div className="input bg-gray-50 text-gray-700 min-h-[38px] whitespace-pre-wrap">{ci.notes || <span className="text-gray-300">-</span>}</div>
                ) : (
                  <textarea
                    value={ci.notes || ''}
                    onChange={(e) => {
                      const next = [...formData.cycle_initiatives]
                      next[idx] = { ...ci, notes: e.target.value }
                      setFormData({ cycle_initiatives: next })
                    }}
                    className="input min-h-[38px]"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Coverage Notes */}
      <div>
        <SectionHeader>Coverage Notes</SectionHeader>
        <div className="border border-t-0 border-gray-200 rounded-b-lg p-3">
          {readOnly ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap min-h-[100px]">{record.coverage_notes || <span className="text-gray-300">-</span>}</p>
          ) : (
            <textarea
              value={record.coverage_notes || ''}
              onChange={(e) => set({ coverage_notes: e.target.value })}
              className="input min-h-[100px]"
            />
          )}
        </div>
      </div>

      {/* Customer sign-off */}
      <div className="card grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Customer -- Signature over Printed Name"
          value={record.customer_signature_name}
          readOnly={readOnly}
          onChange={(v) => set({ customer_signature_name: v })}
        />
        <Field label="Date of Visit" type="date" value={record.visit_date} readOnly={true} onChange={() => {}} />
      </div>
    </div>
  )
}
