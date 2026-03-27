# Product Requirements Document (PRD)

## Riskmarshal — Insurance Intermediary Management Platform

| Field             | Details                              |
| ----------------- | ------------------------------------ |
| **Product Name**  | Riskmarshal                          |
| **Version**       | 1.1                                  |
| **Author**        | Riskmarshal Product Team             |
| **Date**          | February 28, 2026                    |
| **Status**        | Draft                                |
| **Tech Stack**    | Next.js · Express.js · MongoDB       |

---

## 1. Executive Summary

Riskmarshal is an insurance intermediary management platform that serves as the legal umbrella under which multiple insurance intermediaries (agents) operate independently. Each intermediary is associated with specific insurer companies and manages their own client base, policy documents, quotations, and leads.

The platform digitizes the end-to-end insurance workflow — from lead capture and client onboarding to policy document extraction (via Gemini OCR), quotation delivery, payment tracking, **automated policy renewal reminders**, commission management, and reporting. It provides a centralized dashboard for the Riskmarshal admin to oversee operations while giving each intermediary a scoped view of their own business.

---

## 2. Problem Statement

Insurance intermediaries operating under Riskmarshal currently face several operational challenges:

- **Manual document handling** — Policy documents are managed in physical or unstructured digital formats, making retrieval and data extraction time-consuming and error-prone.
- **No centralized client management** — Client information, policy details, and communication history are scattered across spreadsheets, emails, and personal records.
- **Payment follow-up gaps** — There is no systematic mechanism to track whether a client has completed payment after receiving a quotation, leading to revenue leakage.
- **Lack of visibility** — The admin (Riskmarshal) has limited insight into intermediary performance, active policies, revenue, and commission payouts.
- **Missed policy renewals** — There is no proactive system to track upcoming policy expirations and remind clients or intermediaries to renew, resulting in policy lapses and lost recurring revenue.
- **Lead leakage** — Website leads are not efficiently captured, tracked, or converted into paying clients.

---

## 3. Objectives & Goals

| #  | Objective                                                                                      | Success Metric                                   |
| -- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| O1 | Digitize policy document management with automated data extraction                             | 90%+ OCR extraction accuracy on standard formats |
| O2 | Streamline client onboarding and quotation delivery                                            | Quotation sent within 5 minutes of upload        |
| O3 | Eliminate payment follow-up gaps through automated reminders                                   | Zero missed follow-ups on pending payments       |
| O4 | Provide full operational visibility to the admin via dashboards and reports                     | Admin can generate any report in under 30 sec    |
| O5 | Capture, track, and convert website leads into clients                                         | Measurable lead-to-client conversion rate        |
| O6 | Track commissions and revenue per intermediary                                                 | Accurate, real-time commission dashboard         |
| O7 | Proactively remind clients and intermediaries of upcoming policy renewals to minimize lapses   | 95%+ renewal reminder delivery rate before expiry |

---

## 4. User Roles & Permissions

The platform operates on a **role-based access control (RBAC)** model with the following roles:

### 4.1 Super Admin (Riskmarshal Admin)

The Super Admin is the highest-level role, representing the Riskmarshal organization. This role has unrestricted access to the entire platform.

**Permissions include:**

- Full access to all intermediaries' data, clients, and policies
- View and manage **revenue reports**, **commission tracking**, and **financial dashboards**
- Create, edit, and deactivate intermediary accounts
- Create staff users under intermediary accounts and manage their credentials
- Associate intermediaries with specific insurer companies
- Access all system-level settings and configurations
- **Configure renewal reminder windows and templates**
- View consolidated reports across all intermediaries

### 4.2 Intermediary (Agent User)

Each intermediary operates under the Riskmarshal umbrella and has scoped access limited to their own operations.

**Permissions include:**

- Add and manage their own clients
- Upload policy documents and trigger OCR extraction
- Send quotations to clients via email
- View and update payment status for their quotations
- View their own active policies
- **View upcoming renewals and mark policies as renewed**
- Manage leads assigned to them
- View their own basic operational data

**Restricted from:**

- Viewing revenue reports, commission data, and other financial metrics
- Accessing other intermediaries' clients, policies, or data
- Modifying system-level settings or insurer associations

### 4.3 Staff (Created by Admin)

Staff users are created by the Super Admin under a specific intermediary's account to assist with day-to-day operations.

**Permissions include:**

- Scoped to the intermediary they belong to
- Permissions are a subset of the intermediary role, as configured by the admin

---

## 5. Feature Specifications

### 5.1 Client Management

**Description:** Intermediaries can onboard new clients and maintain a structured digital record of each client's information and associated policies.

**Functional Requirements:**

| ID      | Requirement                                                                                                  | Priority |
| ------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| CM-01   | User can add a new client with fields: name, email, phone, address, date of birth, and any custom fields     | P0       |
| CM-02   | User can edit or update existing client information                                                           | P0       |
| CM-03   | User can view a client detail page showing all associated policies, quotations, **renewal history chain**, and communication history | P0 |
| CM-04   | User can search and filter clients by name, email, phone, or policy status                                   | P1       |
| CM-05   | Clients are scoped to their respective intermediary — intermediaries cannot see each other's clients          | P0       |
| CM-06   | Super Admin can view all clients across all intermediaries                                                    | P0       |

