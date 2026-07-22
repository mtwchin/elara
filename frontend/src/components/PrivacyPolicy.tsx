import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface Props {
  onBack?: () => void;
}

const PrivacyPolicy: React.FC<Props> = ({ onBack }) => {
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
          Privacy Policy
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '1rem' }}>
          Last updated: July 22, 2026
        </p>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem', fontFamily: 'EB Garamond, serif' }}>Introduction</h2>
          <p style={{ color: 'var(--text-primary)', lineHeight: '1.6', marginBottom: '1rem' }}>
            Elara ("we," "us," "our," or "Company") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service, including our website and mobile application (collectively, the "Service").
          </p>
          <p style={{ color: 'var(--text-primary)', lineHeight: '1.6' }}>
            Please read this privacy policy carefully. If you do not agree with our policies and practices, please do not use our Service.
          </p>
        </section>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem', fontFamily: 'EB Garamond, serif' }}>Information We Collect</h2>
          <p style={{ color: 'var(--text-primary)', lineHeight: '1.6', marginBottom: '1rem' }}>
            We collect information that you voluntarily provide, including:
          </p>
          <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem', color: 'var(--text-primary)', lineHeight: '1.8' }}>
            <li><strong>Account information:</strong> Email address, name, password, phone number</li>
            <li><strong>Property and financial data:</strong> Property addresses, purchase prices, dates, tenant information, lease terms, rent amounts, transactions, expenses, mortgage details</li>
            <li><strong>Document uploads:</strong> Property photos, lease agreements, receipts, maintenance records, and other property-related documents</li>
            <li><strong>Communications:</strong> Messages, support requests, and feedback you send us</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem', fontFamily: 'EB Garamond, serif' }}>How We Use Your Information</h2>
          <p style={{ color: 'var(--text-primary)', lineHeight: '1.6', marginBottom: '1rem' }}>
            We use the information we collect for:
          </p>
          <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem', color: 'var(--text-primary)', lineHeight: '1.8' }}>
            <li>Providing, maintaining, and improving our Service</li>
            <li>Processing transactions and sending related information</li>
            <li>Sending transactional and marketing communications</li>
            <li>Responding to your comments, questions, and requests</li>
            <li>Generating portfolio analysis and AI-powered insights using Google Gemini</li>
            <li>Monitoring and analyzing trends, usage, and activities for security and performance</li>
            <li>Detecting, investigating, and preventing fraud and security incidents</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem', fontFamily: 'EB Garamond, serif' }}>AI Features and Data Processing</h2>
          <p style={{ color: 'var(--text-primary)', lineHeight: '1.6', marginBottom: '1rem' }}>
            Elara uses Google Gemini to power AI features including portfolio insights, renewal letter generation, document extraction, and maintenance alerts. Your property and financial data may be sent to Google's servers for processing. We recommend reviewing Google's privacy policy at <a href="https://policies.google.com/privacy" style={{ color: 'var(--brand-primary)', textDecoration: 'none' }}>policies.google.com/privacy</a>.
          </p>
          <p style={{ color: 'var(--text-primary)', lineHeight: '1.6' }}>
            AI-generated outputs should be reviewed and edited before being used or shared. We are not responsible for errors or inaccuracies in AI-generated content.
          </p>
        </section>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem', fontFamily: 'EB Garamond, serif' }}>Data Storage and Security</h2>
          <p style={{ color: 'var(--text-primary)', lineHeight: '1.6', marginBottom: '1rem' }}>
            Your data is stored securely on US-based servers using industry-standard encryption and security practices. We implement reasonable administrative, technical, and physical security measures to protect your information against unauthorized access, alteration, disclosure, or destruction.
          </p>
          <p style={{ color: 'var(--text-primary)', lineHeight: '1.6' }}>
            While we strive to use commercially acceptable means to protect your information, we cannot guarantee absolute security.
          </p>
        </section>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem', fontFamily: 'EB Garamond, serif' }}>Cookies and Tracking</h2>
          <p style={{ color: 'var(--text-primary)', lineHeight: '1.6' }}>
            Elara uses session-based cookies to maintain your login and provide service functionality. These cookies expire when you close your browser or log out. We do not use persistent tracking cookies or third-party analytics that profile your behavior.
          </p>
        </section>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem', fontFamily: 'EB Garamond, serif' }}>User Rights and Data Deletion</h2>
          <p style={{ color: 'var(--text-primary)', lineHeight: '1.6', marginBottom: '1rem' }}>
            You have the right to access, update, or delete your personal information at any time. To request data deletion or exercise other privacy rights, please contact us at <a href="mailto:support@getelara.com" style={{ color: 'var(--brand-primary)', textDecoration: 'none' }}>support@getelara.com</a>.
          </p>
          <p style={{ color: 'var(--text-primary)', lineHeight: '1.6' }}>
            We will respond to verified requests within 30 days. Deletion of your account will remove all associated personal information, though we may retain certain data as required by law.
          </p>
        </section>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem', fontFamily: 'EB Garamond, serif' }}>Third-Party Sharing</h2>
          <p style={{ color: 'var(--text-primary)', lineHeight: '1.6' }}>
            We do not sell or rent your personal information to third parties. We may share information with service providers (like Google Gemini for AI features, Stripe for payments) under strict data processing agreements. We may also disclose information when required by law or to protect our rights.
          </p>
        </section>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem', fontFamily: 'EB Garamond, serif' }}>Changes to This Policy</h2>
          <p style={{ color: 'var(--text-primary)', lineHeight: '1.6' }}>
            We may update this Privacy Policy periodically to reflect changes in our practices. We will notify you of significant changes by updating the "Last updated" date and, if necessary, by email or prominently on the Service.
          </p>
        </section>

        <section style={{ marginBottom: '2.5rem', paddingBottom: '2rem', borderTop: '1px solid var(--glass-border)', paddingTop: '2rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem', fontFamily: 'EB Garamond, serif' }}>Contact Us</h2>
          <p style={{ color: 'var(--text-primary)', lineHeight: '1.6' }}>
            If you have questions about this Privacy Policy or our privacy practices, please contact us at:
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

export default PrivacyPolicy;
