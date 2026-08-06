import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
// @ts-ignore
import ImageModule from 'docxtemplater-image-module-free';
import {
  Document as DocxDocument,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ImageRun,
} from 'docx';
import { GoogleGenAI } from '@google/genai';
import { Event, Student, Score } from '../types';
import { formatDateDDMMYYYY } from '../dateUtils';

// Helper to convert base64 Data URL to Uint8Array
export function dataURLToUint8Array(dataUrl: string): Uint8Array {
  const base64Index = dataUrl.indexOf(';base64,');
  if (base64Index !== -1) {
    const base64 = dataUrl.substring(base64Index + 8);
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }
  const binaryString = atob(dataUrl);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Inspect a .docx template Data URL and extract placeholder tags & file metadata
 */
export function inspectDocxTemplate(dataUrl: string): {
  isValid: boolean;
  byteSize: number;
  placeholders: string[];
  hasCurly: boolean;
  hasSquare: boolean;
  error?: string;
} {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return { isValid: false, byteSize: 0, placeholders: [], hasCurly: false, hasSquare: false, error: 'Empty or invalid data URL format' };
  }
  try {
    const bytes = dataURLToUint8Array(dataUrl);
    const zip = new PizZip(bytes);
    const docXml = zip.file("word/document.xml")?.asText() || '';
    if (!docXml) {
      return { isValid: false, byteSize: bytes.byteLength, placeholders: [], hasCurly: false, hasSquare: false, error: 'word/document.xml missing in zip' };
    }
    const curlyMatches = Array.from(new Set(docXml.match(/\{[^}]+\}/g) || []));
    const squareMatches = Array.from(new Set(docXml.match(/\[[^\]]+\]/g) || []));
    const placeholders = [...curlyMatches, ...squareMatches];
    return {
      isValid: true,
      byteSize: bytes.byteLength,
      placeholders,
      hasCurly: curlyMatches.length > 0,
      hasSquare: squareMatches.length > 0,
    };
  } catch (err: any) {
    return { isValid: false, byteSize: 0, placeholders: [], hasCurly: false, hasSquare: false, error: err?.message || 'Failed to parse .docx ZIP archive' };
  }
}