---

### 5.2 Policy Document Upload & OCR Extraction

**Description:** Users upload insurance policy documents (PDF/image), and the system uses Gemini OCR to extract structured data automatically, reducing manual data entry.

**Functional Requirements:**

| ID      | Requirement                                                                                                  | Priority |
| ------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| PD-01   | User can upload policy documents in PDF, JPEG, or PNG format                                                 | P0       |
| PD-02   | Uploaded documents are processed through **Google Gemini OCR** for automated data extraction                  | P0       |
| PD-03   | Extracted fields include (at minimum): policyholder name, policy number, insurer name, policy type, premium amount, coverage amount, start date, end date, and nominee details | P0 |
| PD-04   | User can review, edit, and confirm the extracted data before saving                                          | P0       |
| PD-05   | Confirmed data is saved in structured format in MongoDB and linked to the respective client                  | P0       |
| PD-06   | Original uploaded document is stored and accessible for download at any time                                 | P0       |
| PD-07   | System shows a confidence score or highlights low-confidence fields for manual review                        | P2       |

---

### 5.3 Quotation Management & Delivery

**Description:** After policy data is extracted or manually entered, the user can generate a quotation and send it to the client via email. Future support for WhatsApp delivery is planned.

**Functional Requirements:**

| ID      | Requirement                                                                                                  | Priority |
| ------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| QM-01   | User can generate a policy quotation from extracted/manual data                                              | P0       |
| QM-02   | Quotation includes: client details, insurer, policy type, premium, coverage, terms, and validity period      | P0       |
| QM-03   | User can send the quotation to the client via **email**                                                      | P0       |
| QM-04   | Sent quotations are logged with timestamp, delivery channel, and recipient details                           | P0       |
| QM-05   | Each quotation has a **payment status** field: `Pending`, `Paid`, `Expired`, `Cancelled`                     | P0       |
| QM-06   | User can manually update the payment status of a quotation                                                   | P0       |
| QM-07   | WhatsApp delivery support (via WhatsApp Business API) — **deferred to v2**                                   | P3       |

---

### 5.4 Payment Tracking & Alert Notifications

**Description:** The system tracks the payment status of every sent quotation. Until a quotation is marked as `Paid`, automated email alerts are sent to the user (intermediary) as reminders to follow up.

**Functional Requirements:**

| ID      | Requirement                                                                                                  | Priority |
| ------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| PT-01   | Every quotation starts with a default payment status of `Pending`                                            | P0       |
| PT-02   | System sends **automated email alerts** to the intermediary for all `Pending` quotations                     | P0       |
| PT-03   | Alerts are sent **twice daily**, with an **8-hour gap** between alerts (e.g., 9:00 AM and 5:00 PM)          | P0       |
| PT-04   | Alerts continue until the payment status is changed to `Paid`, `Expired`, or `Cancelled`                    | P0       |
| PT-05   | Alert email includes: client name, quotation details, amount pending, and number of days since quotation sent | P1      |
| PT-06   | User can view a list of all pending payments in a dedicated "Pending Payments" section on the dashboard      | P1       |
| PT-07   | Super Admin can view a consolidated pending payments view across all intermediaries                           | P1       |

**Technical Notes:**

- Implement using a **cron job** (e.g., `node-cron` or a scheduled task) running on the Express.js backend at configured intervals (every 8 hours).
- Email delivery via a transactional email service (e.g., Nodemailer with SMTP, SendGrid, or AWS SES).

---

### 5.5 Dashboard

**Description:** The dashboard is the primary landing page after login. It provides a role-appropriate overview of key metrics and quick-access navigation.

#### 5.5.1 Admin Dashboard

| ID      | Requirement                                                                                                  | Priority |
| ------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| DA-01   | Overview cards: total active policies, total clients, total pending payments, total revenue, total leads      | P0       |
| DA-02   | Commission summary per intermediary                                                                          | P0       |
| DA-03   | Revenue charts (monthly/quarterly/annual)                                                                    | P1       |
| DA-04   | Intermediary performance breakdown                                                                           | P1       |
| DA-05   | Recent activity feed (new clients, policies, payments)                                                       | P2       |
| DA-06   | **Upcoming Renewals widget** — policies expiring in next 30 days across all intermediaries, sorted by urgency with color-coded urgency bands (red ≤7d, orange ≤15d, yellow ≤30d) | P0 |
| DA-07   | **Renewal Health snapshot** — renewal rate vs lapse rate for current month                                   | P1       |

#### 5.5.2 Intermediary Dashboard

| ID      | Requirement                                                                                                  | Priority |
| ------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| DI-01   | Overview cards: my active policies, my clients, my pending payments, my leads                                | P0       |
| DI-02   | Quick actions: add client, upload policy, view pending payments                                              | P0       |
| DI-03   | Recent activity feed scoped to the intermediary's own data                                                   | P2       |
| DI-04   | **My Upcoming Renewals widget** — intermediary's policies expiring in next 30 days with color-coded urgency bands (red ≤7d, orange ≤15d, yellow ≤30d) | P0 |

---

### 5.6 Active Policies Tab

**Description:** A dedicated tab/section displaying all currently active insurance policies with filtering and search capabilities.

**Functional Requirements:**

