/** Public notices describe released free-course capabilities. Versioned alongside recorded agreements. */
export const policies: Record<
  string,
  { title: string; intro: string; sections: { title: string; body: string }[] }
> = {
  terms: {
    title: 'Terms of Service',
    intro:
      'These terms cover the current SkillVerse free-course learning service. Creating an account requires explicit acceptance of these terms, the Community Guidelines and the Privacy Notice.',
    sections: [
      {
        title: 'Who may use SkillVerse',
        body: 'Learning accounts start at age 10. Teaching starts at 16. Anyone under 18 needs a parent or legal guardian aged 18+ to verify their identity through Setu DigiLocker and authorize the account before it is created. Teaching permission for ages 16–17 must explicitly include teaching. Provide an accurate private birth date. Staff accounts must be adults.',
      },
      {
        title: 'Accounts and access',
        body: 'Verify your email, protect your password and security codes, and keep your account details accurate. Choose a display alias if you prefer. You are responsible for your own account use. Do not share access, impersonate others or circumvent access controls. Guardian permission can be withdrawn immediately, which signs linked children out and blocks further learning and teaching until permission is restored.',
      },
      {
        title: 'Courses and completion',
        body: 'Free enrollment grants personal access to a published course. Existing enrolled learners keep access when an instructor archives a course or deletes their account, unless the material is taken down for safety or rights concerns. Courses may change through review. Completion certificates record learning completion; they are not degrees, professional licenses, guaranteed employment or externally accredited qualifications. Sharing a certificate link makes its displayed details public.',
      },
      {
        title: 'Content permissions',
        body: 'You keep ownership of your original work. When you publish a course, you grant SkillVerse permission to host, display and deliver it to enrolled learners, including continuing their access after publication withdrawal or account deletion. You must own or have permission for material you submit. The Instructor Terms explain course review and withdrawal. Course discussions are visible to course participants; private notes and support messages are not public.',
      },
      {
        title: 'Conduct and service availability',
        body: 'Follow the Community Guidelines. We may restrict accounts or take down material for abuse, unsafe content, rights violations or security reasons. You can raise a private grievance through Contact. We aim to provide a useful service, but do not promise uninterrupted availability, particular learning outcomes or third-party video availability. Nothing in these terms removes rights that applicable law requires us to preserve.',
      },
      {
        title: 'Current scope and changes',
        body: 'Paid checkout, subscriptions, mentor bookings, skill swaps, payouts, affiliate earnings and AI features are planned and are not enabled. Future paid features will require separate pricing, cancellation and payment disclosures. Material policy changes will receive a new version and require renewed agreement where appropriate. Use Contact for account or policy questions.',
      },
    ],
  },
  privacy: {
    title: 'Privacy Notice',
    intro:
      'SkillVerse uses account information to provide learning, teaching, security and private support. This notice describes the current service and the controls available in Settings > Privacy.',
    sections: [
      {
        title: 'Information we use and why',
        body: 'We store your email, username, display name, password hash or linked sign-in method, private birth date, versioned agreements, profile preferences, device sessions, and learning records. Learning records include enrollments, progress, quiz attempts, notes, reviews and completion credentials. Teaching records include your application, submitted courses and review history. We use these to authenticate you, enforce age and consent rules, deliver courses, record progress and respond to support requests.',
      },
      {
        title: 'Children and guardian permission',
        body: 'For ages 10–17, a verified adult guardian must authorize learning before child identity is collected for account creation. Teaching at 16–17 needs explicit teaching permission. A guardian creates a single-use code tied to the child email and private birth date. The guardian can withdraw permission in their account; this blocks further learning or teaching and signs the child out. At 18 the account can independently accept current agreements. External video embeds and public profile biography, location and website fields are unavailable for accounts under 18. Use an alias and avoid sharing private information in course discussions.',
      },
      {
        title: 'Identity verification',
        body: 'Setu DigiLocker verifies adult guardians and teachers aged 16+. After your explicit consent, our server checks the provider result, document signature result, age, private birth date and legal name. We retain a request identifier and verification receipt, not your Aadhaar number, document, XML, photo, address or legal name. We revoke provider access after the check and retry failed revocations. Guardian relationship is a separate declaration; DigiLocker identity verification does not prove that relationship. Teacher identity receipts expire after 180 days. Setu and DigiLocker process identity information under their own notices during this flow.',
      },
      {
        title: 'Who can see information',
        body: 'Your display alias, public instructor profile, published courses and visible reviews may be public. Course Q&A is available to permitted course participants. Your learning records, notes, settings and private support history are available to you. Authorized staff can review applications, reported content and verified private support requests when needed for those tasks. Other learners cannot read your private records. We do not sell personal data or enable advertising trackers in the current service.',
      },
      {
        title: 'Service providers and external video',
        body: 'Cloudflare processes backend requests and database records; Vercel may host and render the frontend; Resend delivers transactional email; Google handles optional sign-in; Cloudflare Turnstile checks configured forms for bots. These providers may process information in locations outside your country. YouTube and Vimeo receive browser and network details if you allow embeds on an adult account or follow an external link. Embeds are off by default and consent can be withdrawn in Privacy settings. Third-party links have their own privacy terms.',
      },
      {
        title: 'Retention and deletion',
        body: 'Account and learning information stays while needed for the active account. Confirming deletion with fresh security proof immediately signs out all devices, anonymizes identity, removes private learning records and your certificates, erases your authored Q&A text, withdraws your courses from public discovery and erases your private support text. Licensed course material remains for existing enrolled learners, along with limited pseudonymous security and review records needed for integrity, abuse investigation or legal obligations. Other people’s learning records and certificates remain; deleted instructors are displayed as Former member. Unconfirmed Contact requests expire after 72 hours; resolved support threads are removed after 90 days. Private exports expire after 24 hours and are removed by scheduled maintenance. Expired invitation details are also removed. Infrastructure backups and provider retention follow those providers’ controls; copies are not promised to disappear instantly.',
      },
      {
        title: 'Your choices and requests',
        body: 'Use Privacy settings to download your own data, manage external video consent or delete your account. Exports are private, capped at 20 MB, built in pages and captured while the job runs; use Contact for a larger securely delivered copy. A fresh security check unlocks downloading for ten minutes. Staff must have their staff roles independently revoked before deleting their account. Use private Contact for verified birth date corrections, guardian assistance, privacy questions, grievances or deletion requests you cannot complete while signed in. We verify ownership and authority before acting on someone else’s information. Do not send identity documents or passwords in Contact.',
      },
    ],
  },
  cookies: {
    title: 'Cookies and browser storage',
    intro:
      'The current service uses necessary account and interface storage. No advertising or analytics cookies are enabled.',
    sections: [
      {
        title: 'Necessary storage',
        body: 'An HttpOnly session cookie keeps you signed in and expires under the session’s idle and absolute limits. A short-lived Google state cookie protects optional sign-in against request forgery; registration agreement details inside it are encrypted. Interface storage remembers choices such as your theme. Signing out clears the session cookie and revokes the current server session. You may clear browser storage yourself, but this can sign you out or reset preferences.',
      },
      {
        title: 'Third-party services',
        body: 'Configured Turnstile forms may contact Cloudflare for bot verification. Setu DigiLocker and Google use their own storage on their sign-in pages. YouTube and Vimeo embeds load only with an eligible adult account’s explicit video preference; an external link opens the provider separately. Withdraw embed permission in Settings > Privacy. Future optional analytics or advertising require a separate consent implementation before activation.',
      },
    ],
  },
  'community-guidelines': {
    title: 'Community Guidelines',
    intro: 'Keep learning spaces safe and useful for learners from age 10 onward.',
    sections: [
      {
        title: 'Respect and safety',
        body: 'Be respectful. Do not harass, threaten, bully, discriminate, sexually target anyone, exploit children or solicit private meetings or sensitive identity information from minors. Do not post graphic violence, sexual content, illegal instructions, dangerous challenges, self-harm encouragement or material that violates another person’s rights. Do not share private addresses, phone numbers, identity documents, passwords or security codes.',
      },
      {
        title: 'Useful learning conversations',
        body: 'Ask course-related questions, explain answers constructively and credit sources. Avoid spam, deceptive claims, impersonation, scams, malicious links and copyrighted material you cannot share. Do not manipulate reviews, enrollments, quiz attempts or completion credentials. Certificates describe course completion, not professional qualifications.',
      },
      {
        title: 'Reports and grievances',
        body: 'Use the report action on course content or private Contact for a safety concern or grievance. Reporters’ identities are not disclosed to the reported person or instructor. Staff review reports and may hide content, restrict accounts or take down courses. You can request a private review through Contact with the relevant reference. Contact is not an emergency response service.',
      },
    ],
  },
  'instructor-terms': {
    title: 'Instructor Terms',
    intro: 'These terms apply to publishing free courses in the current SkillVerse service.',
    sections: [
      {
        title: 'Eligibility and review',
        body: 'Teaching starts at 16. Teachers under 18 require a verified guardian’s explicit teaching permission. Accept these terms and verify your own identity through Setu DigiLocker before applying. Verification lasts 180 days; renew it to continue teaching. Staff separately assess your application and review each course before publication. Rejected drafts can be improved and submitted again. Published revisions require review before replacing the live curriculum.',
      },
      {
        title: 'Your material and responsibilities',
        body: 'Create accurate, safe learning material and own or obtain the rights needed for every article, image, quiz and linked video. Do not expose learner or child personal information, fabricate credentials, promise guaranteed income or publish unsafe content. Use a public alias if preferred; verification legal names stay private. YouTube and Vimeo videos depend on those providers’ availability and terms. Direct video uploads and monetized teaching are not enabled.',
      },
      {
        title: 'License and withdrawal',
        body: 'You keep ownership of your original content and grant SkillVerse permission to host, reproduce and deliver it to enrolled learners. Archiving your course or deleting your account removes new public discovery and enrollment, while retaining access for existing learners. A safety or rights takedown can restrict that access. Deletion anonymizes your account and erases your Q&A text but retains licensed course material and limited review records. Contact staff for a rights or safety concern requiring a takedown.',
      },
      {
        title: 'Payments and future features',
        body: 'Paid checkout, subscriptions, revenue splits, payouts and referral earnings are planned. Publishing a free course does not create an entitlement to payment. Any future monetization will need separate accepted commercial terms, tax and verification requirements, pricing and refund rules before it is enabled.',
      },
    ],
  },
  refunds: {
    title: 'Refund and cancellation policy',
    intro:
      'Only free enrollment is available. SkillVerse does not currently collect course purchases, subscription payments or mentor booking payments.',
    sections: [
      {
        title: 'Current free service',
        body: 'There is no charge to refund for a free course enrollment. You may stop learning at any time. Account deletion removes your own enrollment, progress and completion credentials. Archiving a course generally preserves access for enrolled learners, while a safety or rights takedown may remove it. Use Contact for an access issue or grievance.',
      },
      {
        title: 'Future paid services',
        body: 'Paid checkout, subscriptions and bookings are planned and are not active. This policy does not promise refund periods, cancellation fees, revenue splits or payout schedules for services that are not enabled. Applicable pricing, cancellation and refund rules will be published and accepted before any payment feature launches.',
      },
    ],
  },
};
