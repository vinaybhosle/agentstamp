import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — AgentStamp",
  description: "AgentStamp privacy policy. How we collect, use, and protect your data under GDPR and India DPDPA.",
  alternates: { canonical: "https://agentstamp.org/privacy" },
  openGraph: {
    title: "Privacy Policy — AgentStamp",
    description: "How AgentStamp collects, uses, and protects your data.",
    url: "https://agentstamp.org/privacy",
    type: "website",
  },
};

export default function PrivacyPolicy() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 prose prose-invert prose-lg">
      <Link href="/" className="text-sm text-[#818cf8] no-underline hover:underline mb-4 block">&larr; Back to Home</Link>
      <time className="text-sm text-[#71717a]">Last updated: March 25, 2026</time>
      <h1 className="text-3xl font-bold text-[#e8e8ed] mt-2">Privacy Policy</h1>

      <p className="text-[#d4d4d8]">
        This Privacy Policy explains how AgentStamp collects, uses, stores, and protects information
        when you use our website at <Link href="https://agentstamp.org" className="text-[#818cf8]">agentstamp.org</Link> and
        our API services (collectively, the &quot;Service&quot;). We are committed to transparency
        and to your rights under the EU General Data Protection Regulation (GDPR) and India&apos;s
        Digital Personal Data Protection Act, 2023 (DPDPA).
      </p>

      {/* ── 1. Data Controller ── */}
      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-10">1. Data Controller</h2>
      <p className="text-[#d4d4d8]">
        AgentStamp is operated by Vinay Bhosle, based in India.
      </p>
      <ul className="text-[#d4d4d8]">
        <li><strong className="text-[#e8e8ed]">Controller:</strong> Vinay Bhosle (sole proprietor, trading as AgentStamp)</li>
        <li><strong className="text-[#e8e8ed]">Email:</strong> <Link href="mailto:vinay@agentstamp.org" className="text-[#818cf8]">vinay@agentstamp.org</Link></li>
        <li><strong className="text-[#e8e8ed]">Website:</strong> <Link href="https://agentstamp.org" className="text-[#818cf8]">agentstamp.org</Link></li>
      </ul>
      <p className="text-[#a1a1aa]">
        We do not currently appoint a Data Protection Officer (DPO). For all data-related
        requests, contact us at the email above.
      </p>

      {/* ── 2. What Data We Collect ── */}
      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-10">2. What Data We Collect and Why</h2>
      <p className="text-[#d4d4d8]">
        AgentStamp is designed to minimize personal data collection. Most of our data relates
        to AI agent identities, not human individuals. Below is a comprehensive breakdown:
      </p>

      <h3 className="text-xl font-semibold text-[#e8e8ed] mt-6">2.1 Wallet Addresses</h3>
      <p className="text-[#d4d4d8]">
        We collect EVM (Ethereum-compatible) and Solana wallet addresses that you provide
        when minting stamps, registering agents, or interacting with the API. Wallet addresses
        are pseudonymous identifiers. They are not inherently personal data, but we treat them
        as such out of caution because they could be linked to an individual through external means.
      </p>
      <p className="text-[#a1a1aa]">Purpose: identity attestation, stamp issuance, registry lookup, trust scoring.</p>

      <h3 className="text-xl font-semibold text-[#e8e8ed] mt-6">2.2 Agent Metadata</h3>
      <p className="text-[#d4d4d8]">
        When registering an agent, you provide a name, description, capabilities list, and
        endpoint URLs. This metadata describes the AI agent, not a human, and is stored in
        our public registry.
      </p>
      <p className="text-[#a1a1aa]">Purpose: agent discovery, trust evaluation, registry services.</p>

      <h3 className="text-xl font-semibold text-[#e8e8ed] mt-6">2.3 Human Sponsor Field (Optional)</h3>
      <p className="text-[#d4d4d8]">
        When registering an agent, you may optionally provide a <code className="text-[#818cf8]">human_sponsor</code> field
        containing an email address or URL identifying the responsible human behind the agent.
        This field <strong className="text-[#e8e8ed]">is personal data</strong> when it contains
        an email address. It is collected only with your explicit consent and is not required
        to use the Service.
      </p>
      <p className="text-[#a1a1aa]">Purpose: accountability, human-in-the-loop transparency, EU AI Act readiness.</p>

      <h3 className="text-xl font-semibold text-[#e8e8ed] mt-6">2.4 IP Address Hashes</h3>
      <p className="text-[#d4d4d8]">
        We hash your IP address using a one-way cryptographic function for rate limiting and
        abuse prevention. We <strong className="text-[#e8e8ed]">never store raw IP addresses</strong>.
        The hash cannot be reversed to recover your original IP.
      </p>
      <p className="text-[#a1a1aa]">Purpose: rate limiting, abuse prevention, DDoS mitigation.</p>

      <h3 className="text-xl font-semibold text-[#e8e8ed] mt-6">2.5 Trust Scores</h3>
      <p className="text-[#d4d4d8]">
        Trust scores are computed values derived from on-chain and registry activity. They are
        not collected from you; they are generated by our scoring algorithm based on observable
        behavior (endorsements, heartbeats, activity recency).
      </p>

      <h3 className="text-xl font-semibold text-[#e8e8ed] mt-6">2.6 Audit Trail Events</h3>
      <p className="text-[#d4d4d8]">
        We record audit trail events for actions taken through the Service, including stamp
        minting, registry modifications, endorsements, and API calls. These entries are stored
        in a tamper-evident hash chain. Each entry references the hash of the previous entry,
        forming a cryptographic chain of custody.
      </p>
      <p className="text-[#a1a1aa]">Purpose: security, fraud prevention, dispute resolution, regulatory compliance.</p>

      <h3 className="text-xl font-semibold text-[#e8e8ed] mt-6">2.7 Webhook URLs</h3>
      <p className="text-[#d4d4d8]">
        If you register webhooks to receive event notifications, we store the URLs you provide.
        These may contain server hostnames or paths that could identify your infrastructure.
      </p>
      <p className="text-[#a1a1aa]">Purpose: delivering event notifications you requested.</p>

      {/* ── 3. Legal Basis ── */}
      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-10">3. Legal Basis for Processing</h2>
      <p className="text-[#d4d4d8]">We process data under the following GDPR legal bases:</p>
      <ul className="text-[#d4d4d8]">
        <li>
          <strong className="text-[#e8e8ed]">Article 6(1)(b) — Contract Performance:</strong> Processing
          wallet addresses, agent metadata, and webhook URLs is necessary to perform the services
          you requested (stamp issuance, registry listing, event notifications).
        </li>
        <li>
          <strong className="text-[#e8e8ed]">Article 6(1)(f) — Legitimate Interest:</strong> Processing
          IP address hashes, audit trail events, and trust scores is necessary for our legitimate
          interests in security, fraud prevention, and maintaining the integrity of the trust
          system. These interests do not override your fundamental rights because we minimize
          data collection and use pseudonymous identifiers.
        </li>
        <li>
          <strong className="text-[#e8e8ed]">Consent:</strong> The optional <code className="text-[#818cf8]">human_sponsor</code> field
          is processed only with your explicit consent. You can withdraw consent at any time
          by updating your agent registration to remove this field.
        </li>
      </ul>
      <p className="text-[#d4d4d8]">
        Under India&apos;s DPDPA, we process data based on your consent (provided when you
        voluntarily interact with the Service) and for legitimate uses as permitted under the Act.
      </p>

      {/* ── 4. Data Retention ── */}
      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-10">4. Data Retention</h2>
      <ul className="text-[#d4d4d8]">
        <li>
          <strong className="text-[#e8e8ed]">Registration data</strong> (wallet addresses, agent metadata,
          webhook URLs): retained for the duration of your use of the Service. Deleted upon
          request, subject to the audit trail exception described in Section 6.
        </li>
        <li>
          <strong className="text-[#e8e8ed]">Audit trail entries:</strong> retained indefinitely for
          legal compliance, security, and the integrity of the hash chain. See Section 6 for
          the erasure exception.
        </li>
        <li>
          <strong className="text-[#e8e8ed]">IP address hashes:</strong> retained for up to 30 days in
          rate-limiting stores, then automatically purged.
        </li>
        <li>
          <strong className="text-[#e8e8ed]">Trust scores:</strong> recomputed dynamically and decay to
          zero after 30 days of inactivity. Historical scores are not retained.
        </li>
      </ul>

      {/* ── 5. International Transfers ── */}
      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-10">5. International Data Transfers</h2>
      <p className="text-[#d4d4d8]">
        Our servers are located in India. India does not currently have an EU adequacy decision
        under GDPR Article 45. If you are located in the European Economic Area (EEA), United
        Kingdom, or Switzerland, your data is transferred to India for processing.
      </p>
      <p className="text-[#d4d4d8]">
        We rely on Standard Contractual Clauses (SCCs) as the legal mechanism for these transfers.
        A copy of our SCCs is available on request by emailing{" "}
        <Link href="mailto:vinay@agentstamp.org" className="text-[#818cf8]">vinay@agentstamp.org</Link>.
      </p>
      <p className="text-[#d4d4d8]">
        Cloudflare, our CDN and DDoS protection provider, may process requests through edge
        nodes in various countries. Cloudflare maintains its own GDPR compliance documentation
        and has executed SCCs with us for EU data processing.
      </p>

      {/* ── 6. Your Rights ── */}
      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-10">6. Your Rights</h2>
      <p className="text-[#d4d4d8]">
        Depending on your jurisdiction, you have the following rights regarding your personal data:
      </p>

      <h3 className="text-xl font-semibold text-[#e8e8ed] mt-6">Right of Access</h3>
      <p className="text-[#d4d4d8]">
        You can request a copy of all personal data we hold about you. Since most data is
        accessible via our public API and registry, you can also retrieve it directly.
      </p>

      <h3 className="text-xl font-semibold text-[#e8e8ed] mt-6">Right to Rectification</h3>
      <p className="text-[#d4d4d8]">
        You can update your agent metadata, webhook URLs, and human_sponsor field at any time
        through the API.
      </p>

      <h3 className="text-xl font-semibold text-[#e8e8ed] mt-6">Right to Erasure (Right to be Forgotten)</h3>
      <p className="text-[#d4d4d8]">
        You can request deletion of your registration data, including wallet associations,
        agent metadata, and webhook URLs. We will process erasure requests within 30 days.
      </p>
      <p className="text-[#d4d4d8]">
        <strong className="text-[#e8e8ed]">Important exception — Audit Trail Hash Chain:</strong> Our
        audit trail uses a tamper-evident hash chain where each entry contains a cryptographic
        hash of the previous entry. Deleting or modifying any entry would break the chain&apos;s
        integrity, rendering subsequent entries unverifiable.
      </p>
      <p className="text-[#d4d4d8]">
        Under GDPR Article 17(3)(e), we retain audit trail entries where necessary for the
        establishment, exercise, or defense of legal claims. However, upon receiving an erasure
        request, we will <strong className="text-[#e8e8ed]">anonymize</strong> the personal
        identifiers within those entries. Specifically, we replace wallet addresses with
        irreversible pseudonyms and remove any human_sponsor data, while preserving the
        cryptographic hashes that maintain chain integrity. This means the audit chain remains
        valid for verification purposes without containing data that can identify you.
      </p>

      <h3 className="text-xl font-semibold text-[#e8e8ed] mt-6">Right to Data Portability</h3>
      <p className="text-[#d4d4d8]">
        You can export your agent data in machine-readable JSON format via the API at any time.
      </p>

      <h3 className="text-xl font-semibold text-[#e8e8ed] mt-6">Right to Object</h3>
      <p className="text-[#d4d4d8]">
        You can object to processing based on legitimate interest (Section 3). We will cease
        processing unless we demonstrate compelling legitimate grounds that override your
        interests, or the processing is necessary for legal claims.
      </p>

      <h3 className="text-xl font-semibold text-[#e8e8ed] mt-6">Right to Withdraw Consent</h3>
      <p className="text-[#d4d4d8]">
        Where processing is based on consent (the human_sponsor field), you may withdraw consent
        at any time by updating your registration to remove the field, or by contacting us.
        Withdrawal does not affect the lawfulness of processing performed before withdrawal.
      </p>

      <p className="text-[#d4d4d8]">
        To exercise any of these rights, email{" "}
        <Link href="mailto:vinay@agentstamp.org" className="text-[#818cf8]">vinay@agentstamp.org</Link>.
        We will respond within 30 days (GDPR) or as required under DPDPA.
      </p>

      {/* ── 7. Cookies ── */}
      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-10">7. Cookies and Tracking</h2>
      <p className="text-[#d4d4d8]">
        AgentStamp does not use cookies. We do not use any analytics trackers, advertising
        pixels, session cookies, or fingerprinting techniques. The Service operates without
        any client-side tracking technology.
      </p>

      {/* ── 8. Third Parties ── */}
      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-10">8. Third-Party Services</h2>
      <p className="text-[#d4d4d8]">We use the following third-party service:</p>
      <ul className="text-[#d4d4d8]">
        <li>
          <strong className="text-[#e8e8ed]">Cloudflare, Inc.</strong> — CDN, DDoS protection, and DNS.
          Cloudflare may process request metadata (IP addresses, headers) as part of its
          network operation. Cloudflare&apos;s privacy policy is available at{" "}
          <Link href="https://www.cloudflare.com/privacypolicy/" className="text-[#818cf8]">cloudflare.com/privacypolicy</Link>.
        </li>
      </ul>
      <p className="text-[#d4d4d8]">
        We do not use Google Analytics, Facebook Pixel, Hotjar, or any other analytics or
        advertising tracker. We do not sell, rent, or share your data with third parties
        for marketing purposes.
      </p>

      {/* ── 9. Children ── */}
      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-10">9. Children&apos;s Privacy</h2>
      <p className="text-[#d4d4d8]">
        AgentStamp is not intended for use by individuals under the age of 16. We do not
        knowingly collect personal data from children. If we become aware that a child under
        16 has provided us with personal data, we will take steps to delete that information
        promptly. If you believe a child has provided us with personal data, please contact
        us at{" "}
        <Link href="mailto:vinay@agentstamp.org" className="text-[#818cf8]">vinay@agentstamp.org</Link>.
      </p>

      {/* ── 10. Changes ── */}
      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-10">10. Changes to This Policy</h2>
      <p className="text-[#d4d4d8]">
        We may update this Privacy Policy from time to time. Material changes will be announced
        on our website at least 30 days before they take effect. The &quot;Last updated&quot;
        date at the top of this page indicates the most recent revision. Continued use of the
        Service after changes take effect constitutes acceptance of the revised policy.
      </p>

      {/* ── 11. Contact ── */}
      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-10">11. Contact Us</h2>
      <p className="text-[#d4d4d8]">
        For any questions, concerns, or requests regarding this Privacy Policy or your personal
        data, contact us:
      </p>
      <ul className="text-[#d4d4d8]">
        <li><strong className="text-[#e8e8ed]">Email:</strong> <Link href="mailto:vinay@agentstamp.org" className="text-[#818cf8]">vinay@agentstamp.org</Link></li>
        <li><strong className="text-[#e8e8ed]">Subject line:</strong> Privacy Request — [Your Name or Wallet Address]</li>
      </ul>
      <p className="text-[#d4d4d8]">
        If you are in the EEA and believe we have not adequately addressed your data protection
        concerns, you have the right to lodge a complaint with your local Data Protection
        Authority (DPA). A list of EU DPAs is available at{" "}
        <Link href="https://edpb.europa.eu/about-edpb/about-edpb/members_en" className="text-[#818cf8]">edpb.europa.eu</Link>.
      </p>
      <p className="text-[#d4d4d8]">
        If you are in India and wish to exercise your rights under the DPDPA, you may contact
        the Data Protection Board of India once it is constituted, or reach us directly at the
        email above.
      </p>

      <hr className="border-[#27272a] my-10" />
      <p className="text-[#a1a1aa] text-sm">
        This policy is effective as of March 25, 2026 and applies to all users of the AgentStamp
        Service worldwide.
      </p>
    </article>
  );
}
