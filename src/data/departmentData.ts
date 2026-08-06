export interface DepartmentInfo {
  name: string;
  school: string;
  programs: string[];
}

export const DEPARTMENT_PROGRAMS: DepartmentInfo[] = [
  {
    name: 'Commerce',
    school: 'School of Commerce and Management',
    programs: [
      'Bachelor of Commerce (BCMH)',
      'Bachelor of Commerce (BCMR)',
      'Bachelor of Commerce International Accounting and Finance (BCAF)',
      'Bachelor of Commerce (Computer Application) (BCCA)',
      'Master of Commerce (MCMR)',
      'Doctor of Philosophy in Commerce (PACM)'
    ]
  },
  {
    name: 'Management',
    school: 'School of Commerce and Management',
    programs: [
      'Diploma in Business Administration (DBAR)',
      'Post Graduate Program in Management (PGPM)',
      'Bachelor of Business Administration (BBAR)',
      'Bachelor of Business Administration Business Analytics (BBAB)',
      'Bachelor of Business Administration Aviation Management (BBAM)',
      'Bachelor of Business Administration in Tourism and Event (BBTE)',
      'Bachelors of Business Administration in Tourism (BBAT)',
      'Master of Business Administration (MBAR)',
      'Doctor of Philosophy in Management (PAMG)'
    ]
  },
  {
    name: 'Tourism',
    school: 'School of Professional Studies',
    programs: [
      'Bachelor of Business Administration Aviation Management (BBAM)',
      'Bachelor of Business Administration in Tourism and Event (BBTE)',
      'Bachelors of Business Administration in Tourism (BBAT)',
      'Diploma in Tourism and Travel Management (DTTM)',
      'Post Graduate Program in Tourism (PGPT)',
      'Bachelor of Arts (Hons) Tourism (BATH)',
      'Bachelor of Arts Tourism and Event Management (BATE)',
      'Bachelor of Arts Tourism, History, Journalism (BATR)',
      'Master of Tourism and Travel Management (MTTM)',
      'Doctor of Philosophy in Travel & Tourism (PATT)'
    ]
  },
  {
    name: 'Computer Science',
    school: 'School of Computational Sciences & IT',
    programs: [
      'Diploma in Computer Applications (DCAR)',
      'Bachelor of Computer Applications (BCAR)',
      'Bachelor of Science Data Science & Cyber Security (BSDC)',
      'Master of Computer Application (MCAR)',
      'Masters of Science in Data Science and Analytics (MSDA)',
      'Doctor of Philosophy Computer Science (PACS)',
      'Diploma in Information Technology (DSIT)',
      'Bachelor of Science in Information Technology (BSIT)',
      'Bachelor of Science in Information Technology (BSIC)',
      'Master of Science Information Technology (MSIT)'
    ]
  },
  {
    name: 'Computer Science Engineering',
    school: 'School of Engineering',
    programs: [
      'B Tech Computer Science (Robotic Engineering - BTAI)',
      'B Tech Computer Science (Information Technology - BTCS)',
      'B Tech Computer Science and Engineering (Data Science - BTDS)',
      'B Tech Computer Science (BTCE)',
      'BE Computer Science (BECS)',
      'BE Information Science (BEIS)',
      'B Tech Information Technology (BTIT)',
      'B Tech Robotic Engineering (BTRE)'
    ]
  },
  {
    name: 'Physiotherapy',
    school: 'School of Health Sciences',
    programs: [
      'Bachelor of Physiotherapy (BPTR)',
      'Master of Physiotherapy (MPTR)',
      'Doctor of Philosophy in Physiotherapy (PAPT)'
    ]
  },
  {
    name: 'English',
    school: 'School of Indian and Foreign Languages',
    programs: [
      'Bachelor of Arts (Hons) English (BAEH)',
      'Bachelor of Arts English with Comparative Literature (BAEC)',
      'Master of Arts English (MAER)',
      'Master of Arts English with Specialization in Computation (MAEC)',
      'Doctor of Philosophy in English (PAEG)'
    ]
  },
  {
    name: 'Law',
    school: 'School of Law',
    programs: [
      'Masters of Law (LLMR)'
    ]
  },
  {
    name: 'Journalism and Mass Communication',
    school: 'School of Media Studies',
    programs: [
      'Diploma in Journalism (DAJR)',
      'Bachelor of Arts Journalism and Psychology (BAJH)',
      'Bachelor of Arts in Journalism, Psychology and English (BAJR)',
      'Master of Arts Journalism and Mass Communication (MJMC)',
      'Doctor of Philosophy in Journalism (PAJR)'
    ]
  },
  {
    name: 'Psychology',
    school: 'School of Social Sciences',
    programs: [
      'Bachelor of Arts Journalism and Psychology (BAJH)',
      'Bachelor of Arts in Journalism, Psychology and English (BAJR)',
      'Bachelor of Science Psychology (BSPS)',
      'Master of Science Psychology (MSPS)',
      'Doctor of Philosophy in Psychology (PAPY)'
    ]
  },
  {
    name: 'Visual Communication (Electronic Media)',
    school: 'School of Media Studies',
    programs: [
      'Bachelor of Science Visual Communication (BSVC)',
      'Master of Science Visual Communication (Electronic Media - MSVC)',
      'Master of Science in Electronic Media (MSEM)'
    ]
  },
  {
    name: 'Fashion',
    school: 'School of Professional Studies',
    programs: [
      'Diploma in Fashion Technology (DSFR)',
      'Bachelor of Science Fashion and Apparel Design (BSFR)',
      'Master of Science Fashion and Apparel Design (MSFA)',
      'Doctor of Philosophy in Fashion and Apparel Design (PAFA)'
    ]
  },
  {
    name: 'Hotel Management',
    school: 'School of Professional Studies',
    programs: [
      'Diploma in Hospitality Management (DHMR)',
      'Bachelor of Hotel Management (BHMR)',
      'Doctor of Philosophy in Hospitality Management (PAHM)',
      'Doctor of Philosophy in Hotel Management and Tourism (PAHT)'
    ]
  },
  {
    name: 'Forensic Science',
    school: 'School of Sciences',
    programs: [
      'Bachelor of Science Forensic Science, Chemistry (BSFS)',
      'Master of Science Forensic Science (MSFS)',
      'Doctor of Philosophy in Forensic Science (PAFS)'
    ]
  },
  {
    name: 'Biotechnology',
    school: 'School of Sciences',
    programs: [
      'Post Graduate Program in Biotechnology (PGPB)',
      'Bachelor of Science in Biotechnology (Honors - BSBH)',
      'Bachelor of Science Biotechnology, Biochemistry (BBGR)',
      'Master of Science Biotechnology (MSBT)',
      'Doctor of Philosophy in Biotechnology (PABT)'
    ]
  },
  {
    name: 'Genetics',
    school: 'School of Sciences',
    programs: [
      'Post Graduate Diploma in Clinical Embryology (PGCE)',
      'Master of Science Molecular and Human Genetics (MSMH)',
      'Master of Science Molecular and Human Genetics (MSGE)',
      'Doctor of Philosophy in Genetics (PAGE)'
    ]
  },
  {
    name: 'Microbiology',
    school: 'School of Sciences',
    programs: [
      'Master of Science Microbiology (MSMB)',
      'Doctor of Philosophy in Microbiology (PAMB)'
    ]
  },
  {
    name: 'Food Technology',
    school: 'School of Sciences',
    programs: [
      'Bachelor of Science Food Science Technology, Biochemistry (BSFT)'
    ]
  },
  {
    name: 'Bioinformatics',
    school: 'School of Sciences',
    programs: [
      'Bachelor of Science Bioinformatics, Statistics and Data (BSBI)',
      'Master of Science Bioinformatics (MSBI)',
      'Doctor of Philosophy in Bioinformatics (PABI)'
    ]
  },
  {
    name: 'Chemistry',
    school: 'School of Sciences',
    programs: [
      'Bachelor of Science Forensic Science, Chemistry (BSFS)'
    ]
  },
  {
    name: 'Biochemistry',
    school: 'School of Sciences',
    programs: [
      'Bachelor of Science Biotechnology, Biochemistry (BBGR)'
    ]
  },
  {
    name: 'Physical Science',
    school: 'School of Sciences',
    programs: [
      'Bachelor of Science Bioinformatics, Statistics and Data (BSBI)'
    ]
  }
];
