import { useEffect, useState } from 'react'
import { RonAppsLogo } from './RonAppsLogo'

// "About RonApps" panel -- matches the standard About template used across
// RonApps applications (same header treatment, Mission/Vision copy, and
// founder note), with only the "including this ___" line adapted to name
// this specific app.
export const AboutModal = ({ onClose }) => {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  return (
    <div
      className={`fixed inset-0 bg-gray-900/40 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ease-out-strong ${mounted ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
      aria-hidden="true"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="About RonApps"
        className={`bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden transition-all duration-200 ease-out-strong ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#1E2761] px-6 py-5">
          <div className="flex items-center gap-2 mb-1">
            <RonAppsLogo size={22} variant="mark" />
            <h2 className="text-xl font-bold text-white">About RonApps</h2>
          </div>
          <p className="text-sm font-semibold text-teal-300">Building Apps That Matter</p>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm text-gray-700 leading-relaxed">
            RonApps is a software innovation organization founded by Ronald Acedillo. We transform ideas into
            practical digital solutions that help businesses, educators, and individuals become more productive
            through thoughtfully designed applications — including MBT Sales Operations, the field coverage and
            reporting platform you're using now.
          </p>

          <p className="text-xs font-bold text-teal-600 uppercase tracking-wider mt-5 mb-1.5">Mission</p>
          <p className="text-sm text-gray-700 leading-relaxed">
            To design and develop practical, innovative, and user-friendly applications that solve real-world
            problems for businesses, education, and everyday life through thoughtful technology, continuous
            innovation, and exceptional user experience.
          </p>

          <p className="text-xs font-bold text-teal-600 uppercase tracking-wider mt-5 mb-1.5">Vision</p>
          <p className="text-sm text-gray-700 leading-relaxed">
            To become a trusted creator of impactful digital solutions that empower organizations and individuals
            worldwide by building applications that make work easier, learning more engaging, and everyday life
            more productive.
          </p>

          <hr className="my-5 border-gray-200" />

          <p className="text-xs text-gray-400 leading-relaxed">
            Founded by Ronald Acedillo — every RonApps application begins by identifying a real challenge, then
            crafting a solution that is intuitive, dependable, and designed to create lasting value.
          </p>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="bg-[#1E2761] hover:bg-[#141a47] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
