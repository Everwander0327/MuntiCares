import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const CTASection = () => {
  return (
    <section id="cta" className="py-12" aria-labelledby="cta-heading">
      <div className="container mx-auto px-6">
        <motion.div
          className="bg-primary rounded-2xl p-8 md:p-14 text-center text-white relative overflow-hidden shadow-2xl shadow-blue-200"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2"></div>
          <div className="relative z-10 space-y-6">
            <h2 id="cta-heading" className="text-2xl md:text-4xl font-bold">Ready to experience better care?</h2>
            <p className="text-blue-100 text-base max-w-2xl mx-auto">
              Join hundreds of families in Muntinlupa City who trust MuntiCares for their home healthcare needs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register" className="bg-white text-primary px-6 py-3 rounded-xl font-bold text-base hover:bg-blue-50 hover:scale-[1.02] active:scale-[0.97] transition-all shadow-xl">
                Get Started Now
              </Link>
              <button className="bg-transparent border-2 border-white/30 hover:border-white hover:scale-[1.02] active:scale-[0.97] text-white px-6 py-3 rounded-xl font-bold text-base transition-all">
                Learn More
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
