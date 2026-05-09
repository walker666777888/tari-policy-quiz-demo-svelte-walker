-- =============================================================================
-- supabase/seed/policies.sql
-- Compliance Policies + Sub-headings Seed Data
-- 8 policies × 10 sub_headings = 80 sub_headings total
--
-- Dual-track policies (appear in both master + tenant question pools):
--   · Code of Conduct        (COC)
--   · Conflict of Interest   (COI)
--   · Prevention of Insider Trading (PIT)
--
-- NOTE: This seed adds is_dual_track to the policies table if not present.
--       In production, move this column to migration 001.
-- =============================================================================

ALTER TABLE policies
  ADD COLUMN IF NOT EXISTS is_dual_track BOOLEAN NOT NULL DEFAULT FALSE;

-- =============================================================================
-- SEED BLOCK
-- Uses a single DO $$ block so policy UUIDs are declared once and reused
-- safely across all 80 sub_heading inserts — no risk of UUID mismatch.
-- =============================================================================

DO $$
DECLARE
  -- ── Policy UUIDs ────────────────────────────────────────────────────────────
  v_coc UUID := 'b1000001-0000-0000-0000-000000000001'; -- Code of Conduct
  v_coi UUID := 'b1000001-0000-0000-0000-000000000002'; -- Conflict of Interest
  v_pit UUID := 'b1000001-0000-0000-0000-000000000003'; -- Prevention of Insider Trading
  v_aml UUID := 'b1000001-0000-0000-0000-000000000004'; -- Anti-Money Laundering
  v_kyc UUID := 'b1000001-0000-0000-0000-000000000005'; -- Know Your Customer
  v_dpp UUID := 'b1000001-0000-0000-0000-000000000006'; -- Data Protection & Privacy
  v_cis UUID := 'b1000001-0000-0000-0000-000000000007'; -- Cybersecurity & Information Security
  v_fpd UUID := 'b1000001-0000-0000-0000-000000000008'; -- Fraud Prevention & Detection

BEGIN

-- =============================================================================
-- 1. INSERT POLICIES
-- =============================================================================

INSERT INTO policies
  (id, code, title, description, version, is_active, is_dual_track, display_order)
VALUES

  -- ── DUAL-TRACK ─────────────────────────────────────────────────────────────

  (v_coc, 'COC', 'Code of Conduct',
   'Standards governing professional behaviour, ethics, and workplace conduct expected of all employees.',
   '1.0', TRUE, TRUE, 1),

  (v_coi, 'COI', 'Conflict of Interest',
   'Guidelines for identifying, disclosing, and managing situations where personal interests may conflict with organisational duties.',
   '1.0', TRUE, TRUE, 2),

  (v_pit, 'PIT', 'Prevention of Insider Trading',
   'Rules prohibiting the use of material non-public information for personal trading gain and the obligations of employees who possess such information.',
   '1.0', TRUE, TRUE, 3),

  -- ── SINGLE-TRACK ───────────────────────────────────────────────────────────

  (v_aml, 'AML', 'Anti-Money Laundering',
   'Regulatory requirements and internal controls to detect, prevent, and report money laundering and terrorist financing activities.',
   '1.0', TRUE, FALSE, 4),

  (v_kyc, 'KYC', 'Know Your Customer',
   'Customer identification, verification, and due diligence procedures required before and during a business relationship.',
   '1.0', TRUE, FALSE, 5),

  (v_dpp, 'DPP', 'Data Protection & Privacy',
   'Obligations for the lawful collection, processing, storage, and disposal of personal data in compliance with applicable data protection laws.',
   '1.0', TRUE, FALSE, 6),

  (v_cis, 'CIS', 'Cybersecurity & Information Security',
   'Controls and responsibilities for protecting organisational information assets, systems, and networks from cyber threats.',
   '1.0', TRUE, FALSE, 7),

  (v_fpd, 'FPD', 'Fraud Prevention & Detection',
   'Frameworks for identifying, preventing, reporting, and responding to internal and external fraud across all business functions.',
   '1.0', TRUE, FALSE, 8)

ON CONFLICT (code) DO UPDATE SET
  title         = EXCLUDED.title,
  description   = EXCLUDED.description,
  is_dual_track = EXCLUDED.is_dual_track,
  display_order = EXCLUDED.display_order,
  updated_at    = NOW();

-- =============================================================================
-- 2. INSERT SUB_HEADINGS (10 per policy = 80 total)
-- =============================================================================

INSERT INTO sub_headings
  (id, policy_id, code, title, description, display_order, is_active)