| ID      | Requirement                                                                                                  | Priority |
| ------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| AP-01   | Display a list/table of all active policies (policies where `end_date > today`)                              | P0       |
| AP-02   | Columns: policy number, client name, insurer, policy type, premium, start date, end date, renewal status, status | P0   |
| AP-03   | Search by policy number, client name, or insurer                                                             | P1       |
| AP-04   | Filter by insurer, policy type, date range, renewal status                                                   | P1       |
| AP-05   | Click on a policy to view full details, original uploaded document, and **renewal history chain**             | P0       |
| AP-06   | Intermediaries see only their own policies; admin sees all                                                   | P0       |
| AP-07   | **Color-coded urgency indicators** for policies nearing expiry (red ≤7d, orange ≤15d, yellow ≤30d, green >30d) | P0    |
| AP-08   | Quick action button to **"Initiate Renewal"** directly from the policy row — opens the renewal workflow      | P0       |

---

### 5.7 Reports Tab

**Description:** A reporting module that allows the admin to generate and export various business reports. Intermediaries have no access to this section.

**Functional Requirements:**

| ID      | Requirement                                                                                                  | Priority |
| ------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| RP-01   | **Revenue Report** — total revenue generated, filterable by intermediary, insurer, date range                | P0       |
| RP-02   | **Commission Report** — commissions earned by each intermediary, filterable by date range and insurer        | P0       |
| RP-03   | **Policy Report** — total policies issued, active vs expired, breakdown by insurer and type                  | P1       |
| RP-04   | **Client Report** — new clients added over time, client distribution by intermediary                         | P1       |
| RP-05   | **Payment Report** — pending vs completed payments, average payment turnaround time                          | P1       |
| RP-06   | **Renewal Report** — renewal rate, lapse rate, avg days to renew, policies renewed vs lapsed, breakdown by intermediary and insurer | P0 |
| RP-07   | All reports can be exported to **CSV** and **PDF** formats                                                   | P1       |
| RP-08   | Reports are restricted to the **Super Admin role only**                                                      | P0       |

---

### 5.8 Insurer Management Tab

**Description:** A master list of all insurer companies that the intermediaries are associated with, along with the ability to map specific intermediaries to specific insurers.

**Functional Requirements:**

| ID      | Requirement                                                                                                  | Priority |
| ------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| IM-01   | Admin can add, edit, and deactivate insurer companies (e.g., IFFCO-TOKIO General Insurance)                 | P0       |
| IM-02   | Each insurer record includes: name, logo, contact details, and any relevant metadata                        | P0       |
| IM-03   | Admin can **associate/disassociate intermediaries with specific insurers**                                   | P0       |
| IM-04   | One intermediary can be associated with multiple insurers, and one insurer can have multiple intermediaries   | P0       |
| IM-05   | The association is reflected when the intermediary uploads policies — they can only select insurers they're mapped to | P1 |
| IM-06   | View a breakdown of intermediaries per insurer and insurers per intermediary                                 | P1       |

---

### 5.9 Commission Tracking

**Description:** The admin can track and manage commission payouts for each intermediary based on the policies they bring in. This data is strictly admin-only.

**Functional Requirements:**

| ID      | Requirement                                                                                                  | Priority |
| ------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| CT-01   | Admin can define commission rates per intermediary, per insurer, or per policy type                          | P0       |
| CT-02   | Commission is auto-calculated when a policy payment is marked as `Paid`                                     | P0       |
| CT-03   | Admin can view a commission ledger per intermediary with: policy details, premium, commission %, amount      | P0       |
| CT-04   | Admin can mark commissions as `Pending`, `Paid`, or `Withheld`                                              | P0       |
| CT-05   | Dashboard widget shows total commissions: paid vs pending                                                   | P1       |
| CT-06   | Commission data is **not visible** to intermediary or staff users                                            | P0       |

---

### 5.10 Lead Management

**Description:** Leads generated from the Riskmarshal website are captured into the platform and managed through a structured pipeline with the ability to convert a lead into a client.

**Functional Requirements:**

| ID      | Requirement                                                                                                  | Priority |
| ------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| LM-01   | Website leads are automatically captured into the system via an API endpoint or webhook                      | P0       |
| LM-02   | Lead record includes: name, email, phone, source (website), insurance type interest, message/notes, timestamp | P0      |
| LM-03   | Leads have status stages: `New` → `Contacted` → `In Discussion` → `Converted` → `Lost`                     | P0       |
| LM-04   | Admin can assign leads to specific intermediaries                                                            | P0       |
| LM-05   | Intermediaries can view and manage only leads assigned to them                                               | P0       |
| LM-06   | **Lead-to-Client Conversion:** When a lead is marked as `Converted`, the system prompts the user to create a client record pre-filled with the lead's data | P0 |
| LM-07   | Search and filter leads by status, assigned intermediary, date range, and insurance type                     | P1       |
| LM-08   | Lead activity log showing all interactions and status changes                                                | P2       |

---

### 5.11 Authentication & User Management

**Description:** Secure authentication system with role-based access and the ability for the admin to manage all user accounts.

**Functional Requirements:**

