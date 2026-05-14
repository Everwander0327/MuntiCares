import React from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Search, Filter, Clock, MapPin, ChevronDown } from 'lucide-react';
import CustomSelect from '../../components/CustomSelect';

const RequestCard = ({ provider, service, date, status, price }) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-primary font-bold text-lg">
          {provider.split(' ').map(n => n[0]).join('')}
        </div>
        <div>
          <h3 className="font-bold text-slate-900">{provider}</h3>
          <p className="text-slate-500 text-sm">{service}</p>
        </div>
      </div>
      
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Clock className="w-4 h-4" />
          <span>{date}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <MapPin className="w-4 h-4" />
          <span>Muntinlupa</span>
        </div>
        <div className="font-bold text-slate-900">
          ₱{price}
        </div>
        <span className={`px-4 py-1.5 rounded-full text-xs font-bold ${
          status === 'Accepted' ? 'bg-green-100 text-green-700' :
          status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
          'bg-red-100 text-red-700'
        }`}>
          {status}
        </span>
      </div>
    </div>
  </div>
);

const PatientRequests = () => {
  const [filter, setFilter] = React.useState('All');
  const requests = [
    { provider: 'Maria Santos', service: 'Wound Care', date: 'Oct 24, 2025', status: 'Accepted', price: '1,500' },
    { provider: 'Jose Reyes', service: 'Elder Care', date: 'Oct 25, 2025', status: 'Pending', price: '2,000' },
    { provider: 'Ana Cruz', service: 'Physical Therapy', date: 'Oct 26, 2025', status: 'Rejected', price: '1,800' },
    { provider: 'Pedro Lim', service: 'Medication Management', date: 'Oct 22, 2025', status: 'Accepted', price: '1,200' },
  ];

  const filteredRequests = requests.filter(r => filter === 'All' || r.status === filter);

  return (
    <DashboardLayout role="patient">
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Requests</h1>
            <p className="text-slate-500">Track and manage your service requests</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <CustomSelect 
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'All', label: 'All Status' },
                { value: 'Accepted', label: 'Accepted' },
                { value: 'Pending', label: 'Pending' },
                { value: 'Rejected', label: 'Rejected' },
              ]}
            />
            <button 
              onClick={() => alert('New request form coming soon!')}
              className="flex-1 md:flex-none btn-primary px-6 py-2.5 rounded-xl"
            >
              New Request
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {filteredRequests.length > 0 ? (
            filteredRequests.map((req, i) => (
              <RequestCard key={i} {...req} />
            ))
          ) : (
            <div className="p-10 text-center text-slate-500 bg-white rounded-3xl border border-slate-100">No requests found for this filter.</div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PatientRequests;
