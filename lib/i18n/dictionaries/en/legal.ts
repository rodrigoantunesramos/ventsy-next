// Tradução de REFERÊNCIA. A versão PT (pt/legal.ts) é a juridicamente vinculante;
// o `avisoTraducao` abaixo é exibido ao usuário nas páginas EN/ES.
// Namespace `legal` — English. Typed by `T` (from pt/legal) for key parity.
import type { T } from '../pt/legal'

const legal: T = {
  avisoTraducao:
    'This is a reference translation provided for convenience. The legally binding version is the Portuguese one.',
  termos: {
    meta: {
      title: 'Terms of Use',
      description: 'Rules and conditions for using the VENTSY platform.',
    },
    heroTag: 'Legal documents',
    heroTitulo: 'Terms of Use',
    heroSub: 'Rules and conditions for using the VENTSY platform.',
    atualizadoLabel: 'Last updated:',
    atualizadoData: 'January 2026',
    alerta:
      'By creating an account or using the VENTSY platform, you declare that you have read, understood and agreed to all the terms below. If you do not agree, do not use the service.',
    indiceTitulo: 'Contents',
    indice: [
      'Definitions',
      'Acceptance of terms',
      'Registration and account',
      'Use of the platform',
      'Rules for owners',
      'Rules for renters',
      'Payments and fees',
      'Cancellations and refunds',
      'Reviews and content',
      'Liability and limitations',
      'Intellectual property',
      'Suspension and termination',
      'General provisions',
    ],
    s1: {
      titulo: 'Definitions',
      intro: 'For the purposes of these Terms of Use, the following definitions apply:',
      itensTitulo: [
        'VENTSY:',
        'User:',
        'Owner:',
        'Renter:',
        'Venue:',
        'Booking:',
      ],
      itensTexto: [
        'a digital marketplace platform for renting event venues.',
        'any individual or legal entity that accesses or uses the platform.',
        'a user who lists and makes a venue available for rent.',
        'a user who searches for and books venues through the platform.',
        'a property or location made available by the Owner for events.',
        'confirmation of the use of a Venue on an agreed date and under agreed conditions.',
      ],
    },
    s2: {
      titulo: 'Acceptance of terms',
      p1a: 'By accessing, creating an account or using any feature of VENTSY, the User agrees to these Terms of Use and to the ',
      p1Link: 'Privacy Policy',
      p1b: '.',
      p2: 'These terms may be updated periodically. Continued use of the platform after notification of changes implies acceptance of the new conditions.',
    },
    s3: {
      titulo: 'Registration and account',
      intro:
        'To use the platform’s full features, you must create an account. When registering, the User declares that:',
      itens: [
        'They are at least 18 years old or have legal authorization from a guardian.',
        'They have provided truthful, accurate and up-to-date information.',
        'They are responsible for keeping their password confidential.',
        'They will immediately notify VENTSY of any unauthorized use of their account.',
      ],
      destaque:
        'VENTSY reserves the right to refuse or cancel registrations that violate these terms or that contain false information.',
    },
    s4: {
      titulo: 'Use of the platform',
      intro:
        'The User undertakes to use the platform in a lawful and ethical manner. The following is expressly prohibited:',
      itens: [
        'Publishing false, misleading, defamatory or illegal content.',
        'Carrying out financial transactions outside the platform in order to circumvent fees.',
        'Using the platform for spam, fraud or phishing purposes.',
        'Attempting to access restricted areas or VENTSY systems without authorization.',
        'Reproducing, copying or distributing platform content without express permission.',
        'Interfering with the technical operation of the platform or its servers.',
      ],
    },
    s5: {
      titulo: 'Rules for owners',
      intro: 'When listing a venue on VENTSY, the Owner declares and warrants that:',
      itens: [
        'They have legal authorization to make the venue available for rent.',
        'The venue’s information, photos and descriptions are truthful and up to date.',
        'The venue is in adequate condition of use, hygiene and safety.',
        'They hold all licenses and permits required to host events at the location.',
        'They will honor confirmed bookings under the advertised terms.',
        'They will give at least 48 hours’ notice of any inability to fulfill a booking.',
      ],
      fim: 'VENTSY is not liable for legal irregularities of listed venues, which are the sole responsibility of the Owner.',
    },
    s6: {
      titulo: 'Rules for renters',
      intro: 'When making a booking, the Renter undertakes to:',
      itens: [
        'Use the venue exclusively for the event declared at the time of booking.',
        'Respect the maximum capacity of people stated by the Owner.',
        'Return the venue in the same condition in which it was received.',
        'Comply with the agreed entry and exit times.',
        'Be liable for any damage caused to the venue during the event.',
        'Comply with conduct rules, neighborhood standards and local legislation.',
      ],
    },
    s7: {
      titulo: 'Payments and fees',
      p1a: 'Payments made through the platform are processed by certified partners. VENTSY charges a ',
      p1Strong: 'service fee',
      p1b: ' on each completed transaction, the amount of which is disclosed before the booking is confirmed.',
      itens: [
        'The prices displayed are the responsibility of the Owners and may be changed at any time for new bookings.',
        'Bookings already confirmed have their amount guaranteed as agreed.',
        'Any bank or currency-exchange fees that may apply are the responsibility of the User.',
      ],
      fim: 'Paid listing plans (Basic, Pro, Ultra) are billed monthly and renewed automatically unless cancelled by the Owner at least 48 hours before the due date.',
    },
    s8: {
      titulo: 'Cancellations and refunds',
      intro:
        'The cancellation policy for each venue is set by the Owner and displayed on the listing page. As a general rule:',
      itensTitulo: [
        'Cancellation by the Renter more than 30 days in advance:',
        'Cancellation between 15 and 30 days:',
        'Cancellation less than 15 days in advance:',
        'Cancellation by the Owner:',
      ],
      itensTexto: [
        'full refund.',
        'refund of 50% of the amount paid.',
        'no refund, except under the venue’s specific policy.',
        'full refund to the Renter.',
      ],
      destaque:
        'The VENTSY service fee is non-refundable in the event of cancellation by the Renter.',
    },
    s9: {
      titulo: 'Reviews and content',
      intro:
        'VENTSY allows Renters to publish reviews about venues after the event has taken place. By publishing a review, the User:',
      itens: [
        'Warrants that the content is truthful and based on a real experience.',
        'Grants VENTSY a non-exclusive license to display the content on the platform.',
        'Does not publish offensive or discriminatory content or content that infringes the rights of third parties.',
      ],
      p2: 'VENTSY reserves the right to remove reviews that violate these guidelines, without prior notice.',
      p3a: 'Only ',
      p3Strong: 'verified',
      p3b: ' reviews (linked to real completed bookings) are displayed publicly on venue pages.',
    },
    s10: {
      titulo: 'Liability and limitations',
      p1a: 'VENTSY acts as an intermediary between Owners and Renters, ',
      p1Strong: 'and is not a party to the rental contracts',
      p1b: '. Therefore:',
      itens: [
        'VENTSY is not liable for the quality, safety or legality of the listed venues.',
        'VENTSY is not liable for material, personal or financial damages occurring during events.',
        'VENTSY does not guarantee uninterrupted availability of the platform and is not liable for temporary technical failures.',
      ],
      fim: 'In no event shall VENTSY’s total liability exceed the amount of the service fee charged on the transaction related to the claim.',
    },
    s11: {
      titulo: 'Intellectual property',
      p1: 'All content on the VENTSY platform — including logos, text, design, source code and features — is protected by intellectual property rights and belongs to VENTSY or its licensors.',
      p2: 'The reproduction, modification or distribution of any element of the platform without prior and express written authorization is prohibited.',
      p3: 'By publishing photos or content on the platform, the User warrants that they hold the rights to such content and grants VENTSY a license to use it on the platform.',
    },
    s12: {
      titulo: 'Suspension and termination',
      intro:
        'VENTSY may suspend or terminate an account, at any time and without prior notice, in the following cases:',
      itens: [
        'Violation of any provision of these Terms of Use.',
        'Fraudulent behavior or behavior harmful to other users.',
        'Use of the platform for illegal purposes.',
        'Provision of false information in the registration or in listings.',
      ],
      fim: 'Termination of the account does not eliminate obligations already undertaken by the User in previously confirmed bookings.',
    },
    s13: {
      titulo: 'General provisions',
      p1: 'These Terms of Use are governed by the laws of the Federative Republic of Brazil. The courts of the judicial district of Rio de Janeiro — RJ are elected to settle any disputes, waiving any other, however privileged it may be.',
      p2: 'The eventual invalidity of any clause does not affect the validity of the remaining provisions of this instrument.',
      p3a: 'For questions or requests related to these terms, please contact: ',
    },
    contatoTitulo: 'Questions about the terms?',
    contatoSub: 'Our legal team is available to provide clarification.',
    contatoBtn: 'Contact us →',
  },
  privacidade: {
    meta: {
      title: 'Privacy Policy',
      description: 'How we collect, use and protect your information on the VENTSY platform.',
    },
    heroTag: 'Legal documents',
    heroTitulo: 'Privacy Policy',
    heroSub: 'How we collect, use and protect your information.',
    atualizadoLabel: 'Last updated:',
    atualizadoData: 'January 2026',
    indiceTitulo: 'Contents',
    indice: [
      'Who we are',
      'What data we collect',
      'How we use your data',
      'Data sharing',
      'Cookies and tracking',
      'Information security',
      'Your rights (LGPD)',
      'Data retention',
      'Minors',
      'Changes to this policy',
      'Contact',
    ],
    s1: {
      titulo: 'Who we are',
      p1Strong: 'VENTSY',
      p1a: '',
      p1b: ' is a digital platform that connects people looking for event venues with owners of locations available for rent. We operate as a marketplace and are committed to transparency in the processing of personal data.',
      p2a: 'This Privacy Policy applies to all users of the VENTSY platform, including visitors, renters and registered owners, under the terms of the ',
      p2Strong: 'Brazilian General Data Protection Law (Law No. 13,709/2018 — LGPD)',
      p2b: '.',
    },
    s2: {
      titulo: 'What data we collect',
      intro: 'We collect only the data necessary for the operation of the platform:',
      itensTitulo: [
        'Registration data:',
        'Usage data:',
        'Payment data:',
        'Venue data:',
        'Communications:',
      ],
      itensTexto: [
        'full name, taxpayer ID (CPF or CNPJ), date of birth, email address and phone number.',
        'IP address, browser type, pages visited, searches performed and interactions with the platform.',
        'transaction information processed by partner gateways. We do not store full credit card data.',
        'address, photos, descriptions and prices registered by owners.',
        'messages exchanged between users within the platform.',
      ],
    },
    s3: {
      titulo: 'How we use your data',
      intro: 'We use your information to:',
      itens: [
        'Create and manage your account on the platform.',
        'Process bookings and facilitate contact between renters and owners.',
        'Send confirmations, booking notifications and relevant communications.',
        'Continuously improve the venue search and recommendation experience.',
        'Comply with legal obligations and prevent fraud.',
        'Send marketing communications, only with your consent.',
      ],
      destaque:
        'We never sell your personal data to third parties. Your data is used exclusively for the purposes described in this policy.',
    },
    s4: {
      titulo: 'Data sharing',
      intro: 'Your data may be shared in the following situations:',
      itensTitulo: [
        'Between platform users:',
        'Payment partners:',
        'Infrastructure partners:',
        'Legal authorities:',
      ],
      itensTexto: [
        'name and contact information are shared between renter and owner upon confirming a booking.',
        'payment processors (such as Stripe or MercadoPago) receive the data needed to process transactions.',
        'cloud, hosting and database services that operate under confidentiality agreements.',
        'when required by law, court order or competent authority.',
      ],
    },
    s5: {
      titulo: 'Cookies and tracking',
      intro: 'We use cookies and similar technologies to:',
      itens: [
        'Keep your session active after login.',
        'Remember your search preferences.',
        'Analyze page performance and identify improvements.',
        'Display relevant content based on your browsing history.',
      ],
      fim: 'You can configure your browser to refuse cookies, but some platform features may be affected.',
    },
    s6: {
      titulo: 'Information security',
      intro:
        'We adopt technical and organizational measures to protect your data against unauthorized access, alteration, disclosure or destruction, including:',
      itens: [
        'Data transmission via the HTTPS protocol with TLS encryption.',
        'Secure storage of passwords using hashing and salting.',
        'Role-based access control (RBAC) for our team.',
        'Continuous monitoring of access and intrusion attempts.',
      ],
      fim: 'In the event of a security incident that may affect your data, we will notify you and the Brazilian National Data Protection Authority (ANPD) within the timeframes set by law.',
    },
    s7: {
      titulo: 'Your rights (LGPD)',
      intro: 'Under the LGPD, you have the right to:',
      itensTitulo: [
        'Access:',
        'Correction:',
        'Deletion:',
        'Portability:',
        'Withdrawal of consent:',
        'Objection:',
      ],
      itensTexto: [
        'request a copy of the personal data we process about you.',
        'update incomplete, inaccurate or outdated data.',
        'request the deletion of your data, except where there is a legal obligation to retain it.',
        'receive your data in a structured format for transfer to another service.',
        'withdraw consent for processing based on that legal basis.',
        'object to processing carried out on the basis of legitimate interest.',
      ],
      fimA: 'To exercise any of these rights, please contact us at ',
      fimB: '.',
    },
    s8: {
      titulo: 'Data retention',
      p1a: 'We keep your data for as long as necessary to fulfill the purposes described in this policy or as required by law. Financial transaction data is retained for ',
      p1Strong: '5 years',
      p1b: ', in accordance with tax requirements.',
      p2: 'After your account is closed, your data will be anonymized or deleted within 90 days, except for legal obligations that require retention for a longer period.',
    },
    s9: {
      titulo: 'Minors',
      p1a: 'The VENTSY platform is intended for people aged ',
      p1Strong: '18 or older',
      p1b: '. We do not intentionally collect data from minors. If we identify that a minor has registered without authorization, we will delete the data immediately.',
    },
    s10: {
      titulo: 'Changes to this policy',
      p1a: 'We may update this Privacy Policy periodically. When we make material changes, we will notify you by email or by a prominent notice on the platform at least ',
      p1Strong: '15 days in advance',
      p1b: '.',
      p2: 'Continued use of the platform after the changes take effect implies acceptance of the new policy.',
    },
    s11: {
      titulo: 'Contact',
      intro:
        'For questions, requests or to exercise your rights, please contact our Data Protection Officer (DPO):',
      emailLabel: 'Email:',
      atendimentoLabel: 'Service hours:',
      atendimentoValor: 'Monday to Friday, 9 a.m. to 6 p.m.',
      prazoLabel: 'Response time:',
      prazoValor: 'up to 15 business days',
    },
    contatoTitulo: 'Still have questions?',
    contatoSub: 'Our team is ready to help you with any privacy-related matter.',
    contatoBtn: 'Contact us →',
  },
}

export default legal