| ID      | Requirement                                                                                                  | Priority |
| ------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| AU-01   | Email and password-based authentication with JWT tokens                                                      | P0       |
| AU-02   | Role-based access control enforced at both the frontend (route guards) and backend (middleware)               | P0       |
| AU-03   | Super Admin can create intermediary accounts with credentials                                                | P0       |
| AU-04   | Super Admin can create staff accounts under specific intermediaries                                          | P0       |
| AU-05   | Password reset flow via email                                                                                | P1       |
| AU-06   | Account deactivation (soft delete) by admin                                                                  | P1       |
| AU-07   | Session timeout and auto-logout after inactivity                                                             | P2       |

---

### 5.12 Policy Renewal Reminders

**Description:** The system proactively tracks all policy expiration dates and triggers a multi-stage reminder workflow to ensure clients and intermediaries are notified well in advance. This prevents policy lapses, retains clients, and protects recurring revenue.

**Data Flow:** When a policy is saved (via OCR extraction or manual entry), the system reads the `end_date` and automatically schedules renewal reminders. The reminder engine (cron job) runs daily, evaluates all active policies against the configured reminder windows, and dispatches notifications to both the **client** (via email) and the **intermediary** (via in-app notification + email). If the policy is renewed, a new policy record is created and linked to the original, forming a renewal chain.

**Functional Requirements:**

| ID      | Requirement                                                                                                  | Priority |
| ------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| RR-01   | System automatically calculates and stores the renewal reminder schedule when a policy is created or confirmed | P0      |
| RR-02   | Configurable reminder windows: **60 days**, **30 days**, **15 days**, and **7 days** before policy expiry    | P0       |
| RR-03   | At each reminder window, an **email notification** is sent to the **client** with policy details, expiry date, and a call-to-action to contact their intermediary for renewal | P0 |
| RR-04   | At each reminder window, an **email + in-app notification** is sent to the **intermediary** listing the client, policy details, and days remaining until expiry | P0 |
| RR-05   | Admin can configure/customize the reminder window intervals globally (e.g., change 60/30/15/7 to other values) | P1      |
| RR-06   | Each policy has a `renewal_status` field: `Upcoming` → `Reminder Sent` → `Renewed` → `Lapsed`               | P0       |
| RR-07   | Intermediary can mark a policy as `Renewed` — this triggers the system to prompt for uploading the new renewed policy document | P0 |
| RR-08   | When a policy is renewed, the new policy is linked to the original via a `renewed_from_policy_id` field, creating a **renewal chain** for audit and history | P0 |
| RR-09   | If no action is taken by the `end_date`, the system automatically marks the policy as `Lapsed` and stops sending reminders | P0 |
| RR-10   | Dashboard widget: **"Upcoming Renewals"** showing policies expiring in the next 30 days, sorted by urgency  | P0       |
| RR-11   | Dedicated **"Renewals"** tab/section showing all policies in the renewal pipeline with status filters (`Upcoming`, `Reminder Sent`, `Renewed`, `Lapsed`) | P0 |
| RR-12   | Admin can view a consolidated renewal pipeline across all intermediaries                                     | P0       |
| RR-13   | Intermediaries see only their own policies in the renewal pipeline                                           | P0       |
| RR-14   | Renewal reminders include a **counter** showing how many reminders have been sent for a given policy         | P1       |
| RR-15   | Admin can manually trigger a renewal reminder for any policy at any time                                     | P1       |
| RR-16   | System logs every reminder sent (date, channel, recipient) in an auditable `reminder_history` array on the policy | P1 |
| RR-17   | **Renewal Report** — admin can generate a report showing: renewal rate, lapse rate, average days to renew, breakdown by intermediary and insurer | P1 |

**Renewal Lifecycle Flow:**

```
Policy Created (end_date extracted via OCR)
       │
       ▼
  Reminder Schedule Auto-Generated
  (60d, 30d, 15d, 7d before end_date)
       │
       ▼
  ┌─── Cron Job Runs Daily ───┐
  │                            │
  │  Checks all active         │
  │  policies against          │
  │  reminder windows          │
  └────────┬───────────────────┘
           │
     Window Hit?
     ┌─────┴─────┐
     │ YES       │ NO
     ▼           ▼
  Send Email    Skip
  to Client     (check
  + Email &     tomorrow)
  In-App to
  Intermediary
     │
     ▼
  Update renewal_status
  → "Reminder Sent"
     │
     ▼
  ┌──────────────────────────┐
  │  Intermediary Action      │
  ├──────────────────────────┤
  │  Mark as "Renewed"        │──→ Prompt to upload new policy
  │  → Links new policy to    │    document → OCR → save
  │    original (renewal      │    → new policy created with
  │    chain)                  │    renewed_from_policy_id
  ├──────────────────────────┤
  │  No action by end_date    │──→ Auto-mark as "Lapsed"
  │                            │    Stop reminders
  └──────────────────────────┘
```

**Technical Notes:**

- Renewal reminder cron job runs **once daily** (e.g., 8:00 AM) — separate from the payment alert cron (which runs every 8 hours). Both cron jobs can coexist in the same scheduler module.
- When computing reminders, use `end_date - today` to determine which window the policy falls into. Process each window only once per policy (track via `reminder_history`).
- The renewal chain (`renewed_from_policy_id`) enables the system to show a full history of a client's policy renewals over time on the client detail page.

---

