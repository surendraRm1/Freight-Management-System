import React, { useCallback, useEffect, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import TaraChatPanel from './TaraChatPanel';

const TaraAssistantWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const closeWidget = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    closeWidget();
  }, [location.pathname, closeWidget]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {isOpen && (
        <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-2xl">
          <div className="flex items-center justify-between bg-white px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Tara is live</p>
              <p className="text-xs text-slate-500">Ask anything about your freight operations.</p>
            </div>
            <button
              type="button"
              onClick={closeWidget}
              className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close Tara assistant"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="h-[520px] bg-slate-50 px-4 pb-4 pt-3">
            <div className="h-full overflow-hidden rounded-3xl bg-white">
              <TaraChatPanel layout="widget" onClose={closeWidget} />
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-xl transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
        aria-expanded={isOpen}
        aria-controls="tara-assistant-widget"
      >
        <MessageCircle className="h-5 w-5" />
        {isOpen ? 'Hide Tara' : 'Chat with Tara'}
      </button>
    </div>
  );
};

export default TaraAssistantWidget;
