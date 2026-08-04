import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Pencil } from 'lucide-react'
import { EditableTable } from '../../components/EditableTable'
import { monthKeys, monthLabels, PROJECT_REP_LABEL } from './fcrTemplates'
import { PipelineProjectsPanel } from '../Accounts/PipelineProjectsPanel'
import { AccountHistoryPanel } from './AccountHistoryPanel'
import { TRADE_TERMS_LABELS } from '../../utils/accounts'
import { buildFcrMinutesText } from '../../lib/fcrMinutes'

// Customer Information now lives entirely on the Account profile -- this
// just maps an account row onto the shape the FCR's read-only fields
// display, so editing it here is impossible by construction (there's
// nowhere in this component that writes to these values).
const accountToCustomerInfo = (account) => ({
  company_name: account.company_name || '',
  business_address: [account.address, account.city, account.country].filter(Boolean).join(', '),
  owners: account.owners || '',
  region: account.region || '',
  contact_no: account.contact_phone || '',
  email: account.contact_email || '',
  dealer_classification: account.dealer_classification || '',
  channel: account.channel || '',
  ase_tse: account.ase_tse || '',
  visit_freq_days: account.visit_freq_days || '',
})

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
export const FCRFormBody = ({ record, onChange, teamType, readOnly, accounts = [], submitterName = '' }) => {
  const customerInfo = record.customer_info || {}
  const formData = record.form_data || {}

  const set = (patch) => onChange({ ...record, ...patch })
  const setFormData = (patch) => set({ form_data: { ...formData, ...patch } })

  const selectedAccount = accounts.find(a => a.id === record.account_id)

  const handleAccountSelect = (accountId) => {
    const account = accounts.find(a => a.id === accountId)
    set({
      account_id: accountId,
      customer_info: account ? accountToCustomerInfo(account) : {},
    })
  }

  // Keeps Customer Information in sync with the account record -- covers
  // both switching accounts above and arriving here already linked (e.g.
  // the "Log FCR" quick-create from an itinerary visit), without ever
  // letting these fields be typed independently of the account profile.
  useEffect(() => {
    if (selectedAccount) {
      set({ customer_info: accountToCustomerInfo(selectedAccount) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount])

  // Pipeline's "Spec-in" flag (whether Midea is in the project's approved
  // brand list) counts as spec'd-in whether it's a plain "Yes" or one of the
  // two Midea-included variants used in the field.
  const SPECIN_VALUES = ['yes', 'exclusive midea', 'midea included in approved brands']
  const isSpecIn = (specin) => SPECIN_VALUES.includes((specin || '').trim().toLowerCase())
  const isBidding = (status) => (status || '').toLowerCase().includes('bidding')
  const isFinalNegotiation = (status) => (status || '').toLowerCase().includes('final negotiation')

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

    let targetKey
    if (teamType === 'business_development') {
      // BD's Project Opportunities are Spec-in-driven: a project only
      // belongs in Qualified / Identified while it's still at Bidding
      // status, and only belongs in SPEC-IN once Pipeline's Spec-in field
      // actually says Midea is in the approved brand list. A project that's
      // neither (e.g. Lost, Design Stage, or Bidding-but-not-yet-specced)
      // doesn't cleanly fit either section, so it's left for the rep to add
      // manually rather than guessed at.
      if (isBidding(p.status)) {
        targetKey = 'qualified'
      } else if (isSpecIn(p.specin)) {
        targetKey = 'primary'
      } else {
        toast.error(`"${p.name}" isn't at Bidding status and isn't flagged Spec-in in Pipeline, so it doesn't clearly belong in either Qualified / Identified or SPEC-IN. Add it to the table manually below if you still want it on this FCR.`)
        return
      }
    } else {
      // MBT Sales' Project Opportunities are stage-based: still-Bidding
      // projects are early-stage (Qualified / Identified), and projects that
      // have moved to Final Negotiation belong in Under Negotiation. Other
      // Pipeline statuses (Design Stage, Budgetary, Lost, PO Acquired,
      // Verbally Awarded, Delivered) don't map cleanly to either section, so
      // -- same as BD's Spec-in check above -- they're left for the rep to
      // add manually rather than guessed at.
      if (isBidding(p.status)) {
        targetKey = 'qualified'
      } else if (isFinalNegotiation(p.status)) {
        targetKey = 'primary'
      } else {
        toast.error(`"${p.name}" is at "${p.status || 'an unspecified'}" status in Pipeline, which isn't Bidding or Final Negotiation, so it doesn't clearly belong in either Qualified / Identified or Under Negotiation. Add it to the table manually below if you still want it on this FCR.`)
        return
      }
    }

    setFormData({
      project_opportunities: {
        ...formData.project_opportunities,
        [targetKey]: [...(formData.project_opportunities?.[targetKey] || []), newRow],
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
      {/* Account -- required. Customer Information below is entirely
          derived from the selected account's profile and can't be typed
          here; it can only be changed by editing the account itself. */}
      {!readOnly && (
        <div className="card">
          <label className="label">Account *</label>
          <select
            value={record.account_id || ''}
            onChange={(e) => handleAccountSelect(e.target.value)}
            className="input"
          >
            <option value="">Select a profiled account</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.company_name} ({acc.city})</option>
            ))}
          </select>
          {accounts.length === 0 ? (
            <p className="text-xs text-amber-600 mt-1">
              No profiled accounts yet -- <Link to="/accounts/new" className="underline">create one</Link> (with Trade Terms filled in) first.
            </p>
          ) : (
            <p className="text-xs text-gray-400 mt-1">Not seeing the account you need? It needs a completed profile (Trade Terms filled in) first -- <Link to="/accounts/new" className="underline">create it here</Link>.</p>
          )}
        </div>
      )}

      {/* Previous visits to this account + suggested discussion points --
          shown as soon as an account is selected, before the rest of the
          form, so the rep has context before writing this visit up. */}
      {record.account_id && (
        <AccountHistoryPanel
          accountId={record.account_id}
          excludeFcrId={record.id}
          teamType={teamType}
          companyName={customerInfo.company_name}
        />
      )}

      {/* Customer Information -- read-only, sourced from the account profile */}
      <div>
        <SectionHeader>Customer Information</SectionHeader>
        <div className="border border-t-0 border-gray-200 rounded-b-lg p-4">
          {!readOnly && record.account_id && (
            <div className="flex items-center justify-end mb-3">
              <Link
                to={`/accounts/${record.account_id}/edit`}
                className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                <Pencil size={12} /> Edit in Account profile
              </Link>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Company Name" value={customerInfo.company_name} readOnly onChange={() => {}} />
            <Field label="Business Address" value={customerInfo.business_address} readOnly onChange={() => {}} />
            <Field label="Owner/s" value={customerInfo.owners} readOnly onChange={() => {}} />
            <Field label="Region" value={customerInfo.region} readOnly onChange={() => {}} />
            <Field label="Contact No." value={customerInfo.contact_no} readOnly onChange={() => {}} />
            <Field label="E-Mail Address" value={customerInfo.email} readOnly onChange={() => {}} />
            <Field label="Dealer Classification" value={customerInfo.dealer_classification} readOnly onChange={() => {}} />
            <Field label="Channel" value={customerInfo.channel} readOnly onChange={() => {}} />
            <Field label="ASE / TSE" value={customerInfo.ase_tse} readOnly onChange={() => {}} />
            <Field label="Visit Freq / Days" value={customerInfo.visit_freq_days} readOnly onChange={() => {}} />
            <Field label="Trade Terms" value={selectedAccount ? TRADE_TERMS_LABELS[selectedAccount.trade_terms] : ''} readOnly onChange={() => {}} />
            {/* Locked the moment the acknowledgment request is first sent --
                the visit/filing date is now the date that send happened
                (see handleSendAcknowledgment in FCRForm.jsx), not something
                the rep can freely type in or backdate afterward. */}
            <div>
              <Field label="Visit Date" type="date" value={record.visit_date}
                readOnly={readOnly || Boolean(record.ack_requested_at)} onChange={(v) => set({ visit_date: v })} />
              {!readOnly && record.ack_requested_at && (
                <p className="text-xs text-gray-400 mt-1">Locked to the date the acknowledgment request was sent.</p>
              )}
            </div>
            <div>
              <label className="label">AM / PM</label>
              {readOnly ? (
                <div className="input bg-gray-50 text-gray-700 min-h-[38px]">{record.period === 'PM' ? 'PM' : 'AM'}</div>
              ) : (
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                  {['AM', 'PM'].map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => set({ period: p })}
                      className={`flex-1 py-2 font-medium transition-colors ${
                        (record.period || 'AM') === p ? 'bg-primary-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
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

      {/* Meeting Attendee -- the account-side person who attended this visit.
          Their email is what the acknowledgment link gets sent to (see
          "Account Acknowledgment" section on the FCRForm page below). */}
      <div>
        <SectionHeader>Meeting Attendee (Account Side)</SectionHeader>
        <div className="border border-t-0 border-gray-200 rounded-b-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field
              label="Attendee Name"
              value={record.attendee_name}
              readOnly={readOnly}
              onChange={(v) => set({ attendee_name: v })}
            />
            <Field
              label="Attendee Designation"
              value={record.attendee_designation}
              readOnly={readOnly}
              onChange={(v) => set({ attendee_designation: v })}
            />
            <Field
              label="Attendee Email"
              type="email"
              value={record.attendee_email}
              readOnly={readOnly}
              onChange={(v) => set({ attendee_email: v })}
            />
          </div>
          {!readOnly && (
            <p className="text-xs text-gray-400 mt-2">
              Required to send the meeting minutes for acknowledgment -- the FCR can't be exported as a PDF until the account acknowledges.
            </p>
          )}
        </div>
      </div>

      {/* Minutes of the Meeting -- auto-generated from this FCR's own
          content. This exact text is what the account acknowledges via the
          emailed link, and what appears in the exported PDF. */}
      <div>
        <SectionHeader>Minutes of the Meeting (Preview)</SectionHeader>
        <div className="border border-t-0 border-gray-200 rounded-b-lg p-4 bg-gray-50">
          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
            {buildFcrMinutesText({ record, submitterName })}
          </pre>
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
