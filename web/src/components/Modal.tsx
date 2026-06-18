import type { ReactNode } from 'react'

export default function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-medium text-gray-900">{title}</h2>
          <button onClick={onClose} aria-label="关闭" className="text-xl leading-none text-gray-400 hover:text-gray-600">
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
