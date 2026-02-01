import { clsx } from 'clsx';

const FloatingActionButton = ({ icon: Icon, label, className, ...props }) => (
  <button
    className={clsx(
      'inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 shadow-lg',
      'text-white font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
      className
    )}
    {...props}
  >
    {Icon && <Icon className="h-5 w-5" />}
    {label && <span>{label}</span>}
  </button>
);

export default FloatingActionButton;