## 6. System Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
│                     Next.js (Frontend)                        │
│          Dashboard · Forms · Tables · Reports UI             │
└──────────────────────┬───────────────────────────────────────┘
                       │ REST API Calls
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                       API LAYER                              │
│                   Express.js (Backend)                        │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │ Auth &      │  │ Business     │  │ Integrations        │ │
│  │ RBAC        │  │ Logic        │  │                     │ │
│  │ Middleware   │  │ Controllers  │  │ • Gemini OCR API    │ │
│  └─────────────┘  └──────────────┘  │ • Email Service     │ │
│                                      │ • Cron: Payment     │ │
│                                      │   Alerts (8hr)      │ │
│                                      │ • Cron: Renewal     │ │
│                                      │   Reminders (daily) │ │
│                                      │ • WhatsApp (v2)     │ │
│                                      └─────────────────────┘ │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                      DATA LAYER                              │
│                   MongoDB (Database)                          │
│                                                              │
│  Collections:                                                │
│  users · clients · policies · quotations · insurers          │
│  commissions · leads · renewal_config · notifications        │
│  activity_logs                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## 6.1 End-to-End Data Flow

The following illustrates how data flows through the entire system — from lead capture through policy lifecycle to renewal — showing how each feature connects to the next.

```
                        ┌─────────────────┐
                        │   WEBSITE LEAD   │
                        │  (via webhook)   │
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ LEAD MANAGEMENT  │
                        │ New → Contacted  │
                        │ → In Discussion  │
                        └────────┬────────┘
                                 │ Convert Lead
                                 ▼
                  ┌──────────────────────────────┐
                  │       CLIENT CREATED          │
                  │  (pre-filled from lead data)  │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │   POLICY DOCUMENT UPLOAD      │
                  │   (PDF/Image by intermediary) │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │      GEMINI OCR EXTRACTION    │
                  │  Extract: policy #, insurer,  │
                  │  premium, dates, nominee, etc │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │    REVIEW & CONFIRM DATA      │
                  │  (intermediary edits if needed)│
                  └──────────────┬───────────────┘
                                 │
                        ┌────────┴────────┐
                        │                 │
                        ▼                 ▼
              ┌──────────────┐  ┌──────────────────────┐
              │ POLICY SAVED │  │ RENEWAL SCHEDULE     │
              │ (MongoDB)    │  │ AUTO-GENERATED       │
              │              │  │ (60d/30d/15d/7d      │
              │              │  │  before end_date)    │
              └──────┬───────┘  └──────────────────────┘
                     │
                     ▼
              ┌──────────────┐
              │  QUOTATION   │
              │  GENERATED   │
              └──────┬───────┘
                     │
                     ▼
              ┌──────────────┐      ┌──────────────────┐
              │ SEND TO      │      │ PAYMENT ALERT    │
              │ CLIENT       │─────→│ CRON (every 8hr) │
              │ (via email)  │      │ Until status ≠   │
              └──────┬───────┘      │ Pending          │
                     │              └──────────────────┘
                     ▼
              ┌──────────────┐
              │ PAYMENT      │
              │ STATUS       │
              │ UPDATED      │
              │ → "Paid"     │
              └──────┬───────┘
                     │
              ┌──────┴───────┐
              │              │
              ▼              ▼
    ┌──────────────┐  ┌──────────────┐
    │ COMMISSION   │  │ POLICY NOW   │
    │ AUTO-CALC    │  │ ACTIVE       │
    │ (admin only) │  │              │
    └──────────────┘  └──────┬───────┘
                             │
                    ┌────────┴─────────┐
                    │  RENEWAL CRON    │
                    │  (runs daily)    │
                    │                  │
                    │  Checks end_date │
                    │  vs reminder     │
                    │  windows         │
                    └────────┬─────────┘
                             │
                    Window hit? ─── No ──→ (check tomorrow)
                             │
                            Yes
                             │
                    ┌────────┴─────────┐
                    │                  │
                    ▼                  ▼
          ┌──────────────┐   ┌──────────────────┐
          │ EMAIL TO     │   │ EMAIL + IN-APP   │
          │ CLIENT       │   │ TO INTERMEDIARY  │
          │ "Your policy │   │ "Client X's      │
          │  expires in  │   │  policy expires  │
          │  X days"     │   │  in X days"      │
          └──────────────┘   └──────────────────┘
                    │
                    ▼
          ┌──────────────────────────┐
          │   INTERMEDIARY ACTION    │
          ├──────────────────────────┤
          │  A) Mark "Renewed"       │──→ Upload new policy doc
          │     → Link to original   │    → OCR → Save
          │     (renewal chain)      │    → New quotation cycle
          │                          │      begins ↑ (loops back)
          ├──────────────────────────┤
          │  B) No action by expiry  │──→ Auto-mark "Lapsed"
          │     → Stop reminders     │
          └──────────────────────────┘
```

**Key Data Flow Connections:**

- **Lead → Client:** Lead conversion pre-fills client data, eliminating duplicate entry.
- **OCR → Policy + Renewal Schedule:** The moment a policy is confirmed, the `end_date` triggers automatic renewal schedule generation — no manual setup needed.
- **Payment → Commission:** When payment status flips to `Paid`, the commission engine auto-calculates the intermediary's commission based on configured rates.
- **Renewal → New Policy Cycle:** When a policy is renewed, the system creates a new policy linked to the original (`renewed_from_policy_id`), and the entire quotation → payment → commission cycle begins again, forming a continuous loop.
- **All paths → Dashboard & Reports:** Every status change (payment, renewal, lapse) feeds into the dashboard widgets and report generators in real-time.

