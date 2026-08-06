/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Event, Student, Score, Notification, MessageToCoordinator, FacultyCoordinator, Occasion } from '../types';

export const INITIAL_OCCASIONS: Occasion[] = [
  {
    id: 'occ-fresherism-26',
    title: 'Fresherism-26',
    eventDates: 'AUG 3 – 15, 2026',
    fromDate: '2026-08-03',
    toDate: '2026-08-15',
    logoUrl: '/logo2.png',
    brochureUrl: '',
    description: 'Annual Flagship Cultural & Technical Talent Fest for Freshers at Garden City University.',
    chiefGuestName: 'Dr. N. C. Shivaprakash',
    chiefGuestPhotoUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=800',
    chiefGuestDescription: 'Former Professor, IISc Bangalore & Distinguished Academician',
    chiefGuestData: `Dr. N. C. Shivaprakash is a distinguished Indian academician, eminent scientist, and former Professor at the prestigious Indian Institute of Science (IISc), Bangalore. With over three decades of pioneering research in Instrumentation, Applied Physics, and Sensor Technology, he has published over 150 international research papers and guided scores of Ph.D. scholars.

A passionate visionary in higher education policy, Dr. Shivaprakash has served on national advisory committees, university executive councils, and NBA/NAAC accreditation boards across India. He is widely recognized for mentoring youth, fostering innovation ecosystems, and inspiring thousands of young engineers and scientists.

As Chief Guest of Honor for Fresherism '26, Dr. Shivaprakash presides over the inaugurals to inspire the incoming cohort of Garden City University students to strive for academic brilliance, leadership, and holistic growth.`,
    convenorName: 'Prof. Ashwini. S',
    convenorEmail: 'ashwini.s@gcu.edu.in',
    capLimit: 3,
    isOpenToExternal: true,
    isActive: true,
    isCompleted: false,
    masterStudents: []
  },
  {
    id: 'occ-gardenia-26',
    title: 'Gardenia-26',
    eventDates: 'SEP 10 – 18, 2026',
    fromDate: '2026-09-10',
    toDate: '2026-09-18',
    logoUrl: '/logo2.png',
    brochureUrl: '',
    description: 'Inter-University Cultural Extravaganza & Youth Festival.',
    chiefGuestName: 'Ms. Sridevi S',
    chiefGuestPhotoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400',
    chiefGuestDescription: 'Cultural Ambassador & Performing Artist',
    convenorName: 'Prof. Violet Goveas',
    convenorEmail: 'violet.goveas@gcu.edu.in',
    capLimit: 2,
    isOpenToExternal: true,
    isActive: false,
    isCompleted: false,
    masterStudents: []
  },
  {
    id: 'occ-independence-26',
    title: 'Independence Day Gala',
    eventDates: 'AUG 15, 2026',
    fromDate: '2026-08-15',
    toDate: '2026-08-15',
    logoUrl: '/logo2.png',
    brochureUrl: '',
    description: 'Patriotic Celebrations & Inter-Departmental Competitions.',
    chiefGuestName: 'Brigadier R. K. Singh (Retd.)',
    chiefGuestPhotoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400',
    chiefGuestDescription: 'Decorated Veteran & Defense Strategist',
    convenorName: 'Dr. John JP',
    convenorEmail: 'john.jp@gcu.edu.in',
    capLimit: 1,
    isOpenToExternal: false,
    isActive: false,
    isCompleted: false,
    masterStudents: []
  }
];

export const INITIAL_FACULTY_COORDINATORS: FacultyCoordinator[] = [
  {
    facultyId: 'FAC-RAJNI',
    name: 'Dr. Rajni',
    email: 'rajni@gcu.edu.in',
    mobile: '9035728702',
    department: 'School of Media & Performing Arts',
    school: 'Garden City University',
    isApproved: true,
    createdAt: new Date().toISOString(),
    isProfileComplete: true
  },
  {
    facultyId: 'FAC-PAKIARAJ',
    name: 'Prof. Pakiaraj',
    email: 'pakiaraj@gcu.edu.in',
    mobile: '6380359936',
    department: 'School of Media & Performing Arts',
    school: 'Garden City University',
    isApproved: true,
    createdAt: new Date().toISOString(),
    isProfileComplete: true
  },
  {
    facultyId: 'FAC-102',
    name: 'Prof. Kushal B. S.',
    email: 'kushal.bs@gcu.edu.in',
    mobile: '+91 95359 45757',
    department: 'IT Club',
    school: 'Garden City University',
    isApproved: true,
    createdAt: new Date().toISOString(),
    isProfileComplete: true
  }
];

