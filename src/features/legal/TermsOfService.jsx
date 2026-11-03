import { Link } from 'react-router-dom';

const Section = ({ title, children }) => (
  <section>
    <h2 className="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-white mt-8 mb-2">{title}</h2>
    <div className="space-y-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{children}</div>
  </section>
);

const TermsOfService = () => (
  <div className="bg-secondary dark:bg-slate-950 min-h-[calc(100dvh-4rem)] py-10 px-4 sm:px-6">
    <div className="max-w-3xl mx-auto">
      <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white tracking-tight">
        Terms of Service
      </h1>
      <p className="text-xs text-tertiary mt-1">Last updated: November 3, 2026</p>

      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 mt-4">
        These terms govern your use of MuntiCares, a home-care coordination platform for Muntinlupa City
        connecting residents with verified home-care providers. By creating an account, you agree to these
        terms and to our <Link className="text-link hover:underline" to="/privacy">Privacy Policy</Link>.
      </p>

      <Section title="The service">
        <p>MuntiCares coordinates home-care arrangements: patients book providers, providers accept and fulfill requests, and administrators oversee the platform. MuntiCares itself does not provide medical care.</p>
        <p>Accounts are role-based: patient, provider, or administrator. Your role determines the features available to you.</p>
      </Section>

      <Section title="Accounts">
        <p>You must provide accurate information at registration. You are responsible for keeping your credentials secure and for activity that occurs under your account. Providers must register and be approved before accepting requests.</p>
      </Section>

      <Section title="Booking and visits">
        <p>A visit follows a defined lifecycle: a patient creates a request, the provider accepts or declines it, the provider travels to the patient (visible to the patient through live tracking), marks arrival, and completes the visit. Patients can cancel or reschedule requests, and providers manage their schedules through the platform.</p>
        <p>Live tracking shares the provider&apos;s location with the patient for the duration of a tracked visit only.</p>
      </Section>

      <Section title="Privacy and consent">
        <p>Provider access to a patient&apos;s health information is consent-based: providers can view only the categories the patient has granted, and only while the grant is active. Patients can revoke access at any time. Misuse of accessed information may lead to account suspension.</p>
      </Section>

      <Section title="Emergencies">
        <p>MuntiCares is not an emergency service. For life-threatening emergencies, call 911 or your local emergency hotline immediately.</p>
      </Section>

      <Section title="Changes and termination">
        <p>We may update these terms as the platform evolves; the latest version is always available on this page. Accounts that violate these terms may be suspended or removed by administrators.</p>
      </Section>

      <Section title="Contact">
        <p>Questions about these terms: <a className="text-link hover:underline" href="mailto:support@munticares.ph">support@munticares.ph</a>.</p>
      </Section>

      <p className="mt-8 text-xs text-tertiary">
        See also our <Link className="text-link hover:underline" to="/privacy">Privacy Policy</Link>.
      </p>
    </div>
  </div>
);

export default TermsOfService;
