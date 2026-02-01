import { clsx } from 'clsx';

const BottomSheet = ({ title, children, open, onClose, className }) => {
  return (
    <div
      className={clsx(
        'fixed inset-0 z-40 transition-all',
        open ? 'pointer-events-auto' : 'pointer-events-none'
      )}
      aria-hidden={!open}
    >
      <div
        className={clsx(
          'absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity',
          open ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
      />

      <div className="absolute bottom-0 left-0 right-0 flex justify-center px-4 sm:px-6">
        <div
          className={clsx(
            'w-full max-w-3xl rounded-t-3xl bg-white shadow-xl',
            'max-h-[85vh] overflow-y-auto transition-transform duration-300',
            open ? 'translate-y-0' : 'translate-y-full',
            className
          )}
        >
          <div className="px-5 pt-4 pb-2">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-300" />
            {title && <h2 className="text-lg font-semibold text-gray-900">{title}</h2>}
          </div>
          <div className="px-5 pb-8">{children}</div>
        </div>
      </div>
    </div>
  );
};

export default BottomSheet;

