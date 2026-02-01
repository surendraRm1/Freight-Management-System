import { useState } from 'react';
import TaraChatPanel from './TaraChatPanel';

const TaraSidebar = () => {
  const [isOpen, setIsOpen] = useState(false);

  const closeSidebar = () => setIsOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-xl transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
        aria-expanded={isOpen}
        aria-controls="tara-sidebar"
      >
        🤖 Tara
      </button>

      {isOpen && (
        <div
          id="tara-sidebar"
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 px-4 py-8"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Tara — AI operations assistant</p>
                <p className="text-xs text-slate-500">
                  Live shipment insights, compliance alerts, and celebratory wins updated every 30 seconds.
                </p>
              </div>
              <button
                type="button"
                onClick={closeSidebar}
                className="rounded-full px-3 py-1 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close Tara assistant"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
              <TaraChatPanel layout="sidebar" onClose={closeSidebar} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TaraSidebar;