export const INITIAL_EVENTS: Event[] = [
  {
    id: 'evt-freshathon-sprint',
    occasionId: 'occ-fresherism-26',
    title: 'Freshathon - Sprinting Towards Glory',
    description: `The Grand Finale Independence Day Mini-Marathon! Sprint towards glory, celebrate freedom, physical fitness, and collegiate sportsmanship. All participants earn 100 Points towards their GCU leaderboard ranking! Trophies and special certificates awarded to top sprinters.`,
    date: '2026-08-15',
    timeStart: '06:30',
    timeEnd: '09:30',
    venue: 'GCU Main Track & Sports Complex Ground',
    hostDepartment: 'Department of Physical Education & Sports / EOL Committee',
    coordinatorFacultyId: 'FAC-102',
    coordinatorName: 'Prof. Kushal B. S.',
    coordinatorMobile: '+91 95359 45757',
    coordinatorEmail: 'kushal.bs@gcu.edu.in',
    studentCoordinatorName: 'Sports Committee Coordinators',
    rules: `1. Open to all registered Garden City University students.
2. Reporting time: 06:00 AM at GCU Main Sports Ground.
3. Athletic attire and running shoes are mandatory.
4. Completing the mini-marathon awards 100 Points to your profile!
5. Refreshments & Medical Aid provided on track.`,
    imageUrl: 'https://images.unsplash.com/photo-1530541930197-ff16ac917b0e?auto=format&fit=crop&q=80&w=800',
    brochureUrl: 'https://images.unsplash.com/photo-1530541930197-ff16ac917b0e?auto=format&fit=crop&q=80&w=800',
    eventType: 'individual'
  },
  {
    id: 'evt-coral-tank',
    occasionId: 'occ-fresherism-26',
    title: 'Coral Tank — AI & Tech Ideathon',
    description: `An innovation pitch challenge where participants identify a real-world problem and propose creative, technology-driven solutions across healthcare, education, or smart cities. Freshers showcase visionary ideas and tech prototypes before an esteemed panel of judges.`,
    date: '2026-08-03',
    timeStart: '14:35',
    timeEnd: '16:30',
    venue: 'Room no 384',
    hostDepartment: 'IT Club',
    coordinatorFacultyId: 'FAC-102',
    coordinatorName: 'Prof. Kushal B. S.',
    coordinatorMobile: '+91 95359 45757',
    coordinatorEmail: 'kushal.bs@gcu.edu.in',
    studentCoordinatorName: 'Trisha P (24BCAR105) & Harsha Raj (24BSDC140)',
    rules: `1. Open to all registered GCU students.
2. Teams of 2-4 members or individual participation.
3. 2 minutes pitch + 1 min Q&A with judges.
4. Focus on feasibility, impact, and technology integration.`,
    imageUrl: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=800',
    brochureUrl: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=800',
    eventType: 'group'
  },
  {
    id: 'evt-bollywood-beats',
    occasionId: 'occ-fresherism-26',
    title: 'BOLLYWOOD BEATS',
    description: `Lights... Music... Action! 
Are you ready to set the stage on fire? Bollywood Beats is your chance to unleash your inner superstar and experience the magic of Bollywood like never before! Whether you're known for your killer dance moves or simply love grooving to your favourite Bollywood tracks, this is the perfect platform to shine.
Dance your heart out, showcase your unique style, and create unforgettable memories with your fellow freshers. It's not just a competition—it's a celebration of energy, confidence, creativity, and the vibrant spirit of college life. Feel the adrenaline, soak in the applause, and let every beat tell your story.
So, put on your dancing shoes, bring your best expressions, and get ready to own the stage. The spotlight is waiting for you!

Dance with passion. Perform with confidence. Become the next Bollywood Beat!`,
    date: '2026-08-05',
    timeStart: '10:00',
    timeEnd: '13:00',
    venue: 'Main Auditorium / Open Stage',
    hostDepartment: 'School of Media & Performing Arts',
    coordinatorFacultyId: 'FAC-RAJNI',
    coordinatorName: 'Dr. Rajni',
    coordinatorMobile: '9035728702',
    coordinatorEmail: 'rajni@gcu.edu.in',
    studentCoordinatorName: 'Geetanjali - 24BBAM113 (90357 28702), Deepika - 24BBAM104 (89512 85856)',
    rules: `1. Participation can be Individual or in groups.
2. Participants should report 30 minutes before the scheduled event.
3. Bollywood songs only are permitted.
4. Performance duration should not exceed 2-3 minutes.
5. Participants must maintain appropriate costumes`,
    imageUrl: 'https://images.unsplash.com/photo-1547153760-18fc86324498?auto=format&fit=crop&q=80&w=800',
    eventType: 'group'
  },
  {
    id: 'evt-contemporary-dance',
    occasionId: 'occ-fresherism-26',
    title: 'Contemporary Dance Competition',
    description: `Participants are invited to express the journey of life through powerful movement, emotion, and storytelling. Performances should creatively reflect growth, change, resilience, and renewal. Originality, artistic expression, and connection to the theme will be highly valued. Let your dance bring every season of life to the stage.`,
    date: '2026-08-06',
    timeStart: '10:00',
    timeEnd: '13:00',
    venue: 'Main Auditorium',
    hostDepartment: 'School of Media & Performing Arts',
    coordinatorFacultyId: 'FAC-PAKIARAJ',
    coordinatorName: 'Prof. Pakiaraj',
    coordinatorMobile: '6380359936',
    coordinatorEmail: 'pakiaraj@gcu.edu.in',
    studentCoordinatorName: '1. Om Prakash M. (BHM) 6380359936, 2. ROMELLA NICO WAGNER (BHM) 8825668018',
    rules: `1. Eligibility - Open to all Students of GCU - Solo, Duet, or Group (Maximum 8 members)
2. Dance Style - Contemporary Dance should be the primary style - Fusion with other styles is allowed if contemporary remains dominant.
3. Performance Guidelines - Time Limit: Minimum: 3 Minutes; Maximum: 5 Minutes. Music - Submit track in MP3 format before the deadline. Carry a backup copy (USB/Pen Drive/Mobile).
4. Costumes & Props - Theme-appropriate, Comfortable and performance-friendly, Handheld props allowed. Not Allowed – Fire, Water, Glass, Powder/Confetti, Hazardous materials`,
    imageUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&q=80&w=800',
    eventType: 'group'
  },
  {
    id: 'evt-reef-rumble',
    occasionId: 'occ-fresherism-26',
    title: 'REEF RUMBLE',
    description: `Inspired by the theme "Coral," the event symbolizes diversity, unity, and growth, encouraging students from all departments to showcase their talent, creativity, and passion for dance. The event provides a lively platform for freshers to express themselves, build confidence, and foster new friendships through the universal language of music and movement. To add an exciting twist, finalists will compete in a Mystery Music Round, where they will be given a surprise song or remix and have 45–60 seconds to freestyle, testing their adaptability, creativity, and stage presence. The performances will celebrate energy, teamwork, and artistic expression, making it a memorable highlight of the Freshers' festivities.`,
    date: '2026-08-07',
    timeStart: '10:00',
    timeEnd: '14:00',
    venue: 'Open Air Theatre / Main Stage',
    hostDepartment: 'School of Media & Performing Arts',
    coordinatorFacultyId: 'FAC-PAKIARAJ',
    coordinatorName: 'Prof. Pakiaraj',
    coordinatorMobile: '6380359936',
    coordinatorEmail: 'pakiaraj@gcu.edu.in',
    studentCoordinatorName: '1. Keerthana K S – 25BSFT115, 2. Parvani Nilesh Raut – 25BSFT111',
    rules: `1. Prepare a 3–5-minute performance.
2. Performances may include styles such as Hip-Hop, Salsa, Jazz, Locking, Popping, Waacking, or Fusion Western Dance.
3. Participants must bring their own audio track in MP3 format (pen drive/mobile backup recommended).
4. As part of the Coral 35th Anniversary celebrations, participants are encouraged to present performances that celebrate 35 years of excellence, unity, growth, innovation, diversity, and the vibrant spirit of our institution.
5. Costume is mandatory during the auditions and should be appropriate for the performance.
6. Performances must uphold the dignity of the institution. Any choreography, gestures, costumes, music, or expressions that are vulgar, obscene, offensive, discriminatory, or otherwise inappropriate will not be permitted.
7. Performances should maintain stage discipline, sportsmanship, and respect for fellow participants.
8. Any props used must be safe, easy to handle, and approved by the organizing team before the audition.
9. The performance should reflect creativity, energy, synchronization (for group performances), stage presence, and technical execution.`,
    imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&q=80&w=800',
    eventType: 'group'
  }
];

export const INITIAL_STUDENTS: Student[] = [];

export const INITIAL_NOTIFICATIONS: Notification[] = [];

export const INITIAL_MESSAGES: MessageToCoordinator[] = [];

export const INITIAL_SCORES: Score[] = [];

export function generateInitialScores(_students: Student[], _events: Event[]): Score[] {
  return [];
}