---

## 7. Data Models (MongoDB Collections)

### 7.1 Users

```json
{
  "_id": "ObjectId",
  "name": "string",
  "email": "string",
  "password": "string (hashed)",
  "role": "enum: super_admin | intermediary | staff",
  "parent_intermediary_id": "ObjectId | null",
  "associated_insurers": ["ObjectId"],
  "is_active": "boolean",
  "created_at": "Date",
  "updated_at": "Date"
}
```

### 7.2 Clients

```json
{
  "_id": "ObjectId",
  "name": "string",
  "email": "string",
  "phone": "string",
  "address": "string",
  "date_of_birth": "Date",
  "intermediary_id": "ObjectId",
  "converted_from_lead": "ObjectId | null",
  "created_at": "Date",
  "updated_at": "Date"
}
```

### 7.3 Policies

```json
{
  "_id": "ObjectId",
  "policy_number": "string",
  "client_id": "ObjectId",
  "intermediary_id": "ObjectId",
  "insurer_id": "ObjectId",
  "policy_type": "string",
  "premium_amount": "number",
  "coverage_amount": "number",
  "start_date": "Date",
  "end_date": "Date",
  "nominee_details": "object",
  "status": "enum: active | expired | cancelled",
  "renewal_status": "enum: upcoming | reminder_sent | renewed | lapsed",
  "renewed_from_policy_id": "ObjectId | null",
  "renewed_to_policy_id": "ObjectId | null",
  "renewal_reminder_schedule": [
    {
      "days_before_expiry": "number",
      "scheduled_date": "Date",
      "sent": "boolean",
      "sent_at": "Date | null"
    }
  ],
  "reminder_history": [
    {
      "reminder_type": "enum: 60d | 30d | 15d | 7d | manual",
      "sent_to_client": "boolean",
      "sent_to_intermediary": "boolean",
      "sent_at": "Date",
      "channel": "enum: email | in_app"
    }
  ],
  "original_document_url": "string",
  "ocr_extracted_data": "object",
  "created_at": "Date",
  "updated_at": "Date"
}
```

### 7.4 Quotations

```json
{
  "_id": "ObjectId",
  "policy_id": "ObjectId",
  "client_id": "ObjectId",
  "intermediary_id": "ObjectId",
  "sent_via": "enum: email | whatsapp",
  "sent_at": "Date",
  "payment_status": "enum: pending | paid | expired | cancelled",
  "payment_updated_at": "Date | null",
  "alert_count": "number",
  "last_alert_sent_at": "Date | null",
  "created_at": "Date"
}
```

### 7.5 Insurers

```json
{
  "_id": "ObjectId",
  "name": "string",
  "logo_url": "string",
  "contact_details": "object",
  "associated_intermediaries": ["ObjectId"],
  "is_active": "boolean",
  "created_at": "Date",
  "updated_at": "Date"
}
```

### 7.6 Commissions

```json
{
  "_id": "ObjectId",
  "intermediary_id": "ObjectId",
  "policy_id": "ObjectId",
  "insurer_id": "ObjectId",
  "premium_amount": "number",
  "commission_rate": "number",
  "commission_amount": "number",
  "status": "enum: pending | paid | withheld",
  "paid_at": "Date | null",
  "created_at": "Date"
}
```

### 7.7 Leads

```json
{
  "_id": "ObjectId",
  "name": "string",
  "email": "string",
  "phone": "string",
  "source": "string",
  "insurance_type_interest": "string",
  "message": "string",
  "status": "enum: new | contacted | in_discussion | converted | lost",
  "assigned_intermediary_id": "ObjectId | null",
  "converted_client_id": "ObjectId | null",
  "activity_log": [
    {
      "action": "string",
      "performed_by": "ObjectId",
      "timestamp": "Date",
      "notes": "string"
    }
  ],
  "created_at": "Date",
  "updated_at": "Date"
}
```

### 7.8 Renewal Configuration

```json
{
  "_id": "ObjectId",
  "reminder_windows": [60, 30, 15, 7],
  "client_email_template": "string",
  "intermediary_email_template": "string",
  "cron_schedule": "string (e.g., '0 8 * * *')",
  "is_active": "boolean",
  "updated_by": "ObjectId",
  "updated_at": "Date"
}
```

**Note:** This is a singleton configuration document managed by the Super Admin. Default reminder windows are 60, 30, 15, and 7 days before policy expiry.

---

## 8. API Endpoints Overview

### Authentication

| Method | Endpoint               | Description              | Access         |
| ------ | ---------------------- | ------------------------ | -------------- |
| POST   | `/api/auth/login`      | User login               | Public         |
| POST   | `/api/auth/logout`     | User logout              | Authenticated  |
| POST   | `/api/auth/reset-password` | Password reset       | Public         |

### Users

