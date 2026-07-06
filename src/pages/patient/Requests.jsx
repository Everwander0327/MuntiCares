import { useState } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import CancelRescheduleModal from '../../components/CancelRescheduleModal';
import PaymentModal from '../../components/PaymentModal';
import ReviewModal from '../../components/ReviewModal';

const requests = [
  { id: 1, provider: 'Maria Santos', service: 'Senior Care', date: 'Jan 15, 2026', status: 'Accepted' },
  { id: 2, provider: 'Juan Reyes', service: 'Physical Therapy', date: 'Jan 12, 2026', status: 'Completed' },
  { id: 3, provider: 'Ana Cruz', service: 'Home Nursing', date: 'Jan 10, 2026', status: 'Pending' },
  { id: 4, provider: 'Pedro Gonzales', service: 'Child Care', date: 'Jan 8, 2026', status: 'Cancelled' },
];

const PatientRequests = () => {
  const [modal, setModal] = useState({ type: null, request: null });

  const openModal = (type, request) => setModal({ type, request });
  const closeModal = () => setModal({ type: null, request: null });

  return (
    <DashboardLayout role="patient">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">My Requests</h1>
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Provider</th>
                <th className="px-6 py-4 font-semibold">Service</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="px-6 py-4 font-semibold text-slate-700">{r.provider}</td>
                  <td className="px-6 py-4 text-slate-600">{r.service}</td>
                  <td className="px-6 py-4 text-slate-600">{r.date}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      r.status === 'Accepted' ? 'bg-green-100 text-green-700' :
                      r.status === 'Completed' ? 'bg-blue-100 text-blue-700' :
                      r.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>{r.status}</span>
                  </td>
                  <td className="px-6 py-4">
                    {r.status === 'Accepted' && (
                      <div className="flex gap-2">
                        <button onClick={() => openModal('payment', r)} className="text-xs bg-primary text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-blue-600">Pay</button>
                        <button onClick={() => openModal('cancel', r)} className="text-xs border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg font-semibold hover:bg-slate-50">Cancel</button>
                      </div>
                    )}
                    {r.status === 'Completed' && (
                      <button onClick={() => openModal('review', r)} className="text-xs bg-yellow-500 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-yellow-600">Review</button>
                    )}
                    {r.status === 'Pending' && (
                      <button onClick={() => openModal('cancel', r)} className="text-xs border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg font-semibold hover:bg-slate-50">Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <CancelRescheduleModal isOpen={modal.type === 'cancel'} onClose={closeModal} request={modal.request} />
      <PaymentModal isOpen={modal.type === 'payment'} onClose={closeModal} request={modal.request} />
      <ReviewModal isOpen={modal.type === 'review'} onClose={closeModal} request={modal.request} />
    </DashboardLayout>
  );
};

export default PatientRequests;
