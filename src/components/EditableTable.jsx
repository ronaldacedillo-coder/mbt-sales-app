import { Plus, Trash2 } from 'lucide-react'

// Generic spreadsheet-like editable table used to reproduce the repeatable
// row/column sections of the official FCR paper forms (Program Execution
// Check, Competitive Check, Project Opportunities, etc.)
export const EditableTable = ({ columns, rows, onChange, readOnly, addLabel = 'Add Row' }) => {
  const updateCell = (rowIndex, key, value) => {
    onChange(rows.map((r, i) => (i === rowIndex ? { ...r, [key]: value } : r)))
  }

  const addRow = () => {
    const blank = Object.fromEntries(columns.map(c => [c.key, '']))
    onChange([...rows, blank])
  }

  const removeRow = (rowIndex) => {
    onChange(rows.filter((_, i) => i !== rowIndex))
  }

  const cellClass = 'w-full px-2 py-1.5 border border-transparent hover:border-gray-200 focus:border-primary-400 rounded focus:outline-none text-sm bg-transparent'

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-b-lg">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100">
            {columns.map(col => (
              <th key={col.key} className="px-3 py-2 text-left font-medium text-gray-700 whitespace-nowrap border-b border-gray-200">
                {col.label}
              </th>
            ))}
            {!readOnly && <th className="w-9 border-b border-gray-200"></th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 1} className="px-3 py-4 text-center text-sm text-gray-400">
                No rows yet
              </td>
            </tr>
          ) : rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-gray-200">
              {columns.map(col => (
                <td key={col.key} className="px-1 py-0.5 align-top min-w-[120px]">
                  {readOnly ? (
                    <span className="block px-2 py-1.5 text-gray-700">{row[col.key] || ''}</span>
                  ) : col.type === 'textarea' ? (
                    <textarea
                      value={row[col.key] || ''}
                      onChange={(e) => updateCell(rowIndex, col.key, e.target.value)}
                      className={`${cellClass} min-h-[36px]`}
                      rows={1}
                    />
                  ) : col.type === 'date' ? (
                    <input
                      type="date"
                      value={row[col.key] || ''}
                      onChange={(e) => updateCell(rowIndex, col.key, e.target.value)}
                      className={cellClass}
                    />
                  ) : col.type === 'select' ? (
                    <select
                      value={row[col.key] || ''}
                      onChange={(e) => updateCell(rowIndex, col.key, e.target.value)}
                      className={`${cellClass} bg-white`}
                    >
                      <option value="">-</option>
                      {col.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={row[col.key] || ''}
                      onChange={(e) => updateCell(rowIndex, col.key, e.target.value)}
                      className={cellClass}
                    />
                  )}
                </td>
              ))}
              {!readOnly && (
                <td className="px-1 text-center">
                  <button
                    type="button"
                    onClick={() => removeRow(rowIndex)}
                    className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                    aria-label="Remove row"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {!readOnly && (
        <button
          type="button"
          onClick={addRow}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-sm text-primary-600 hover:bg-primary-50 border-t border-gray-200 transition-colors"
        >
          <Plus size={14} /> {addLabel}
        </button>
      )}
    </div>
  )
}
