import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — AgentStamp",
  description: "AgentStamp terms of service. Rules governing use of our identity attestation, trust scoring, and registry services for AI agents.",
  alternates: { canonical: "https://agentstamp.org/terms" },
  openGraph: {
    title: "Terms of Service — AgentStamp",
    description: "Terms governing AgentStamp identity attestation, trust scoring, and registry services.",
    url: "https://agentstamp.org/terms",
    type: "website",
  },
};

export default function TermsOfService() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 prose prose-invert prose-lg">
      <Link href="/" className="text-sm text-[#818cf8] no-underline hover:underline mb-4 block">&larr; Back to Home</Link>
      <time className="text-sm text-[#71717a]">Effective: March 25, 2026</time>
      <h1 className="text-3xl font-bold text-[#e8e8ed] mt-2">Terms of Service</h1>

      <p className="text-[#d4d4d8]">
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of AgentStamp&apos;s
        website at <Link href="https://agentstamp.org" className="text-[#818cf8]">agentstamp.org</Link>,
        API, MCP server, SDK, and all related services (collectively, the &quot;Service&quot;).
        The Service is operated by Vinay Bhosle, trading as AgentStamp, based in India.
      </p>
      <p className="text-[#d4d4d8]">
        By accessing or using the Service, you agree to be bound by these Terms. If you do not
        agree, do not use the Service.
      </p>

      {/* ── 1. Acceptance ── */}
      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-10">1. Acceptance of Terms</h2>
      <p className="text-[#d4d4d8]">
        By connecting a wallet, minting a stamp, registering an agent, calling the API, or
        otherwise using the Service, you confirm that you have read, understood, and agree to
        these Terms. If you are using the Service on behalf of an organization, you represent
        that you have authority to bind that organization to these Terms.
      </p>

      {/* ── 2. Description of Service ── */}
      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-10">2. Description of Service</h2>
      <p className="text-[#d4d4d8]">
        AgentStamp provides identity attestation, trust scoring, verifiable credentials, and
        registry services for AI agents. The Service includes:
      </p>
      <ul className="text-[#d4d4d8]">
        <li>Stamp issuance — cryptographic identity attestations linked to wallet addresses</li>
        <li>Agent registry — a public directory of registered AI agents with metadata</li>
        <li>Trust scoring — dynamic reputation scores based on agent activity and endorsements</li>
        <li>Verifiable credentials — W3C-compatible credentials for agent identity</li>
        <li>Audit trails — tamper-evident hash chain records of agent actions</li>
        <li>EU AI Act readiness tools — informational compliance checklists</li>
        <li>MCP server — Model Context Protocol integration for AI assistants</li>
        <li>SDK and API — programmatic access to all of the above</li>
      </ul>

      {/* ── 3. Account and Registration ── */}
      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-10">3. Account and Registration</h2>
      <p className="text-[#d4d4d8]">
        AgentStamp uses wallet-based authentication. There are no usernames, passwords, or
        traditional accounts. Your identity is established by cryptographic signatures from
        your EVM or Solana wallet.
      </p>
      <p className="text-[#d4d4d8]">
        You are solely responsible for the security of your wallet private keys. AgentStamp
        never has access to your private keys. If your wallet is compromised, AgentStamp cannot
        recover it or reverse unauthorized actions taken with your wallet.
      </p>
      <p className="text-[#d4d4d8]">
        You agree to provide accurate agent metadata when registering. Intentionally false or
        misleading metadata may result in removal from the registry.
      </p>

      {/* ── 4. Trust Indicators Disclaimer ── */}
      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-10">4. Trust Indicators Disclaimer</h2>
      <p className="text-[#d4d4d8]">
        This section is critical to your understanding of the Service. Please read it carefully.
      </p>
      <div className="bg-[#1a1a2e] rounded-lg p-6 my-4">
        <p className="text-[#d4d4d8] mt-0">
          Trust indicators (including trust scores, tier labels, and reputation data) are
          <strong className="text-[#e8e8ed]"> informational summaries of historical behavioral data</strong>.
          They reflect past activity patterns and are computed algorithmically.
        </p>
        <p className="text-[#d4d4d8]">
          Trust indicators <strong className="text-[#e8e8ed]">do NOT constitute</strong> guarantees,
          warranties, certifications, endorsements, or representations of agent safety, reliability,
          or future behavior.
        </p>
        <p className="text-[#d4d4d8]">
          <strong className="text-[#e8e8ed]">Do not use trust indicators as the sole basis</strong> for
          permitting autonomous agent actions that could cause financial loss, physical harm,
          reputational damage, or other adverse consequences.
        </p>
        <p className="text-[#d4d4d8] mb-0">
          AgentStamp is <strong className="text-[#e8e8ed]">not</strong> a credit rating agency, auditor,
          certifier, insurer, or guarantor. Trust scores are one data point among many that
          should inform your agent governance decisions.
        </p>
      </div>

      {/* ── 5. EU AI Act Disclaimer ── */}
      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-10">5. EU AI Act Readiness Tools Disclaimer</h2>
      <div className="bg-[#1a1a2e] rounded-lg p-6 my-4">
        <p className="text-[#d4d4d8] mt-0">
          EU AI Act readiness checklists, compliance reports, and related tools provided by AgentStamp
          are <strong className="text-[#e8e8ed]">informational tools only</strong>.
        </p>
        <p className="text-[#d4d4d8]">
          They <strong className="text-[#e8e8ed]">do not constitute</strong> conformity assessments,
          legal advice, legal opinions, or certification under the EU Artificial Intelligence Act
          (Regulation (EU) 2024/1689) or any other regulation.
        </p>
        <p className="text-[#d4d4d8] mb-0">
          For formal compliance assessment, consult a qualified legal professional or a notified
          body authorized under the EU AI Act. AgentStamp does not provide legal advice.
        </p>
      </div>

      {/* ── 6. Limitation of Liability ── */}
      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-10">6. Limitation of Liability</h2>
      <p className="text-[#d4d4d8]">
        TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:
      </p>
      <ul className="text-[#d4d4d8]">
        <li>
          AgentStamp&apos;s total aggregate liability to you for any and all claims arising out of
          or related to the Service shall not exceed the total fees you paid to AgentStamp in the
          twelve (12) months immediately preceding the event giving rise to the claim.
        </li>
        <li>
          If you have not paid any fees, AgentStamp&apos;s maximum liability is zero.
        </li>
        <li>
          In no event shall AgentStamp be liable for any indirect, incidental, special,
          consequential, punitive, or exemplary damages, including but not limited to damages
          for loss of profits, goodwill, data, or other intangible losses, regardless of whether
          AgentStamp was advised of the possibility of such damages.
        </li>
        <li>
          AgentStamp is not liable for any actions taken by AI agents that you interact with
          through the Service, whether or not those agents hold a stamp or trust score.
        </li>
      </ul>

      {/* ── 7. Disclaimer of Warranties ── */}
      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-10">7. Disclaimer of Warranties</h2>
      <p className="text-[#d4d4d8]">
        THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES
        OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES
        OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.
      </p>
      <p className="text-[#d4d4d8]">
        AgentStamp does not warrant that the Service will be uninterrupted, error-free, secure,
        or free of viruses or other harmful components. AgentStamp does not warrant the accuracy,
        completeness, or reliability of any trust scores, audit trail data, or registry information.
      </p>

      {/* ── 8. Indemnification ── */}
      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-10">8. Indemnification</h2>
      <p className="text-[#d4d4d8]">
        You agree to indemnify, defend, and hold harmless AgentStamp and its operator from and
        against any claims, liabilities, damages, losses, costs, and expenses (including
        reasonable legal fees) arising out of or related to:
      </p>
      <ul className="text-[#d4d4d8]">
        <li>Your use or misuse of the Service</li>
        <li>Your violation of these Terms</li>
        <li>Your violation of any third-party rights</li>
        <li>Any agent you register or control that causes harm to third parties</li>
        <li>Any reliance on trust indicators in a manner inconsistent with Section 4</li>
      </ul>

      {/* ── 9. Acceptable Use ── */}
      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-10">9. Acceptable Use</h2>
      <p className="text-[#d4d4d8]">You agree not to use the Service to:</p>
      <ul className="text-[#d4d4d8]">
        <li>Commit, facilitate, or conceal fraud or financial crime</li>
        <li>Evade sanctions, export controls, or anti-money-laundering regulations</li>
        <li>Impersonate another person, agent, or entity</li>
        <li>Register agents with intentionally false or misleading metadata</li>
        <li>Artificially inflate trust scores through Sybil attacks, self-endorsement, or collusion</li>
        <li>Send spam, unsolicited communications, or abuse webhook endpoints</li>
        <li>Attempt to disrupt, overload, or gain unauthorized access to the Service or its infrastructure</li>
        <li>Reverse-engineer, decompile, or extract source code from the Service (except as permitted by the Apache 2.0 license for open-source components)</li>
        <li>Use the Service in any manner that violates applicable law</li>
      </ul>
      <p className="text-[#d4d4d8]">
        Violation of this section may result in immediate suspension or termination of access,
        removal of agents from the registry, and revocation of stamps.
      </p>

      {/* ── 10. Intellectual Property ── */}
      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-10">10. Intellectual Property</h2>
      <p className="text-[#d4d4d8]">
        The AgentStamp open-source codebase is licensed under the{" "}
        <Link href="https://www.apache.org/licenses/LICENSE-2.0" className="text-[#818cf8]">Apache License 2.0</Link>.
        You may use, modify, and distribute the code in accordance with that license.
      </p>
      <p className="text-[#d4d4d8]">
        The AgentStamp name, logo, brand identity, and visual design of the website are reserved
        and may not be used without prior written permission. You may not use the AgentStamp
        name or brand in a way that suggests endorsement, affiliation, or sponsorship without
        authorization.
      </p>
      <p className="text-[#d4d4d8]">
        Content you submit to the registry (agent metadata, descriptions, capabilities) remains
        yours. By submitting it, you grant AgentStamp a worldwide, non-exclusive, royalty-free
        license to display and distribute it as part of the public registry.
      </p>

      {/* ── 11. Termination ── */}
      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-10">11. Termination</h2>
      <p className="text-[#d4d4d8]">
        Either party may terminate this agreement at any time:
      </p>
      <ul className="text-[#d4d4d8]">
        <li>
          <strong className="text-[#e8e8ed]">You</strong> may stop using the Service at any time.
          You may request deletion of your data as described in our{" "}
          <Link href="/privacy" className="text-[#818cf8]">Privacy Policy</Link>.
        </li>
        <li>
          <strong className="text-[#e8e8ed]">AgentStamp</strong> may suspend or terminate your access
          if you violate these Terms, engage in abuse, or if required by law.
        </li>
      </ul>
      <p className="text-[#d4d4d8]">
        Upon termination, your right to use the Service ceases immediately. AgentStamp will
        handle your data in accordance with our Privacy Policy, including honoring deletion
        requests subject to legal retention obligations.
      </p>
      <p className="text-[#d4d4d8]">
        Sections 4 (Trust Indicators Disclaimer), 5 (EU AI Act Disclaimer), 6 (Limitation of
        Liability), 7 (Disclaimer of Warranties), 8 (Indemnification), and 12 (Governing Law)
        survive termination.
      </p>

      {/* ── 12. Governing Law ── */}
      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-10">12. Governing Law and Dispute Resolution</h2>
      <p className="text-[#d4d4d8]">
        These Terms are governed by and construed in accordance with the laws of India, without
        regard to conflict of law principles.
      </p>
      <p className="text-[#d4d4d8]">
        For disputes involving parties located in India, the courts of India shall have exclusive
        jurisdiction.
      </p>
      <p className="text-[#d4d4d8]">
        For international disputes, the parties agree to submit to binding arbitration administered
        under the UNCITRAL Arbitration Rules. The arbitration shall be conducted in English,
        with the seat of arbitration in New Delhi, India. The arbitral tribunal shall consist of
        a sole arbitrator. Judgment on the award may be entered in any court having jurisdiction.
      </p>

      {/* ── 13. Modifications ── */}
      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-10">13. Modifications to Terms</h2>
      <p className="text-[#d4d4d8]">
        AgentStamp reserves the right to modify these Terms at any time. For material changes,
        we will provide at least 30 days&apos; notice by posting the updated Terms on our website
        with a revised effective date. Your continued use of the Service after the effective date
        of any changes constitutes acceptance of the modified Terms.
      </p>
      <p className="text-[#d4d4d8]">
        Non-material changes (typo corrections, formatting, clarifications that do not alter
        meaning) may be made without advance notice.
      </p>

      {/* ── 14. Severability ── */}
      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-10">14. Severability</h2>
      <p className="text-[#d4d4d8]">
        If any provision of these Terms is held to be invalid, illegal, or unenforceable by a
        court of competent jurisdiction, that provision shall be modified to the minimum extent
        necessary to make it valid and enforceable, or if modification is not possible, it shall
        be severed. The remaining provisions shall continue in full force and effect.
      </p>

      {/* ── 15. Entire Agreement ── */}
      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-10">15. Entire Agreement</h2>
      <p className="text-[#d4d4d8]">
        These Terms, together with the{" "}
        <Link href="/privacy" className="text-[#818cf8]">Privacy Policy</Link>, constitute
        the entire agreement between you and AgentStamp regarding the Service. They supersede
        all prior agreements, representations, and understandings, whether written or oral.
      </p>

      {/* ── 16. Contact ── */}
      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-10">16. Contact</h2>
      <p className="text-[#d4d4d8]">
        For questions about these Terms, contact us:
      </p>
      <ul className="text-[#d4d4d8]">
        <li><strong className="text-[#e8e8ed]">Legal inquiries:</strong> <Link href="mailto:legal@agentstamp.org" className="text-[#818cf8]">legal@agentstamp.org</Link></li>
        <li><strong className="text-[#e8e8ed]">General inquiries:</strong> <Link href="mailto:vinay@agentstamp.org" className="text-[#818cf8]">vinay@agentstamp.org</Link></li>
      </ul>

      <hr className="border-[#27272a] my-10" />
      <p className="text-[#a1a1aa] text-sm">
        These Terms of Service are effective as of March 25, 2026. By using AgentStamp, you
        acknowledge that you have read and understood these Terms.
      </p>
    </article>
  );
}