| Method | Endpoint               | Description                          | Access      |
| ------ | ---------------------- | ------------------------------------ | ----------- |
| GET    | `/api/users`           | List all users                       | Admin       |
| POST   | `/api/users`           | Create intermediary or staff account | Admin       |
| PUT    | `/api/users/:id`       | Update user                          | Admin       |
| DELETE | `/api/users/:id`       | Deactivate user                      | Admin       |

### Clients

| Method | Endpoint               | Description                          | Access            |
| ------ | ---------------------- | ------------------------------------ | ----------------- |
| GET    | `/api/clients`         | List clients (scoped by role)        | Authenticated     |
| POST   | `/api/clients`         | Add new client                       | Intermediary+     |
| GET    | `/api/clients/:id`     | Get client details                   | Scoped            |
| PUT    | `/api/clients/:id`     | Update client                        | Scoped            |

### Policies

| Method | Endpoint                    | Description                     | Access            |
| ------ | --------------------------- | ------------------------------- | ----------------- |
| GET    | `/api/policies`             | List policies (scoped by role)  | Authenticated     |
| POST   | `/api/policies/upload`      | Upload document + trigger OCR   | Intermediary+     |
| POST   | `/api/policies/confirm`     | Confirm extracted data & save   | Intermediary+     |
| GET    | `/api/policies/:id`         | Get policy details              | Scoped            |
| GET    | `/api/policies/:id/renewal-history` | Get full renewal chain for a policy | Scoped      |
| GET    | `/api/policies/active`      | List active policies            | Scoped            |

### Quotations

| Method | Endpoint                         | Description                  | Access            |
| ------ | -------------------------------- | ---------------------------- | ----------------- |
| POST   | `/api/quotations`                | Generate & send quotation    | Intermediary+     |
| GET    | `/api/quotations`                | List quotations              | Scoped            |
| PUT    | `/api/quotations/:id/status`     | Update payment status        | Scoped            |
| GET    | `/api/quotations/pending`        | List pending quotations      | Scoped            |

### Insurers

| Method | Endpoint                              | Description                          | Access |
| ------ | ------------------------------------- | ------------------------------------ | ------ |
| GET    | `/api/insurers`                       | List all insurers                    | All    |
| POST   | `/api/insurers`                       | Add new insurer                      | Admin  |
| PUT    | `/api/insurers/:id`                   | Update insurer                       | Admin  |
| POST   | `/api/insurers/:id/associate`         | Associate intermediary with insurer  | Admin  |
| DELETE | `/api/insurers/:id/disassociate`      | Remove intermediary association      | Admin  |

### Commissions

| Method | Endpoint                         | Description                       | Access |
| ------ | -------------------------------- | --------------------------------- | ------ |
| GET    | `/api/commissions`               | List all commissions              | Admin  |
| POST   | `/api/commissions/configure`     | Set commission rates              | Admin  |
| PUT    | `/api/commissions/:id/status`    | Update commission payout status   | Admin  |

### Leads

| Method | Endpoint                      | Description                     | Access            |
| ------ | ----------------------------- | ------------------------------- | ----------------- |
| POST   | `/api/leads`                  | Capture new lead (webhook)      | Public/API Key    |
| GET    | `/api/leads`                  | List leads (scoped)             | Authenticated     |
| PUT    | `/api/leads/:id`              | Update lead status              | Scoped            |
| POST   | `/api/leads/:id/convert`      | Convert lead to client          | Intermediary+     |
| PUT    | `/api/leads/:id/assign`       | Assign lead to intermediary     | Admin             |

### Reports

| Method | Endpoint                      | Description                     | Access |
| ------ | ----------------------------- | ------------------------------- | ------ |
| GET    | `/api/reports/revenue`        | Revenue report                  | Admin  |
| GET    | `/api/reports/commissions`    | Commission report               | Admin  |
| GET    | `/api/reports/policies`       | Policy report                   | Admin  |
| GET    | `/api/reports/clients`        | Client report                   | Admin  |
| GET    | `/api/reports/payments`       | Payment report                  | Admin  |
| GET    | `/api/reports/renewals`       | Renewal report                  | Admin  |

### Renewals

| Method | Endpoint                              | Description                                      | Access            |
| ------ | ------------------------------------- | ------------------------------------------------ | ----------------- |
| GET    | `/api/renewals`                       | List policies in renewal pipeline (scoped)       | Authenticated     |
| GET    | `/api/renewals/upcoming`              | Policies expiring in next 30/60 days (scoped)    | Authenticated     |
| PUT    | `/api/renewals/:policyId/renew`       | Mark policy as renewed → triggers new policy upload flow | Intermediary+ |
| POST   | `/api/renewals/:policyId/remind`      | Manually trigger a renewal reminder              | Admin             |
| GET    | `/api/renewals/config`                | Get current renewal reminder configuration       | Admin             |
| PUT    | `/api/renewals/config`                | Update reminder windows and templates            | Admin             |

---

## 9. Non-Functional Requirements

| Category        | Requirement                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| **Performance** | Dashboard should load within 2 seconds. API response time under 500ms for standard queries.               |
| **Security**    | All passwords hashed with bcrypt. JWT-based auth with token expiry. RBAC enforced at API middleware level. |
| **Scalability** | Architecture should support up to 50 intermediaries and 5,000 clients without performance degradation.    |
| **Reliability** | Cron jobs (payment alerts + renewal reminders) must have retry logic and health monitoring. Failed email deliveries should be logged and retried. |
| **Data Backup** | MongoDB backups scheduled daily with 30-day retention.                                                    |
| **Compliance**  | Policy documents stored securely. Access restricted by role. Audit trail on sensitive operations.          |
| **Browser**     | Support for Chrome, Firefox, Safari, and Edge (latest 2 versions).                                       |