VALUES

  -- ── COC: Code of Conduct (10) ───────────────────────────────────────────────
  (gen_random_uuid(), v_coc, 'COC-01', 'Professional Standards',
   'Expected levels of professionalism, competence, and accountability in all work activities.', 1, TRUE),

  (gen_random_uuid(), v_coc, 'COC-02', 'Workplace Behaviour',
   'Rules governing day-to-day conduct in the workplace including punctuality, communication, and team interactions.', 2, TRUE),

  (gen_random_uuid(), v_coc, 'COC-03', 'Respect and Dignity',
   'Zero-tolerance stance on harassment, bullying, discrimination, and any behaviour that undermines dignity.', 3, TRUE),

  (gen_random_uuid(), v_coc, 'COC-04', 'Use of Company Resources',
   'Acceptable and prohibited uses of organisational assets including equipment, systems, and funds.', 4, TRUE),

  (gen_random_uuid(), v_coc, 'COC-05', 'Gifts, Entertainment and Hospitality',
   'Thresholds, approval requirements, and prohibitions relating to giving and receiving gifts or entertainment.', 5, TRUE),

  (gen_random_uuid(), v_coc, 'COC-06', 'Social Media and Public Communications',
   'Guidelines for employee use of social media and public-facing communications in a professional context.', 6, TRUE),

  (gen_random_uuid(), v_coc, 'COC-07', 'Confidentiality and Information Handling',
   'Obligations to protect confidential business, client, and employee information from unauthorised disclosure.', 7, TRUE),

  (gen_random_uuid(), v_coc, 'COC-08', 'Whistleblowing and Speak-Up',
   'Protected channels and procedures for reporting suspected misconduct, fraud, or policy violations.', 8, TRUE),

  (gen_random_uuid(), v_coc, 'COC-09', 'Disciplinary Procedures',
   'Progressive disciplinary framework applied when conduct or performance standards are not met.', 9, TRUE),

  (gen_random_uuid(), v_coc, 'COC-10', 'Ethics and Integrity',
   'Core ethical principles underpinning all business decisions, relationships, and actions.', 10, TRUE),

  -- ── COI: Conflict of Interest (10) ─────────────────────────────────────────
  (gen_random_uuid(), v_coi, 'COI-01', 'Definition and Scope',
   'What constitutes a conflict of interest and to whom this policy applies.', 1, TRUE),

  (gen_random_uuid(), v_coi, 'COI-02', 'Personal and Family Relationships',
   'Managing situations where personal or family relationships may influence business decisions.', 2, TRUE),

  (gen_random_uuid(), v_coi, 'COI-03', 'Outside Employment and Directorships',
   'Rules around taking secondary employment, board seats, or advisory roles outside the organisation.', 3, TRUE),

  (gen_random_uuid(), v_coi, 'COI-04', 'Financial Interests',
   'Disclosure requirements for personal financial interests in entities that do or seek business with the organisation.', 4, TRUE),

  (gen_random_uuid(), v_coi, 'COI-05', 'Client and Counterparty Relationships',
   'Managing dual roles or prior relationships with clients that could compromise objectivity.', 5, TRUE),

  (gen_random_uuid(), v_coi, 'COI-06', 'Vendor and Supplier Relations',
   'Standards for fair procurement and the management of conflicts arising in vendor selection.', 6, TRUE),

  (gen_random_uuid(), v_coi, 'COI-07', 'Gifts and Corporate Hospitality',
   'How gifts and entertainment from third parties create or signal conflicts and required disclosures.', 7, TRUE),

  (gen_random_uuid(), v_coi, 'COI-08', 'Disclosure and Approval Process',
   'Step-by-step process for declaring a potential conflict and obtaining management sign-off.', 8, TRUE),

  (gen_random_uuid(), v_coi, 'COI-09', 'Managing and Mitigating Conflicts',
   'Controls applied once a conflict is identified — recusal, information barriers, or divestment.', 9, TRUE),

  (gen_random_uuid(), v_coi, 'COI-10', 'Annual Certification and Monitoring',
   'Requirements for periodic employee self-certification and management review of conflict disclosures.', 10, TRUE),

  -- ── PIT: Prevention of Insider Trading (10) ────────────────────────────────
  (gen_random_uuid(), v_pit, 'PIT-01', 'Definition of Insider Information',
   'What constitutes material non-public information (MNPI) and how it is recognised.', 1, TRUE),

  (gen_random_uuid(), v_pit, 'PIT-02', 'Prohibited Trading Activities',
   'Specific trading actions that are forbidden when an employee is in possession of MNPI.', 2, TRUE),

  (gen_random_uuid(), v_pit, 'PIT-03', 'Trading Windows and Blackout Periods',
   'Defined open and closed periods for personal dealing in securities of the organisation or related entities.', 3, TRUE),

  (gen_random_uuid(), v_pit, 'PIT-04', 'Pre-Clearance Procedures',
   'Mandatory approval steps employees must complete before executing any personal securities transactions.', 4, TRUE),

  (gen_random_uuid(), v_pit, 'PIT-05', 'Tipping and Tippee Liability',
   'Prohibition on sharing MNPI with third parties and liability implications for both tipper and tippee.', 5, TRUE),

  (gen_random_uuid(), v_pit, 'PIT-06', 'Personal Account Dealing',
   'Requirements for disclosing, monitoring, and restricting trades in personal investment accounts.', 6, TRUE),

  (gen_random_uuid(), v_pit, 'PIT-07', 'Information Barriers (Chinese Walls)',
   'Structural and procedural controls used to prevent MNPI from flowing between business units.', 7, TRUE),

  (gen_random_uuid(), v_pit, 'PIT-08', 'Reporting Obligations',
   'Requirements to report suspected insider trading — internally and to regulatory authorities.', 8, TRUE),

  (gen_random_uuid(), v_pit, 'PIT-09', 'Penalties and Regulatory Consequences',
   'Civil, criminal, and regulatory sanctions applicable for breaches of insider trading rules.', 9, TRUE),

  (gen_random_uuid(), v_pit, 'PIT-10', 'Record Keeping and Surveillance',
   'Obligations to maintain trading records and submission to ongoing surveillance programmes.', 10, TRUE),

  -- ── AML: Anti-Money Laundering (10) ────────────────────────────────────────
  (gen_random_uuid(), v_aml, 'AML-01', 'Introduction to Money Laundering',
   'Definition, mechanics, and societal harm caused by money laundering and terrorist financing.', 1, TRUE),

  (gen_random_uuid(), v_aml, 'AML-02', 'Three Stages of Money Laundering',
   'Placement, layering, and integration: how illicit funds are moved through the financial system.', 2, TRUE),

  (gen_random_uuid(), v_aml, 'AML-03', 'Customer Due Diligence (CDD)',
   'Standard identity verification and risk assessment procedures applied to all customers.', 3, TRUE),

  (gen_random_uuid(), v_aml, 'AML-04', 'Enhanced Due Diligence (EDD)',
   'Heightened scrutiny applied to high-risk customers, PEPs, and complex ownership structures.', 4, TRUE),

  (gen_random_uuid(), v_aml, 'AML-05', 'Suspicious Activity Reporting (SAR)',
   'Obligations and procedures for filing Suspicious Activity Reports with the relevant authority.', 5, TRUE),

  (gen_random_uuid(), v_aml, 'AML-06', 'Transaction Monitoring',
   'Systems and thresholds used to flag unusual or high-risk transaction patterns for review.', 6, TRUE),

  (gen_random_uuid(), v_aml, 'AML-07', 'Sanctions and Embargo Screening',
   'Screening obligations against OFAC, UN, EU, and domestic sanctions lists.', 7, TRUE),

  (gen_random_uuid(), v_aml, 'AML-08', 'Record Keeping Requirements',
   'Minimum retention periods and formats for AML-related customer and transaction records.', 8, TRUE),

  (gen_random_uuid(), v_aml, 'AML-09', 'Regulatory Framework and Legislation',
   'Key laws and regulations governing AML obligations including FATF recommendations.', 9, TRUE),

  (gen_random_uuid(), v_aml, 'AML-10', 'Penalties for Non-Compliance',
   'Regulatory, financial, and reputational consequences of AML failures for individuals and institutions.', 10, TRUE),

  -- ── KYC: Know Your Customer (10) ───────────────────────────────────────────
  (gen_random_uuid(), v_kyc, 'KYC-01', 'KYC Overview and Purpose',
   'Why KYC exists, its role in AML compliance, and the obligations it places on staff.', 1, TRUE),

  (gen_random_uuid(), v_kyc, 'KYC-02', 'Customer Identification Programme (CIP)',
   'Minimum information and documents required to establish and verify a customer''s identity.', 2, TRUE),

  (gen_random_uuid(), v_kyc, 'KYC-03', 'Beneficial Ownership',
   'Requirements to identify and verify the ultimate beneficial owners of legal entities.', 3, TRUE),

  (gen_random_uuid(), v_kyc, 'KYC-04', 'Risk-Based Approach',
   'Calibrating KYC intensity to the assessed money laundering and terrorist financing risk of a customer.', 4, TRUE),

  (gen_random_uuid(), v_kyc, 'KYC-05', 'Politically Exposed Persons (PEPs)',
   'Identification of PEPs, their associates, and the enhanced measures required for this category.', 5, TRUE),

  (gen_random_uuid(), v_kyc, 'KYC-06', 'Non-Face-to-Face Customers',
   'Additional verification measures when customers are onboarded remotely or digitally.', 6, TRUE),

  (gen_random_uuid(), v_kyc, 'KYC-07', 'Ongoing Customer Monitoring',
   'Periodic review obligations to keep customer information current and detect changed risk profiles.', 7, TRUE),

  (gen_random_uuid(), v_kyc, 'KYC-08', 'KYC Refresh and Re-verification',
   'Triggers and timelines for refreshing KYC data including significant life events and risk changes.', 8, TRUE),

  (gen_random_uuid(), v_kyc, 'KYC-09', 'Correspondent Banking and Third-Party Reliance',
   'Rules for placing reliance on third parties for KYC and managing correspondent banking risk.', 9, TRUE),

  (gen_random_uuid(), v_kyc, 'KYC-10', 'KYC Failure Consequences',
   'Regulatory sanctions, reputational risk, and internal consequences of inadequate KYC controls.', 10, TRUE),

  -- ── DPP: Data Protection & Privacy (10) ────────────────────────────────────
  (gen_random_uuid(), v_dpp, 'DPP-01', 'Data Protection Principles',
   'Core principles of lawfulness, fairness, transparency, purpose limitation, and data minimisation.', 1, TRUE),

  (gen_random_uuid(), v_dpp, 'DPP-02', 'Lawful Basis for Processing',
   'The six lawful bases under data protection law and when each applies.', 2, TRUE),

  (gen_random_uuid(), v_dpp, 'DPP-03', 'Data Subject Rights',
   'Rights of individuals including access, rectification, erasure, portability, and objection.', 3, TRUE),

  (gen_random_uuid(), v_dpp, 'DPP-04', 'Consent Management',
   'Requirements for obtaining, recording, and withdrawing valid data processing consent.', 4, TRUE),

  (gen_random_uuid(), v_dpp, 'DPP-05', 'Data Retention and Disposal',
   'Schedules for retaining personal data and secure methods for its deletion or anonymisation.', 5, TRUE),

  (gen_random_uuid(), v_dpp, 'DPP-06', 'Personal Data Breach Notification',
   'Detection, containment, assessment, and notification obligations when a data breach occurs.', 6, TRUE),

  (gen_random_uuid(), v_dpp, 'DPP-07', 'Cross-Border Data Transfers',
   'Mechanisms and safeguards required when transferring personal data outside the home jurisdiction.', 7, TRUE),

  (gen_random_uuid(), v_dpp, 'DPP-08', 'Privacy by Design and Default',
   'Embedding data protection considerations into systems, processes, and products from the outset.', 8, TRUE),

  (gen_random_uuid(), v_dpp, 'DPP-09', 'Third-Party Data Processors',
   'Contractual and oversight obligations when personal data is processed by vendors or partners.', 9, TRUE),

  (gen_random_uuid(), v_dpp, 'DPP-10', 'Employee Data Handling',
   'Rules governing how employee personal data is collected, used, stored, and shared internally.', 10, TRUE),

  -- ── CIS: Cybersecurity & Information Security (10) ─────────────────────────
  (gen_random_uuid(), v_cis, 'CIS-01', 'Information Classification',
   'Framework for classifying data by sensitivity and applying appropriate handling controls.', 1, TRUE),

  (gen_random_uuid(), v_cis, 'CIS-02', 'Access Control and Password Management',
   'Principles of least privilege, multi-factor authentication, and strong password practices.', 2, TRUE),

  (gen_random_uuid(), v_cis, 'CIS-03', 'Email and Internet Acceptable Use',
   'Permitted and prohibited uses of corporate email, internet, and collaboration tools.', 3, TRUE),

  (gen_random_uuid(), v_cis, 'CIS-04', 'Device and Endpoint Security',
   'Security requirements for laptops, mobile devices, and removable media.', 4, TRUE),

  (gen_random_uuid(), v_cis, 'CIS-05', 'Phishing and Social Engineering',
   'Recognition and response to phishing emails, vishing calls, and social engineering attacks.', 5, TRUE),

  (gen_random_uuid(), v_cis, 'CIS-06', 'Security Incident Response',
   'Procedures for reporting, escalating, and recovering from cybersecurity incidents.', 6, TRUE),

  (gen_random_uuid(), v_cis, 'CIS-07', 'Data Backup and Business Continuity',
   'Requirements for regular data backups, testing, and recovery time objectives.', 7, TRUE),

  (gen_random_uuid(), v_cis, 'CIS-08', 'Remote and Hybrid Working Security',
   'Controls for securing corporate access and data when working outside the office.', 8, TRUE),

  (gen_random_uuid(), v_cis, 'CIS-09', 'Software, Patch and Vulnerability Management',
   'Obligations to maintain up-to-date software and remediate known vulnerabilities promptly.', 9, TRUE),

  (gen_random_uuid(), v_cis, 'CIS-10', 'Third-Party and Supply Chain Security',
   'Due diligence and ongoing monitoring requirements for technology vendors and suppliers.', 10, TRUE),

  -- ── FPD: Fraud Prevention & Detection (10) ─────────────────────────────────
  (gen_random_uuid(), v_fpd, 'FPD-01', 'Types and Categories of Fraud',
   'Taxonomy of fraud including internal, external, cyber, payment, and identity fraud.', 1, TRUE),

  (gen_random_uuid(), v_fpd, 'FPD-02', 'Internal Fraud Indicators',
   'Behavioural and transactional red flags that may indicate employee fraud or collusion.', 2, TRUE),

  (gen_random_uuid(), v_fpd, 'FPD-03', 'External Fraud Prevention',
   'Controls to defend against fraud perpetrated by customers, third parties, or criminal organisations.', 3, TRUE),

  (gen_random_uuid(), v_fpd, 'FPD-04', 'Transaction Monitoring and Fraud Alerts',
   'Rule-based and ML-driven systems used to detect anomalous transactions in real time.', 4, TRUE),

  (gen_random_uuid(), v_fpd, 'FPD-05', 'Fraud Reporting Procedures',
   'Internal and external escalation paths when fraud is suspected or confirmed.', 5, TRUE),

  (gen_random_uuid(), v_fpd, 'FPD-06', 'Card and Payment Fraud',
   'Prevention and detection of card-present, card-not-present, and authorised push payment fraud.', 6, TRUE),

  (gen_random_uuid(), v_fpd, 'FPD-07', 'Identity Theft and Impersonation',
   'Controls to verify identity and detect synthetic or stolen identity fraud.', 7, TRUE),

  (gen_random_uuid(), v_fpd, 'FPD-08', 'Cyber-Enabled Fraud',
   'Fraud typologies exploiting digital channels including account takeover and social engineering.', 8, TRUE),

  (gen_random_uuid(), v_fpd, 'FPD-09', 'Fraud Investigation Process',
   'Structured process for gathering evidence, conducting interviews, and escalating findings.', 9, TRUE),

  (gen_random_uuid(), v_fpd, 'FPD-10', 'Recovery, Remediation and Lessons Learned',
   'Post-fraud response including asset recovery, victim support, and control enhancements.', 10, TRUE)

