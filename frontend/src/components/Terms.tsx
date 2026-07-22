import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface Props {
  onBack?: () => void;
}

const Terms: React.FC<Props> = ({ onBack }) => {
  return (
    <div style={{ minHeight: '100vh', paddingTop: '2rem', paddingBottom: '4rem' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 2rem' }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--brand-primary)',
              cursor: 'pointer',
              padding: 0,
              fontSize: '0.9rem',
              marginBottom: '2rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <ArrowLeft size={16} />
            Back to home
          </button>
        )}

        <h1 className="text-gradient" style={{ marginBottom: '0.5rem', fontFamily: 'EB Garamond, serif', fontSize: '2.5rem' }}>
          Terms of Service
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '1rem' }}>
          Last updated: July 22, 2026
        </p>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem', fontFamily: 'EB Garamond, serif' }}>Agreement to Terms</h2>
          <p style={{ color: 'var(--text-primary)', lineHeight: '1.6', marginBottom: '1rem' }}>
            These Terms of Service ("Terms") constitute a legal agreement between you ("User," "you," or "your") and Elara ("Company," "we," "us," or "our") governing your use of our platform, including our website and application (the "Service").
          </p>
          <p style={{ color: 'var(--text-primary)', lineHeight: '1.6' }}>
            By accessing and using Elara, you acknowledge that you have read, understood, and agree to be bound by these Terms. If you do not agree to these Terms, you may not use the Service.
          </p>
        </section>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem', fontFamily: 'EB Garamond, serif' }}>Service Description</h2>
          <p style={{ color: 'var(--text-primary)', lineHeight: '1.6' }}>
            Elara is a portfolio management platform designed to help rental property owners track properties, tenants, leases, transactions, and maintenance. The Service includes AI-powered features such as portfolio analysis, renewal letter generation, document extraction, and maintenance alerts. The Service is provided on an "as is" basis.
          </p>
        </section>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem', fontFamily: 'EB Garamond, serif' }}>User Accounts and Responsibility</h2>
          <p style={{ color: 'var(--text-primary)', lineHeight: '1.6', marginBottom: '1rem' }}>
            You are responsible for:
          </p>
          <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem', color: 'var(--text-primary)', lineHeight: '1.8' }}>
            <li>Maintaining the confidentiality of your login credentials</li>
            <li>All activity that occurs under your account</li>
            <li>Notifying us immediately of any unauthorized access</li>
            <li>Ensuring your information is accurate and up-to-date</li>
          </ul>
          <p style={{ color: 'var(--text-primary)', lineHeight: '1.6' }}>
            You agree not to share your account credentials with others or allow unauthorized individuals to access your account.
          </p>
        </section>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem', fontFamily: 'EB Garamond, serif' }}>Acceptable Use</h2>
          <p style={{ color: 'var(--text-primary)', lineHeight: '1.6', marginBottom: '1rem' }}>
            You agree not to use Elara for any unlawful purposes or in violation of these Terms. Prohibited activities include:
          </p>
          <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem', color: 'var(--text-primary)', lineHeight: '1.8' }}>
            <li>Violating any applicable laws or regulations</li>
            <li>Infringing on intellectual property rights</li>
            <li>Transmitting malware, viruses, or harmful code</li>
            <li>Attempting to gain unauthorized access to the Service or its systems</li>
            <li>Disrupting the Service or creating excessive server load</li>
            <li>Engaging in harassment, abuse, or discrimination</li>
            <li>Sharing or uploading illegal or infringing content</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem', fontFamily: 'EB Garamond, serif' }}>Subscription and Billing</h2>
          <p style={{ color: 'var(--text-primary)', lineHeight: '1.6', marginBottom: '1rem' }}>
            During beta, certain features may be provided at no cost. Paid subscriptions are processed through Stripe and are subject to the following:
          </p>
          <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem', color: 'var(--text-primary)', lineHeight: '1.8' }}>
            <li>Billing occurs monthly on the anniversary of your subscription start date</li>
            <li>You authorize us to charge the payment method on file for the selected plan</li>
            <li>Invoices are provided via email and your account dashboard</li>
            <li>Failed payments may result in service suspension</li>
            <li>Cancellation takes effect at the end of your current billing period</li>
            <li>Refunds are not provided for partial months except as required by law</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem', fontFamily: 'EB Garamond, serif' }}>Data Ownership and Rights</h2>
          <p style={{ color: 'var(--text-primary)', lineHeight: '1.6', marginBottom: '1rem' }}>
            <strong>You retain all ownership rights to your data.</strong> By using Elara, you grant us a limited license to:
          </p>
          <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem', color: 'var(--text-primary)', lineHeight: '1.8' }}>
            <li>Store and process your data to provide the Service</li>
            <li>Use your data with AI services (Google Gemini) for feature generation</li>
            <li>Display, analyze, and report on your data within your account</li>
            <li>Comply with legal obligations</li>
          </ul>
          <p style={{ color: 'var(--text-primary)', lineHeight: '1.6' }}>
            We will not sell, share, or use your data for purposes outside the Service without your explicit consent.
          </p>
        </section>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem', fontFamily: 'EB Garamond, serif' }}>AI-Generated Content Disclaimer</h2>
          <p style={{ color: 'var(--text-primary)', lineHeight: '1.6', marginBottom: '1rem' }}>
            Elara uses AI to generate insights, recommendations, letters, and analysis. <strong>You acknowledge and agree that:</strong>
          </p>
          <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem', color: 'var(--text-primary)', lineHeight: '1.8' }}>
            <li>AI outputs may contain errors or inaccuracies</li>
            <li>You are responsible for reviewing and editing all AI-generated content before use or sharing</li>
            <li>AI outputs should not be used as professional legal, financial, or tax advice</li>
            <li>We disclaim liability for decisions made based on AI outputs</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem', fontFamily: 'EB Garamond, serif' }}>Limitation of Liability</h2>
          <p style={{ color: 'var(--text-primary)', lineHeight: '1.6', marginBottom: '1rem' }}>
            To the fullest extent permitted by law, Elara and its officers, directors, employees, and agents shall not be liable for:
          </p>
          <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem', color: 'var(--text-primary)', lineHeight: '1.8' }}>
            <li>Indirect, incidental, consequential, or punitive damages</li>
            <li>Loss of profits, revenue, data, or business opportunity</li>
            <li>Service interruptions or data loss</li>
            <li>Errors in AI-generated content or recommendations</li>
          </ul>
          <p style={{ color: 'var(--text-primary)', lineHeight: '1.6' }}>
            Our total liability to you shall not exceed the fees paid by you in the 12 months preceding the claim.
          </p>
        </section>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem', fontFamily: 'EB Garamond, serif' }}>Warranty Disclaimer</h2>
          <p style={{ color: 'var(--text-primary)', lineHeight: '1.6' }}>
            <strong>The Service is provided "as is" and "as available."</strong> Elara makes no warranties, express or implied, including warranties of merchantability, fitness for a particular purpose, non-infringement, or title. We do not guarantee the Service will be uninterrupted, error-free, or secure.
          </p>
        </section>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem', fontFamily: 'EB Garamond, serif' }}>Termination</h2>
          <p style={{ color: 'var(--text-primary)', lineHeight: '1.6', marginBottom: '1rem' }}>
            Either party may terminate the Service at any time:
          </p>
          <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem', color: 'var(--text-primary)', lineHeight: '1.8' }}>
            <li><strong>You:</strong> Cancel your account through your dashboard or by contacting support</li>
            <li><strong>Elara:</strong> May terminate or suspend access for breach of these Terms, non-payment, or violation of applicable law</li>
          </ul>
          <p style={{ color: 'var(--text-primary)', lineHeight: '1.6' }}>
            Upon termination, your access to the Service ends and your account data may be deleted after 30 days (unless you request earlier deletion).
          </p>
        </section>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem', fontFamily: 'EB Garamond, serif' }}>Governing Law and Jurisdiction</h2>
          <p style={{ color: 'var(--text-primary)', lineHeight: '1.6' }}>
            These Terms are governed by the laws of the State of California, without regard to conflict of law principles. You agree to submit to the exclusive jurisdiction of the state and federal courts located in California for any legal disputes arising from these Terms or your use of Elara.
          </p>
        </section>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem', fontFamily: 'EB Garamond, serif' }}>Changes to These Terms</h2>
          <p style={{ color: 'var(--text-primary)', lineHeight: '1.6' }}>
            We may update these Terms at any time by posting the revised version on the Service. Significant changes will be communicated via email or a prominent notice on the Service. Continued use of Elara after changes constitutes acceptance of the updated Terms.
          </p>
        </section>

        <section style={{ marginBottom: '2.5rem', paddingBottom: '2rem', borderTop: '1px solid var(--glass-border)', paddingTop: '2rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem', fontFamily: 'EB Garamond, serif' }}>Contact Us</h2>
          <p style={{ color: 'var(--text-primary)', lineHeight: '1.6' }}>
            If you have questions about these Terms of Service, please contact us at:
          </p>
          <p style={{ color: 'var(--text-primary)', lineHeight: '1.8', marginTop: '1rem' }}>
            <strong>Elara</strong>
            <br />
            Email: <a href="mailto:support@getelara.com" style={{ color: 'var(--brand-primary)', textDecoration: 'none' }}>support@getelara.com</a>
          </p>
        </section>
      </div>
    </div>
  );
};

export default Terms;