// 1x1 transparent PNG Uint8Array fallback
function getTransparentPngUint8Array(): Uint8Array {
  const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Asynchronously resolve image input (base64 data URL, HTTP URL, or Uint8Array) into Uint8Array image buffer
async function resolveImageToUint8Array(urlOrDataUrl?: string | Uint8Array | null): Promise<Uint8Array | null> {
  if (!urlOrDataUrl) return null;
  if (urlOrDataUrl instanceof Uint8Array) return urlOrDataUrl;

  const str = String(urlOrDataUrl).trim();
  if (!str) return null;

  if (str.startsWith('data:image')) {
    try {
      return dataURLToUint8Array(str);
    } catch (e) {
      console.warn('Error converting base64 image data URL:', e);
      return null;
    }
  }

  if (str.startsWith('http://') || str.startsWith('https://')) {
    try {
      const res = await fetch(str);
      const arrayBuffer = await res.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (e) {
      console.warn('Error fetching image from URL:', str, e);
      return null;
    }
  }

  return null;
}

/**
 * Call Gemini API using @google/genai to generate plain-text prose for Objectives, Brief Description, and Key Outcome
 */
export async function generateReportContentWithGemini(event: Event): Promise<{
  objectives: string;
  briefDescription: string;
  keyOutcome: string;
}> {
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (process as any).env?.GEMINI_API_KEY || (window as any)?.GEMINI_API_KEY;

  const defaultObjectives = `1. To foster experiential learning, creative problem solving, and domain excellence in ${event.title || 'the event'}.\n2. To encourage healthy competition, leadership, and teamwork among participating students.\n3. To evaluate and celebrate outstanding student talent across departments.`;
  
  const defaultDescription = event.description && event.description.length > 20
    ? event.description
    : `The event "${event.title || 'Event'}" was successfully organized by ${event.hostDepartment || 'Garden City University'} at ${event.venue || 'Main Campus'}. The program engaged students through interactive sessions, competitive challenges, and skill-building activities. Active participation was witnessed with great enthusiasm from all attendees.`;
    
  const defaultOutcome = `1. High student engagement and successful achievement of event objectives.\n2. Enhanced practical skills, domain knowledge, and collaborative capability demonstrated by participants.\n3. Official performance evaluation and certificates awarded to top student achievers.`;

  if (!apiKey) {
    console.warn('Gemini API key not found in environment, using dynamic report prose defaults.');
    return {
      objectives: defaultObjectives,
      briefDescription: defaultDescription,
      keyOutcome: defaultOutcome,
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are an AI generating plain-text prose for an official University Event Completion Report.
Event Title: "${event.title}"
Organizer / Host Department: "${event.hostDepartment || 'Garden City University'}"
Venue: "${event.venue}"
Date & Time: "${event.date} (${event.timeStart} to ${event.timeEnd})"
Raw Event Description: "${event.description || 'N/A'}"
Chief Guest / Speaker: "${event.chiefGuestName || 'N/A'}"

Generate plain-text content for the following 3 fields:
1. "objectives": 2 to 3 concise numbered sentences detailing the learning objectives.
2. "briefDescription": A plain-text paragraph (70-120 words) describing the execution, student engagement, and highlights of the event.
3. "keyOutcome": 2 to 3 concise numbered sentences stating the key learning outcomes and impact.

Strict Rules:
- Return ONLY a raw JSON object with keys "objectives", "briefDescription", and "keyOutcome".
- Do NOT include markdown codeblocks (\`\`\`json).
- Do NOT include HTML, CSS, or layout commentary. Plain text only.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    let rawText = response.text?.trim() || '';
    if (rawText.startsWith('```json')) rawText = rawText.replace(/^```json\s*/, '').replace(/```$/, '');
    else if (rawText.startsWith('```')) rawText = rawText.replace(/^```\s*/, '').replace(/```$/, '');

    const parsed = JSON.parse(rawText.trim());
    return {
      objectives: parsed.objectives || defaultObjectives,
      briefDescription: parsed.briefDescription || defaultDescription,
      keyOutcome: parsed.keyOutcome || defaultOutcome,
    };
  } catch (err) {
    console.warn('Gemini text generation fallback:', err);
    return {
      objectives: defaultObjectives,
      briefDescription: defaultDescription,
      keyOutcome: defaultOutcome,
    };
  }
}

/**
 * Configure ImageModule for docxtemplater natively
 */
function createDocxImageModule() {
  const imageOptions = {
    centered: false,
    fileType: 'docx',
    getImage: function (tagValue: any) {
      if (!tagValue) return getTransparentPngUint8Array();
      if (tagValue instanceof Uint8Array) return tagValue;
      if (tagValue instanceof ArrayBuffer) return new Uint8Array(tagValue);
      if (typeof tagValue === 'string' && tagValue.startsWith('data:image')) {
        return dataURLToUint8Array(tagValue);
      }
      return getTransparentPngUint8Array();
    },
    getSize: function (img: any, tagValue: any, tagName: string) {
      const tag = (tagName || '').toLowerCase();
      if (tag.includes('student_photo') || tag.includes('studentphoto') || (tag.includes('photo') && tag.includes('student'))) {
        return [150, 150]; // Square cropped 150x150 for student photo
      }
      if (tag.includes('brochure')) {
        return [420, 280]; // [width, height] in px
      }
      if (tag.includes('photo') || tag.includes('geotag')) {
        return [320, 220]; // [width, height] in px for geo photos
      }
      if (tag.includes('logo') || tag.includes('brand')) {
        return [180, 80];
      }
      if (tag.includes('signature') || tag.includes('sign')) {
        return [150, 60];
      }
      return [300, 200];
    },
  };

  return new ImageModule(imageOptions);
}

/**
 * Main function: Generates the Word (.docx) Event Completion Report using native docxtemplater and docx library.
 */
export async function generateEventCompletionReportDocx(
  event: Event,
  registeredStudents: Student[],
  scores: Score[],
  occasionTitle: string = 'Fresherism 2026',
  templateDataUrl?: string
): Promise<void> {
  const eventTitle = event.title || 'Untitled Event';
  const organizer = event.hostDepartment || (event.coordinatorName ? `${event.coordinatorName} (${event.hostDepartment || 'Faculty Coordinator'})` : 'Garden City University');
  const dateTime = `${formatDateDDMMYYYY(event.date)} (${event.timeStart} to ${event.timeEnd})`;
  const venue = event.venue || 'Main Campus';

  // 1. Generate Gemini AI Prose for Objectives, Brief Description, and Key Outcome
  const geminiProse = await generateReportContentWithGemini(event);

  // 2. Resolve Images into Uint8Array binary buffers asynchronously BEFORE rendering
  const brochureRaw = event.noBrochure ? null : (event.brochureUrl || null);
  const photo1Raw = event.geotaggedPhotos?.[0] || null;
  const photo2Raw = event.geotaggedPhotos?.[1] || null;
  const chiefGuestRaw = event.chiefGuestPhotoUrl || null;

  const [brochureBuffer, photo1Buffer, photo2Buffer, chiefGuestBuffer] = await Promise.all([
    resolveImageToUint8Array(brochureRaw),
    resolveImageToUint8Array(photo1Raw),
    resolveImageToUint8Array(photo2Raw),
    resolveImageToUint8Array(chiefGuestRaw),
  ]);

  const transparentPng = getTransparentPngUint8Array();

  // 3. Format Student List array for dynamic table loop ({#students}...{/students})
  const studentList = registeredStudents.map((s, idx) => ({
    s_no: idx + 1,
    sno: idx + 1,
    sl_no: idx + 1,
    index: idx + 1,
    name: s.name || '',
    student_name: s.name || '',
    studentName: s.name || '',
    register_no: s.registerNo || '',
    registerNo: s.registerNo || '',
    program_name: s.programName || s.externalCollegeName || s.department || s.school || 'General',
    programName: s.programName || s.externalCollegeName || s.department || s.school || 'General',
    department: s.department || s.school || s.programName || 'General',
  }));

  // Clean dataset object mapping clean document properties
  const templateData: Record<string, any> = {
    // Distinct text properties
    event_title: eventTitle,
    organizer: organizer,
    date_time: dateTime,
    venue: venue,
    objectives: geminiProse.objectives,
    brief_description: geminiProse.briefDescription,
    description: geminiProse.briefDescription,
    key_outcome: geminiProse.keyOutcome,
    outcome: geminiProse.keyOutcome,
    occasion_title: occasionTitle,

    // Image binary buffers
    brochure_image: brochureBuffer || transparentPng,
    brochure: brochureBuffer || transparentPng,
    photo1: photo1Buffer || transparentPng,
    photo2: photo2Buffer || transparentPng,
    geotagged_photo_1: photo1Buffer || transparentPng,
    geotagged_photo_2: photo2Buffer || transparentPng,
    chief_guest_photo: chiefGuestBuffer || transparentPng,

    // Array field for dynamic row loop {#students}...{/students}
    students: studentList,
    student_list: studentList,

    // Uppercase aliases
    EVENT_TITLE: eventTitle,
    ORGANIZER: organizer,
    DATE_TIME: dateTime,
    VENUE: venue,
    OBJECTIVES: geminiProse.objectives,
    BRIEF_DESCRIPTION: geminiProse.briefDescription,
    KEY_OUTCOME: geminiProse.keyOutcome,
    OCCASION_TITLE: occasionTitle,
    STUDENTS: studentList,
  };

  // IF SUPER ADMIN HAS UPLOADED A TEMPLATE (.docx Data URL)
  if (templateDataUrl && templateDataUrl.startsWith('data:')) {
    try {
      const content = dataURLToUint8Array(templateDataUrl);
      const zip = new PizZip(content);

      const imageModule = createDocxImageModule();
      const doc = new Docxtemplater(zip, {
        modules: [imageModule],
        paragraphLoop: true,
        linebreaks: true,
      });

      doc.render(templateData);

      const out = doc.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      downloadBlob(out, `${eventTitle.replace(/[^a-zA-Z0-9]/g, '_')}_Event_Report.docx`);
      return;
    } catch (err: any) {
      if (err.properties && err.properties.errors) {
        console.warn('Docxtemplater rendering error details:', err.properties.errors);
      } else {
        console.warn('Failed to merge uploaded docx template, falling back to native docx generator:', err);
      }
    }
  }

  // FALLBACK NATIVE GENERATOR: Creates pristine OpenXML .docx with embedded ImageRuns and structural student table
  const metaRows = [
    createMetaRowText('1. Title of the Event:', eventTitle),
    createMetaRowText('2. Organizer:', organizer),
    createMetaRowText('3. Date & Time:', dateTime),
    createMetaRowText('4. Venue:', venue),
    createMetaRowText('5. Objectives of the Event/Program:', geminiProse.objectives),
    createMetaRowText('6. Brief Description of the Program:', geminiProse.briefDescription),
    createMetaRowText('8. Key Outcome of the Event:', geminiProse.keyOutcome),
  ];

  // If images exist, add brochure & geotagged photos as ImageRuns
  const imageElements: Paragraph[] = [];

  if (brochureBuffer) {
    imageElements.push(
      new Paragraph({
        spacing: { before: 120, after: 120 },
        children: [
          new TextRun({ text: 'Event Brochure:', bold: true, size: 20 }),
        ],
      }),
      new Paragraph({
        children: [
          new ImageRun({
            data: brochureBuffer,
            transformation: { width: 400, height: 260 },
            type: 'png',
          }),
        ],
      })
    );
  }

  if (photo1Buffer) {
    imageElements.push(
      new Paragraph({
        spacing: { before: 120, after: 120 },
        children: [
          new TextRun({ text: 'Geo Tagged Photo - 1:', bold: true, size: 20 }),
        ],
      }),
      new Paragraph({
        children: [
          new ImageRun({
            data: photo1Buffer,
            transformation: { width: 340, height: 220 },
            type: 'png',
          }),
        ],
      })
    );
  }

  if (photo2Buffer) {
    imageElements.push(
      new Paragraph({
        spacing: { before: 120, after: 120 },
        children: [
          new TextRun({ text: 'Geo Tagged Photo - 2:', bold: true, size: 20 }),
        ],
      }),
      new Paragraph({
        children: [
          new ImageRun({
            data: photo2Buffer,
            transformation: { width: 340, height: 220 },
            type: 'png',
          }),
        ],
      })
    );
  }

  if (imageElements.length > 0) {
    metaRows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: 32, type: WidthType.PERCENTAGE },
            borders: getCellBorders('B0B0B0', 4),
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Brochure & Geo Tagged Photos:',
                    bold: true,
                    size: 20,
                    color: '002244',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 68, type: WidthType.PERCENTAGE },
            borders: getCellBorders('B0B0B0', 4),
            children: imageElements,
          }),
        ],
      })
    );
  }

  const doc = new DocxDocument({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'GARDEN CITY UNIVERSITY',
                bold: true,
                size: 32,
                color: '800020',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [
              new TextRun({
                text: `EVENT COMPLETION REPORT — ${occasionTitle.toUpperCase()}`,
                bold: true,
                size: 24,
                color: '333333',
              }),
            ],
          }),

          // 8-Field Metadata Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: metaRows,
          }),

          new Paragraph({
            spacing: { before: 400, after: 150 },
            children: [
              new TextRun({
                text: 'STUDENT LIST',
                bold: true,
                size: 24,
                color: '003366',
              }),
            ],
          }),

          // Student Table (Loops through every registered student)
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createHeaderCell('S.No', 10),
                  createHeaderCell('Name of the student', 35),
                  createHeaderCell('Register No', 25),
                  createHeaderCell('Program Name', 30),
                ],
              }),
              ...studentList.map((s) =>
                new TableRow({
                  children: [
                    createDataCell(String(s.s_no), AlignmentType.CENTER),
                    createDataCell(s.name, AlignmentType.LEFT, true),
                    createDataCell(s.register_no, AlignmentType.LEFT),
                    createDataCell(s.program_name, AlignmentType.LEFT),
                  ],
                })
              ),
            ],
          }),

          // Signatures
          new Paragraph({
            spacing: { before: 600 },
            children: [
              new TextRun({
                text: '________________________________________              ________________________________________',
                bold: true,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Faculty Event Coordinator                                            Convenor / Head of Department',
                bold: true,
                size: 20,
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${eventTitle.replace(/[^a-zA-Z0-9]/g, '_')}_Event_Report.docx`);
}

/**
 * Generate Student Certificate Word/PDF document mapping template tags:
 * {student_name}, {register_no}, {citation_text}, {event_title}, {event_tagline}, {event_description},
 * {awarder_name}, {awarder_designation}, {award_date}, {website_url}, and {%student_photo} (150x150)
 */
export async function generateStudentCertificateDocx(
  student: Student & { photoUrl?: string; profilePhoto?: string; studentPhoto?: string; regNo?: string; usn?: string },
  event: Event & { certificateCitation?: string; certificate_citation?: string; tagline?: string; endedAt?: string; awarderName?: string; awarderDesignation?: string; eventTitle?: string; eventName?: string },
  templateDataUrl?: string
): Promise<Uint8Array> {
  const studentName = student?.name || (student as any)?.studentName || (student as any)?.fullName || 'Student';
  const registerNo = student?.registerNo || student?.regNo || student?.usn || (student as any)?.register_no || (student as any)?.rollNo || '';
  const department = student?.department || (student as any)?.dept || (student as any)?.hostDepartment || '';
  const school = student?.school || '';
  const eventTitle = event?.title || event?.eventTitle || event?.eventName || 'Event';
  const eventTagline = event?.tagline || 'Annual Intra-University Fest';
  const eventDescription = event?.description || '';
  const citationText = event?.certificateCitation || event?.certificate_citation || `for exemplary performance and participation in ${eventTitle}`;
  const awarderName = event?.awarderName || event?.coordinatorName || 'Prof. Vice Chancellor';
  const awarderDesignation = event?.awarderDesignation || event?.hostDepartment || 'Convener & Head of Department';

  const formattedDate = formatDateDDMMYYYY(event?.endedAt || event?.date || new Date().toISOString().substring(0, 10));

  const websiteUrl = 'https://gardencity.university';

  // 1. Fetch student photo or fallback to default silhouette
  const photoSource = student?.photoUrl || student?.profilePhoto || student?.studentPhoto || null;
  let photoBuffer = await resolveImageToUint8Array(photoSource);
  if (!photoBuffer) {
    photoBuffer = getTransparentPngUint8Array();
  }

  // 2. Comprehensive Data payload with all common placeholder aliases
  const processedData: Record<string, any> = {
    // Student Name
    student_name: studentName,
    studentName: studentName,
    Student_Name: studentName,
    StudentName: studentName,
    STUDENT_NAME: studentName,
    student_full_name: studentName,
    studentFullName: studentName,
    Student_Full_Name: studentName,
    StudentFullName: studentName,
    STUDENT_FULL_NAME: studentName,
    studentfullname: studentName,
    name: studentName,
    Name: studentName,
    NAME: studentName,
    full_name: studentName,
    fullName: studentName,
    FullName: studentName,
    FULL_NAME: studentName,
    student: studentName,
    Student: studentName,
    STUDENT: studentName,
    participant_name: studentName,
    participantName: studentName,

    // Register / USN
    register_no: registerNo,
    registerNo: registerNo,
    Register_No: registerNo,
    RegisterNo: registerNo,
    REGISTER_NO: registerNo,
    reg_no: registerNo,
    regNo: registerNo,
    Reg_No: registerNo,
    REG_NO: registerNo,
    usn: registerNo,
    Usn: registerNo,
    USN: registerNo,
    roll_no: registerNo,
    rollNo: registerNo,
    Roll_No: registerNo,
    ROLL_NO: registerNo,
    registration_no: registerNo,
    registrationNo: registerNo,
    REGISTRATION_NO: registerNo,
    id: registerNo,
    ID: registerNo,
    student_id: registerNo,
    studentId: registerNo,

    // Department & School
    department: department,
    Department: department,
    DEPARTMENT: department,
    dept: department,
    Dept: department,
    DEPT: department,
    host_department: department,
    hostDepartment: department,
    branch: department,
    Branch: department,
    BRANCH: department,
    school: school,
    School: school,
    SCHOOL: school,

    // Event & Occasion
    event_title: eventTitle,
    eventTitle: eventTitle,
    Event_Title: eventTitle,
    EventTitle: eventTitle,
    EVENT_TITLE: eventTitle,
    event_name: eventTitle,
    eventName: eventTitle,
    Event_Name: eventTitle,
    EventName: eventTitle,
    EVENT_NAME: eventTitle,
    title: eventTitle,
    Title: eventTitle,
    TITLE: eventTitle,
    event: eventTitle,
    Event: eventTitle,
    EVENT: eventTitle,
    course: eventTitle,
    Course: eventTitle,
    COURSE: eventTitle,
    program: eventTitle,
    Program: eventTitle,

    // Tagline & Description
    event_tagline: eventTagline,
    eventTagline: eventTagline,
    tagline: eventTagline,
    Tagline: eventTagline,
    event_description: eventDescription,
    eventDescription: eventDescription,
    description: eventDescription,
    Description: eventDescription,

    // Citation
    citation_text: citationText,
    citationText: citationText,
    Citation_Text: citationText,
    CITATION_TEXT: citationText,
    citation: citationText,
    Citation: citationText,
    CITATION: citationText,
    reason: citationText,
    Reason: citationText,

    // Awarder / Signatory
    awarder_name: awarderName,
    awarderName: awarderName,
    Awarder_Name: awarderName,
    AWARDER_NAME: awarderName,
    awarder: awarderName,
    Awarder: awarderName,
    convenor: awarderName,
    Convenor: awarderName,
    signatory: awarderName,
    Signatory: awarderName,
    awarder_designation: awarderDesignation,
    awarderDesignation: awarderDesignation,
    Awarder_Designation: awarderDesignation,
    AWARDER_DESIGNATION: awarderDesignation,
    designation: awarderDesignation,
    Designation: awarderDesignation,

    // Date
    award_date: formattedDate,
    awardDate: formattedDate,
    Award_Date: formattedDate,
    AWARD_DATE: formattedDate,
    date: formattedDate,
    Date: formattedDate,
    DATE: formattedDate,
    formatted_date: formattedDate,
    issue_date: formattedDate,
    Issue_Date: formattedDate,

    // Website & Photo
    website_url: websiteUrl,
    websiteUrl: websiteUrl,
    website: websiteUrl,
    Website: websiteUrl,
    student_photo: photoBuffer,
    studentPhoto: photoBuffer,
    photo: photoBuffer,
    Photo: photoBuffer,
  };

  // Smart case-insensitive & keyword fallback parser for docxtemplater
  const customSmartParser = (tag: string) => {
    const rawTag = tag ? tag.trim() : '';
    return {
      get(scope: Record<string, any>) {
        if (!rawTag) return '';

        // 1. Direct exact key match
        if (scope[rawTag] !== undefined && scope[rawTag] !== null) {
          return scope[rawTag];
        }

        // 2. Normalized alphanumeric match (case-insensitive, ignoring spaces, underscores, hyphens)
        const normTag = rawTag.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const [key, val] of Object.entries(scope)) {
          const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (normKey === normTag && val !== undefined && val !== null) {
            return val;
          }
        }

        // 3. Keyword heuristic fallbacks
        if (normTag.includes('name') && !normTag.includes('award') && !normTag.includes('event')) {
          return scope.student_name || scope.name || '';
        }
        if (normTag.includes('reg') || normTag.includes('usn') || normTag.includes('roll') || normTag.includes('id')) {
          return scope.register_no || scope.reg_no || '';
        }
        if (normTag.includes('event') || normTag.includes('title') || normTag.includes('course') || normTag.includes('program')) {
          return scope.event_title || scope.title || '';
        }
        if (normTag.includes('date')) {
          return scope.award_date || scope.date || '';
        }
        if (normTag.includes('dept') || normTag.includes('department') || normTag.includes('branch')) {
          return scope.department || '';
        }
        if (normTag.includes('citation') || normTag.includes('reason')) {
          return scope.citation_text || scope.citation || '';
        }
        if (normTag.includes('awarder') || normTag.includes('sign') || normTag.includes('convenor')) {
          return scope.awarder_name || '';
        }
        if (normTag.includes('designation')) {
          return scope.awarder_designation || '';
        }

        return '';
      },
    };
  };

  if (templateDataUrl && templateDataUrl.startsWith('data:')) {
    try {
      const content = dataURLToUint8Array(templateDataUrl);
      const zip = new PizZip(content);

      // Extract raw document XML to scan placeholders & inspect format
      let rawDocXml = zip.file("word/document.xml")?.asText() || '';
      
      const hasCurlyBraces = rawDocXml.includes('{') && rawDocXml.includes('}');
      const hasSquareBrackets = rawDocXml.includes('[') && rawDocXml.includes(']');
      
      // Extract curly tags e.g. {student_name}
      const curlyMatches = Array.from(new Set(rawDocXml.match(/\{[^}]+\}/g) || []));
      // Extract square tags e.g. [STUDENT_FULL_NAME]
      const squareMatches = Array.from(new Set(rawDocXml.match(/\[[^\]]+\]/g) || []));
      
      const allDetectedPlaceholders = [...curlyMatches, ...squareMatches];

      // Auto-detect delimiter format
      let activeDelimiters = { start: '{', end: '}' };
      if (hasSquareBrackets && !hasCurlyBraces) {
        activeDelimiters = { start: '[', end: ']' };
      } else if (hasSquareBrackets && hasCurlyBraces) {
        // If template has both square and curly tags, convert square bracket tags [tag] to {tag} in raw XML so Docxtemplater resolves both!
        rawDocXml = rawDocXml.replace(/\[([A-Za-z0-9_ -]+)\]/g, '{$1}');
        zip.file("word/document.xml", rawDocXml);
      }

      console.log('===========================================================');
      console.log('📜 [CERTIFICATE ENGINE] DOCX TEMPLATE LOADED SUCCESSFULLY');
      console.log('  • Event Title:', eventTitle);
      console.log('  • Student Name:', studentName, `(${registerNo})`);
      console.log('  • Template Data URL Prefix:', templateDataUrl.substring(0, 60) + '...');
      console.log('  • Template File Byte Size:', content.byteLength, 'bytes', `(${(content.byteLength / 1024).toFixed(2)} KB)`);
      console.log('  • Document XML Character Length:', rawDocXml.length);
      console.log('  • Has Curly Braces "{...}":', hasCurlyBraces, curlyMatches);
      console.log('  • Has Square Brackets "[...]":', hasSquareBrackets, squareMatches);
      console.log('  • Total Detected Placeholders in Template:', allDetectedPlaceholders);
      console.log('  • Active Delimiters configured for render:', activeDelimiters);
      console.log('===========================================================');

      const imageModule = createDocxImageModule();

      const doc = new Docxtemplater(zip, {
        modules: [imageModule],
        paragraphLoop: true,
        linebreaks: true,
        delimiters: activeDelimiters,
        parser: customSmartParser,
        nullGetter() {
          return '';
        },
      });

      doc.render(processedData);

      console.log('✅ [CERTIFICATE ENGINE] doc.render() completed successfully!');
      return doc.getZip().generate({ type: 'uint8array' });
    } catch (err: any) {
      console.error('❌ [CERTIFICATE ENGINE ERROR] Failed to render uploaded .docx template:', err);
      if (err.properties && err.properties.errors) {
        console.error('  • Detailed Docxtemplater Tag Errors:', err.properties.errors);
      }
      // Fallback below to native generator if uploaded template is corrupted or invalid zip
    }
  }

  // Fallback native docx document creation if no template uploaded
  const doc = new DocxDocument({
    sections: [
      {
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'GARDEN CITY UNIVERSITY', bold: true, size: 36, color: '800020' }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [
              new TextRun({ text: 'CERTIFICATE OF ACHIEVEMENT', bold: true, size: 28, color: '003366' }),
            ],
          }),
          ...(photoBuffer ? [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
              children: [
                new ImageRun({
                  data: photoBuffer,
                  transformation: { width: 150, height: 150 },
                  type: 'png',
                }),
              ],
            }),
          ] : []),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({ text: 'This is to certify that ', size: 24 }),
              new TextRun({ text: studentName, bold: true, size: 26, color: '800020' }),
              new TextRun({ text: ` (${registerNo}) `, bold: true, size: 24 }),
              new TextRun({ text: `${citationText} in `, size: 24 }),
              new TextRun({ text: eventTitle, bold: true, size: 26, color: '002244' }),
              new TextRun({ text: ` on ${formattedDate}.`, size: 24 }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 500 },
            children: [
              new TextRun({ text: `${awarderName} — ${awarderDesignation}`, bold: true, size: 20 }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Trigger browser download for generated Student Certificate (.docx)
 */
export async function downloadStudentCertificateDocx(
  student: Student & { photoUrl?: string; profilePhoto?: string; studentPhoto?: string },
  event: Event & { certificateCitation?: string; certificate_citation?: string; tagline?: string; endedAt?: string; awarderName?: string; awarderDesignation?: string },
  templateDataUrl?: string
): Promise<void> {
  const bytes = await generateStudentCertificateDocx(student, event, templateDataUrl);
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const sanitizedStudent = (student.name || 'Student').replace(/[^a-zA-Z0-9]/g, '_');
  const sanitizedEvent = (event.title || 'Event').replace(/[^a-zA-Z0-9]/g, '_');
  downloadBlob(blob, `${sanitizedStudent}_${sanitizedEvent}_Certificate.docx`);
}

/**
 * Generate Sample Word (.docx) Template for Super Admin download
 */
export async function generateSampleWordTemplateDocx(type: 'report' | 'certificate', occasionTitle: string = 'Fresherism 2026'): Promise<void> {
  if (type === 'certificate') {
    const doc = new DocxDocument({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 300, after: 150 },
              children: [
                new TextRun({
                  text: 'GARDEN CITY UNIVERSITY',
                  bold: true,
                  size: 36,
                  color: '800020',
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 300 },
              children: [
                new TextRun({
                  text: 'CERTIFICATE OF ACHIEVEMENT',
                  bold: true,
                  size: 28,
                  color: '003366',
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
              children: [
                new TextRun({
                  text: '{%student_photo}',
                  size: 20,
                  color: '666666',
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
              children: [
                new TextRun({
                  text: 'This is to certify that ',
                  size: 24,
                }),
                new TextRun({
                  text: '{student_name}',
                  bold: true,
                  size: 26,
                  color: '800020',
                }),
                new TextRun({
                  text: ' (Register No: ',
                  size: 24,
                }),
                new TextRun({
                  text: '{register_no}',
                  bold: true,
                  size: 24,
                }),
                new TextRun({
                  text: ') ',
                  size: 24,
                }),
                new TextRun({
                  text: '{citation_text}',
                  size: 24,
                }),
                new TextRun({
                  text: ' in ',
                  size: 24,
                }),
                new TextRun({
                  text: '{event_title}',
                  bold: true,
                  size: 26,
                  color: '002244',
                }),
                new TextRun({
                  text: ` ({event_tagline})`,
                  size: 22,
                  color: '555555',
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
              children: [
                new TextRun({
                  text: '{event_description}',
                  size: 20,
                  color: '333333',
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 400 },
              children: [
                new TextRun({
                  text: 'Date: {award_date}',
                  bold: true,
                  size: 20,
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 400 },
              children: [
                new TextRun({
                  text: '{awarder_name}',
                  bold: true,
                  size: 22,
                }),
                new TextRun({
                  text: ' — ',
                  size: 22,
                }),
                new TextRun({
                  text: '{awarder_designation}',
                  size: 20,
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200 },
              children: [
                new TextRun({
                  text: '{website_url}',
                  size: 18,
                  color: '888888',
                }),
              ],
            }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    downloadBlob(blob, `${occasionTitle}_Certificate_Template_Sample.docx`);
    return;
  }

  // Report Sample Word Format
  const doc = new DocxDocument({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'GARDEN CITY UNIVERSITY',
                bold: true,
                size: 32,
                color: '800020',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [
              new TextRun({
                text: `EVENT COMPLETION REPORT — {OCCASION_TITLE}`,
                bold: true,
                size: 24,
                color: '333333',
              }),
            ],
          }),

          // 8-Field Table with image placeholders {%brochure_image}, {%photo1}, {%photo2}
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createMetaRowText('1. Title of the Event:', '{event_title}'),
              createMetaRowText('2. Organizer:', '{organizer}'),
              createMetaRowText('3. Date & Time:', '{date_time}'),
              createMetaRowText('4. Venue:', '{venue}'),
              createMetaRowText('5. Objectives of the Event/Program:', '{objectives}'),
              createMetaRowText('6. Brief Description of the Program:', '{brief_description}'),
              createMetaRowText('8. Key Outcome of the Event:', '{key_outcome}'),
              createMetaRowText('Brochure:', '{%brochure_image}'),
              createMetaRowText('Geo Tagged Photo - 1:', '{%photo1}'),
              createMetaRowText('Geo Tagged Photo - 2:', '{%photo2}'),
            ],
          }),

          new Paragraph({
            spacing: { before: 400, after: 150 },
            children: [
              new TextRun({
                text: 'STUDENT LIST',
                bold: true,
                size: 24,
                color: '003366',
              }),
            ],
          }),

          // Student Table with proper repeat/loop tags {#students}...{/students}
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createHeaderCell('S.No', 10),
                  createHeaderCell('Name of the student', 35),
                  createHeaderCell('Register No', 25),
                  createHeaderCell('Program Name', 30),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('{#students}{s_no}', AlignmentType.CENTER),
                  createDataCell('{name}', AlignmentType.LEFT, true),
                  createDataCell('{register_no}', AlignmentType.LEFT),
                  createDataCell('{program_name}{/students}', AlignmentType.LEFT),
                ],
              }),
            ],
          }),

          new Paragraph({
            spacing: { before: 600 },
            children: [
              new TextRun({
                text: '________________________________________              ________________________________________',
                bold: true,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Faculty Event Coordinator                                            Convenor / Head of Department',
                bold: true,
                size: 20,
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${occasionTitle}_Report_Format_Sample.docx`);
}

function createMetaRowText(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 32, type: WidthType.PERCENTAGE },
        borders: getCellBorders('B0B0B0', 4),
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: label,
                bold: true,
                size: 20,
                color: '002244',
              }),
            ],
          }),
        ],
      }),
      new TableCell({
        width: { size: 68, type: WidthType.PERCENTAGE },
        borders: getCellBorders('B0B0B0', 4),
        children: value.split('\n').map((line) =>
          new Paragraph({
            children: [
              new TextRun({
                text: line,
                size: 20,
                color: '111111',
              }),
            ],
          })
        ),
      }),
    ],
  });
}

function getCellBorders(color: string, size: number) {
  return {
    top: { style: BorderStyle.SINGLE, size, color },
    bottom: { style: BorderStyle.SINGLE, size, color },
    left: { style: BorderStyle.SINGLE, size, color },
    right: { style: BorderStyle.SINGLE, size, color },
  };
}

function createHeaderCell(text: string, widthPercent: number): TableCell {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    borders: getCellBorders('002244', 4),
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: true,
            size: 20,
            color: 'FFFFFF',
          }),
        ],
      }),
    ],
  });
}

function createDataCell(text: string, alignment: any = AlignmentType.LEFT, bold: boolean = false): TableCell {
  return new TableCell({
    borders: getCellBorders('CCCCCC', 2),
    children: [
      new Paragraph({
        alignment,
        children: [
          new TextRun({
            text,
            bold,
            size: 19,
            color: '111111',
          }),
        ],
      }),
    ],
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
