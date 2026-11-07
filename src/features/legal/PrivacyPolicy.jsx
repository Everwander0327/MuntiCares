import { Link } from 'react-router-dom';
import { PageMeta } from '@/shared/components';

const Section = ({ title, children }) => (
  <section>
    <h2 className="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-white mt-8 mb-2">{title}</h2>
    <div className="space-y-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{children}</div>
  </section>
);

const PrivacyPolicy = () => (
  <div className="bg-secondary dark:bg-slate-950 min-h-[calc(100dvh-4rem)] py-10 px-4 sm:px-6">
    <PageMeta
      title="Privacy Policy — MuntiCares"
      description="How MuntiCares collects, stores, and shares home care health data in Muntinlupa City, and the controls you have under the Data Privacy Act of 2012."
      path="/privacy"
    />
    <div className="max-w-3xl mx-auto">
      <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white tracking-tight">
        Privacy Policy
      </h1>
      <p className="text-xs text-tertiary mt-1">Last updated: November 3, 2026</p>

      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 mt-4">
        MuntiCares is a home-care coordination platform for Muntinlupa City. This policy explains what
        information we collect, why we collect it, and how it is protected. We handle personal and health
        information in line with the Data Privacy Act of 2012 (Republic Act No. 10173).
      </p>

      <Section title="Information we collect">
        <p><strong className="text-slate-800 dark:text-slate-100">Account information</strong> — your full name and email address, collected at registration.</p>
        <p><strong className="text-slate-800 dark:text-slate-100">Profile and care details</strong> — the information you provide during onboarding and profile editing: phone number, home address and map pin, date of birth, care needs, medical history and conditions, emergency contact, and any documents you upload (for example, medical records).</p>
        <p><strong className="text-slate-800 dark:text-slate-100">Service requests and visit records</strong> — requests you create, their status, schedules, and visit notes written by providers.</p>
        <p><strong className="text-slate-800 dark:text-slate-100">Live location</strong> — a provider&apos;s GPS location is collected <em>only while a tracked visit is active</em>, to show the patient live progress and estimated arrival. It is deleted as soon as the visit ends or arrives.</p>
        <p><strong className="text-slate-800 dark:text-slate-100">Chat and teleconsultations</strong> — chat messages and photo/video attachments between patients and providers, and call records (who called whom, when, and for how long).</p>
        <p><strong className="text-slate-800 dark:text-slate-100">Consent preferences</strong> — which categories of your health information you have allowed each provider to access, and until when.</p>
      </Section>

      <Section title="How information is used">
        <p>Your information is used to match you with providers, coordinate and track home-care visits, enable chat and teleconsultations, and keep a consultation record. It is not sold, shared with advertisers, or used for marketing.</p>
      </Section>

      <Section title="Who can see your information">
        <p>Access is limited by role and enforced at the database level (row-level security):</p>
        <p>You can see your own records. A provider can see your records only for requests you have made with them, and only the health categories you have granted consent for. Administrators oversee the platform and can view platform records for moderation and oversight.</p>
      </Section>

      <Section title="Consent">
        <p>You agree to this policy at registration. You can grant or revoke access to specific health categories for each provider at any time from the Privacy &amp; Consent page. Grants carry an expiry date and no access is granted by default: if you have not granted a category, the provider cannot see it.</p>
      </Section>

      <Section title="Retention">
        <p>Chat messages are automatically deleted 24 hours after they are sent. Live location data is deleted when a tracked visit ends. Device push tokens are pruned after 60 days of inactivity. Call records are kept as a consultation record.</p>
      </Section>

      <Section title="Security">
        <p>Data is stored in Supabase&apos;s managed Postgres database and private storage buckets. All traffic between your device and the service is encrypted in transit (HTTPS/TLS), and database access is governed by row-level security policies. Chat attachments are served through short-lived signed URLs rather than public links.</p>
      </Section>

      <Section title="Payments">
        <p>MuntiCares does not collect or store payment information. No payment data is part of the platform.</p>
      </Section>

      <Section title="Your rights and contact">
        <p>You may review and correct your profile at any time, revoke consents, and request deletion of your account by contacting us at <a className="text-link hover:underline" href="mailto:support@munticares.ph">support@munticares.ph</a>.</p>
      </Section>

      <p className="mt-8 text-xs text-tertiary">
        See also our <Link className="text-link hover:underline" to="/terms">Terms of Service</Link>.
      </p>
    </div>
  </div>
);

export default PrivacyPolicy;
