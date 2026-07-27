import { format, parseISO } from 'date-fns'

// Builds the "Minutes of the Meeting" text from an FCR record. Used in three
// places that must all agree on the exact same text: the FCR form's preview
// (FCRFormBody), the public Acknowledge page (which only has the raw fields
// returned by the get_fcr_ack_details RPC, not a full account row), and the
// exported PDF (fcrPdf.js). Keeping this in one function is what guarantees
// "what the account acknowledged" and "what's in the PDF" never drift apart.
export const buildFcrMinutesText = ({ record, submitterName }) => {
  const customerInfo = record.customer_info || {}
  const formData = record.form_data || {}

  const visitDateLabel = record.visit_date
    ? format(parseISO(record.visit_date), 'MMMM d, yyyy')
    : 'Not specified'

  const projectCount =
    (formData.project_opportunities?.primary?.filter(p => p.project_name_owner)?.length || 0) +
    (formData.project_opportunities?.qualified?.filter(p => p.project_name_owner)?.length || 0)
  const competitiveCount = (formData.competitive_check || []).filter(c => c.brand).length

  const discussionLines = []
  if (projectCount > 0) discussionLines.push(`- ${projectCount} project opportunit${projectCount === 1 ? 'y' : 'ies'} discussed (see Project Opportunities section of the FCR).`)
  if (competitiveCount > 0) discussionLines.push(`- Competitive landscape reviewed for ${competitiveCount} brand${competitiveCount === 1 ? '' : 's'}.`)
  if (!discussionLines.length) discussionLines.push('- See Coverage Notes below.')

  return `
MINUTES OF THE MEETING
=======================

Company: ${customerInfo.company_name || 'Not specified'}
Visit Date: ${visitDateLabel} (${record.period === 'PM' ? 'Afternoon' : 'Morning'})
Location: ${customerInfo.business_address || 'Not specified'}
Prepared by: ${submitterName || 'Not specified'} (MBT ${record.team_type === 'business_development' ? 'Business Development' : 'Sales'})
Attendee (Account side): ${record.attendee_name || 'Not specified'}${record.attendee_designation ? `, ${record.attendee_designation}` : ''}

DISCUSSION SUMMARY
-------------------
${discussionLines.join('\n')}

COVERAGE NOTES
--------------
${record.coverage_notes || 'None recorded.'}

GET BACK ITEMS / ACTION ITEMS
------------------------------
${formData.get_back_items || 'None recorded.'}

---
These minutes are generated from the Field Contact Report filed for this visit.
By acknowledging, you confirm this summary accurately reflects the meeting.
  `.trim()
}