---

## 10. Third-Party Integrations

| Service               | Purpose                                   | Status       |
| --------------------- | ----------------------------------------- | ------------ |
| **Google Gemini API**  | OCR data extraction from policy documents | Integrated   |
| **Email Service**      | Transactional emails (quotations, alerts) | To configure |
| **WhatsApp Business API** | Quotation delivery via WhatsApp        | Deferred (v2)|

---

## 11. Priority & Phasing

### Phase 1 — Core Platform (MVP)

- Authentication & RBAC (super admin, intermediary, staff)
- Client management (CRUD)
- Policy upload + Gemini OCR extraction
- Quotation generation & email delivery
- Payment tracking with manual status updates
- Automated alert notifications (email, twice daily)
- **Policy renewal reminder system (automated multi-stage reminders)**
- **Renewals tab with renewal pipeline and status tracking**
- Active Policies tab with renewal status and urgency indicators
- Insurer management with intermediary association
- Basic dashboard (admin + intermediary views) with upcoming renewals widget

### Phase 2 — Business Intelligence & Leads

- Commission tracking & configuration
- Reports module (revenue, commission, policy, client, payment, **renewal**)
- Lead management with website integration
- Lead-to-client conversion flow
- CSV/PDF export for reports
- Renewal configuration panel (admin can customize reminder windows)

### Phase 3 — Enhancements

- WhatsApp Business API integration for quotation delivery and renewal reminders
- OCR confidence scoring and smart field highlighting
- Advanced analytics and intermediary performance scoring
- Activity logs and audit trails
- Smart renewal predictions (flag high-risk lapses based on historical data)

---

## 12. Risks & Mitigations

| Risk                                                    | Impact | Mitigation                                                                         |
| ------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------- |
| Gemini OCR inaccuracy on non-standard document formats  | High   | Mandatory human review step before saving. Iterative prompt tuning for extraction. |
| Email alerts marked as spam                             | Medium | Use verified domain, SPF/DKIM/DMARC setup. Use reputable email service provider.  |
| Data breach or unauthorized access                      | High   | JWT + RBAC + encrypted storage. Regular security audits.                           |
| WhatsApp API approval delays                            | Low    | Deferred to Phase 3. Email is primary channel for MVP.                             |
| Intermediary sees another intermediary's data            | High   | Strict scoping at the API middleware level with intermediary ID checks.            |
| Renewal reminders ignored or lost in client inbox       | Medium | Multi-stage reminders (60/30/15/7 days). In-app notifications for intermediaries. Admin can manually trigger reminders. |
| Cron job failure causes missed reminders                | High   | Implement health-check monitoring on cron jobs. Retry logic with failure logging. Alerting to admin on consecutive failures. |

---

## 13. Open Questions

| #  | Question                                                                                              | Status   |
| -- | ----------------------------------------------------------------------------------------------------- | -------- |
| 1  | What specific email service provider will be used (SendGrid, AWS SES, Nodemailer + SMTP)?            | Open     |
| 2  | Should there be a client-facing portal where clients can view their own policies?                     | Open     |
| 3  | Are there specific report templates or formats the admin prefers?                                     | Open     |
| 4  | ~~Should policy renewal reminders be automated?~~                                                    | Resolved — Yes, included as a core feature (Section 5.12) |
| 5  | Is there a specific file storage solution for uploaded documents (AWS S3, GCS, local)?               | Open     |
| 6  | What is the exact commission structure — flat rate, percentage, or tiered?                            | Open     |
| 7  | Should renewal reminder emails to clients include a direct payment/renewal link, or just a CTA to contact their intermediary? | Open |
| 8  | Should the system support auto-renewal for certain policy types, or is all renewal intermediary-initiated? | Open |
| 9  | Should lapsed policies trigger a re-engagement email to the client after a configurable grace period? | Open     |

---

## 14. Glossary

| Term             | Definition                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| **Riskmarshal**  | The legal umbrella entity under which multiple insurance intermediaries operate.                     |
| **Intermediary** | An individual insurance agent operating under Riskmarshal, associated with one or more insurers.    |
| **Insurer**      | The insurance company that underwrites the policy (e.g., IFFCO-TOKIO General Insurance).            |
| **Policy**       | An insurance contract between the insurer and the client, facilitated by the intermediary.          |
| **Quotation**    | A formal quote sent to a client detailing premium, coverage, and terms for a proposed policy.       |
| **Lead**         | A potential client who has expressed interest via the Riskmarshal website.                           |
| **OCR**          | Optical Character Recognition — technology used to extract text from scanned/image documents.       |
| **RBAC**         | Role-Based Access Control — a method of restricting access based on user roles.                     |
| **Renewal Chain**| A linked sequence of policy records where each renewed policy references its predecessor via `renewed_from_policy_id`, enabling full renewal history tracking. |
| **Lapsed Policy**| A policy that has passed its expiry date without being renewed by the client/intermediary.           |

---

*End of Document*
