# GCU Emphasis on Life - Backend Methods & API Documentation

This document provides a comprehensive reference of all backend methods, database operations, authentication handlers, and utility functions implemented in `src/firebase.ts`.

---

## Table of Contents
1. [Core Configuration & Initialization](#1-core-configuration--initialization)
2. [Realtime Observers (Firestore Subscriptions)](#2-realtime-observers-firestore-subscriptions)
3. [Student Management Methods](#3-student-management-methods)
4. [Event Management Methods](#4-event-management-methods)
5. [Faculty Coordinator Methods](#5-faculty-coordinator-methods)
6. [Scores & Evaluation Methods](#6-scores--evaluation-methods)
7. [Notifications & Messaging Methods](#7-notifications--messaging-methods)
8. [Occasions Management Methods](#8-occasions-management-methods)
9. [Firebase Authentication Helpers](#9-firebase-authentication-helpers)
10. [String & Data Formatting Helpers](#10-string--data-formatting-helpers)

---

## 1. Core Configuration & Initialization

| Method / Symbol | Parameters | Return Type | Description |
| :--- | :--- | :--- | :--- |
| `app` | - | `FirebaseApp` | Initialized Firebase application instance. |
| `db` | - | `Firestore` | Firestore database instance for `gcu-emphasis-on-life`. |
| `auth` | - | `Auth` | Firebase Authentication service instance. |
| `seedFirestoreIfEmpty()` | None | `Promise<void>` | Checks if Firestore collections (`events`, `facultyCoordinators`) are empty and seeds initial data from `initialData.ts`. |
| `purgeAllSampleData()` | None | `Promise<void>` | Administrative helper to purge sample/demo dataset from Firestore. |
| `cleanObjectForFirestore<T>(obj)` | `obj: T` | `T` | Recursively strips `undefined` keys and cleans Javascript objects for safe Firestore storage. |

---

## 2. Realtime Observers (Firestore Subscriptions)

| Observer Function | Callback Parameter Type | Description |
| :--- | :--- | :--- |
| `subscribeEvents(callback)` | `(events: Event[]) => void` | Listens to realtime changes on `events` collection and invokes callback. |
| `subscribeStudents(callback)` | `(students: Student[]) => void` | Listens to `students` collection, formats student names in Title Case, and emits full student list. |
| `subscribeCoordinators(callback)`| `(coords: FacultyCoordinator[]) => void` | Listens to `facultyCoordinators` collection. |
| `subscribeScores(callback)` | `(scores: Score[]) => void` | Listens to `scores` collection, normalizes records, and emits score list. |
| `subscribeNotifications(callback)`| `(notifs: Notification[]) => void` | Listens to `notifications` collection, filters out deprecated dummy notifications, and sorts chronologically. |
| `subscribeMessages(callback)` | `(msgs: MessageToCoordinator[]) => void` | Listens to `messages` collection, filters legacy dummy messages, and sorts by timestamp. |
| `subscribeOccasions(callback)` | `(occasions: Occasion[]) => void` | Listens to `occasions` collection for realtime updates. |

---

## 3. Student Management Methods

| Method | Parameters | Return Type | Description |
| :--- | :--- | :--- | :--- |
| `dbSaveStudent(student)` | `student: Student` | `Promise<{ok: boolean; reason?: string}>` | Upserts a student record in `students/{registerNo}` (sanitized doc ID). Formats name and register number before saving. |
| `dbDeleteStudent(registerNo)` | `registerNo: string` | `Promise<{ok: boolean}>` | Deletes a student document from `students` collection using normalized register number doc ID. |
| `dbAddEventRegistration(studentOrRegNo, eventId)` | `studentOrRegNo: Student \| string, eventId: string` | `Promise<{ok: boolean; reason?: string}>` | Atomically adds `eventId` to student's `registeredEventIds` using Firestore `arrayUnion`. |
| `dbRemoveEventRegistration(studentOrRegNo, eventId)` | `studentOrRegNo: Student \| string, eventId: string` | `Promise<{ok: boolean; reason?: string}>` | Atomically removes `eventId` from student's `registeredEventIds` using Firestore `arrayRemove`. |

---

## 4. Event Management Methods

| Method | Parameters | Return Type | Description |
| :--- | :--- | :--- | :--- |
| `dbSaveEvent(event)` | `event: Event` | `Promise<void>` | Upserts an event document in `events/{id}` with sanitized default fields. |
| `dbDeleteEvent(eventId)` | `eventId: string` | `Promise<void>` | Permanently deletes an event document from Firestore. |
| `dbClearAllEvents()` | None | `Promise<void>` | Performs chunked batch deletion (chunks of 500) of all event documents. |

---

## 5. Faculty Coordinator Methods

| Method | Parameters | Return Type | Description |
| :--- | :--- | :--- | :--- |
| `dbSaveCoordinator(coord)` | `coord: FacultyCoordinator` | `Promise<void>` | Upserts faculty coordinator details in `facultyCoordinators/{facultyId}`. |
| `dbDeleteCoordinator(coordId)` | `coordId: string` | `Promise<void>` | Deletes a faculty coordinator record by sanitized faculty ID. |

---

## 6. Scores & Evaluation Methods

| Method | Parameters | Return Type | Description |
| :--- | :--- | :--- | :--- |
| `isGradeFiled(score)` | `score: Partial<Score> \| null \| undefined` | `boolean` | Utility function checking if criteria scores, total points, or entered flag exist for a student evaluation. |
| `mergeScoreRecords(existing, incoming)` | `existing: Score, incoming: Score` | `Score` | Pure calculation helper merging existing and new scores while preserving non-zero criteria marks. |
| `dbSaveScore(score)` | `score: Score` | `Promise<{ok: boolean; reason?: string}>` | Upserts a score document in `scores/{registerNo}_{eventId}`. Merges with existing records to prevent data loss. |
| `dbDeleteScore(scoreId, force)` | `scoreId: string, force?: boolean` | `Promise<{ok: boolean; reason?: string}>` | Deletes a score document. Blocks deletion if grades are entered unless `force = true`. |
| `dbSaveStudentsAndScoresBatch(students, scores)` | `studentsToSave: Student[], scoresToSave: Score[]` | `Promise<void>` | Performs high-speed batched write operations for bulk student and score imports (250 items per batch). |

---

## 7. Notifications & Messaging Methods

| Method | Parameters | Return Type | Description |
| :--- | :--- | :--- | :--- |
| `dbSaveNotification(notif)` | `notif: Notification` | `Promise<void>` | Saves a push/dashboard notification. |
| `dbClearAllNotifications()` | None | `Promise<void>` | Deletes all notifications from Firestore and updates local clearance timestamp. |
| `dbSaveMessage(msg)` | `msg: MessageToCoordinator` | `Promise<void>` | Saves a student-to-coordinator communication message. |
| `dbClearAllMessages()` | None | `Promise<void>` | Deletes all messages from Firestore. |

---

## 8. Occasions Management Methods

| Method | Parameters | Return Type | Description |
| :--- | :--- | :--- | :--- |
| `dbSaveOccasion(occ)` | `occ: Occasion` | `Promise<void>` | Creates/updates an occasion doc in `occasions/{id}`. |
| `dbDeleteOccasion(occId)` | `occId: string` | `Promise<void>` | Deletes an occasion record from Firestore. |

---

## 9. Firebase Authentication Helpers

| Method | Parameters | Return Type | Description |
| :--- | :--- | :--- | :--- |
| `signUpStudentAuth(email, password, studentData)` | `email, password, studentData` | `Promise<{user, student}>` | Registers a new Firebase Auth user, sets display name, sends verification email, and writes initial student record. |
| `signInStudentAuth(email, password)` | `email, password` | `Promise<User>` | Authenticates user with email and password credentials. |
| `sendResetPasswordLink(email)` | `email: string` | `Promise<void>` | Triggers a password reset email via Firebase Auth. |
| `resendAuthEmailVerification()` | None | `Promise<boolean>` | Resends verification email to currently signed in Firebase user. |
| `checkAuthEmailVerified()` | None | `Promise<boolean>` | Reloads current auth user state and checks if `emailVerified` is true. |
| `signInWithGoogleAuth()` | None | `Promise<User>` | Executes Google OAuth popup login. |
| `signInWithMicrosoftAuth(tenantId)`| `tenantId?: string` | `Promise<User>` | Executes Microsoft 365 OAuth popup login for university accounts. |
| `logoutStudentAuth()` | None | `Promise<void>` | Signs out active Firebase Auth user session. |
| `subscribeAuthUser(callback)` | `(user: User \| null) => void` | `Unsubscribe` | Attaches `onAuthStateChanged` listener to track session changes. |

---

## 10. String & Data Formatting Helpers

| Method | Parameters | Return Type | Description |
| :--- | :--- | :--- | :--- |
| `formatToTitleCase(str)` | `str: string` | `string` | Converts names or strings into standard Title Case capitalization. |
| `formatStudentNameFromEmail(emailOrLocalPart, fallback)` | `emailOrLocalPart: string, fallback?: string` | `string` | Converts local email handles (e.g. `26anshuman.k@gcu.edu.in`) into formatted human-readable names (`Anshuman K`). |
