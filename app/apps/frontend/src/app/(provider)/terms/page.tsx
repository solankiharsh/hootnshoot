export const dynamic = 'force-dynamic';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — Hootnshoot',
  description: 'Terms of Service for Hootnshoot, the social media scheduling platform.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white">
      <div className="max-w-[760px] mx-auto px-[24px] py-[64px]">
        {/* Header */}
        <div className="mb-[48px]">
          <p className="text-[12px] font-[700] tracking-[1.5px] uppercase text-[rgba(97,43,211,0.8)] mb-[12px]">
            Hootnshoot
          </p>
          <h1 className="text-[36px] font-[800] text-white mb-[8px]">Terms of Service</h1>
          <p className="text-[14px] text-[rgba(255,255,255,0.4)]">Last updated: May 2026</p>
        </div>

        <div className="flex flex-col gap-[32px] text-[15px] text-[rgba(255,255,255,0.75)] leading-[1.7]">

          <section>
            <h2 className="text-[18px] font-[700] text-white mb-[12px]">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Hootnshoot at{' '}
              <a href="https://hootnshoot.app" className="text-[#612bd3] underline">hootnshoot.app</a>,
              you agree to be bound by these Terms of Service. If you do not agree, do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-[18px] font-[700] text-white mb-[12px]">2. Eligibility</h2>
            <p>
              You must be at least 18 years old and capable of entering into a binding agreement to use
              Hootnshoot. We reserve the right to revoke access at any time.
            </p>
          </section>

          <section>
            <h2 className="text-[18px] font-[700] text-white mb-[12px]">3. Permitted Use</h2>
            <p className="mb-[12px]">You may use Hootnshoot to:</p>
            <ul className="list-disc pl-[24px] flex flex-col gap-[8px]">
              <li>Schedule and publish social media content for your organisation.</li>
              <li>Generate AI-assisted captions for marketing purposes.</li>
              <li>Connect and manage your own social media accounts.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[18px] font-[700] text-white mb-[12px]">4. Prohibited Use</h2>
            <p className="mb-[12px]">You must not use Hootnshoot to:</p>
            <ul className="list-disc pl-[24px] flex flex-col gap-[8px]">
              <li>Publish content that violates applicable laws or regulations.</li>
              <li>Publish misleading, false, or unsubstantiated claims.</li>
              <li>Publish content that violates the terms of service of any connected social media platform.</li>
              <li>Attempt to gain unauthorised access to other users&apos; accounts or data.</li>
              <li>Reverse engineer, copy, or redistribute any part of the platform.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[18px] font-[700] text-white mb-[12px]">5. AI-Generated Content</h2>
            <p>
              Hootnshoot uses Google&apos;s Gemini API to generate caption suggestions. AI-generated content
              is provided as a starting point only. You are solely responsible for reviewing, editing,
              and ensuring that any content you publish complies with applicable laws and the terms of
              the social media platforms you publish to. We do not guarantee the accuracy, completeness,
              or compliance of AI-generated content.
            </p>
          </section>

          <section>
            <h2 className="text-[18px] font-[700] text-white mb-[12px]">6. Social Media Integrations</h2>
            <p>
              By connecting a social media account, you authorise Hootnshoot to publish content to that
              account on your behalf. You are responsible for ensuring you have the right to connect and
              publish to any account you link. You may disconnect any account at any time from the
              Integrations settings.
            </p>
          </section>

          <section>
            <h2 className="text-[18px] font-[700] text-white mb-[12px]">7. Intellectual Property</h2>
            <p>
              All content you create and publish through Hootnshoot remains your responsibility.
              The Hootnshoot platform, including its design and code, is proprietary.
              You may not copy, modify, or distribute any part of the platform without written permission.
            </p>
          </section>

          <section>
            <h2 className="text-[18px] font-[700] text-white mb-[12px]">8. Disclaimer of Warranties</h2>
            <p>
              Hootnshoot is provided &quot;as is&quot; without warranties of any kind. We do not guarantee
              uninterrupted availability, error-free operation, or that content published through the
              platform will meet any particular performance standard on social media platforms.
            </p>
          </section>

          <section>
            <h2 className="text-[18px] font-[700] text-white mb-[12px]">9. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Hootnshoot shall not be liable for any indirect,
              incidental, or consequential damages arising from your use of the service, including but
              not limited to loss of revenue, loss of data, or reputational damage resulting from
              content published through the platform.
            </p>
          </section>

          <section>
            <h2 className="text-[18px] font-[700] text-white mb-[12px]">10. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your access to Hootnshoot at any time,
              with or without notice, for any violation of these Terms or for any other reason at
              our discretion.
            </p>
          </section>

          <section>
            <h2 className="text-[18px] font-[700] text-white mb-[12px]">11. Changes to Terms</h2>
            <p>
              We may update these Terms of Service at any time. Updated terms will be posted on this
              page with a revised date. Continued use of the service after changes constitutes acceptance
              of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-[18px] font-[700] text-white mb-[12px]">12. Governing Law</h2>
            <p>
              These Terms are governed by applicable law. Any disputes shall be resolved through
              good-faith negotiation or, where necessary, through appropriate legal proceedings.
            </p>
          </section>

          <section>
            <h2 className="text-[18px] font-[700] text-white mb-[12px]">13. Contact</h2>
            <p>
              For questions about these Terms, contact us at{' '}
              <a href="mailto:support@hootnshoot.app" className="text-[#612bd3] underline">support@hootnshoot.app</a>.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
