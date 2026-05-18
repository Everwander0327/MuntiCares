import React from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Search, Star, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import CustomSelect from '../../components/CustomSelect';

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.08 } },
};
const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

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
        <motion.div 
          className="flex flex-col md:flex-row gap-4 items-center justify-between"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
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
        </motion.div>

        {filteredProviders.length > 0 ? (
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {filteredProviders.map((p, i) => (
              <motion.div 
                key={i} 
                className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300"
                variants={staggerItem}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
              >
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

                  <motion.button 
                    onClick={() => handleRequest(p.name)}
                    disabled={requested.includes(p.name)}
                    className={`w-full py-3 rounded-2xl text-sm font-bold shadow-lg transition-all ${requested.includes(p.name) ? 'bg-green-100 text-green-600 cursor-not-allowed shadow-none' : 'btn-primary shadow-primary/20'}`}
                    whileHover={!requested.includes(p.name) ? { scale: 1.02 } : {}}
                    whileTap={!requested.includes(p.name) ? { scale: 0.97 } : {}}
                  >
                    {requested.includes(p.name) ? 'Request Sent ✓' : 'Request Service'}
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div 
            className="text-center py-20 bg-white rounded-[2rem] border border-slate-100"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-slate-500 text-lg">No providers found matching your search.</p>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PatientProviders;
