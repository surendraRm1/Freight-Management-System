
const StatCard = ({ title, value, description, icon: Icon, iconColor = 'text-blue-500' }) => {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
        {Icon && <Icon className={`h-5 w-5 ${iconColor}`} />}
      </div>
      <p className="mt-4 text-3xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{description}</p>
    </div>
  );
};

export default StatCard;
