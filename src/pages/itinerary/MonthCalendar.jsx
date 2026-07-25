import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  format,
  parseISO,
} from 'date-fns'
import { Plus } from 'lucide-react'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Renders a traditional month calendar grid for one itinerary's visits.
// `month` is any date within the month to display (itineraries.month is
// always the 1st). Each day cell lists the accounts being visited that day;
// clicking a chip opens that visit in the editable list below (if
// onSelectVisit is given), and clicking empty space on a day adds a new
// visit pre-filled with that date (if onDayClick is given and editable).
export const MonthCalendar = ({ month, visits = [], accounts = [], onDayClick, onSelectVisit, editable = false }) => {
  const monthDate = typeof month === 'string' ? parseISO(month) : month
  const gridStart = startOfWeek(startOfMonth(monthDate))
  const gridEnd = endOfWeek(endOfMonth(monthDate))
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const accountsById = Object.fromEntries(accounts.map(a => [a.id, a]))

  const visitsByDay = {}
  visits.forEach(v => {
    if (!v.visit_date) return
    visitsByDay[v.visit_date] = visitsByDay[v.visit_date] || []
    visitsByDay[v.visit_date].push(v)
  })

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden print:border-black">
      <div className="grid grid-cols-7 bg-gray-50 print:bg-white">
        {WEEKDAYS.map(wd => (
          <div key={wd} className="px-2 py-2 text-xs font-semibold text-gray-500 text-center border-b border-gray-200 print:border-black print:text-black">
            {wd}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const inMonth = isSameMonth(day, monthDate)
          const dayVisits = visitsByDay[dateStr] || []
          return (
            <div
              key={dateStr}
              onClick={() => editable && onDayClick && onDayClick(dateStr)}
              className={`min-h-[92px] border-b border-r border-gray-100 print:border-black p-1.5 align-top ${
                inMonth ? 'bg-white' : 'bg-gray-50 print:bg-white'
              } ${editable ? 'cursor-pointer hover:bg-primary-50/40' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${
                  inMonth ? (isToday(day) ? 'text-white bg-primary-600 rounded-full w-5 h-5 flex items-center justify-center print:bg-white print:text-black print:border print:border-black' : 'text-gray-700')
                    : 'text-gray-300 print:text-gray-400'
                }`}>
                  {format(day, 'd')}
                </span>
                {editable && inMonth && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDayClick && onDayClick(dateStr) }}
                    className="print:hidden opacity-0 hover:opacity-100 text-gray-400 hover:text-primary-600"
                    title="Add visit on this day"
                  >
                    <Plus size={13} />
                  </button>
                )}
              </div>
              <div className="mt-1 space-y-1">
                {dayVisits.map((v, i) => {
                  const acc = accountsById[v.account_id]
                  return (
                    <button
                      key={v.id || i}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onSelectVisit && onSelectVisit(v.id) }}
                      className="w-full text-left px-1.5 py-1 rounded bg-primary-50 hover:bg-primary-100 border border-primary-100 text-[11px] leading-tight print:bg-white print:border-black print:rounded-none"
                    >
                      <div className="font-medium text-primary-800 truncate print:text-black">
                        {acc?.company_name || 'Unassigned account'}
                      </div>
                      {v.purpose && <div className="text-primary-600 truncate print:text-black">{v.purpose}</div>}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
