import React from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Search, Filter, Star, MapPin, ChevronDown } from 'lucide-react';
import CustomSelect from '../../components/CustomSelect';

const ProviderCard = ({ name, services, rating }) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
    <div className="flex items-center gap-4 mb-6">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-xl font-bold text-primary shadow-inner">
        {name.split(' ').map(n => n[0]).join('')}
      </div>
      <div>
        <h3 className="font-bold text-slate-900 text-lg">{name}</h3>
        <div className="flex items-center gap-1 text-yellow-500">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className={`w-4 h-4 ${i < Math.floor(rating) ? 'fill-current' : 'text-slate-300'}`} />
          ))}
          <span className="text-slate-400 text-sm ml-1 font-medium">{rating.toFixed(1)}</span>
        </div>
      </div>
    </div>
    
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {services.map((s, i) => (
          <span key={i} className="px-3 py-1 bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold border border-slate-100">
            {s}
          </span>
        ))}
      </div>
      
      <div className="flex items-center gap-2 text-slate-400 text-sm">
        <MapPin className="w-4 h-4" />
        <span>Muntinlupa City</span>
      </div>

      <button className="w-full btn-primary py-3 rounded-2xl text-sm font-bold shadow-lg shadow-primary/20">
        Request Service
      </button>
    </div>
  </div>
);

const PatientProviders = () => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filter, setFilter] = React.useState('All');
  const [requested, setRequested] = React.useState([]);

  const providers = [
    { name: 'Dr. Maria Santos', services: ['Wound Care', 'Post-Surgery'], rating: 5.0 },
    { name: 'Nurse Jose Reyes', services: ['Elder Care', 'Medication'], rating: 4.5 },
    { name: 'Dr. Ana Cruz', services: ['Physical Therapy', 'Rehabilitation'], rating: 4.8 },
    { name: 'Pedro Lim, RN', services: ['Medication Management'], rating: 4.2 },
    { name: 'Rosa Garcia, PT', services: ['Post-Surgery Care', 'Home Nursing'], rating: 5.0 },
    { name: 'Dr. Antonio Luna', services: ['General Checkup', 'Emergency'], rating: 4.9 },
    { name: 'Melchora Aquino', services: ['Elder Care', 'Home Care'], rating: 5.0 },
    { name: 'Juan Luna, RN', services: ['Wound Care', 'Home Nursing'], rating: 4.6 },
    { name: 'Marcelo Del Pilar', services: ['Medication Management'], rating: 4.4 },
    { name: 'Gregorio Del Pilar', services: ['Physical Therapy'], rating: 4.7 },
    { name: 'Dr. Jose Rizal', services: ['Ophthalmology', 'Checkup'], rating: 5.0 },
    { name: 'Andres Bonifacio', services: ['Emergency Care'], rating: 4.8 },
    { name: 'Apolinario Mabini', services: ['Rehabilitation', 'Elder Care'], rating: 4.9 },
    { name: 'Gabriela Silang', services: ['Post-Surgery Care'], rating: 4.5 },
    { name: 'Emilio Aguinaldo', services: ['Elder Care'], rating: 4.0 },
  ];

  const filteredProviders = providers.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.services.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = filter === 'All' || p.services.includes(filter);
    return matchesSearch && matchesFilter;
  });

  const handleRequest = (name) => {
    setRequested([...requested, name]);
    alert(`Request sent to ${name}!`);
  };

  return (
    <DashboardLayout role="patient">
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search for providers or services..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-100 rounded-2xl py-4 pl-12 pr-4 shadow-sm focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all outline-none"
            />
          </div>
          <CustomSelect 
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'All', label: 'All Services' },
              { value: 'Wound Care', label: 'Wound Care' },
              { value: 'Elder Care', label: 'Elder Care' },
              { value: 'Physical Therapy', label: 'Physical Therapy' },
              { value: 'Medication Management', label: 'Medication Management' },
            ]}
          />
        </div>

        {filteredProviders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProviders.map((p, i) => (
              <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-xl font-bold text-primary shadow-inner">
                    {p.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">{p.name}</h3>
                    <div className="flex items-center gap-1 text-yellow-500">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-4 h-4 ${i < Math.floor(p.rating) ? 'fill-current' : 'text-slate-300'}`} />
                      ))}
                      <span className="text-slate-400 text-sm ml-1 font-medium">{p.rating.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {p.services.map((s, i) => (
                      <span key={i} className="px-3 py-1 bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold border border-slate-100">
                        {s}
                      </span>
                    ))}
                  </div>
                  
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <MapPin className="w-4 h-4" />
                    <span>Muntinlupa City</span>
                  </div>

                  <button 
                    onClick={() => handleRequest(p.name)}
                    disabled={requested.includes(p.name)}
                    className={`w-full py-3 rounded-2xl text-sm font-bold shadow-lg transition-all ${requested.includes(p.name) ? 'bg-green-100 text-green-600 cursor-not-allowed shadow-none' : 'btn-primary shadow-primary/20'}`}
                  >
                    {requested.includes(p.name) ? 'Request Sent ✓' : 'Request Service'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-[2rem] border border-slate-100">
            <p className="text-slate-500 text-lg">No providers found matching your search.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PatientProviders;
