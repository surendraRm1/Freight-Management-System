import AccruedCostsReport from './reports/AccruedCostsReport';
import RejectedInvoiceAnalysis from './reports/RejectedInvoiceAnalysis';
import PodPerformanceKpi from './reports/PodPerformanceKpi';
import TransporterScorecard from './reports/TransporterScorecard';

export const AnalyticsDashboard = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <PodPerformanceKpi />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <RejectedInvoiceAnalysis />
      <AccruedCostsReport />
    </div>
    <TransporterScorecard />
  </div>
);