ON CONFLICT (policy_id, code) DO UPDATE SET
  title         = EXCLUDED.title,
  description   = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  updated_at    = NOW();

END $$;

-- =============================================================================
-- VERIFY COUNTS
-- =============================================================================

DO $$
DECLARE
  v_policy_count     INT;
  v_subheading_count INT;
  v_dual_track_count INT;
BEGIN
  SELECT COUNT(*) INTO v_policy_count     FROM policies;
  SELECT COUNT(*) INTO v_subheading_count FROM sub_headings;
  SELECT COUNT(*) INTO v_dual_track_count FROM policies WHERE is_dual_track = TRUE;

  RAISE NOTICE '─────────────────────────────────────────';
  RAISE NOTICE 'Seed verification:';
  RAISE NOTICE '  Policies inserted   : %', v_policy_count;
  RAISE NOTICE '  Sub-headings inserted: %', v_subheading_count;
  RAISE NOTICE '  Dual-track policies : %', v_dual_track_count;

  IF v_policy_count < 8 THEN
    RAISE EXCEPTION 'Expected 8 policies, found %', v_policy_count;
  END IF;
  IF v_subheading_count < 80 THEN
    RAISE EXCEPTION 'Expected 80 sub_headings, found %', v_subheading_count;
  END IF;
  IF v_dual_track_count <> 3 THEN
    RAISE EXCEPTION 'Expected 3 dual-track policies, found %', v_dual_track_count;
  END IF;

  RAISE NOTICE 'All seed assertions passed.';
  RAISE NOTICE '─────────────────────────────────────────';
END $$;

-- =============================================================================
-- END OF SEED: policies.sql
-- =============================================================================
