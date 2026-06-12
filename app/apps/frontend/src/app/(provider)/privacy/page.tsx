export const dynamic = 'force-dynamic';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — Hootnshoot',
  description: 'Privacy Policy for Hootnshoot, the social media scheduling platform.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white">
      <div className="max-w-[760px] mx-auto px-[24px] py-[64px]">
        {/* Header */}
        <div className="mb-[48px]">
          <p className="text-[12px] font-[700] tracking-[1.5px] uppercase text-[rgba(97,43,211,0.8)] mb-[12px]">
            Hootnshoot
          </p>
          <h1 className="text-[36px] font-[800] text-white mb-[8px]">Privacy Policy</h1>
          <p className="text-[14px] text-[rgba(255,255,255,0.4)]">Last updated: May 2026</p>
        </div>

        <div className="flex flex-col gap-[32px] text-[15px] text-[rgba(255,255,255,0.75)] leading-[1.7]">

          <section>
            <h2 className="text-[18px] font-[700] text-white mb-[12px]">1. Introduction</h2>
            <p>
              Hootnshoot (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is a social media scheduling and content creation
              platform. This Privacy Policy explains how we collect, use, and protect information when
              you use Hootnshoot at{' '}
              <a href="https://hootnshoot.app" className="text-[#612bd3] underline">hootnshoot.app</a>.
            </p>
          </section>

          <section>
            <h2 className="text-[18px] font-[700] text-white mb-[12px]">2. Information We Collect</h2>
            <p className="mb-[12px]">We collect the following types of information:</p>
            <ul className="list-disc pl-[24px] flex flex-col gap-[8px]">
              <li><strong className="text-white">Account information:</strong> Email address and password when you register.</li>
              <li><strong className="text-white">Social media tokens:</strong> OAuth access tokens for platforms you connect (Facebook, Instagram, LinkedIn, etc.). These are stored securely and used only to publish content on your behalf.</li>
              <li><strong className="text-white">Content data:</strong> Posts, captions, images, and scheduling information you create within the platform.</li>
              <li><strong className="text-white">Usage data:</strong> Basic analytics about how you use the platform (pages visited, features used) to improve the service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[18px] font-[700] text-white mb-[12px]">3. How We Use Your Information</h2>
            <ul className="list-disc pl-[24px] flex flex-col gap-[8px]">
              <li>To provide and operate the Hootnshoot service.</li>
              <li>To publish content to connected social media accounts on your behalf.</li>
              <li>To generate AI-assisted captions using the Gemini API (your topic and content type are sent to Google&apos;s Gemini service; no personal data is included in these requests).</li>
              <li>To send service-related notifications (if email is configured).</li>
              <li>To improve and maintain the platform.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[18px] font-[700] text-white mb-[12px]">4. Third-Party Services</h2>
            <p className="mb-[12px]">Hootnshoot integrates with the following third-party services:</p>
            <ul className="list-disc pl-[24px] flex flex-col gap-[8px]">
              <li><strong className="text-white">Meta (Facebook/Instagram):</strong> For connecting and publishing to Facebook Pages and Instagram Business accounts. Subject to <a href="https://www.facebook.com/privacy/policy/" className="text-[#612bd3] underline" target="_blank" rel="noopener noreferrer">Meta&apos;s Privacy Policy</a>.</li>
              <li><strong className="text-white">Google Gemini API:</strong> For AI caption generation. Topic and content type data is sent to Google. Subject to <a href="https://policies.google.com/privacy" className="text-[#612bd3] underline" target="_blank" rel="noopener noreferrer">Google&apos;s Privacy Policy</a>.</li>
              <li><strong className="text-white">LinkedIn, Twitter/X, and other platforms:</strong> When connected, subject to their respective privacy policies.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[18px] font-[700] text-white mb-[12px]">5. Data Storage and Security</h2>
            <p>
              Your data is stored on secure servers. Social media access tokens are encrypted at rest.
              We do not sell or share your personal data with third parties except as required to operate
              the service (as described above) or as required by law.
            </p>
          </section>

          <section>
            <h2 className="text-[18px] font-[700] text-white mb-[12px]">6. Data Retention</h2>
            <p>
              We retain your account data for as long as your account is active. You may request deletion
              of your account and associated data at any time by contacting us. Social media tokens are
              deleted when you disconnect a platform or delete your account.
            </p>
          </section>

          <section>
            <h2 className="text-[18px] font-[700] text-white mb-[12px]">7. Your Rights</h2>
            <p className="mb-[12px]">You have the right to:</p>
            <ul className="list-disc pl-[24px] flex flex-col gap-[8px]">
              <li>Access the personal data we hold about you.</li>
              <li>Request correction of inaccurate data.</li>
              <li>Request deletion of your data.</li>
              <li>Disconnect any connected social media account at any time.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[18px] font-[700] text-white mb-[12px]">8. Cookies</h2>
            <p>
              Hootnshoot uses session cookies for authentication. No third-party advertising or tracking
              cookies are used.
            </p>
          </section>

          <section>
            <h2 className="text-[18px] font-[700] text-white mb-[12px]">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Changes will be posted on this page
              with an updated date. Continued use of the service after changes constitutes acceptance
              of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-[18px] font-[700] text-white mb-[12px]">10. Contact</h2>
            <p>
              For privacy-related questions or data requests, contact us at{' '}
              <a href="mailto:support@hootnshoot.app" className="text-[#612bd3] underline">support@hootnshoot.app</a>.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
